import os
import smtplib
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any, Optional
import httpx
from dotenv import load_dotenv

load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://sgkdpliqlhgiqsabxzxe.supabase.co").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
ALERT_RECIPIENT_EMAILS = [
    e.strip() for e in os.getenv("ALERT_RECIPIENT_EMAILS", "manish.23cs065@sode-edu.in").split(",") if e.strip()
]
ALERT_THRESHOLD_MINUTES = int(os.getenv("ALERT_THRESHOLD_MINUTES", "30"))
ALERT_COOLDOWN_HOURS = int(os.getenv("ALERT_COOLDOWN_HOURS", "24")) # Max 1 email per day

# SMTP Sender Configuration
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SENDER_NAME = os.getenv("SENDER_NAME", "Smart AirNet Sentinel Alert")

MONITORED_TABLES = [
    {"name": "AQI_LIVE_NODE1", "label": "AQI Live Telemetry (Node 1)", "type": "Air Quality"},
    {"name": "WEATHER_LIVE_NODE1", "label": "Weather Live Telemetry (Node 1)", "type": "Weather Sensors"}
]


def send_email_alert(subject: str, html_content: str, text_content: str, recipients: List[str]) -> bool:
    """Sends an email alert to multiple recipients via SMTP."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print("[ALERT ERROR] SMTP_USER or SMTP_PASSWORD is not set. Cannot send email.")
        print(f"Would have sent alert to {recipients}: {subject}")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SENDER_NAME} <{SMTP_USER}>"
    msg["To"] = ", ".join(recipients)

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, recipients, msg.as_string())
        print(f"[ALERT SENT] Successfully emailed alert to: {', '.join(recipients)}")
        return True
    except Exception as e:
        print(f"[ALERT ERROR] Failed to send email via SMTP: {e}")
        return False


def get_latest_node_reading(table_name: str) -> Optional[Dict[str, Any]]:
    """Fetches the newest record from the given live table."""
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?order=created_at.desc.nullslast&limit=1"
    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.get(url, headers=headers)
            if res.status_code == 200:
                rows = res.json()
                if rows and len(rows) > 0:
                    return rows[0]
    except Exception as e:
        print(f"[ERROR] Failed to query {table_name}: {e}")
    return None


def get_tracker_status() -> Dict[str, Dict[str, Any]]:
    """Fetches tracker records from node_alert_tracker."""
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    url = f"{SUPABASE_URL}/rest/v1/node_alert_tracker?select=*"
    tracker_dict = {}
    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.get(url, headers=headers)
            if res.status_code == 200:
                for row in res.json():
                    tracker_dict[row["node_name"]] = row
    except Exception as e:
        print(f"[ERROR] Failed to query node_alert_tracker: {e}")
    return tracker_dict


def update_tracker(node_name: str, alerted: bool, alerted_at: Optional[str] = None):
    """Updates node_alert_tracker in Supabase."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    url = f"{SUPABASE_URL}/rest/v1/node_alert_tracker?node_name=eq.{node_name}"
    payload: Dict[str, Any] = {"alert_dispatched": alerted}
    if alerted_at is not None:
        payload["last_alerted_at"] = alerted_at

    try:
        with httpx.Client(timeout=10.0) as client:
            client.patch(url, json=payload, headers=headers)
    except Exception as e:
        print(f"[ERROR] Failed to update node_alert_tracker for {node_name}: {e}")


