import os
import math
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple

import numpy as np
import joblib
import httpx
from dotenv import load_dotenv

load_dotenv()

# Force PyTorch backend for Keras 3
os.environ["KERAS_BACKEND"] = "torch"
import keras

logger = logging.getLogger("forecast_engine")
logging.basicConfig(level=logging.INFO)

# Base Paths & Artifacts Config
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTIFACTS_DIR_NAME = os.getenv("ARTIFACTS_DIR", "AQI-prediction-new")
ARTIFACTS_DIR = os.path.join(BASE_DIR, ARTIFACTS_DIR_NAME)

SCALER_X_PATH = os.path.join(ARTIFACTS_DIR, "scaler_X.save")
SCALER_Y_PATH = os.path.join(ARTIFACTS_DIR, "scaler_y.save")

# Supabase Config
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://sgkdpliqlhgiqsabxzxe.supabase.co").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SOURCE_AQI_TABLE = os.getenv("SOURCE_AQI_TABLE", "AQI_NODE1")
DEST_FORECAST_TABLE = os.getenv("DEST_FORECAST_TABLE", "aqi_forecasts_24h")
NODE_ID = os.getenv("NODE_ID", "node_1")
WIND_SPEED_BASELINE = float(os.getenv("WIND_SPEED_BASELINE", "7.86"))

# Available Model Tiers (Lookback in hours)
TIER_WINDOWS = [168, 144, 120, 96, 72, 48, 24]

# Runtime Caches
_MODEL_CACHE: Dict[int, Any] = {}
_SCALER_X: Optional[Any] = None
_SCALER_Y: Optional[Any] = None


def load_scalers():
    """Loads and caches scaler_X and scaler_y."""
    global _SCALER_X, _SCALER_Y
    if _SCALER_X is not None and _SCALER_Y is not None:
        return _SCALER_X, _SCALER_Y

    if not os.path.exists(SCALER_X_PATH):
        raise FileNotFoundError(f"Feature scaler not found at: {SCALER_X_PATH}")
    if not os.path.exists(SCALER_Y_PATH):
        raise FileNotFoundError(f"Target scaler not found at: {SCALER_Y_PATH}")

    _SCALER_X = joblib.load(SCALER_X_PATH)
    _SCALER_Y = joblib.load(SCALER_Y_PATH)
    logger.info("Loaded scalers from %s", ARTIFACTS_DIR)
    return _SCALER_X, _SCALER_Y


def load_model_for_tier(lookback_hours: int):
    """Lazy-loads and caches the Keras Seq2Seq model for the chosen lookback tier."""
    global _MODEL_CACHE
    if lookback_hours in _MODEL_CACHE:
        return _MODEL_CACHE[lookback_hours]

    model_filename = f"model_tier_{lookback_hours}h.keras"
    model_path = os.path.join(ARTIFACTS_DIR, model_filename)
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model tier file not found: {model_path}")

    logger.info("Loading model tier %dh from %s...", lookback_hours, model_path)
    model = keras.saving.load_model(model_path)
    _MODEL_CACHE[lookback_hours] = model
    return model


# CPCB India Standard Breakpoints: [C_lo, C_hi, I_lo, I_hi]
CPCB_BREAKPOINTS = {
    "pm25": [(0.0, 30.0, 0, 50), (30.0, 60.0, 51, 100), (60.0, 90.0, 101, 200), (90.0, 120.0, 201, 300), (120.0, 250.0, 301, 400), (250.0, 500.0, 401, 500)],
    "pm10": [(0.0, 50.0, 0, 50), (50.0, 100.0, 51, 100), (100.0, 250.0, 101, 200), (250.0, 350.0, 201, 300), (350.0, 430.0, 301, 400), (430.0, 600.0, 401, 500)],
    "co":   [(0.0, 1.0, 0, 50), (1.0, 2.0, 51, 100), (2.0, 10.0, 101, 200), (10.0, 17.0, 201, 300), (17.0, 34.0, 301, 400), (34.0, 50.0, 401, 500)],
    "no2":  [(0.0, 40.0, 0, 50), (40.0, 80.0, 51, 100), (80.0, 180.0, 101, 200), (180.0, 280.0, 201, 300), (280.0, 400.0, 301, 400), (400.0, 500.0, 401, 500)],
    "o3":   [(0.0, 50.0, 0, 50), (50.0, 100.0, 51, 100), (100.0, 168.0, 101, 200), (168.0, 208.0, 201, 300), (208.0, 748.0, 301, 400), (748.0, 1000.0, 401, 500)],
}


