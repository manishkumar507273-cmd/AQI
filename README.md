# Atmo-Logic — Real-Time AQI & Weather Monitor

A modern, full-stack web application for real-time air quality index (AQI) and weather telemetry monitoring, powered by **FastAPI**, **React 19**, **Vite**, and **Supabase Cloud**.

---

## 🌟 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Recharts, Framer Motion, Lucide Icons, TailwindCSS |
| **Backend** | Python FastAPI, Uvicorn, HTTPX, Pydantic, python-dotenv |
| **Data Source** | Supabase Cloud REST API (`AQI_LIVE_NODE1`, `AQI_NODE1`, `WEATHER_LIVE_NODE1`, `WEATHER_NODE1`) |
| **Design System** | Dark Slate Theme (`#131e2b`), Space Grotesk & JetBrains Mono typography, Glassmorphic cards |

---

## ✨ Features

- **Real-Time Air Quality Index (CPCB Standard)**: Live calculation & visualization of CPCB AQI values with dynamic risk color coding (Good, Satisfactory, Moderate, Poor, Very Poor, Severe).
- **Air Quality Visualizations**:
  - **AQI Line Plot**: Area line plot tracking overall Air Quality Index progression over 15-minute intervals.
  - **AQI Parameters Comparison Line Plot**: Multi-line plot comparing all pollutant parameters (**PM2.5**, **PM10**, **CO**, **NO₂**, **O₃**) on a single graph (excluding weather metrics), complete with interactive pollutant filter chips and hover tooltips.
- **Pollutant Breakdown & Sensor Modals**: Interactive modals displaying WHO limits, health impacts, precautions, working principles, and product links for physical sensors (**Sensirion SPS30**, **MQ-131**, **Fermion NO₂**, **Winsen ZE07-CO**, **SHT45**, etc.).
- **Live Weather Telemetry**: Real-time tracking of Temperature (°C), Humidity (%), Wind Speed (km/h), Wind Direction (°), and Rain Gauge (mm).
- **Historical Analytics**: Telemetry archive log table and parameter trends bar histogram.
- **Predictive Forecast**: 24-hour predictive trends & multi-parameter telemetry graphing.

---

## 📁 Project Structure

```text
├── backend/
│   ├── main.py                   # FastAPI server entry point & CORS configuration
│   ├── requirements.txt           # Backend dependencies
│   ├── routers/                   # API endpoint routers (aqi, weather, cloud)
│   ├── services/                  # Supabase Cloud data integration service
│   ├── .env.example              # Backend environment template
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── api.js                 # API client & direct Supabase Cloud fallback handlers
│   │   ├── components/            # Shared UI components (Layout, WindCanvas)
│   │   ├── pages/                 # Pages (Dashboard, Weather, Forecast, Historical)
│   │   ├── assets/                # Hardware sensor module images
│   │   ├── index.css              # Design tokens, Tailwind directives & typography
│   │   └── main.jsx               # React 19 entry point
│   ├── index.html                 # Main HTML template & favicon
│   ├── package.json               # Dependencies & scripts
│   ├── vite.config.js             # Vite development server configuration
│   ├── .env.example              # Frontend environment template
│   └── .gitignore
├── .env.example                   # Project-wide environment template
├── .gitignore                     # Root Git ignore configuration
└── README.md                      # Project documentation
```

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env` in both `backend/` and `frontend/` directories:

### Backend Configuration (`backend/.env`)
```ini
SUPABASE_URL=https://sgkdpliqlhgiqsabxzxe.supabase.co
SUPABASE_KEY=your_supabase_key_here
PORT=8000
HOST=0.0.0.0
```

### Frontend Configuration (`frontend/.env`)
```ini
VITE_SUPABASE_URL=https://sgkdpliqlhgiqsabxzxe.supabase.co
VITE_SUPABASE_KEY=your_supabase_key_here
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🚀 Quick Start

### 1. Start the Python FastAPI Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Start the React Frontend

```bash
cd frontend
npm install
npm run dev
```
- **Frontend App**: [http://localhost:5173](http://localhost:5173)

---

## 🔌 API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | API Health Check |
| `GET` | `/api/cloud/latest` | Latest cloud sensor telemetry (AQI + Weather) |
| `GET` | `/api/cloud/live-history?limit=50` | Real-time live telemetry stream history |
| `GET` | `/api/cloud/history?limit=500` | Historical telemetry archive data |
| `GET` | `/api/aqi/current` | Current AQI telemetry data |
| `GET` | `/api/aqi/forecast?limit=24` | 24-hour predictive forecast trends |
| `GET` | `/api/weather/current` | Current weather telemetry reading |
| `GET` | `/api/weather/hourly?limit=24` | Hourly weather trend history |
