import httpx
from typing import Optional, List, Dict, Any

# ==============================================================================
# SUPABASE CONFIGURATION: CHANGE SUPABASE_URL AND SUPABASE_KEY HERE IF NEEDED
# ==============================================================================
SUPABASE_URL = "https://sgkdpliqlhgiqsabxzxe.supabase.co/rest/v1/aqi"
SUPABASE_KEY = "sb_publishable_9gBUGozvaGyoxkM9rW2tFg_pyF6esLE"
# ==============================================================================

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

_CLIENT: Optional[httpx.AsyncClient] = None

def get_http_client() -> httpx.AsyncClient:
    global _CLIENT
    if _CLIENT is None or _CLIENT.is_closed:
        _CLIENT = httpx.AsyncClient(timeout=10.0, follow_redirects=True)
    return _CLIENT

def format_supabase_reading(raw: Dict[str, Any]) -> Dict[str, Any]:
    cpcb_aqi = raw.get("cpcb_aqi") or 0
    
    if cpcb_aqi <= 50:
        label = "Good"
        color = "#65ff50"
    elif cpcb_aqi <= 100:
        label = "Satisfactory"
        color = "#a3e635"
    elif cpcb_aqi <= 200:
        label = "Moderate"
        color = "#facc15"
    elif cpcb_aqi <= 300:
        label = "Poor"
        color = "#fb923c"
    elif cpcb_aqi <= 400:
        label = "Very Poor"
        color = "#f87171"
    else:
        label = "Severe"
        color = "#c084fc"

    return {
        "id": raw.get("id"),
        "timestamp": raw.get("created_at"),
        "temperature": raw.get("temperature"),
        "humidity": raw.get("humidity"),
        "pm25": raw.get("pm25") if "pm25" in raw else raw.get("pm2.5"),
        "pm10": raw.get("pm10"),
        "co": raw.get("co"),
        "o3": raw.get("o3"),
        "no2": raw.get("no2"),
        "cpcb_aqi": cpcb_aqi,
        "dominant_pollutant": raw.get("dominant_pollutant", "N/A"),
        "aqi_info": {
            "value": cpcb_aqi,
            "label": label,
            "color": color,
            "standard": "CPCB (India)"
        },
        "wind_speed": raw.get("wind_speed"),
        "wind_direction": raw.get("wind_direction"),
        "rain_gauge": raw.get("rain_gauge")
    }

async def get_latest_cloud_reading() -> Optional[Dict[str, Any]]:
    client = get_http_client()
    url = f"{SUPABASE_URL}?order=id.desc&limit=1"
    response = await client.get(url, headers=HEADERS)
    response.raise_for_status()
    data = response.json()
    if data and len(data) > 0:
        return format_supabase_reading(data[0])
    return None

async def get_cloud_history(limit: int = 50) -> List[Dict[str, Any]]:
    client = get_http_client()
    url = f"{SUPABASE_URL}?order=id.desc&limit={limit}"
    response = await client.get(url, headers=HEADERS)
    response.raise_for_status()
    data = response.json()
    return [format_supabase_reading(row) for row in reversed(data)]
