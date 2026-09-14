import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import aqi, weather, cloud

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the automated 1-hour forecast engine sync loop as a background task
    from scheduler import start_scheduler
    loop = asyncio.get_running_loop()
    task = loop.create_task(start_scheduler(interval_seconds=3600))
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="Smart AirNet API",
    description="AQI & Weather telemetry data powered by Supabase Cloud",
    version="1.0.0",
    lifespan=lifespan
)



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(aqi.router)
app.include_router(weather.router)
app.include_router(cloud.router)

@app.get("/api/forecast/24h", tags=["Forecast"])
@app.get("/api/forecast", tags=["Forecast"])
@app.get("/api/aqi/forecast", tags=["Forecast"])
async def get_24h_forecast():
    """
    Returns 24-hour predictive forecast using dynamic Seq2Seq LSTM tiered models
    based on continuous hourly rows from AQI_NODE1.
    """
    try:
        from services.forecast_engine import run_24h_forecast
        return await run_24h_forecast()
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Forecast Engine error: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Smart AirNet API is running", "docs": "/docs"}



