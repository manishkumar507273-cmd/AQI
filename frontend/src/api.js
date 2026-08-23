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

export const isSensorOnline = (timestamp, maxAgeMinutes = 5) => {
  if (!timestamp) return false;
  const dt = new Date(timestamp);
  if (isNaN(dt.getTime())) return false;
  const diffMs = Date.now() - dt.getTime();
  return diffMs >= 0 && diffMs <= maxAgeMinutes * 60 * 1000;
};

export const getTimeAgo = (timestamp) => {
  if (!timestamp) return 'No data';
  const dt = new Date(timestamp);
  if (isNaN(dt.getTime())) return 'Invalid date';
  const diffSec = Math.floor((Date.now() - dt.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

export const getCachedData = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const setCachedData = (key, data) => {
  try {
    if (data) localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
};

const getNoCacheHeaders = () => ({
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache'
});

export const getCloudLatest = async () => {
  const cached = getCachedData('CACHE_CLOUD_LATEST');
  try {
    const headers = getNoCacheHeaders();

    // 1st Table (Live AQI): AQI_LIVE_NODE1 - strictly fetches telemetry & temperature from AQI_LIVE_NODE1
    const res = await axios.get(`${getTableRestUrl(TABLE_AQI_LIVE)}?order=created_at.desc&limit=1`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_AQI_LIVE)}?limit=1`, { headers }));

    if (res.data && res.data[0]) {
      const formatted = formatRawReading(res.data[0]);
      if (formatted) {
        setCachedData('CACHE_CLOUD_LATEST', formatted);
        return { data: { status: 'success', data: formatted } };
      }
    }
  } catch (err) {
    console.warn('Direct Supabase AQI live fetch fallback to backend API:', err?.message || err);
  }

  if (cached) {
    return { data: { status: 'success', data: cached, isOffline: true } };
  }

  return api.get('/cloud/latest').catch(() => {
    return { data: { status: 'offline', data: cached } };
  });
};

export const getCloudLiveHistory = async (limit = 50) => {
  const cached = getCachedData('CACHE_AQI_LIVE_HISTORY');
  try {
    const headers = getNoCacheHeaders();

    const res = await axios.get(`${getTableRestUrl(TABLE_AQI_LIVE)}?order=created_at.desc&limit=${limit}`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_AQI_LIVE)}?limit=${limit}`, { headers }));

    const list = Array.isArray(res.data) ? res.data : [];
    const history = list.map(formatRawReading).filter(Boolean);

    if (history.length > 0) {
      setCachedData('CACHE_AQI_LIVE_HISTORY', history);
      return {
        data: {
          status: 'success',
          count: history.length,
          history
        }
      };
    }
  } catch (err) {
    console.warn('Direct Supabase live history fetch fallback to backend API:', err?.message || err);
  }

  if (cached && cached.length > 0) {
    return { data: { status: 'success', count: cached.length, history: cached, isOffline: true } };
  }

  return api.get(`/cloud/live-history?limit=${limit}`).catch(() => {
    return { data: { status: 'offline', count: cached?.length || 0, history: cached || [] } };
  });
};

export const getWeatherLatest = async () => {
  const cached = getCachedData('CACHE_WEATHER_LATEST');
  try {
    const headers = getNoCacheHeaders();
    const res = await axios.get(`${getTableRestUrl(TABLE_WEATHER_LIVE)}?order=created_at.desc&limit=1`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_WEATHER_LIVE)}?limit=1`, { headers }));

    if (res.data && res.data[0]) {
      const raw = res.data[0];
      const data = {
        id: raw.id,
        timestamp: raw.created_at || raw.timestamp_hour || raw.timestamp,
        temperature: raw.temperature,
        humidity: raw.humidity,
        wind_speed: raw.wind_speed,
        wind_direction: raw.wind_direction,
        rain_gauge: raw.rain_gauge ?? raw.rain
      };
      setCachedData('CACHE_WEATHER_LATEST', data);
      return { data: { status: 'success', data } };
    }
  } catch (err) {
    console.warn('Direct Supabase weather latest fetch fallback to backend API:', err?.message || err);
  }

  if (cached) {
    return { data: { status: 'success', data: cached, isOffline: true } };
  }

  return api.get('/cloud/weather-latest').catch(() => {
    return { data: { status: 'offline', data: cached } };
  });
};

export const getCloudWeatherLiveHistory = async (limit = 50) => {
  const cached = getCachedData('CACHE_WEATHER_LIVE_HISTORY');
  try {
    const headers = getNoCacheHeaders();

    const res = await axios.get(`${getTableRestUrl(TABLE_WEATHER_LIVE)}?order=created_at.desc&limit=${limit}`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_WEATHER_LIVE)}?limit=${limit}`, { headers }));

    const list = Array.isArray(res.data) ? res.data : [];
    const history = list.map((raw) => {
      if (!raw) return null;
      return {
        id: raw.id,
        timestamp: raw.created_at || raw.timestamp_hour || raw.timestamp,
        temperature: raw.temperature,
        humidity: raw.humidity,
        wind_speed: raw.wind_speed,
        wind_direction: raw.wind_direction,
        rain_gauge: raw.rain_gauge ?? raw.rain
      };
    }).filter(Boolean);

    if (history.length > 0) {
      setCachedData('CACHE_WEATHER_LIVE_HISTORY', history);
      return {
        data: {
          status: 'success',
          count: history.length,
          history
        }
      };
    }
  } catch (err) {
    console.warn('Direct Supabase weather live history fetch fallback to backend API:', err?.message || err);
  }

  if (cached && cached.length > 0) {
    return { data: { status: 'success', count: cached.length, history: cached, isOffline: true } };
  }

  return api.get(`/cloud/weather-live-history?limit=${limit}`).catch(() => {
    return { data: { status: 'offline', count: cached?.length || 0, history: cached || [] } };
  });
};

