# Smart AirNet — Real-Time AQI, Weather & Predictive AI Monitor

A modern, full-stack intelligence platform for real-time air quality index (AQI) telemetry, meteorological monitoring, and 24-hour predictive machine learning forecasting, powered by **FastAPI**, **PyTorch/Keras 3**, **React 19**, **Vite**, and **Supabase Cloud**.

---

## 🌟 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Recharts, Framer Motion, Lucide Icons, Vanilla CSS & TailwindCSS |
| **Backend** | Python 3.12, FastAPI, Uvicorn, HTTPX, Pydantic, python-dotenv |
| **AI / Machine Learning** | Bidirectional Seq2Seq LSTM (`keras` 3 + PyTorch backend), Scikit-Learn (`Ridge` multi-parameter sensor calibrators, `MinMaxScaler`), Joblib, NumPy |
| **Data Source** | Supabase Cloud REST API (`AQI_LIVE_NODE1`, `AQI_NODE1`, `WEATHER_LIVE_NODE1`, `WEATHER_NODE1`) |
| **Design System** | Dark Slate Theme (`#0f172a`), Space Grotesk & JetBrains Mono typography, Glassmorphism, Micro-animations |

---

## ✨ Features

- **Real-Time Air Quality Index (CPCB India Standard)**:
  - Dynamic calculation of CPCB AQI values across 6 risk bands (*Good*, *Satisfactory*, *Moderate*, *Poor*, *Very Poor*, *Severe*).
  - Sub-index computation for individual pollutants: $\text{PM}_{2.5}$, $\text{PM}_{10}$, $\text{CO}$, $\text{NO}_2$, and $\text{O}_3$.
- **AI Multi-Parameter Predictive Forecaster**:
  - **Enhanced Seq2Seq Bidirectional LSTM**: Takes past 48 hours of 14 engineered features (pollutants, weather, cyclical time encodings, wind vectors) and forecasts the next 24 hours of 7 parameters ($\text{PM}_{2.5}$, $\text{PM}_{10}$, $\text{CO}$, $\text{NO}_2$, $\text{O}_3$, Temperature, Humidity).
  - **Ridge Cross-Sensitivity Sensor Calibrators**: Calibrates low-cost electrochemical and optical sensor readings against temperature and humidity drift using pre-trained Ridge regression models before passing into the model.
  - **Same-Hour Telemetry Alignment**: Compares forecast against actual sensor telemetry recorded at identical time points with real-time error delta and percentage variance.
- **Air Quality Visualizations**:
  - **AQI Line Plot**: Area line plot tracking overall Air Quality Index progression over 15-minute intervals.
  - **All Pollutants Comparison**: Multi-line chart tracking calibrated $\text{PM}_{2.5}$, $\text{PM}_{10}$, $\text{CO}$, $\text{NO}_2$, and $\text{O}_3$ with toggleable chip selectors.
  - **Compact Comparison Hover Tooltips**: Responsive, sleek dark-mode tooltips highlighting sensor vs forecast values.
- **Hardware Sensor Intelligence**:
  - Interactive specifications, WHO thresholds, health guidance, and technical datasheets for physical sensors:
    - **Sensirion SPS30** ($\text{PM}_{2.5} / \text{PM}_{10}$)
    - **Winsen ZE07-CO** ($\text{CO}$)
    - **Fermion NO₂** ($\text{NO}_2$)
    - **MQ-131** ($\text{O}_3$)
    - **Sensirion SHT45** (Temperature & Humidity)
    - **Wind Speed, Direction & Rain Gauge sensors**
- **Live Weather Telemetry**:
  - Real-time tracking of Ambient Temperature (°C), Relative Humidity (%), Wind Speed (km/h), Wind Direction (°), and Precipitation Gauge (mm).
- **Historical Telemetry Archive**:
  - Historical table with pagination, CSV data export, and parameter histograms.

---

## 📁 Project Structure

```text
├── aqi_model_and_calibrators/     # AI / ML Model Artifacts
│   ├── best_aqi_lstm_model.keras  # Enhanced Bidirectional Seq2Seq LSTM Model
│   ├── feature_scaler.pkl         # 14-feature MinMaxScaler
│   ├── target_scaler.pkl          # 7-target MinMaxScaler
│   └── sensor_calibrators.pkl     # Ridge cross-sensitivity calibrator models
├── backend/
│   ├── main.py                    # FastAPI server entry point & CORS configuration
│   ├── requirements.txt           # Backend Python dependencies
│   ├── routers/                   # API endpoint routers
│   │   ├── aqi.py                 # AQI & LSTM forecast endpoints
│   │   ├── cloud.py               # Supabase cloud telemetry endpoints
│   │   └── weather.py             # Weather telemetry endpoints
│   ├── services/
│   │   ├── lstm_forecast_service.py # LSTM inference pipeline & telemetry alignment
│   │   └── supabase_service.py    # Supabase Cloud data integration & Ridge calibration
│   ├── .env.example               # Backend environment template
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── api.js                 # API client, Ridge calibration & Supabase fallbacks
│   │   ├── components/            # UI components (Layout, WindCanvas)
│   │   ├── pages/                 # Views (Dashboard, LiveData, Weather, Forecast, Historical)
│   │   ├── assets/                # Hardware sensor module imagery
│   │   ├── index.css              # Design tokens & typography
│   │   └── main.jsx               # React 19 entry point
│   ├── index.html                 # Main HTML template & favicon
│   ├── package.json               # Dependencies & scripts
│   ├── vite.config.js             # Vite development server & reverse proxy
│   ├── .env.example               # Frontend environment template
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
| `GET` | `/api/cloud/latest` | Latest cloud sensor telemetry (calibrated AQI + Weather) |
| `GET` | `/api/cloud/live-history?limit=50` | Real-time live telemetry stream history |
| `GET` | `/api/cloud/history?limit=500` | Historical telemetry archive data |
| `GET` | `/api/aqi/current` | Current calibrated AQI telemetry reading |
| `GET` | `/api/aqi/forecast` | 24-hour predictive forecast generated by Seq2Seq LSTM |
| `GET` | `/api/aqi/predict-24h` | Dedicated alias for 24-hour predictive forecast |
| `GET` | `/api/aqi/comparison?history_limit=48` | Aligned forecast vs actual telemetry on identical time points |
| `GET` | `/api/weather/current` | Current weather telemetry reading |
| `GET` | `/api/weather/hourly?limit=24` | Hourly weather trend history |


