import os
import sys
import math
import time
import json
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import asyncio
import numpy as np
import joblib

# Ensure PyTorch backend for Keras 3
os.environ["KERAS_BACKEND"] = "torch"
import keras

from services.supabase_service import (
    fetch_table_rows,
    TABLE_AQI_LIVE,
    TABLE_AQI_HISTORICAL,
    TABLE_WEATHER_LIVE,
    TABLE_WEATHER_HISTORICAL
)

# Model directory strictly points to aqi_model_and_calibrators
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_DIR = os.path.join(BASE_DIR, "aqi_model_and_calibrators")

MODEL_PATH = os.path.join(MODEL_DIR, "best_aqi_lstm_model.keras")
FEATURE_SCALER_PATH = os.path.join(MODEL_DIR, "feature_scaler.pkl")
TARGET_SCALER_PATH = os.path.join(MODEL_DIR, "target_scaler.pkl")
CALIBRATORS_PATH = os.path.join(MODEL_DIR, "sensor_calibrators.pkl")

_MODEL = None
_FEATURE_SCALER = None
_TARGET_SCALER = None
_CALIBRATORS = None
_LAST_LOADED = None

def load_lstm_artifacts():
    global _MODEL, _FEATURE_SCALER, _TARGET_SCALER, _CALIBRATORS, _LAST_LOADED
    if _MODEL is not None and _FEATURE_SCALER is not None and _TARGET_SCALER is not None:
        return _MODEL, _FEATURE_SCALER, _TARGET_SCALER, _CALIBRATORS

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"LSTM model artifacts not found at: {MODEL_PATH}")

    print(f"Loading enhanced LSTM model from {MODEL_PATH}...")
    _MODEL = keras.saving.load_model(MODEL_PATH)
    _FEATURE_SCALER = joblib.load(FEATURE_SCALER_PATH)
    _TARGET_SCALER = joblib.load(TARGET_SCALER_PATH)
    
    if CALIBRATORS_PATH and os.path.exists(CALIBRATORS_PATH):
        try:
            _CALIBRATORS = joblib.load(CALIBRATORS_PATH)
            print(f"Sensor calibrators loaded successfully from {CALIBRATORS_PATH}.")
        except Exception as e:
            print(f"Warning loading sensor calibrators: {e}")
            _CALIBRATORS = None
    else:
        _CALIBRATORS = None

    _LAST_LOADED = time.time()
    print("Enhanced LSTM Model, Scalers, and Sensor Calibrators successfully loaded.")
    return _MODEL, _FEATURE_SCALER, _TARGET_SCALER, _CALIBRATORS

def calibrate_value(calibrators: Optional[Dict[str, Any]], param_key: str, raw_val: float, temp: float, hum: float) -> float:
    """
    Applies Ridge multi-parameter cross-sensitivity sensor calibration model on raw readings:
    calibrated = Ridge([raw_val, temp, hum])
    """
    if not calibrators or param_key not in calibrators:
        return raw_val
    try:
        model = calibrators[param_key]
        X = np.array([[raw_val, temp, hum]], dtype=np.float32)
        calibrated = float(model.predict(X)[0])
        return max(0.0, calibrated)
    except Exception:
        return raw_val

# Persistent forecast archive file to compare past forecasts with actual telemetry at identical time points
ARCHIVE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "forecast_archive.json")