def sub_index(pollutant_key: str, cp: Optional[float]) -> float:
    """Computes CPCB linear sub-index."""
    if cp is None or pollutant_key not in CPCB_BREAKPOINTS:
        return 0.0
    val = max(0.0, float(cp))
    tiers = CPCB_BREAKPOINTS[pollutant_key]
    for c_lo, c_hi, i_lo, i_hi in tiers:
        if val <= c_hi:
            return round(max(0.0, ((i_hi - i_lo) / (c_hi - c_lo)) * (val - c_lo) + i_lo), 1)
    c_lo, c_hi, i_lo, i_hi = tiers[-1]
    return round(min(500.0, max(0.0, ((i_hi - i_lo) / (c_hi - c_lo)) * (val - c_lo) + i_lo)), 1)


def get_cpcb_category(aqi_val: int) -> Tuple[str, str]:
    """Returns qualitative label and color code."""
    if aqi_val <= 50:
        return "Good", "#10b981"
    elif aqi_val <= 100:
        return "Satisfactory", "#84cc16"
    elif aqi_val <= 200:
        return "Moderate", "#f59e0b"
    elif aqi_val <= 300:
        return "Poor", "#f97316"
    elif aqi_val <= 400:
        return "Very Poor", "#ef4444"
    else:
        return "Severe", "#8b5cf6"


def compute_cyclical_features(dt: datetime) -> Tuple[float, float, float, float]:
    """Computes hour_sin, hour_cos, month_sin, month_cos."""
    hour = dt.hour
    month = dt.month
    hour_sin = math.sin(2.0 * math.pi * hour / 24.0)
    hour_cos = math.cos(2.0 * math.pi * hour / 24.0)
    month_sin = math.sin(2.0 * math.pi * month / 12.0)
    month_cos = math.cos(2.0 * math.pi * month / 12.0)
    return hour_sin, hour_cos, month_sin, month_cos


def parse_iso_datetime(ts_str: str) -> datetime:
    """Safely parses timestamp string to datetime object."""
    clean_str = ts_str.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(clean_str)
    except Exception:
        return datetime.strptime(ts_str[:19], "%Y-%m-%dT%H:%M:%S")


async def fetch_source_rows(limit: int = 168) -> List[Dict[str, Any]]:
    """
    Queries up to 168 records ordered descending by timestamp_hour from AQI_NODE1.
    """
    url = f"{SUPABASE_URL}/rest/v1/{SOURCE_AQI_TABLE}?order=timestamp_hour.desc&limit={limit}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.get(url, headers=headers)
        if res.status_code != 200:
            raise RuntimeError(f"Failed to fetch data from Supabase table {SOURCE_AQI_TABLE}: {res.status_code} - {res.text}")
        rows = res.json()

    if not rows:
        raise ValueError(f"No records found in source table {SOURCE_AQI_TABLE}")

    return rows


