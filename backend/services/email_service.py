import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from typing import Dict, Any, Optional

def get_smtp_config():
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip().replace(" ", "")
    sender_name = os.getenv("SENDER_NAME", "WeatherNet Data Portal")
    return host, port, user, password, sender_name

def is_smtp_configured() -> bool:
    _, _, user, password, _ = get_smtp_config()
    return bool(user and password)

def send_dataset_email(
    recipient_email: str,
    recipient_name: str,
    dataset_name: str,
    filename: str,
    csv_content: str,
    rows_count: int,
    purpose: Optional[str] = ""
) -> Dict[str, Any]:
    """
    Sends an approved dataset as a CSV email attachment to the requester.
    """
    host, port, user, password, sender_name = get_smtp_config()
    if not (user and password):
        return {
            "success": False,
            "requires_smtp_config": True,
            "message": "SMTP credentials (SMTP_USER and SMTP_PASSWORD) are not configured in backend/.env."
        }

    subject = f"Your Requested Dataset: {dataset_name} is Approved"
    clean_name = recipient_name.strip() if recipient_name else "Researcher"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; }}
        .card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
        .header {{ background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 28px 24px; text-align: center; }}
        .header h1 {{ margin: 0 0 6px 0; font-size: 22px; font-weight: 800; color: #00bfa5; }}
        .header p {{ margin: 0; font-size: 14px; color: #94a3b8; }}
        .content {{ padding: 24px; }}
        .details-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 18px 0; font-size: 14px; line-height: 1.6; }}
        .badge {{ display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; background: #dcfce7; color: #15803d; }}
        .footer {{ text-align: center; font-size: 12px; color: #94a3b8; padding: 18px 24px; border-top: 1px solid #f1f5f9; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>Dataset Request Approved</h1>
          <p>Smart WeatherNet Atmospheric Telemetry Portal</p>
        </div>
        <div class="content">
          <p>Hello <strong>{clean_name}</strong>,</p>
          <p>Your request for environmental telemetry data has been reviewed and approved by the system administrator.</p>
          
          <div class="details-box">
            <div><strong>Dataset:</strong> {dataset_name}</div>
            <div><strong>Total Records:</strong> {rows_count} hourly data points</div>
            <div><strong>Status:</strong> <span class="badge">Approved & Attached</span></div>
            {f'<div><strong>Stated Purpose:</strong> {purpose}</div>' if purpose else ''}
          </div>

          <p>The complete requested dataset has been attached to this email as a CSV file (<code>{filename}</code>).</p>
          <p>Thank you for contributing to atmospheric research and environmental monitoring.</p>
        </div>
        <div class="footer">
          Smart WeatherNet Node 1 Telemetry Platform &bull; Automated Data Delivery
        </div>
      </div>
    </body>
    </html>
    """

    text_content = f"""
    Dataset Request Approved

    Hello {clean_name},

    Your request for environmental telemetry data has been approved.

    Dataset: {dataset_name}
    Total Records: {rows_count} hourly data points
    Filename: {filename}
    {f'Purpose: {purpose}' if purpose else ''}

    The complete CSV file is attached to this email.

    Smart WeatherNet Node 1 Telemetry Platform
    """

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = f"{sender_name} <{user}>"
    msg["To"] = recipient_email

    # Alternative text/html body
    body_part = MIMEMultipart("alternative")
    body_part.attach(MIMEText(text_content, "plain"))
    body_part.attach(MIMEText(html_content, "html"))
    msg.attach(body_part)

    # Attach CSV
    try:
        csv_attachment = MIMEApplication(csv_content.encode("utf-8"), Name=filename)
        csv_attachment["Content-Disposition"] = f'attachment; filename="{filename}"'
        msg.attach(csv_attachment)
    except Exception as att_err:
        return {"success": False, "message": f"Failed to attach CSV: {str(att_err)}"}

    try:
        server = smtplib.SMTP(host, port, timeout=25)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(user, password)
        server.sendmail(user, [recipient_email], msg.as_string())
        try:
            server.quit()
        except Exception:
            pass
        
        return {
            "success": True,
            "message": f"Successfully sent dataset CSV to {recipient_email}"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"SMTP delivery failed: {str(e)}"
        }
