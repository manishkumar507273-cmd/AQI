import httpx, json

URL = "https://sgkdpliqlhgiqsabxzxe.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNna2RwbGlxbGhnaXFzYWJ4enhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzgzMTIsImV4cCI6MjEwMDQ1NDMxMn0.vMtbXomFdmOcBkhhSoiyYyp_vFxOhg4MYCFCw9-pL30"
headers = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json"
}

with httpx.Client(timeout=15.0) as client:
    for tbl in ["AQI_LIVE_NODE1", "AQI_NODE1", "WEATHER_LIVE_NODE1", "WEATHER_NODE1"]:
        print(f"\n--- Checking Table: {tbl} ---")
        try:
            r = client.get(f"{URL}/rest/v1/{tbl}?limit=2", headers=headers)
            print(f"Status: {r.status_code}")
            if r.status_code == 200:
                data = r.json()
                print(f"Count returned: {len(data)}")
                if len(data) > 0:
                    print("Sample row keys:", list(data[0].keys()))
                    print("Sample row:", json.dumps(data[0], indent=2))
            else:
                print(f"Response: {r.text}")
        except Exception as e:
            print(f"Error: {e}")