def verify_continuity_and_select_tier(rows_desc: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
    """
    Walks backward from the newest record to verify that adjacent timestamps have an exact 1-hour delta.
    Counts unbroken consecutive hours N:
      - N < 24: Halt (insufficient data).
      - 24 <= N < 48: 24h tier
      - 48 <= N < 72: 48h tier
      - 72 <= N < 96: 72h tier
      - 96 <= N < 120: 96h tier
      - 120 <= N < 144: 120h tier
      - 144 <= N < 168: 144h tier
      - N >= 168: 168h tier
    Returns the chronological slice of rows matching the selected tier and the lookback hours.
    """
    if not rows_desc:
        raise ValueError("Cannot verify continuity on empty dataset.")

    # Walk backward from the newest record
    continuous_rows_desc = [rows_desc[0]]
    prev_dt = parse_iso_datetime(rows_desc[0].get("timestamp_hour") or rows_desc[0].get("created_at") or rows_desc[0].get("timestamp"))

    for r in rows_desc[1:]:
        curr_dt = parse_iso_datetime(r.get("timestamp_hour") or r.get("created_at") or r.get("timestamp"))
        delta = prev_dt - curr_dt
        # Verify delta is approximately 1 hour (allow small 60s tolerance for clock drift)
        if abs(delta.total_seconds() - 3600.0) <= 60.0:
            continuous_rows_desc.append(r)
            prev_dt = curr_dt
        else:
            logger.info("Continuity broken between %s and %s (delta=%.1fs)", prev_dt.isoformat(), curr_dt.isoformat(), delta.total_seconds())
            break

    N = len(continuous_rows_desc)
    logger.info("Detected %d unbroken consecutive hourly records in %s.", N, SOURCE_AQI_TABLE)

    if N < 24:
        raise ValueError(f"Insufficient continuous historical data: required at least 24 hours, found {N} hours.")

    # Select highest viable tier
    selected_tier = 24
    for tier in TIER_WINDOWS:
        if N >= tier:
            selected_tier = tier
            break

    logger.info("Selected model tier: %dh (continuous hours available: %d)", selected_tier, N)

    # Slice the newest `selected_tier` records and reverse to chronological order (t - lookback + 1 -> t)
    tier_rows_desc = continuous_rows_desc[:selected_tier]
    tier_rows_chrono = list(reversed(tier_rows_desc))

    return tier_rows_chrono, selected_tier


def prepare_tiered_input_matrix(rows_chrono: List[Dict[str, Any]]) -> Tuple[np.ndarray, datetime]:
    """
    Prepares (lookback, 12) matrix from chronological rows:
    Features: pm2_5_ug_m3, pm10_ug_m3, no2_ug_m3, co_mg_m3, ozone_ug_m3, temperature_c, humidity_pct,
              wind_speed_kmh (imputed with 7.86), hour_sin, hour_cos, month_sin, month_cos.
    """
    data_rows = []
    latest_dt = None

    for r in rows_chrono:
        ts_str = r.get("timestamp_hour") or r.get("created_at") or r.get("timestamp")
        dt = parse_iso_datetime(ts_str) if ts_str else datetime.now(timezone.utc)
        latest_dt = dt

        h_sin, h_cos, m_sin, m_cos = compute_cyclical_features(dt)

        pm25_val = float(r.get("pm2.5") if "pm2.5" in r else r.get("pm25", 0.0) or 0.0)
        pm10_val = float(r.get("pm10", 0.0) or 0.0)
        no2_val = float(r.get("no2", 0.0) or 0.0)
        co_val = float(r.get("co", 0.0) or 0.0)
        o3_val = float(r.get("o3", 0.0) or 0.0)
        temp_val = float(r.get("temperature", 25.0) or 25.0)
        hum_val = float(r.get("humidity", 50.0) or 50.0)

        raw_wind = r.get("wind_speed")
        wind_val = float(raw_wind) if raw_wind is not None else WIND_SPEED_BASELINE

        feature_vector = [
            pm25_val,
            pm10_val,
            no2_val,
            co_val,
            o3_val,
            temp_val,
            hum_val,
            wind_val,
            h_sin,
            h_cos,
            m_sin,
            m_cos
        ]
        data_rows.append(feature_vector)

    input_matrix = np.array(data_rows, dtype=np.float32)
    return input_matrix, (latest_dt or datetime.now(timezone.utc))


def run_tiered_inference(input_matrix: np.ndarray, selected_tier: int, latest_dt: datetime) -> List[Dict[str, Any]]:
    """
    Scales input using scaler_X, reshapes to (1, selected_tier, 12), runs prediction on model_tier_{tier}h.keras,
    inverse transforms outputs using scaler_y, and calculates CPCB sub-indices for t+1 to t+24.
    """
    scaler_x, scaler_y = load_scalers()
    model = load_model_for_tier(selected_tier)

    # Scale inputs
    scaled_x = scaler_x.transform(input_matrix)
    reshaped_x = scaled_x.reshape(1, selected_tier, 12)

    # Predict (1, 24, 7)
    raw_pred = model.predict(reshaped_x, verbose=0)
    pred_2d = raw_pred.reshape(24, 7)

    # Inverse transform targets to physical units
    unscaled_pred = scaler_y.inverse_transform(pred_2d)

    forecast_results = []
    base_time = latest_dt.replace(minute=0, second=0, microsecond=0)

    for step in range(1, 25):
        future_time = base_time + timedelta(hours=step)
        iso_str = future_time.isoformat()

        row_vals = unscaled_pred[step - 1]
        pm25_val = round(max(0.0, float(row_vals[0])), 2)
        pm10_val = round(max(0.0, float(row_vals[1])), 2)
        no2_val = round(max(0.0, float(row_vals[2])), 2)
        co_val = round(max(0.0, float(row_vals[3])), 3)
        o3_val = round(max(0.0, float(row_vals[4])), 2)
        temp_val = round(float(row_vals[5]), 2)
        hum_val = round(min(100.0, max(0.0, float(row_vals[6]))), 2)

        sub_pm25 = sub_index("pm25", pm25_val)
        sub_pm10 = sub_index("pm10", pm10_val)
        sub_no2 = sub_index("no2", no2_val)
        sub_co = sub_index("co", co_val)
        sub_o3 = sub_index("o3", o3_val)

        sub_indices = {
            "pm25": sub_pm25,
            "pm10": sub_pm10,
            "no2": sub_no2,
            "co": sub_co,
            "o3": sub_o3
        }

        dominant_key = max(sub_indices, key=lambda k: sub_indices[k])
        dominant_label_map = {
            "pm25": "PM2.5",
            "pm10": "PM10",
            "no2": "NO₂",
            "co": "CO",
            "o3": "O₃"
        }
        cpcb_aqi = int(round(sub_indices[dominant_key]))
        category_label, category_color = get_cpcb_category(cpcb_aqi)

        forecast_results.append({
            "step": step,
            "forecast_for_time": iso_str,
            "aqi": cpcb_aqi,
            "cpcb_aqi": cpcb_aqi,
            "tier_used": f"{selected_tier}h",
            "aqi_category": category_label,
            "aqi_color": category_color,
            "dominant_pollutant": dominant_label_map[dominant_key],
            "dominant_pollutant_key": dominant_key,
            "sub_indices": sub_indices,
            "pm2_5_ug_m3": pm25_val,
            "pm10_ug_m3": pm10_val,
            "no2_ug_m3": no2_val,
            "co_mg_m3": co_val,
            "ozone_ug_m3": o3_val,
            "temperature_c": temp_val,
            "humidity_pct": hum_val
        })

    return forecast_results


async def upsert_forecasts_to_supabase(forecast_records: List[Dict[str, Any]], generated_at: str, tier_used: str) -> Dict[str, Any]:
    """
    Upserts the 24 forecast items into the destination table (aqi_forecasts_24h).
    """
    payload = [
        {
            "node_id": NODE_ID,
            "forecast_for_time": item["forecast_for_time"],
            "forecast_generated_at": generated_at,
            "tier_used": tier_used,
            "pm2_5_ug_m3": item["pm2_5_ug_m3"],
            "pm10_ug_m3": item["pm10_ug_m3"],
            "no2_ug_m3": item["no2_ug_m3"],
            "co_mg_m3": item["co_mg_m3"],
            "ozone_ug_m3": item["ozone_ug_m3"],
            "temperature_c": item["temperature_c"],
            "humidity_pct": item["humidity_pct"]
        }
        for item in forecast_records
    ]

    url = f"{SUPABASE_URL}/rest/v1/{DEST_FORECAST_TABLE}?on_conflict=node_id,forecast_for_time"
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
                logger.info("Successfully synced %d forecast records (%s) to %s", len(payload), tier_used, DEST_FORECAST_TABLE)
                return {"synced": True, "count": len(payload), "tier_used": tier_used, "status": res.status_code}
            else:
                logger.warning("Supabase upsert status %d: %s", res.status_code, res.text)
                return {"synced": False, "status": res.status_code, "detail": res.text}
    except Exception as e:
        logger.warning("Error during Supabase destination sync: %s", str(e))
        return {"synced": False, "error": str(e)}


async def run_24h_forecast() -> Dict[str, Any]:
    """
    Full execution pipeline:
    1. Ingest up to 168 rows from AQI_NODE1.
    2. Check 1-hour continuity backward and pick highest viable model tier (24h -> 168h).
    3. Prepare input matrix and run inference on selected Seq2Seq LSTM tier.
    4. Upsert forecast records (t+1 -> t+24) to aqi_forecasts_24h in Supabase.
    """
    rows_desc = await fetch_source_rows(limit=168)
    rows_chrono, selected_tier = verify_continuity_and_select_tier(rows_desc)
    input_matrix, latest_dt = prepare_tiered_input_matrix(rows_chrono)
    forecast_records = run_tiered_inference(input_matrix, selected_tier, latest_dt)

    generated_at = datetime.now(timezone.utc).isoformat()
    tier_label = f"{selected_tier}h"
    sync_result = await upsert_forecasts_to_supabase(forecast_records, generated_at, tier_label)

    return {
        "status": "success",
        "node_id": NODE_ID,
        "source_table": SOURCE_AQI_TABLE,
        "latest_input_timestamp": latest_dt.isoformat(),
        "generated_at": generated_at,
        "detected_continuous_hours": len(rows_chrono),
        "selected_tier": tier_label,
        "count": len(forecast_records),
        "sync_status": sync_result,
        "forecast": forecast_records
    }


if __name__ == "__main__":
    import asyncio
    print("Executing standalone test run of Tiered Seq2Seq 24-Hour Forecasting Engine...")
    result = asyncio.run(run_24h_forecast())
    print("\n================ PIPELINE EXECUTION SUMMARY ================")
    print("Status:", result["status"])
    print("Detected Continuous Hours:", result["detected_continuous_hours"])
    print("Selected Model Tier:", result["selected_tier"])
    print("Latest Input Timestamp:", result["latest_input_timestamp"])
    print("Supabase Sync Status:", result["sync_status"])
    print("\n--- FIRST 5 FORECASTED HOURLY ROWS (t+1 to t+5) ---")
    for item in result["forecast"][:5]:
        dom_clean = str(item['dominant_pollutant']).encode('ascii', 'ignore').decode('ascii')
        print(f"Step +{item['step']}h ({item['forecast_for_time']}): AQI={item['aqi']} ({item['aqi_category']}) | Dominant={dom_clean} | Tier={item['tier_used']} | PM2.5={item['pm2_5_ug_m3']} | PM10={item['pm10_ug_m3']} | Temp={item['temperature_c']}C | Hum={item['humidity_pct']}%")