def check_and_alert():
    """
    Main sentinel execution:
    1. Checks telemetry arrival for monitored tables.
    2. Identifies if data is delayed past ALERT_THRESHOLD_MINUTES (30 mins).
    3. Enforces 1 email per day per node via node_alert_tracker.
    4. Dispatches email alert if downtime exceeds threshold and cooldown has passed.
    """
    now = datetime.now(timezone.utc)
    print(f"--- Running Sensor Health & Data Alert Sentinel at {now.isoformat()} ---")
    trackers = get_tracker_status()

    for node in MONITORED_TABLES:
        table_name = node["name"]
        label = node["label"]
        reading = get_latest_node_reading(table_name)
        tracker = trackers.get(table_name, {})

        last_alerted_raw = tracker.get("last_alerted_at")
        last_alerted_dt = None
        if last_alerted_raw:
            try:
                last_alerted_dt = datetime.fromisoformat(last_alerted_raw.replace("Z", "+00:00"))
            except Exception:
                pass

        if not reading:
            print(f"[{table_name}] No records found in table!")
            continue

        raw_created_at = reading.get("created_at")
        if not raw_created_at:
            print(f"[{table_name}] Record has no created_at timestamp.")
            continue

        created_dt = datetime.fromisoformat(raw_created_at.replace("Z", "+00:00"))
        minutes_silent = (now - created_dt).total_seconds() / 60.0

        ist_offset = timedelta(hours=5, minutes=30)
        last_seen_ist = (created_dt + ist_offset).strftime("%d %b %Y, %I:%M %p IST")
        now_ist = (now + ist_offset).strftime("%d %b %Y, %I:%M %p IST")

        print(f"[{table_name}] Last seen: {last_seen_ist} ({minutes_silent:.1f} mins ago).")

        # Check if silence exceeds threshold (30 minutes)
        if minutes_silent > ALERT_THRESHOLD_MINUTES:
            # Check 1 email per day cooldown (24 hours)
            if last_alerted_dt:
                hours_since_alert = (now - last_alerted_dt).total_seconds() / 3600.0
                if hours_since_alert < ALERT_COOLDOWN_HOURS:
                    print(f"[{table_name}] INACTIVE, but an alert was already sent {hours_since_alert:.1f}h ago (Cooldown: {ALERT_COOLDOWN_HOURS}h). Skipping to respect 1 mail per day.")
                    continue

            # Format downtime duration
            hours = int(minutes_silent // 60)
            mins = int(minutes_silent % 60)
            duration_str = f"{hours}h {mins}m" if hours > 0 else f"{mins} minutes"

            subject = f"🔴 ALERT: No Data Received from {table_name} for {duration_str}"

            text_content = f"""
SMART AIRNET SENSOR ALERT
==========================
Table: {table_name} ({label})
Status: OFFLINE / NO RECENT DATA

The system detected that {table_name} has stopped transmitting data.
- Silence Duration: {duration_str} (Threshold: {ALERT_THRESHOLD_MINUTES} mins)
- Last Data Received: {last_seen_ist}
- Current Check Time: {now_ist}

Last Reported Telemetry:
{reading}

Please inspect the sensor node hardware and internet connectivity.
(This notification is rate-limited to a maximum of 1 email per day per node).
"""

            html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }}
    .card {{ background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 580px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ background-color: #dc2626; color: #ffffff; padding: 20px 24px; text-align: left; }}
    .header h2 {{ margin: 0; font-size: 20px; }}
    .content {{ padding: 24px; color: #334155; font-size: 14px; line-height: 1.6; }}
    .badge {{ display: inline-block; background-color: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; }}
    .info-table {{ width: 100%; border-collapse: collapse; margin: 16px 0; }}
    .info-table td {{ padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }}
    .info-table td.label {{ color: #64748b; font-weight: 600; width: 40%; }}
    .info-table td.val {{ color: #0f172a; font-weight: 700; }}
    .footer {{ background-color: #f1f5f9; color: #64748b; padding: 14px 24px; font-size: 12px; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>⚠️ Sensor Telemetry Alert</h2>
    </div>
    <div class="content">
      <p>Data from <strong>{label}</strong> has stopped arriving at Supabase Cloud.</p>
      <div style="margin: 12px 0;">
        <span class="badge">🔴 INACTIVE FOR {duration_str.upper()}</span>
      </div>
      <table class="info-table">
        <tr><td class="label">Target Table:</td><td class="val">{table_name}</td></tr>
        <tr><td class="label">Last Data Received:</td><td class="val">{last_seen_ist}</td></tr>
        <tr><td class="label">Inactivity Duration:</td><td class="val">{duration_str} (Threshold: {ALERT_THRESHOLD_MINUTES}m)</td></tr>
        <tr><td class="label">Alert Timestamp:</td><td class="val">{now_ist}</td></tr>
      </table>
      <p style="margin-top: 16px;"><strong>Action Required:</strong> Please check the node's power supply, Wi-Fi connectivity, or microcontroller gateway.</p>
    </div>
    <div class="footer">
      Smart AirNet Automated Health Sentinel • Rate limited to 1 email per day
    </div>
  </div>
</body>
</html>
"""
            success = send_email_alert(subject, html_content, text_content, ALERT_RECIPIENT_EMAILS)
            if success:
                update_tracker(table_name, alerted=True, alerted_at=now.isoformat())
        else:
            print(f"[{table_name}] HEALTHY. Data received within the last {ALERT_THRESHOLD_MINUTES} minutes.")
            if tracker.get("alert_dispatched"):
                # Sensor recovered, reset alert dispatched flag
                update_tracker(table_name, alerted=False)


if __name__ == "__main__":
    check_and_alert()
