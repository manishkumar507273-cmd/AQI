from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response
from services.supabase_service import (
    get_latest_cloud_reading,
    get_latest_weather_live_reading,
    get_cloud_history,
    get_cloud_live_history,
    get_weather_live_history,
    get_weather_history,
    fetch_dataset_range,
    fetch_available_periods,
    format_dataset_csv,
    TABLE_AQI_HISTORICAL,
    TABLE_WEATHER_HISTORICAL
)

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
    year: int = Query(default=2026, ge=2020, description="Calendar year for dataset export"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="Month 1-12 (omit for full year)")
):
    """
    Downloads historical dataset for complete year or specific month as CSV.
    Fetches real records directly from Supabase, handling multi-page pagination.
    """
    try:
        table_name = TABLE_AQI_HISTORICAL if category == "aqi" else TABLE_WEATHER_HISTORICAL
        rows = await fetch_dataset_range(table_name, year=year, month=month)
        
        if not rows:
            period_str = f"{MONTH_NAMES.get(month, f'Month {month}')} {year}" if month else f"Year {year}"
            raise HTTPException(
                status_code=404,
                detail=f"No {category.upper()} records exist in database for {period_str}."
            )

        csv_content = format_dataset_csv(rows, category=category)
        
        cat_title = "AQI" if category == "aqi" else "Weather"
        if month:
            m_name = MONTH_NAMES.get(month, f"{month:02d}")
            filename = f"{cat_title}_Historical_Dataset_{year}_{month:02d}_{m_name}.csv"
        else:
            filename = f"{cat_title}_Historical_Dataset_{year}_Full_Year.csv"

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



