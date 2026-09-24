import asyncio
import logging
from datetime import datetime, timezone
logger = logging.getLogger("forecast_scheduler")
logging.basicConfig(level=logging.INFO)

async def forecast_hourly_job():
    """Runs the 24-hour tiered forecast engine and syncs to Supabase."""
    logger.info("Starting scheduled 24-Hour AQI forecast job at %s...", datetime.now(timezone.utc).isoformat())
    try:
        from services.forecast_engine import run_24h_forecast
        result = await run_24h_forecast()
        logger.info(
            "Forecast job completed: Continuous Hours=%d, Selected Tier=%s, Upsert Status=%s",
            result.get("detected_continuous_hours", 0),
            result.get("selected_tier", "unknown"),
            result.get("sync_status", {}).get("status", "unknown")
        )
    except (Exception, MemoryError) as e:
        logger.warning("Forecast scheduled job could not run: %s", str(e))

async def start_scheduler(interval_seconds: int = 3600):
    """Loops infinitely, executing the forecast sync every `interval_seconds` (default: 1 hour)."""
    logger.info("Initializing Forecast Scheduler (Interval: %ds)...", interval_seconds)
    # Brief initial pause to let uvicorn finish binding to socket
    await asyncio.sleep(2)
    await forecast_hourly_job()


    while True:
        try:
            await asyncio.sleep(interval_seconds)
            await forecast_hourly_job()
        except asyncio.CancelledError:
            logger.info("Forecast scheduler background task received cancellation. Exiting cleanly.")
            break
        except Exception as e:
            logger.error("Scheduler loop error: %s", str(e))
            await asyncio.sleep(60)

if __name__ == "__main__":
    try:
        asyncio.run(start_scheduler())
    except KeyboardInterrupt:
        print("\nForecast scheduler stopped by user.")
