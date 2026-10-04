import os
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple

import numpy as np
import pandas as pd
import joblib

from dotenv import load_dotenv
import httpx

load_dotenv()

logger = logging.getLogger("weather_forecast_24h_engine")
logging.basicConfig(level=logging.INFO)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "weather")
MODEL_PATH = os.path.join(MODELS_DIR, "best_hurdle_model.keras")
FULL_SCALER_PATH = os.path.join(MODELS_DIR, "full_scaler.pkl")
TARGET_SCALER_PATH = os.path.join(MODELS_DIR, "target_scaler (1).pkl")

_MODEL = None
_FULL_SCALER = None
_TARGET_SCALER = None

def load_scalers():
    global _FULL_SCALER, _TARGET_SCALER
    if _FULL_SCALER is not None and _TARGET_SCALER is not None:
        return _FULL_SCALER, _TARGET_SCALER

    _FULL_SCALER = joblib.load(FULL_SCALER_PATH)
    _TARGET_SCALER = joblib.load(TARGET_SCALER_PATH)
    return _FULL_SCALER, _TARGET_SCALER

def load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    import tensorflow as tf
    _MODEL = tf.keras.models.load_model(MODEL_PATH, compile=False)
    return _MODEL

def parse_iso_datetime(ts_str: str) -> datetime:
    clean_str = ts_str.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(clean_str)
    except Exception:
        return datetime.strptime(ts_str[:19], "%Y-%m-%dT%H:%M:%S")

COMPASS_TO_DEG = {
    "N": 0, "NNE": 22.5, "NE": 45, "ENE": 67.5, "E": 90, "ESE": 112.5, "SE": 135, "SSE": 157.5,
    "S": 180, "SSW": 202.5, "SW": 225, "WSW": 247.5, "W": 270, "WNW": 292.5, "NW": 315, "NNW": 337.5,
    "NORTH": 0, "NORTHEAST": 45, "EAST": 90, "SOUTHEAST": 135,
    "SOUTH": 180, "SOUTHWEST": 225, "WEST": 270, "NORTHWEST": 315,
}

def _wind_dir_to_degrees(value) -> float:
    """Wind direction may be numeric degrees or a compass name like 'Southwest'."""
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        key = str(value).strip().upper().replace(" ", "").replace("-", "")
        return float(COMPASS_TO_DEG.get(key, 0.0))

