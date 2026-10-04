from fastapi import APIRouter, HTTPException, Query
from services.supabase_service import get_latest_weather_live_reading, get_weather_history
from services.weather_forecast_24h_engine import get_or_generate_weather_forecast_24h

router = APIRouter(prefix="/api/weather", tags=["Weather Telemetry"])

@router.get("/current")
async def current_weather():
    try:
        data = await get_latest_weather_live_reading()
        if not data:
            raise HTTPException(status_code=404, detail="No weather sensor data available from cloud.")
        return {"status": "success", "data": data}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Cloud telemetry connection error: {str(e)}")

@router.get("/hourly")
async def hourly_weather(limit: int = Query(default=24, ge=1, le=200)):
    try:
        history = await get_weather_history(limit=limit)
        return {"status": "success", "count": len(history), "hourly": history}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Cloud telemetry connection error: {str(e)}")

@router.get("/forecast/24h")
async def weather_forecast_24h(force: bool = False):
    try:
        data = await get_or_generate_weather_forecast_24h(force=force)
        if data.get("status") == "error":
            raise HTTPException(status_code=400, detail=data.get("message", "Error generating forecast"))
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Weather forecast 24h generation error: {str(e)}")
