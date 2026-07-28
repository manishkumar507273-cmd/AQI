# Atmo-Logic — Real-Time AQI & Weather Monitor

A full-stack React + Python web application for real-time cloud sensor telemetry monitoring.

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Recharts, Lucide Icons |
| Backend | Python FastAPI + uvicorn |
| Data | Supabase Cloud ESP32 Telemetry REST API |
| Design | Clean responsive UI, Inter typography, glassmorphism |

## Features
- **Dashboard** — Live CPCB AQI gauge, pollutant cards (PM2.5, PM10, CO, NO₂, O₃), WHO thresholds, sensor hardware modals
- **Weather** — Live temperature, humidity, wind speed, wind direction, rain gauge telemetry
- **Forecast** — Predictive trends & multi-parameter telemetry graphing
- **History** — Historical telemetry log & interactive charts live from Supabase cloud

## Quick Start

### 1. Start the Python Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### 2. Start the React Frontend
```bash
cd frontend
npm install
npm run dev
```
App runs at: http://localhost:5173

## API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/cloud/latest` | Latest ESP32 cloud sensor telemetry |
| GET | `/api/cloud/history?limit=50` | Recent telemetry reading history |
| GET | `/api/aqi/current` | Current AQI telemetry data |
| GET | `/api/aqi/forecast` | Recent AQI forecast trends |
| GET | `/api/weather/current` | Current weather telemetry data |
| GET | `/api/weather/hourly` | Recent weather telemetry trends |
