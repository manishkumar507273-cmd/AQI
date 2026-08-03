from fastapi import APIRouter, HTTPException, Query
from services.supabase_service import get_latest_cloud_reading, get_cloud_history, get_cloud_live_history

router = APIRouter(prefix="/api/cloud", tags=["Cloud Telemetry"])

@router.get("/latest")
async def latest_cloud_data():
    try:
        data = await get_latest_cloud_reading()
        if not data:
            raise HTTPException(status_code=444, detail="No cloud sensor data available")
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Supabase connection error: {str(e)}")

@router.get("/live-history")
async def live_cloud_data(limit: int = Query(default=50, ge=5, le=500)):
    try:
        history = await get_cloud_live_history(limit=limit)
        return {"status": "success", "count": len(history), "history": history}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Supabase connection error: {str(e)}")

@router.get("/history")
async def historical_cloud_data(limit: int = Query(default=96, ge=5, le=1000)):
    try:
        history = await get_cloud_history(limit=limit)
        return {"status": "success", "count": len(history), "history": history}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Supabase connection error: {str(e)}")


