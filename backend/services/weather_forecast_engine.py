import os
import math
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple

import numpy as np
import joblib
import torch
import torch.nn as nn
import torch.nn.functional as F

from dotenv import load_dotenv
import httpx

load_dotenv()

logger = logging.getLogger("weather_forecast_engine")
logging.basicConfig(level=logging.INFO)

# Base Paths & Artifacts Config
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "weather_prediction-files")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "multikernel_cnn_lstm_24h_168h.pth")
SCALERS_PATH = os.path.join(ARTIFACTS_DIR, "scalers.pkl")

# Runtime Caches
_MODEL = None
_FEATURE_SCALER = None
_RAINFALL_SCALER = None

class MultiKernelCNNLSTM(nn.Module):
    def __init__(self, input_size=11, output_size=4, hidden_size=128):
        super(MultiKernelCNNLSTM, self).__init__()
        self.conv3 = nn.Conv1d(in_channels=input_size, out_channels=32, kernel_size=3, padding=1)
        self.conv5 = nn.Conv1d(in_channels=input_size, out_channels=32, kernel_size=5, padding=2)
        self.conv7 = nn.Conv1d(in_channels=input_size, out_channels=32, kernel_size=7, padding=3)
        self.bn = nn.BatchNorm1d(96)
        self.lstm = nn.LSTM(input_size=96, hidden_size=hidden_size, num_layers=2, batch_first=True)
        self.fc = nn.Linear(hidden_size, 168 * output_size)
        self.output_size = output_size
        
    def forward(self, x):
        # x is (batch, seq, features) -> Conv1d expects (batch, channels, seq)
        x = x.transpose(1, 2)
        c3 = F.relu(self.conv3(x))
        c5 = F.relu(self.conv5(x))
        c7 = F.relu(self.conv7(x))
        c = torch.cat([c3, c5, c7], dim=1)
        c = self.bn(c)
        c = c.transpose(1, 2)
        
        lstm_out, _ = self.lstm(c)
        last_out = lstm_out[:, -1, :]
        out = self.fc(last_out)
        out = out.view(-1, 168, self.output_size)
        return out

def load_scalers():
    global _FEATURE_SCALER, _RAINFALL_SCALER
    if _FEATURE_SCALER is not None and _RAINFALL_SCALER is not None:
        return _FEATURE_SCALER, _RAINFALL_SCALER

    if not os.path.exists(SCALERS_PATH):
        raise FileNotFoundError(f"Scalers not found at: {SCALERS_PATH}")

    scalers = joblib.load(SCALERS_PATH)
    _FEATURE_SCALER = scalers['feature_scaler']
    _RAINFALL_SCALER = scalers['rainfall_scaler']
    logger.info("Loaded weather scalers")
    return _FEATURE_SCALER, _RAINFALL_SCALER

def load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    logger.info("Loading PyTorch model from %s...", MODEL_PATH)
    state = torch.load(MODEL_PATH, map_location='cpu', weights_only=False)
    
    _MODEL = MultiKernelCNNLSTM(input_size=11, output_size=4, hidden_size=128)
    _MODEL.load_state_dict(state['model_state_dict'])
    _MODEL.eval()
    
    return _MODEL

def compute_cyclical_features(dt: datetime) -> Tuple[float, float, float, float, float, float]:
    hour = dt.hour
    day = dt.day
    month = dt.month
    
    hour_sin = math.sin(2.0 * math.pi * hour / 24.0)
    hour_cos = math.cos(2.0 * math.pi * hour / 24.0)
    day_sin = math.sin(2.0 * math.pi * day / 31.0)
    day_cos = math.cos(2.0 * math.pi * day / 31.0)
    month_sin = math.sin(2.0 * math.pi * month / 12.0)
    month_cos = math.cos(2.0 * math.pi * month / 12.0)
    
    return hour_sin, hour_cos, day_sin, day_cos, month_sin, month_cos

def parse_iso_datetime(ts_str: str) -> datetime:
    clean_str = ts_str.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(clean_str)
    except Exception:
        return datetime.strptime(ts_str[:19], "%Y-%m-%dT%H:%M:%S")

def prepare_input_matrix(rows_chrono: List[Dict[str, Any]]) -> Tuple[np.ndarray, datetime]:
    fs, rs = load_scalers()
    data_rows = []
    latest_dt = None

    for r in rows_chrono:
        ts_str = r.get("timestamp_hour") or r.get("created_at") or r.get("timestamp")
        dt = parse_iso_datetime(ts_str) if ts_str else datetime.now(timezone.utc)
        latest_dt = dt

        h_sin, h_cos, d_sin, d_cos, m_sin, m_cos = compute_cyclical_features(dt)

        temp_val = float(r.get("temperature", 25.0) or 25.0)
        hum_val = float(r.get("humidity", 50.0) or 50.0)
        
        raw_wind = r.get("wind_speed")
        wind_val = float(raw_wind) if raw_wind is not None else 5.0
        
        raw_gust = r.get("wind_gust") or r.get("gust")
        gust_val = float(raw_gust) if raw_gust is not None else wind_val
        
        rain_val = float(r.get("rain_gauge", 0.0) or r.get("rain", 0.0) or 0.0)

        # Scale features
        scaled_f = fs.transform(np.array([[temp_val, hum_val, wind_val, gust_val]]))[0]
        scaled_r = rs.transform(np.array([[rain_val]]))[0]

        feature_vector = [
            scaled_f[0],
            scaled_f[1],
            scaled_f[2],
            scaled_f[3],
            scaled_r[0],
            h_sin,
            h_cos,
            d_sin,
            d_cos,
            m_sin,
            m_cos
        ]
        data_rows.append(feature_vector)

    input_matrix = np.array(data_rows, dtype=np.float32)
    return input_matrix, (latest_dt or datetime.now(timezone.utc))