export const getCloudHistory = async (limit = 96) => {
  const cached = getCachedData('CACHE_AQI_HISTORICAL');
  try {
    const headers = getNoCacheHeaders();

    const res = await axios.get(`${getTableRestUrl(TABLE_AQI_HISTORICAL)}?order=timestamp_hour.desc&limit=${limit}`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_AQI_HISTORICAL)}?limit=${limit}`, { headers }));

    const list = Array.isArray(res.data) ? res.data : [];
    const history = list.map(formatRawReading).filter(Boolean);

    if (history.length > 0) {
      setCachedData('CACHE_AQI_HISTORICAL', history);
      return {
        data: {
          status: 'success',
          count: history.length,
          history
        }
      };
    }
  } catch (err) {
    console.warn('Direct Supabase AQI history fetch fallback to backend API:', err?.message || err);
  }

  if (cached && cached.length > 0) {
    return { data: { status: 'success', count: cached.length, history: cached, isOffline: true } };
  }

  return api.get(`/cloud/history?limit=${limit}`).catch(() => {
    return { data: { status: 'offline', count: cached?.length || 0, history: cached || [] } };
  });
};

export const getCloudWeatherHistory = async (limit = 96) => {
  const cached = getCachedData('CACHE_WEATHER_HISTORICAL');
  try {
    const headers = getNoCacheHeaders();

    const res = await axios.get(`${getTableRestUrl(TABLE_WEATHER_HISTORICAL)}?order=timestamp_hour.desc&limit=${limit}`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_WEATHER_HISTORICAL)}?limit=${limit}`, { headers }));

    const list = Array.isArray(res.data) ? res.data : [];
    const history = list.map((raw) => {
      if (!raw) return null;
      return {
        id: raw.timestamp_hour || raw.id,
        timestamp: raw.timestamp_hour || raw.created_at || raw.timestamp,
        temperature: raw.temperature,
        humidity: raw.humidity,
        wind_speed: raw.wind_speed,
        wind_direction: raw.wind_direction,
        rain_gauge: raw.rain_gauge ?? raw.rain
      };
    }).filter(Boolean);

    if (history.length > 0) {
      setCachedData('CACHE_WEATHER_HISTORICAL', history);
      return {
        data: {
          status: 'success',
          count: history.length,
          history
        }
      };
    }
  } catch (err) {
    console.warn('Direct Supabase Weather history fetch fallback to backend API:', err?.message || err);
  }

  if (cached && cached.length > 0) {
    return { data: { status: 'success', count: cached.length, history: cached, isOffline: true } };
  }

  return api.get(`/cloud/weather-history?limit=${limit}`).catch(() => {
    return { data: { status: 'offline', count: cached?.length || 0, history: cached || [] } };
  });
};


export default api;