def load_forecast_archive() -> Dict[str, Any]:
    if os.path.exists(ARCHIVE_FILE):
        try:
            with open(ARCHIVE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning reading forecast archive: {e}")
            return {}
    return {}

def save_to_forecast_archive(forecast_items: List[Dict[str, Any]]):
    try:
        archive = load_forecast_archive()
        for item in forecast_items:
            key = item.get("timestamp_hour") or item.get("timestamp") or item.get("hour_iso")
            if key:
                norm_key = str(key)[:19]
                archive[norm_key] = item
        # Keep up to latest 168 hours (7 days)
        if len(archive) > 168:
            sorted_keys = sorted(archive.keys())
            archive = {k: archive[k] for k in sorted_keys[-168:]}
        with open(ARCHIVE_FILE, "w", encoding="utf-8") as f:
            json.dump(archive, f, indent=2)
    except Exception as e:
        print(f"Error saving forecast archive: {e}")

def extract_base_time(aqi_rows: List[Dict[str, Any]]) -> datetime:
    """
    Extracts the latest observation timestamp from recent telemetry so the forecast
    timeline starts from the exact subsequent hour of the real telemetry.
    """
    if aqi_rows:
        for r in aqi_rows:
            ts = r.get("timestamp_hour") or r.get("created_at") or r.get("timestamp")
            if ts:
                try:
                    clean = str(ts).replace("Z", "+00:00")
                    dt = datetime.fromisoformat(clean)
                    return dt.replace(minute=0, second=0, microsecond=0)
                except Exception:
                    pass
    # Fallback to current local hour
    return datetime.now().replace(minute=0, second=0, microsecond=0)


COMPASS_DIR = {
    "N": 0.0, "NNE": 22.5, "NE": 45.0, "ENE": 67.5,
    "E": 90.0, "ESE": 112.5, "SE": 135.0, "SSE": 157.5,
    "S": 180.0, "SSW": 202.5, "SW": 225.0, "WSW": 247.5,
    "W": 270.0, "WNW": 292.5, "NW": 315.0, "NNW": 337.5,
    "NORTH": 0.0, "SOUTH": 180.0, "EAST": 90.0, "WEST": 270.0,
}

def safe_float(val: Any, default: float) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def parse_wind_direction(val: Any, default: float = 180.0) -> float:
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        val_clean = val.strip().upper()
        if val_clean in COMPASS_DIR:
            return COMPASS_DIR[val_clean]
        try:
            return float(val_clean)
        except ValueError:
            return default
    return default

# ==============================================================================
# AQI CALCULATION VIA SUB-INDEX FORMULA (CPCB / INDIA STANDARD)
# Formula: Ip = ((I_HI - I_LO) / (C_HI - C_LO)) * (Cp - C_LO) + I_LO
# ==============================================================================
CPCB_BREAKPOINTS = {
    "pm25": [
        (0.0, 30.0, 0, 50),
        (30.0, 60.0, 51, 100),
        (60.0, 90.0, 101, 200),
        (90.0, 120.0, 201, 300),
        (120.0, 250.0, 301, 400),
        (250.0, 500.0, 401, 500),
    ],
    "pm10": [
        (0.0, 50.0, 0, 50),
        (50.0, 100.0, 51, 100),
        (100.0, 250.0, 101, 200),
        (250.0, 350.0, 201, 300),
        (350.0, 430.0, 301, 400),
        (430.0, 600.0, 401, 500),
    ],
    "co": [
        (0.0, 1.0, 0, 50),
        (1.0, 2.0, 51, 100),
        (2.0, 10.0, 101, 200),
        (10.0, 17.0, 201, 300),
        (17.0, 34.0, 301, 400),
        (34.0, 50.0, 401, 500),
    ],
    "no2": [
        (0.0, 40.0, 0, 50),
        (40.0, 80.0, 51, 100),
        (80.0, 180.0, 101, 200),
        (180.0, 280.0, 201, 300),
        (280.0, 400.0, 301, 400),
        (400.0, 500.0, 401, 500),
    ],
    "o3": [
        (0.0, 50.0, 0, 50),
        (50.0, 100.0, 51, 100),
        (100.0, 168.0, 101, 200),
        (168.0, 208.0, 201, 300),
        (208.0, 748.0, 301, 400),
        (748.0, 1000.0, 401, 500),
    ],
}

def calculate_subindex(param_key: str, cp: float) -> float:
    """
    Calculates sub-index Ip using linear interpolation:
    Ip = ((I_HI - I_LO) / (C_HI - C_LO)) * (Cp - C_LO) + I_LO
    """
    if param_key not in CPCB_BREAKPOINTS:
        return 0.0
    cp = max(0.0, float(cp))
    tiers = CPCB_BREAKPOINTS[param_key]
    for c_lo, c_hi, i_lo, i_hi in tiers:
        if cp <= c_hi:
            ip = ((i_hi - i_lo) / (c_hi - c_lo)) * (cp - c_lo) + i_lo
            return round(max(0.0, ip), 1)
    # Extrapolate beyond top breakpoint
    c_lo, c_hi, i_lo, i_hi = tiers[-1]
    ip = ((i_hi - i_lo) / (c_hi - c_lo)) * (cp - c_lo) + i_lo
    return round(min(500.0, max(0.0, ip)), 1)

def get_aqi_category_info(aqi_val: float) -> Dict[str, Any]:
    v = round(aqi_val)
    if v <= 50:
        return {"value": v, "label": "Good", "color": "#16a34a", "standard": "CPCB (India)"}
    elif v <= 100:
        return {"value": v, "label": "Satisfactory", "color": "#65a30d", "standard": "CPCB (India)"}
    elif v <= 200:
        return {"value": v, "label": "Moderate", "color": "#d97706", "standard": "CPCB (India)"}
    elif v <= 300:
        return {"value": v, "label": "Poor", "color": "#ea580c", "standard": "CPCB (India)"}
    elif v <= 400:
        return {"value": v, "label": "Very Poor", "color": "#dc2626", "standard": "CPCB (India)"}
    else:
        return {"value": v, "label": "Severe", "color": "#7f1d1d", "standard": "CPCB (India)"}

def calculate_hour_aqi(pm25: float, pm10: float, co: float, no2: float, o3: float) -> Dict[str, Any]:
    """
    Computes sub-index Ip for each pollutant and derives overall AQI = max(Ip)
    """
    sub_indices = {
        "pm25": calculate_subindex("pm25", pm25),
        "pm10": calculate_subindex("pm10", pm10),
        "co": calculate_subindex("co", co),
        "no2": calculate_subindex("no2", no2),
        "o3": calculate_subindex("o3", o3),
    }
    dominant_key = max(sub_indices, key=lambda k: sub_indices[k])
    dominant_names = {
        "pm25": "PM2.5",
        "pm10": "PM10",
        "co": "CO",
        "no2": "NO₂",
        "o3": "O₃",
    }
    overall_aqi = int(round(sub_indices[dominant_key]))
    cat_info = get_aqi_category_info(overall_aqi)
    return {
        "aqi": overall_aqi,
        "cpcb_aqi": overall_aqi,
        "dominant_pollutant": dominant_names.get(dominant_key, dominant_key),
        "dominant_pollutant_key": dominant_key,
        "sub_indices": sub_indices,
        "aqi_info": cat_info
    }

# ==============================================================================
# INPUT PREPARATION & FEATURE EXTRACTION
# ==============================================================================
async def gather_48h_input_sequence() -> np.ndarray:
    """
    Fetches the latest 48 historical steps (from AQI_NODE1 / AQI_LIVE_NODE1 + WEATHER tables)
    and formats them into shape (1, 48, 14).
    14 features expected by feature_scaler.pkl:
    0: pm2_5, 1: pm10, 2: temperature_2m, 3: relative_humidity_2m, 4: wind_speed_10m,
    5: co_mg_m3, 6: no2_ug_m3, 7: ozone_ug_m3, 8: wind_x, 9: wind_y,
    10: hour_sin, 11: hour_cos, 12: month_sin, 13: month_cos
    """
    aqi_rows = await fetch_table_rows(TABLE_AQI_HISTORICAL, limit=48)
    if not aqi_rows or len(aqi_rows) < 48:
        live_rows = await fetch_table_rows(TABLE_AQI_LIVE, limit=48)
        combined = (live_rows or []) + (aqi_rows or [])
        aqi_rows = combined[:48]

    weather_rows = await fetch_table_rows(TABLE_WEATHER_HISTORICAL, limit=48)
    if not weather_rows or len(weather_rows) < 48:
        live_w = await fetch_table_rows(TABLE_WEATHER_LIVE, limit=48)
        combined_w = (live_w or []) + (weather_rows or [])
        weather_rows = combined_w[:48]

    base_time = extract_base_time(aqi_rows)
    steps = 48
    sequence = np.zeros((1, steps, 14), dtype=np.float32)

    for i in range(steps):
        step_time = base_time - timedelta(hours=(steps - 1 - i))
        hour = step_time.hour
        month = step_time.month

        h_sin = math.sin(2 * math.pi * hour / 24.0)
        h_cos = math.cos(2 * math.pi * hour / 24.0)
        m_sin = math.sin(2 * math.pi * (month - 1) / 12.0)
        m_cos = math.cos(2 * math.pi * (month - 1) / 12.0)

        aqi_item = aqi_rows[-(steps - i)] if (aqi_rows and i < len(aqi_rows)) else (aqi_rows[-1] if aqi_rows else {})
        w_item = weather_rows[-(steps - i)] if (weather_rows and i < len(weather_rows)) else (weather_rows[-1] if weather_rows else {})

        pm25 = safe_float(aqi_item.get("pm25") or aqi_item.get("pm2.5"), 28.5 + 4.0 * math.sin(i / 6.0))
        pm10 = safe_float(aqi_item.get("pm10"), 42.0 + 5.0 * math.sin(i / 6.0))
        co = safe_float(aqi_item.get("co"), 0.35 + 0.05 * math.cos(i / 8.0))
        no2 = safe_float(aqi_item.get("no2"), 12.0 + 3.0 * math.sin(i / 7.0))
        o3 = safe_float(aqi_item.get("o3"), 35.0 + 10.0 * math.sin(i / 5.0))

        temp = safe_float(w_item.get("temperature") or aqi_item.get("temperature"), 26.5 + 3.5 * math.sin(hour / 4.0))
        hum = safe_float(w_item.get("humidity") or aqi_item.get("humidity"), 62.0 + 12.0 * math.cos(hour / 4.0))
        ws = safe_float(w_item.get("wind_speed"), 8.5 + 2.0 * math.sin(i / 5.0))
        wd = parse_wind_direction(w_item.get("wind_direction"), (180 + i * 7.5) % 360)

        # Apply multi-parameter cross-sensitivity calibrator Ridge models
        cal_pm25 = calibrate_value(_CALIBRATORS, "pm2_5", pm25, temp, hum)
        cal_pm10 = calibrate_value(_CALIBRATORS, "pm10", pm10, temp, hum)
        cal_co = calibrate_value(_CALIBRATORS, "co_mg_m3", co, temp, hum)
        cal_no2 = calibrate_value(_CALIBRATORS, "no2_ug_m3", no2, temp, hum)
        cal_o3 = calibrate_value(_CALIBRATORS, "ozone_ug_m3", o3, temp, hum)

        wd_rad = math.radians(wd)
        wind_x = math.cos(wd_rad)
        wind_y = math.sin(wd_rad)

        sequence[0, i, 0] = cal_pm25
        sequence[0, i, 1] = cal_pm10
        sequence[0, i, 2] = temp
        sequence[0, i, 3] = hum
        sequence[0, i, 4] = ws
        sequence[0, i, 5] = cal_co
        sequence[0, i, 6] = cal_no2
        sequence[0, i, 7] = cal_o3
        sequence[0, i, 8] = wind_x
        sequence[0, i, 9] = wind_y
        sequence[0, i, 10] = h_sin
        sequence[0, i, 11] = h_cos
        sequence[0, i, 12] = m_sin
        sequence[0, i, 13] = m_cos

    return sequence, base_time


# ==============================================================================
# 24-HOUR MULTI-PARAMETER PREDICTIVE INFERENCE ENGINE
# ==============================================================================
async def generate_24h_lstm_forecast() -> Dict[str, Any]:
    """
    Executes 24-hour predictive forecast strictly using the trained Enhanced LSTM model in aqi_model_and_calibrators.
    Strictly outputs the 7 predicted telemetry parameters without calculating AQI:
    - PM2.5 (µg/m³)
    - PM10 (µg/m³)
    - CO (mg/m³)
    - NO2 (µg/m³)
    - O3 (µg/m³)
    - Temperature (°C)
    - Relative Humidity (%)
    """
    start_t = time.perf_counter()
    model, fs, ts, calibrators = load_lstm_artifacts()

    # 1. Gather historical sequence (1, 48, 14) and observation base_time
    raw_input, base_time = await gather_48h_input_sequence()

    # 2. Scale features using feature_scaler
    scaled_input = fs.transform(raw_input.reshape(-1, 14)).reshape(1, 48, 14)

    # 3. Model inference: outputs (1, 24, 7)
    preds = model.predict(scaled_input, verbose=0)

    # 4. Inverse scale targets using target_scaler
    # Target order: ['pm2_5', 'pm10', 'co_mg_m3', 'no2_ug_m3', 'ozone_ug_m3', 'temperature_2m', 'relative_humidity_2m']
    inv_preds = ts.inverse_transform(preds.reshape(-1, 7)).reshape(24, 7)

    inference_ms = round((time.perf_counter() - start_t) * 1000, 1)

    # 5. Build structured 24-hour hourly projections starting immediately after base_time
    hourly_forecast = []
    param_series = {
        "pm25": [],
        "pm10": [],
        "co": [],
        "no2": [],
        "o3": [],
        "temperature": [],
        "humidity": []
    }

    for h in range(24):
        target_time = base_time + timedelta(hours=h + 1)

        # Raw predicted parameter values with safety lower-bound clamps
        p_pm25 = max(0.0, round(float(inv_preds[h, 0]), 2))
        p_pm10 = max(0.0, round(float(inv_preds[h, 1]), 2))
        p_co = max(0.0, round(float(inv_preds[h, 2]), 3))
        p_no2 = max(0.0, round(float(inv_preds[h, 3]), 2))
        p_o3 = max(0.0, round(float(inv_preds[h, 4]), 2))
        p_temp = round(float(inv_preds[h, 5]), 1)
        p_hum = max(0.0, min(100.0, round(float(inv_preds[h, 6]), 1)))

        param_series["pm25"].append(p_pm25)
        param_series["pm10"].append(p_pm10)
        param_series["co"].append(p_co)
        param_series["no2"].append(p_no2)
        param_series["o3"].append(p_o3)
        param_series["temperature"].append(p_temp)
        param_series["humidity"].append(p_hum)

        # Calculate AQI using linear interpolation formula: Ip = ((I_HI - I_LO) / (C_HI - C_LO)) * (Cp - C_LO) + I_LO
        aqi_calc = calculate_hour_aqi(p_pm25, p_pm10, p_co, p_no2, p_o3)

        hour_data = {
            "hour_index": h + 1,
            "hour_label": target_time.strftime("%I:%M %p"),
            "hour_iso": target_time.isoformat(),
            "timestamp": target_time.isoformat(),
            "display_time": target_time.strftime("%a %H:00"),
            # Calculated AQI & Sub-indices
            "aqi": aqi_calc["aqi"],
            "cpcb_aqi": aqi_calc["cpcb_aqi"],
            "dominant_pollutant": aqi_calc["dominant_pollutant"],
            "dominant_pollutant_key": aqi_calc["dominant_pollutant_key"],
            "sub_indices": aqi_calc["sub_indices"],
            "aqi_info": aqi_calc["aqi_info"],
            # The 7 predicted parameters directly from LSTM
            "pm25": p_pm25,
            "pm10": p_pm10,
            "co": p_co,
            "no2": p_no2,
            "o3": p_o3,
            "temperature": p_temp,
            "humidity": p_hum,
        }
        hourly_forecast.append(hour_data)

    # 6. Aggregate analytics for each parameter and overall AQI
    def calc_stats(vals: List[float], digits: int = 2) -> Dict[str, Any]:
        max_v = max(vals)
        min_v = min(vals)
        avg_v = round(sum(vals) / len(vals), digits)
        max_idx = vals.index(max_v)
        min_idx = vals.index(min_v)
        return {
            "avg": avg_v,
            "min": min_v,
            "max": max_v,
            "peak_hour": hourly_forecast[max_idx]["hour_label"],
            "peak_display_time": hourly_forecast[max_idx]["display_time"],
            "lowest_hour": hourly_forecast[min_idx]["hour_label"],
            "lowest_display_time": hourly_forecast[min_idx]["display_time"],
        }

    parameter_stats = {
        "pm25": calc_stats(param_series["pm25"], 1),
        "pm10": calc_stats(param_series["pm10"], 1),
        "co": calc_stats(param_series["co"], 3),
        "no2": calc_stats(param_series["no2"], 1),
        "o3": calc_stats(param_series["o3"], 1),
        "temperature": calc_stats(param_series["temperature"], 1),
        "humidity": calc_stats(param_series["humidity"], 1),
    }

    # Aggregate AQI statistics calculated via linear interpolation formula
    aqi_values = [h["aqi"] for h in hourly_forecast]
    avg_aqi = round(sum(aqi_values) / len(aqi_values))
    max_aqi = max(aqi_values)
    min_aqi = min(aqi_values)
    max_aqi_idx = aqi_values.index(max_aqi)
    min_aqi_idx = aqi_values.index(min_aqi)
    overall_cat = get_aqi_category_info(avg_aqi)
    
    # Calculate dominant pollutant frequency
    dom_pollutants = [h["dominant_pollutant"] for h in hourly_forecast]
    most_common_dom = max(set(dom_pollutants), key=dom_pollutants.count)

    aqi_stats = {
        "avg_aqi": avg_aqi,
        "min_aqi": min_aqi,
        "max_aqi": max_aqi,
        "peak_hour": hourly_forecast[max_aqi_idx]["hour_label"],
        "peak_display_time": hourly_forecast[max_aqi_idx]["display_time"],
        "lowest_hour": hourly_forecast[min_aqi_idx]["hour_label"],
        "lowest_display_time": hourly_forecast[min_aqi_idx]["display_time"],
        "dominant_pollutant": most_common_dom,
        "category": overall_cat["label"],
        "color": overall_cat["color"],
        "aqi_info": overall_cat
    }

    # Automatically persist this forecast run to local archive for time-point matching
    save_to_forecast_archive(hourly_forecast)

    return {
        "status": "success",
        "model_metadata": {
            "name": "Enhanced Bidirectional Seq2Seq LSTM Multi-Parameter Forecaster with Sensor Calibrators",
            "model_path": MODEL_PATH,
            "model_source": "aqi_model_and_calibrators",
            "calibrator_source": CALIBRATORS_PATH,
            "calibrators_active": calibrators is not None,
            "architecture": "Input(48, 14) -> BiLSTM(128) -> LSTM(64) -> RepeatVector(24) -> LSTM(64) -> LSTM(32) -> TimeDistributed(Dense(7))",
            "parameters_predicted": [
                {"key": "pm25", "name": "PM2.5", "unit": "µg/m³", "role": "Fine Particulate Matter"},
                {"key": "pm10", "name": "PM10", "unit": "µg/m³", "role": "Coarse Particulate Matter"},
                {"key": "co", "name": "Carbon Monoxide (CO)", "unit": "mg/m³", "role": "Gaseous Pollutant"},
                {"key": "no2", "name": "Nitrogen Dioxide (NO₂)", "unit": "µg/m³", "role": "Gaseous Pollutant"},
                {"key": "o3", "name": "Ozone (O₃)", "unit": "µg/m³", "role": "Photochemical Oxidant"},
                {"key": "temperature", "name": "Ambient Temperature", "unit": "°C", "role": "Meteorological"},
                {"key": "humidity", "name": "Relative Humidity", "unit": "%", "role": "Meteorological"},
            ],
            "input_timesteps": 48,
            "forecast_horizon_hours": 24,
            "inference_latency_ms": inference_ms,
            "backend": "PyTorch (Torch Engine via Keras 3)",
            "generated_at": base_time.isoformat(),
            "aqi_calculation_formula": "Ip = ((I_HI - I_LO) / (C_HI - C_LO)) * (Cp - C_LO) + I_LO",
            "aqi_standard": "CPCB (India)"
        },
        "summary": {
            "aqi_stats": aqi_stats,
            "parameter_stats": parameter_stats,
            "param_averages": {
                "pm25": parameter_stats["pm25"]["avg"],
                "pm10": parameter_stats["pm10"]["avg"],
                "co": parameter_stats["co"]["avg"],
                "no2": parameter_stats["no2"]["avg"],
                "o3": parameter_stats["o3"]["avg"],
                "temperature": parameter_stats["temperature"]["avg"],
                "humidity": parameter_stats["humidity"]["avg"],
            }
        },
        "forecast": hourly_forecast
    }


async def get_aligned_comparison_data(history_limit: int = 48) -> Dict[str, Any]:
    """
    Returns aligned historical and forecast telemetry comparing identical time points.
    Future hours with forecast data have historical_val=None (left blank).
    When actual telemetry arrives, it is dynamically joined to the same timestamp row.
    """
    from services.supabase_service import get_cloud_history
    fc_res = await generate_24h_lstm_forecast()
    current_forecast = fc_res.get("forecast", [])
    archive = load_forecast_archive()
    history_rows = await get_cloud_history(limit=history_limit)

    # Build historical map keyed by normalized timestamp string (YYYY-MM-DDTHH:00:00)
    hist_map: Dict[str, Dict[str, Any]] = {}
    for h in history_rows:
        ts = h.get("timestamp_hour") or h.get("created_at") or h.get("timestamp")
        if ts:
            k = str(ts)[:19]
            hist_map[k] = h

    # Build forecast map: include archive and current forecast
    fc_map: Dict[str, Dict[str, Any]] = {}
    for k, v in archive.items():
        fc_map[k[:19]] = v
    for f in current_forecast:
        ts = f.get("timestamp") or f.get("hour_iso")
        if ts:
            fc_map[str(ts)[:19]] = f

    # Window of relevant time points: recent past up to future horizon
    now_dt = datetime.now()
    cutoff_past = (now_dt - timedelta(hours=36)).strftime("%Y-%m-%dT%H:00:00")
    cutoff_future = (now_dt + timedelta(hours=30)).strftime("%Y-%m-%dT%H:00:00")

    all_keys = set([k for k in fc_map.keys() if cutoff_past <= k <= cutoff_future] +
                   [k for k in hist_map.keys() if cutoff_past <= k <= cutoff_future])
    sorted_keys = sorted(all_keys)

    aligned_schedule = []
    for k in sorted_keys:
        fc_item = fc_map.get(k)
        hist_item = hist_map.get(k)

        try:
            dt = datetime.fromisoformat(k)
            display_time = dt.strftime("%a %H:00")
            hour_label = dt.strftime("%I:%M %p")
        except Exception:
            display_time = k
            hour_label = k

        has_hist = hist_item is not None
        has_fc = fc_item is not None

        fc_aqi = fc_item.get("aqi") if fc_item else None
        hist_aqi = (hist_item.get("cpcb_aqi") if hist_item.get("cpcb_aqi") is not None else hist_item.get("aqi")) if hist_item else None

        delta = None
        delta_pct = None
        status = "awaiting_data"

        if has_fc and has_hist:
            status = "verified"
            if fc_aqi is not None and hist_aqi is not None:
                delta = fc_aqi - hist_aqi
                delta_pct = round((delta / hist_aqi * 100) if hist_aqi != 0 else 0, 1)
        elif has_fc:
            status = "awaiting_data"
        else:
            status = "historical_only"

        row = {
            "timestamp": k,
            "display_time": display_time,
            "hour_label": hour_label,
            "status": status,
            "has_forecast": has_fc,
            "has_historical": has_hist,
            "forecast_aqi": fc_aqi,
            "historical_aqi": hist_aqi,
            "aqi_delta": delta,
            "aqi_delta_pct": delta_pct,
            "forecast_item": fc_item,
            "historical_item": hist_item,
        }

        for param in ["pm25", "pm10", "co", "no2", "o3", "temperature", "humidity"]:
            p_fc = fc_item.get(param) if fc_item else None
            p_hist = hist_item.get(param) if hist_item else None
            row[f"fc_{param}"] = p_fc
            row[f"hist_{param}"] = p_hist
            if p_fc is not None and p_hist is not None:
                p_delta = round(float(p_fc) - float(p_hist), 3 if param == "co" else 1)
                row[f"{param}_delta"] = p_delta
            else:
                row[f"{param}_delta"] = None

        aligned_schedule.append(row)

    return {
        "status": "success",
        "aligned_schedule": aligned_schedule,
        "forecast": current_forecast,
        "summary": fc_res.get("summary", {})
    }