def run_inference(input_matrix: np.ndarray, latest_dt: datetime) -> List[Dict[str, Any]]:
    fs, rs = load_scalers()
    model = load_model()

    # Shape to (1, 24, 11)
    reshaped_x = torch.tensor(input_matrix).unsqueeze(0)

    with torch.no_grad():
        raw_pred = model(reshaped_x)
    
    # (168, 4)
    pred_2d = raw_pred.squeeze(0).numpy()

    forecast_results = []
    
    IST = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(IST)
    
    base_time = latest_dt.astimezone(IST).replace(minute=0, second=0, microsecond=0)

    for step in range(1, 169):
        future_time = base_time + timedelta(hours=step)
        iso_str = future_time.isoformat()

        row_vals = pred_2d[step - 1]
        
        temp_unscaled = float((row_vals[0] - fs.min_[0]) / fs.scale_[0])
        hum_unscaled = float((row_vals[1] - fs.min_[1]) / fs.scale_[1])
        wind_unscaled = float((row_vals[2] - fs.min_[2]) / fs.scale_[2])
        rain_unscaled = float((row_vals[3] - rs.min_[0]) / rs.scale_[0])

        temp_val = round(temp_unscaled, 2)
        hum_val = round(max(0.0, min(100.0, hum_unscaled)), 2)
        wind_val = round(max(0.0, wind_unscaled), 2)
        rain_val = round(max(0.0, rain_unscaled), 2)

        forecast_results.append({
            "step": step,
            "forecast_for_time": iso_str,
            "temperature": temp_val,
            "humidity": hum_val,
            "wind_speed": wind_val,
            "rain_gauge": rain_val
        })

    return forecast_results

async def upsert_weather_forecasts_to_supabase(forecast_records: List[Dict[str, Any]], generated_at: str) -> Dict[str, Any]:
    """
    Upserts the 168 forecast items into the destination table (weather_forecasts_168h).
    """
    SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")).rstrip('/')
    if "/rest/v1" in SUPABASE_URL:
        SUPABASE_URL = SUPABASE_URL.rsplit("/rest/v1", 1)[0]
    
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""))
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("Supabase credentials missing. Skipping weather forecast sync.")
        return {"synced": False, "error": "missing_credentials"}

    payload = [
        {
            "node_id": "node_1",
            "forecast_for_time": item["forecast_for_time"],
            "forecast_generated_at": generated_at,
            "temperature": item["temperature"],
            "humidity": item["humidity"],
            "wind_speed": item["wind_speed"],
            "rain_gauge": item["rain_gauge"]
        }
        for item in forecast_records
    ]

    url = f"{SUPABASE_URL}/rest/v1/weather_forecasts_168h?on_conflict=node_id,forecast_for_time"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code in (200, 201):
                logger.info("Successfully synced %d weather forecast records to weather_forecasts_168h", len(payload))
                try:
                    del_url = f"{SUPABASE_URL}/rest/v1/weather_forecasts_168h?node_id=eq.node_1&forecast_generated_at=lt.{generated_at}"
                    await client.delete(del_url, headers=headers)
                except Exception as del_err:
                    logger.debug("Prune of older weather forecast batches notice: %s", del_err)
                return {"synced": True, "count": len(payload), "status": res.status_code}
            else:
                logger.warning("Supabase weather upsert status %d: %s", res.status_code, res.text)
                return {"synced": False, "status": res.status_code, "detail": res.text}
    except Exception as e:
        logger.warning("Error during Supabase destination sync for weather: %s", str(e))
        return {"synced": False, "error": str(e)}

_LATEST_FORECAST_CACHE: Optional[Dict[str, Any]] = None
_CACHE_TIMESTAMP: Optional[datetime] = None
_INFERENCE_LOCK: Optional[asyncio.Lock] = None

def _get_inference_lock() -> asyncio.Lock:
    global _INFERENCE_LOCK
    if _INFERENCE_LOCK is None:
        _INFERENCE_LOCK = asyncio.Lock()
    return _INFERENCE_LOCK

async def get_or_generate_weather_forecast(force: bool = False) -> Dict[str, Any]:
    global _LATEST_FORECAST_CACHE, _CACHE_TIMESTAMP
    now = datetime.now(timezone.utc)
    lock = _get_inference_lock()

    if not force and _LATEST_FORECAST_CACHE is not None and _CACHE_TIMESTAMP is not None:
        age = (now - _CACHE_TIMESTAMP).total_seconds()
        if age < 1800:
            return _LATEST_FORECAST_CACHE

    async with lock:
        from services.supabase_service import get_weather_history
        rows_desc = await get_weather_history(limit=24)
        
        if len(rows_desc) < 24:
            # Need exactly 24 or will pad
            logger.warning("Weather history less than 24h, padding with latest.")
            if len(rows_desc) > 0:
                rows_desc = rows_desc + [rows_desc[-1]] * (24 - len(rows_desc))
            else:
                return {"status": "error", "message": "No weather data"}

        rows_chrono = list(reversed(rows_desc[:24]))
        input_matrix, latest_dt = prepare_input_matrix(rows_chrono)
        
        forecast_records = await asyncio.to_thread(run_inference, input_matrix, latest_dt)
        
        generated_at = now.isoformat()
        
        sync_result = await upsert_weather_forecasts_to_supabase(forecast_records, generated_at)
        
        result = {
            "status": "success",
            "generated_at": generated_at,
            "latest_input_timestamp": latest_dt.isoformat(),
            "count": len(forecast_records),
            "sync_status": sync_result,
            "forecast": forecast_records
        }
        
        _LATEST_FORECAST_CACHE = result
        _CACHE_TIMESTAMP = now
        return result
