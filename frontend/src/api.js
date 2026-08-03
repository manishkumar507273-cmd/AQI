import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL 
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api` 
  : '/api';

const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNna2RwbGlxbGhnaXFzYWJ4enhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzgzMTIsImV4cCI6MjEwMDQ1NDMxMn0.vMtbXomFdmOcBkhhSoiyYyp_vFxOhg4MYCFCw9-pL30";

let rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sgkdpliqlhgiqsabxzxe.supabase.co';
const supabaseBaseUrl = rawUrl.includes('/rest/v1') ? rawUrl.split('/rest/v1')[0] : rawUrl.replace(/\/$/, '');
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;

// Table definitions as requested:
// 1st: AQI_LIVE_NODE1 (Live AQI)
// 2nd: AQI_NODE1 (Historical AQI)
// 3rd: WEATHER_LIVE_NODE1 (Live Weather)
// 4th: WEATHER_NODE1 (Historical Weather)
const TABLE_AQI_LIVE = 'AQI_LIVE_NODE1';
const TABLE_AQI_HISTORICAL = 'AQI_NODE1';
const TABLE_WEATHER_LIVE = 'WEATHER_LIVE_NODE1';
const TABLE_WEATHER_HISTORICAL = 'WEATHER_NODE1';

const getTableRestUrl = (tableName) => `${supabaseBaseUrl}/rest/v1/${tableName}`;

const api = axios.create({
  baseURL,
  timeout: 15000,
});

const formatRawReading = (raw) => {
  if (!raw) return null;
  const cpcb_aqi = raw.cpcb_aqi || 0;
  let label = "Good", color = "#65ff50";
  if (cpcb_aqi > 50 && cpcb_aqi <= 100) { label = "Satisfactory"; color = "#a3e635"; }
  else if (cpcb_aqi > 100 && cpcb_aqi <= 200) { label = "Moderate"; color = "#facc15"; }
  else if (cpcb_aqi > 200 && cpcb_aqi <= 300) { label = "Poor"; color = "#fb923c"; }
  else if (cpcb_aqi > 300 && cpcb_aqi <= 400) { label = "Very Poor"; color = "#f87171"; }
  else if (cpcb_aqi > 400) { label = "Severe"; color = "#c084fc"; }

  return {
    id: raw.id,
    timestamp: raw.created_at || raw.timestamp_hour || raw.timestamp,
    temperature: raw.temperature,
    humidity: raw.humidity,
    pm25: raw.pm25 ?? raw['pm2.5'],
    pm10: raw.pm10,
    co: raw.co,
    o3: raw.o3,
    no2: raw.no2,
    cpcb_aqi,
    dominant_pollutant: raw.dominant_pollutant || 'N/A',
    aqi_info: { value: cpcb_aqi, label, color, standard: 'CPCB (India)' },
    wind_speed: raw.wind_speed,
    wind_direction: raw.wind_direction,
    rain_gauge: raw.rain_gauge
  };
};

export const getCloudLatest = async () => {
  try {
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    };

    // 1st Table (Live AQI) and 3rd Table (Live Weather) for Live Page
    const [aqiRes, weatherRes] = await Promise.allSettled([
      axios.get(`${getTableRestUrl(TABLE_AQI_LIVE)}?order=created_at.desc&limit=1`, { headers }),
      axios.get(`${getTableRestUrl(TABLE_WEATHER_LIVE)}?order=created_at.desc&limit=1`, { headers })
    ]);

    const combined = {};
    if (aqiRes.status === 'fulfilled' && aqiRes.value.data?.[0]) {
      Object.assign(combined, aqiRes.value.data[0]);
    }
    if (weatherRes.status === 'fulfilled' && weatherRes.value.data?.[0]) {
      const wData = weatherRes.value.data[0];
      for (const k in wData) {
        if (wData[k] != null || combined[k] == null) {
          combined[k] = wData[k];
        }
      }
    }

    const formatted = formatRawReading(combined);
    if (formatted) {
      return { data: { status: 'success', data: formatted } };
    }
  } catch (err) {
    console.warn('Direct Supabase fetch fallback to backend API:', err?.message || err);
  }
  return api.get('/cloud/latest');
};

export const getCloudLiveHistory = async (limit = 50) => {
  try {
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    };

    const res = await axios.get(`${getTableRestUrl(TABLE_AQI_LIVE)}?order=created_at.desc&limit=${limit}`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_AQI_LIVE)}?limit=${limit}`, { headers }));

    const list = Array.isArray(res.data) ? res.data : [];
    const history = list.map(formatRawReading).filter(Boolean);

    return {
      data: {
        status: 'success',
        count: history.length,
        history
      }
    };
  } catch (err) {
    console.warn('Direct Supabase live history fetch fallback to backend API:', err?.message || err);
  }
  return api.get(`/cloud/live-history?limit=${limit}`);
};

export const getCloudHistory = async (limit = 50) => {
  try {
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    };

    // 2nd Table (Historical AQI - AQI_NODE1 uses timestamp_hour) and 4th Table (Historical Weather - WEATHER_NODE1)
    const [aqiHistRes, weatherHistRes] = await Promise.allSettled([
      axios.get(`${getTableRestUrl(TABLE_AQI_HISTORICAL)}?order=timestamp_hour.desc&limit=${limit}`, { headers })
        .catch(() => axios.get(`${getTableRestUrl(TABLE_AQI_HISTORICAL)}?limit=${limit}`, { headers })),
      axios.get(`${getTableRestUrl(TABLE_WEATHER_HISTORICAL)}?order=timestamp_hour.desc&limit=${limit}`, { headers })
        .catch(() => axios.get(`${getTableRestUrl(TABLE_WEATHER_HISTORICAL)}?limit=${limit}`, { headers }))
    ]);

    const aqiList = aqiHistRes.status === 'fulfilled' && Array.isArray(aqiHistRes.value.data) ? aqiHistRes.value.data : [];
    const weatherList = weatherHistRes.status === 'fulfilled' && Array.isArray(weatherHistRes.value.data) ? weatherHistRes.value.data : [];

    const maxLen = Math.max(aqiList.length, weatherList.length);
    if (maxLen > 0) {
      const history = [];
      for (let i = 0; i < maxLen; i++) {
        const merged = { ...(aqiList[i] || {}) };
        const wObj = weatherList[i];
        if (wObj) {
          for (const k in wObj) {
            if (wObj[k] != null || merged[k] == null) {
              merged[k] = wObj[k];
            }
          }
        }
        const formatted = formatRawReading(merged);
        if (formatted) history.push(formatted);
      }

      return {
        data: {
          status: 'success',
          count: history.length,
          history
        }
      };
    }
  } catch (err) {
    console.warn('Direct Supabase history fetch fallback to backend API:', err?.message || err);
  }
  return api.get(`/cloud/history?limit=${limit}`);
};


export const getAQICurrent = () => api.get('/aqi/current');
export const getAQIForecast = (limit = 24) => api.get(`/aqi/forecast?limit=${limit}`);
export const getAQIHistorical = (limit = 50) => api.get(`/aqi/historical?limit=${limit}`);
export const getWeatherCurrent = () => api.get('/weather/current');
export const getWeatherHourly = (limit = 24) => api.get(`/weather/hourly?limit=${limit}`);

export default api;

