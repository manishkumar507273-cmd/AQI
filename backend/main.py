from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import aqi, weather, cloud

app = FastAPI(
    title="Smart AirNet API",
    description="AQI & Weather telemetry data powered by Supabase Cloud",
    version="1.0.0",
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

@app.get("/")
async def root():
    return {"message": "Smart AirNet API is running", "docs": "/docs"}

