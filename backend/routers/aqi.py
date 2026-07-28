from fastapi import APIRouter, HTTPException, Query
from services.supabase_service import get_latest_cloud_reading, get_cloud_history

router = APIRouter(prefix="/api/aqi", tags=["AQI Telemetry"])

@router.get("/current")
async def current_aqi():
    try:
        data = await get_latest_cloud_reading()
        if not data:
            raise HTTPException(status_code=404, detail="No AQI sensor data available from cloud.")
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cloud telemetry connection error: {str(e)}")

@router.get("/forecast")
async def aqi_forecast(limit: int = Query(default=24, ge=1, le=200)):
    try:
        history = await get_cloud_history(limit=limit)
        return {"status": "success", "count": len(history), "forecast": history}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cloud telemetry connection error: {str(e)}")

@router.get("/historical")
async def aqi_historical(limit: int = Query(default=50, ge=1, le=500)):
    try:
        history = await get_cloud_history(limit=limit)
        return {"status": "success", "count": len(history), "history": history}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cloud telemetry connection error: {str(e)}")

