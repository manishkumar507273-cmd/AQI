from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Query, Response
from services.email_service import send_dataset_email, is_smtp_configured
from services.supabase_service import (
    get_latest_cloud_reading,
    get_latest_weather_live_reading,
    get_cloud_history,
    get_cloud_live_history,
    get_weather_live_history,
    get_weather_history,
    fetch_dataset_range,
    fetch_table_rows,
    fetch_available_periods,
    format_dataset_csv,
    TABLE_AQI_HISTORICAL,
    TABLE_WEATHER_HISTORICAL
)

class DatasetEmailPayload(BaseModel):
    recipient_email: str
    recipient_name: Optional[str] = "Researcher"
    dataset_name: Optional[str] = "Historical Dataset"
    category: Optional[str] = "aqi"
    year: Optional[int] = 2026
    month: Optional[int] = None
    purpose: Optional[str] = ""

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

@router.get("/weather-latest")
async def latest_weather_data():
    try:
        data = await get_latest_weather_live_reading()
        if not data:
            raise HTTPException(status_code=444, detail="No cloud weather data available")
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

@router.get("/weather-live-history")
async def weather_live_cloud_data(limit: int = Query(default=50, ge=5, le=500)):
    try:
        history = await get_weather_live_history(limit=limit)
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

@router.get("/weather-history")
async def historical_weather_cloud_data(limit: int = Query(default=96, ge=5, le=1000)):
    try:
        history = await get_weather_history(limit=limit)
        return {"status": "success", "count": len(history), "history": history}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Supabase connection error: {str(e)}")

MONTH_NAMES = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December"
}

@router.get("/available-periods")
async def get_available_periods(
    category: str = Query(..., regex="^(aqi|weather)$", description="Type of historical dataset: aqi or weather")
):
    """
    Returns the years and months that actually have data in Supabase.
    Only periods with data can be downloaded.
    """
    try:
        table_name = TABLE_AQI_HISTORICAL if category == "aqi" else TABLE_WEATHER_HISTORICAL
        periods = await fetch_available_periods(table_name)
        return {
            "status": "success",
            "category": category,
            "periods": periods,
            "years": list(periods.keys())
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch available periods: {str(e)}")

@router.get("/export-dataset")
async def export_dataset(
    category: str = Query(..., regex="^(aqi|weather)$", description="Type of historical dataset: aqi or weather"),
):
    """
    Downloads historical dataset for previous 24 hours as CSV.
    Fetches real records directly from Supabase, handling multi-page pagination.
    """
    try:
        table_name = TABLE_AQI_HISTORICAL if category == "aqi" else TABLE_WEATHER_HISTORICAL
        rows = await fetch_table_rows(table_name, limit=96)
        
        if not rows:
            raise HTTPException(
                status_code=404,
                detail=f"No {category.upper()} records exist in database."
            )

        csv_content = format_dataset_csv(rows, category=category)
        
        cat_title = "AQI" if category == "aqi" else "Weather"
        filename = f"{cat_title}_Historical_Dataset_Previous_24H.csv"

        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
                "X-Dataset-Rows": str(len(rows))
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to generate dataset export: {str(e)}")

MONTH_NAMES = {
    1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
    7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"
}

@router.post("/send-dataset-email")
async def email_dataset_to_user(payload: DatasetEmailPayload):
    try:
        cat_raw = (payload.category or "aqi").lower()
        category = "weather" if "weather" in cat_raw or "meteo" in cat_raw else "aqi"
        
        table_name = TABLE_AQI_HISTORICAL if category == "aqi" else TABLE_WEATHER_HISTORICAL
        rows = await fetch_table_rows(table_name, limit=96)
            
        if not rows:
            raise HTTPException(
                status_code=404,
                detail=f"No {category.upper()} records found in database."
            )
            
        csv_content = format_dataset_csv(rows, category=category)
        cat_title = "AQI" if category == "aqi" else "Weather"
        filename = f"{cat_title}_Historical_Dataset_Previous_24H.csv"
            
        result = send_dataset_email(
            recipient_email=payload.recipient_email,
            recipient_name=payload.recipient_name or "Researcher",
            dataset_name=payload.dataset_name or f"{cat_title} Historical Dataset",
            filename=filename,
            csv_content=csv_content,
            rows_count=len(rows),
            purpose=payload.purpose
        )
        
        return {
            "status": "success" if result["success"] else "notice",
            "email_sent": result["success"],
            "requires_smtp_config": result.get("requires_smtp_config", False),
            "message": result["message"],
            "filename": filename,
            "rows_count": len(rows),
            "recipient": payload.recipient_email
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process and email dataset: {str(e)}")