def prepare_input_matrix(rows_chrono: List[Dict[str, Any]]) -> Tuple[np.ndarray, datetime]:
    fs, _ = load_scalers()
    df = pd.DataFrame(rows_chrono)
    
    # Base features
    df['temperature_c'] = pd.to_numeric(df['temperature'], errors='coerce').fillna(25.0)
    df['humidity_percent'] = pd.to_numeric(df['humidity'], errors='coerce').fillna(50.0)
    df['wind_speed_kmh'] = pd.to_numeric(df['wind_speed'], errors='coerce').fillna(5.0)
    
    rain = pd.to_numeric(df.get('rain_gauge', df.get('rain', pd.Series([0.0]*len(df)))), errors='coerce').fillna(0.0)
    df['rainfall_log'] = np.log1p(rain)
    
    wind_dir = df['wind_direction'].map(_wind_dir_to_degrees) if 'wind_direction' in df else pd.Series([0.0]*len(df))
    rad = np.radians(wind_dir)
    df['wind_u'] = -df['wind_speed_kmh'] * np.sin(rad)
    df['wind_v'] = -df['wind_speed_kmh'] * np.cos(rad)
    
    df['wind_gust_kmh'] = pd.to_numeric(df.get('wind_gust', df.get('gust', df['wind_speed_kmh'])), errors='coerce').fillna(df['wind_speed_kmh'])
    
    # Dew point approximation
    df['dew_point'] = df['temperature_c'] - ((100.0 - df['humidity_percent']) / 5.0)
    
    # Time features
    timestamps = []
    latest_dt = datetime.now(timezone.utc)
    for i, r in df.iterrows():
        ts_str = r.get("timestamp_hour") or r.get("created_at") or r.get("timestamp")
        dt = parse_iso_datetime(ts_str) if ts_str else latest_dt
        timestamps.append(dt)
        latest_dt = dt
    
    hours = np.array([dt.hour for dt in timestamps])
    doys = np.array([dt.timetuple().tm_yday for dt in timestamps])
    
    df['sin_hour'] = np.sin(2 * np.pi * hours / 24.0)
    df['cos_hour'] = np.cos(2 * np.pi * hours / 24.0)
    df['sin_doy'] = np.sin(2 * np.pi * doys / 365.25)
    df['cos_doy'] = np.cos(2 * np.pi * doys / 365.25)
    
    # Rolling features
    df['temperature_c_roll6'] = df['temperature_c'].rolling(6, min_periods=1).mean()
    df['temperature_c_roll24'] = df['temperature_c'].rolling(24, min_periods=1).mean()
    
    df['humidity_percent_roll6'] = df['humidity_percent'].rolling(6, min_periods=1).mean()
    df['humidity_percent_roll24'] = df['humidity_percent'].rolling(24, min_periods=1).mean()
    
    df['wind_speed_kmh_roll6'] = df['wind_speed_kmh'].rolling(6, min_periods=1).mean()
    df['wind_speed_kmh_roll24'] = df['wind_speed_kmh'].rolling(24, min_periods=1).mean()
    
    df['rainfall_log_roll6'] = df['rainfall_log'].rolling(6, min_periods=1).mean()
    df['rainfall_log_roll24'] = df['rainfall_log'].rolling(24, min_periods=1).mean()
    
    feature_cols = [
        'temperature_c', 'humidity_percent', 'wind_speed_kmh', 'rainfall_log',
        'wind_u', 'wind_v', 'wind_gust_kmh', 'dew_point', 'sin_hour', 'cos_hour',
        'sin_doy', 'cos_doy', 'temperature_c_roll6', 'temperature_c_roll24',
        'humidity_percent_roll6', 'humidity_percent_roll24', 'wind_speed_kmh_roll6',
        'wind_speed_kmh_roll24', 'rainfall_log_roll6', 'rainfall_log_roll24'
    ]
    
    X = df[feature_cols].values
    X_scaled = fs.transform(X)
    
    # We only need the last sequence
    # Let's see the sequence length dynamically, assuming 24 or 48.
    # We will slice the last 'n' rows during inference based on model input shape.
    return X_scaled, latest_dt

def run_inference(input_matrix: np.ndarray, latest_dt: datetime) -> List[Dict[str, Any]]:
    fs, ts = load_scalers()
    model = load_model()
    
    # model.input_shape is usually (None, seq_len, features)
    seq_len = model.input_shape[1]
    if seq_len is None:
        seq_len = 24
        
    if len(input_matrix) < seq_len:
        # Pad with first row if necessary
        pad = np.tile(input_matrix[0], (seq_len - len(input_matrix), 1))
        input_matrix = np.vstack([pad, input_matrix])
        
    X_seq = input_matrix[-seq_len:]
    reshaped_x = np.expand_dims(X_seq, axis=0) # (1, seq_len, 20)
    
    raw_pred = model.predict(reshaped_x, verbose=0)
    
    # Hurdle model outputs: [regression (1, 24, 4), rain probability (1, 24, 1)]
    rain_prob = None
    if isinstance(raw_pred, (list, tuple)):
        if len(raw_pred) > 1:
            rain_prob = np.asarray(raw_pred[1]).reshape(-1)
        raw_pred = raw_pred[0]
        
    if len(raw_pred.shape) == 3:
        pred_2d = raw_pred[0] # (24, 4)
    else:
        # If it's (1, 24*4)
        pred_2d = raw_pred.reshape(-1, 4)
        
    forecast_results = []
    IST = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(IST)
    base_time = latest_dt.astimezone(IST).replace(minute=0, second=0, microsecond=0)
    
    out_len = len(pred_2d)
    
    # unscale
    unscaled_preds = ts.inverse_transform(pred_2d)

    # Bias correction for distribution shift (sensor data hotter/drier than training data):
    # shift temperature (col 0) and humidity (col 1) so the 24h forecast mean matches the
    # mean of the last 24 observed hours. The model's hour-to-hour shape is preserved.
    if os.getenv("WEATHER_BIAS_CORRECTION", "1") != "0":
        recent_obs = fs.inverse_transform(input_matrix[-24:])  # cols: temperature_c, humidity_percent, ...
        for col in (0, 1):
            offset = float(np.mean(recent_obs[:, col]) - np.mean(unscaled_preds[:, col]))
            unscaled_preds[:, col] = unscaled_preds[:, col] + offset
            logger.info("Weather bias correction col=%d offset=%+.2f", col, offset)
    
    for step in range(1, out_len + 1):
        future_time = base_time + timedelta(hours=step)
        iso_str = future_time.isoformat()
        
        row_vals = unscaled_preds[step - 1]
        
        temp_val = round(float(row_vals[0]), 2)
        hum_val = round(max(0.0, min(100.0, float(row_vals[1]))), 2)
        wind_val = round(max(0.0, float(row_vals[2])), 2)
        # Rain target is log1p-scaled; hurdle gate zeroes hours predicted dry (prob < 0.5)
        rain_val = round(max(0.0, float(np.expm1(row_vals[3]))), 2)
        if rain_prob is not None and step - 1 < len(rain_prob) and float(rain_prob[step - 1]) < 0.5:
            rain_val = 0.0
        
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
    SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")).rstrip('/')
    if "/rest/v1" in SUPABASE_URL:
        SUPABASE_URL = SUPABASE_URL.rsplit("/rest/v1", 1)[0]
    
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""))
    if not SUPABASE_URL or not SUPABASE_KEY:
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

    url = f"{SUPABASE_URL}/rest/v1/weather_forecasts_24h?on_conflict=node_id,forecast_for_time"
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
                try:
                    from urllib.parse import quote
                    del_url = f"{SUPABASE_URL}/rest/v1/weather_forecasts_24h?node_id=eq.node_1&forecast_generated_at=lt.{quote(generated_at, safe='')}"
                    await client.delete(del_url, headers=headers)
                except Exception:
                    pass
                return {"synced": True, "count": len(payload)}
            else:
                return {"synced": False, "status": res.status_code, "detail": res.text}
    except Exception as e:
        return {"synced": False, "error": str(e)}

_LATEST_FORECAST_CACHE: Optional[Dict[str, Any]] = None
_CACHE_TIMESTAMP: Optional[datetime] = None
_INFERENCE_LOCK: Optional[asyncio.Lock] = None

def _get_inference_lock() -> asyncio.Lock:
    global _INFERENCE_LOCK
    if _INFERENCE_LOCK is None:
        _INFERENCE_LOCK = asyncio.Lock()
    return _INFERENCE_LOCK

async def get_or_generate_weather_forecast_24h(force: bool = False) -> Dict[str, Any]:
    global _LATEST_FORECAST_CACHE, _CACHE_TIMESTAMP
    now = datetime.now(timezone.utc)
    lock = _get_inference_lock()

    if not force and _LATEST_FORECAST_CACHE is not None and _CACHE_TIMESTAMP is not None:
        age = (now - _CACHE_TIMESTAMP).total_seconds()
        if age < 1800:
            return _LATEST_FORECAST_CACHE

    async with lock:
        from services.supabase_service import get_weather_history
        rows_desc = await get_weather_history(limit=168)
        
        if len(rows_desc) < 2:
            return {"status": "error", "message": "Not enough weather data"}

        rows_chrono = list(reversed(rows_desc))
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
