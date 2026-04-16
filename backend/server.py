from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, Response, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, date
from passlib.context import CryptContext
from jose import JWTError, jwt
import re
from bson import ObjectId
import io
import csv
import base64
import json
from math import radians, cos, sin, asin, sqrt
import asyncio
from urllib import request as urllib_request, error as urllib_error
from zoneinfo import ZoneInfo
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'emplora_hr')]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'emplora-hr-secret-key-2025-secure')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
ACCESS_TOKEN_EXPIRE_REMEMBER_ME = 60 * 24 * 30  # 30 days for remember me

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI(
    title="Emplora HR API",
    description="Smart Attendance & Workforce Management - Emplora",
    version="1.0.0"
)
app.state.notification_worker = None

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def start_background_notification_worker():
    if not app.state.notification_worker:
        app.state.notification_worker = asyncio.create_task(background_notification_worker())


@app.on_event("shutdown")
async def stop_background_notification_worker():
    task = getattr(app.state, "notification_worker", None)
    if task:
        task.cancel()
        app.state.notification_worker = None

# ===== Utility Functions =====
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_mail_settings() -> dict:
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port = int(os.environ.get("SMTP_PORT", "465") or "465")
    smtp_username = os.environ.get("SMTP_USERNAME", "").strip()
    smtp_password = os.environ.get("SMTP_PASSWORD", "").strip()
    from_email = os.environ.get("SMTP_FROM_EMAIL", smtp_username or "support@emplora.org").strip()
    from_name = os.environ.get("SMTP_FROM_NAME", "Emplora").strip() or "Emplora"
    use_ssl = str(os.environ.get("SMTP_USE_SSL", "true")).strip().lower() not in {"0", "false", "no"}
    use_starttls = str(os.environ.get("SMTP_USE_STARTTLS", "false")).strip().lower() in {"1", "true", "yes"}
    return {
        "host": smtp_host,
        "port": smtp_port,
        "username": smtp_username,
        "password": smtp_password,
        "from_email": from_email,
        "from_name": from_name,
        "use_ssl": use_ssl,
        "use_starttls": use_starttls,
    }

def email_delivery_enabled() -> bool:
    settings = get_mail_settings()
    return bool(settings["host"] and settings["username"] and settings["password"] and settings["from_email"])

def build_hr_welcome_email(first_name: str, company_name: str) -> Dict[str, str]:
    web_base_url = os.environ.get("WEB_APP_URL", "https://www.emplora.org").rstrip("/")
    login_url = os.environ.get("WEB_LOGIN_URL", f"{web_base_url}/login").strip()
    support_email = os.environ.get("SUPPORT_EMAIL", "support@emplora.org").strip()
    mobile_note = os.environ.get(
        "MOBILE_APP_NOTE",
        "Employees and managers can use the Emplora mobile app after you create their accounts from inside your HR workspace.",
    ).strip()

    subject = f"Welcome to Emplora, {company_name}"
    text_body = f"""Hi {first_name},

Welcome to Emplora. Your HR workspace for {company_name} is ready.

Sign in here:
{login_url}

What you can do inside Emplora:
- Add employees and managers
- Set pay rates and leave balances
- Build schedules and send them to employees
- Review attendance, late arrivals, and leave requests
- Run payroll and send paystubs
- Export backups and reports

Mobile app note:
{mobile_note}

A good first setup path:
1. Sign in to your HR dashboard
2. Add your departments and first employees
3. Set leave balances, pay details, and regular hours
4. Review schedules, attendance, payroll, and paystubs

If you need help, reply to {support_email}.

Welcome aboard,
The Emplora Team
"""

    html_body = f"""
    <html>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
                <tr>
                  <td style="background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);padding:28px 32px;color:#ffffff;">
                    <div style="font-size:28px;font-weight:700;letter-spacing:-0.02em;">Welcome to Emplora</div>
                    <div style="margin-top:10px;font-size:16px;line-height:1.6;color:#dbeafe;">
                      Your HR workspace for <strong style="color:#ffffff;">{company_name}</strong> is ready to go.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi {first_name},</p>
                    <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">
                      Thanks for creating your Emplora HR account. You can now manage your company workspace from one place and get your team set up quickly.
                    </p>
                    <div style="margin:26px 0;">
                      <a href="{login_url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;">
                        Sign In to Your Dashboard
                      </a>
                    </div>
                    <div style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#334155;">
                      Here’s what you can do right away:
                    </div>
                    <ul style="margin:0 0 24px 20px;padding:0;color:#334155;font-size:15px;line-height:1.8;">
                      <li>Add employees and managers</li>
                      <li>Set pay rates, deductions, and leave balances</li>
                      <li>Create schedules and send them to employees</li>
                      <li>Review attendance, lateness, and leave requests</li>
                      <li>Run payroll and publish branded paystubs</li>
                      <li>Export reports and backups for safekeeping</li>
                    </ul>
                    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin:0 0 24px;">
                      <div style="font-weight:700;font-size:15px;color:#1d4ed8;margin-bottom:8px;">Mobile app note</div>
                      <div style="font-size:14px;line-height:1.7;color:#334155;">{mobile_note}</div>
                    </div>
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px;">
                      <div style="font-weight:700;font-size:15px;margin-bottom:8px;">Recommended first steps</div>
                      <ol style="margin:0 0 0 18px;padding:0;color:#334155;font-size:14px;line-height:1.8;">
                        <li>Sign in to your HR dashboard</li>
                        <li>Add your departments and first employees</li>
                        <li>Set regular hours, pay details, and leave balances</li>
                        <li>Start using schedules, attendance, payroll, and paystubs</li>
                      </ol>
                    </div>
                    <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#475569;">
                      Need help? Reply to <a href="mailto:{support_email}" style="color:#2563eb;text-decoration:none;">{support_email}</a>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """

    return {"subject": subject, "text": text_body, "html": html_body}

def send_email_message(to_email: str, subject: str, text_body: str, html_body: Optional[str] = None) -> None:
    settings = get_mail_settings()
    if not email_delivery_enabled():
        raise RuntimeError("Email delivery is not configured")

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{settings['from_name']} <{settings['from_email']}>"
    message["To"] = to_email
    message.attach(MIMEText(text_body, "plain", "utf-8"))
    if html_body:
        message.attach(MIMEText(html_body, "html", "utf-8"))

    if settings["use_ssl"]:
        with smtplib.SMTP_SSL(settings["host"], settings["port"], context=ssl.create_default_context()) as server:
            server.login(settings["username"], settings["password"])
            server.sendmail(settings["from_email"], [to_email], message.as_string())
        return

    with smtplib.SMTP(settings["host"], settings["port"]) as server:
        server.ehlo()
        if settings["use_starttls"]:
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
        server.login(settings["username"], settings["password"])
        server.sendmail(settings["from_email"], [to_email], message.as_string())

def send_hr_welcome_email(recipient_email: str, first_name: str, company_name: str) -> None:
    email_payload = build_hr_welcome_email(first_name=first_name, company_name=company_name)
    send_email_message(
        to_email=recipient_email,
        subject=email_payload["subject"],
        text_body=email_payload["text"],
        html_body=email_payload["html"],
    )


def send_contact_email(payload: ContactRequest) -> None:
    support_email = os.environ.get("SUPPORT_EMAIL", "support@emplora.org").strip() or "support@emplora.org"
    employee_range = payload.employees or "Not provided"
    phone = payload.phone or "Not provided"
    message = payload.message or "No message provided."

    text_body = f"""New Emplora contact request

Business Name: {payload.business_name}
Contact Name: {payload.contact_name}
Email: {payload.email}
Phone: {phone}
Employee Range: {employee_range}

Message:
{message}
"""

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">New Emplora contact request</h2>
        <p><strong>Business Name:</strong> {payload.business_name}</p>
        <p><strong>Contact Name:</strong> {payload.contact_name}</p>
        <p><strong>Email:</strong> {payload.email}</p>
        <p><strong>Phone:</strong> {phone}</p>
        <p><strong>Employee Range:</strong> {employee_range}</p>
        <p><strong>Message:</strong></p>
        <div style="padding: 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
          {message.replace(chr(10), '<br />')}
        </div>
      </body>
    </html>
    """

    send_email_message(
        to_email=support_email,
        subject=f"New Emplora contact request from {payload.business_name}",
        text_body=text_body,
        html_body=html_body,
    )

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the distance between two points on Earth in meters"""
    R = 6371000  # Earth's radius in meters
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return R * c

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["super_admin", "hr_admin", "hr"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_manager(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["super_admin", "hr_admin", "manager", "hr"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    return current_user


async def ensure_company_for_user(user: dict) -> Optional[str]:
    if user.get("company_id"):
        return user.get("company_id")

    employee = await db.employees.find_one({"user_id": user["id"]}) or await db.employees.find_one({"email": user["email"]})
    if employee and employee.get("company_id"):
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"company_id": employee["company_id"], "updated_at": datetime.utcnow()}},
        )
        user["company_id"] = employee["company_id"]
        return employee["company_id"]

    if user["role"] in ["super_admin", "hr_admin", "hr"]:
        company_id = str(uuid.uuid4())
        company_name = f"{user.get('first_name', 'HR')}'s Workspace"
        now = datetime.utcnow()
        await db.companies.insert_one(
            {
                "id": company_id,
                "name": company_name,
                "owner_user_id": user["id"],
                "created_at": now,
                "updated_at": now,
            }
        )
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"company_id": company_id, "updated_at": now}},
        )
        user["company_id"] = company_id
        return company_id

    return None


async def get_current_company_id(current_user: dict) -> Optional[str]:
    return await ensure_company_for_user(current_user)

# ===== Pydantic Models =====
def make_pdf_bytes(
    employee_name: str,
    employee_code: str,
    pay_period_start: str,
    pay_period_end: str,
    pay_date: str,
    gross_pay: float,
    net_pay: float,
    basic_pay: float = 0,
    overtime_pay: float = 0,
    bonus: float = 0,
    tax: float = 0,
    deductions: float = 0,
    insurance_deduction: float = 0,
    pension_deduction: float = 0,
    benefits_deduction: float = 0,
    department_name: Optional[str] = None,
    job_title: Optional[str] = None,
) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    logo_candidates = [
        ROOT_DIR.parent / "frontend" / "assets" / "images" / "icon.png",
        ROOT_DIR / "icon.png",
    ]
    logo_path = next((path for path in logo_candidates if path.exists()), None)

    def draw_money(value: float) -> str:
        return f"${float(value or 0):,.2f}"

    def draw_column_row(left_x: float, right_x: float, y_pos: float, label: str, value: str, bold: bool = False):
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 10.5)
        c.setFillColor(colors.HexColor("#334155"))
        c.drawString(left_x, y_pos, label)
        c.drawRightString(right_x, y_pos, value)

    c.setFillColor(colors.HexColor("#0F172A"))
    c.setStrokeColor(colors.HexColor("#D9E2F0"))
    c.setLineWidth(1)

    if logo_path:
        try:
            c.drawImage(ImageReader(str(logo_path)), 50, height - 84, width=40, height=40, mask="auto")
        except Exception:
            pass

    c.setFont("Helvetica-Bold", 19)
    c.drawString(98, height - 56, "Emplora Paystub")
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#64748B"))
    c.drawString(98, height - 72, "Official earnings statement")

    c.setFillColor(colors.HexColor("#2563EB"))
    c.roundRect(width - 200, height - 92, 145, 40, 14, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width - 127.5, height - 68.5, f"Pay Date {pay_date}")

    c.setFillColor(colors.white)
    c.setFillColor(colors.HexColor("#FFFFFF"))
    c.roundRect(45, height - 208, width - 90, 92, 18, stroke=1, fill=1)

    c.setFillColor(colors.HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(60, height - 138, "Employee")
    c.drawString(305, height - 138, "Pay Period")

    c.setFont("Helvetica", 10.5)
    c.setFillColor(colors.HexColor("#334155"))
    c.drawString(60, height - 156, employee_name)
    c.drawString(60, height - 172, f"Employee ID: {employee_code}")
    if department_name:
        c.drawString(60, height - 188, f"Department: {department_name}")
    elif job_title:
        c.drawString(60, height - 188, f"Job Title: {job_title}")

    c.drawString(305, height - 156, f"Start: {pay_period_start}")
    c.drawString(305, height - 172, f"End: {pay_period_end}")
    if job_title and department_name:
        c.drawString(305, height - 188, f"Job Title: {job_title}")

    c.setFillColor(colors.white)
    c.roundRect(45, height - 455, (width - 105) / 2, 215, 18, stroke=1, fill=1)
    c.setFillColor(colors.white)
    c.roundRect(60 + (width - 105) / 2, height - 455, (width - 105) / 2, 215, 18, stroke=1, fill=1)

    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.drawString(60, height - 265, "Earnings")
    c.drawString(60 + (width - 105) / 2 + 15, height - 265, "Deductions")

    earnings_left = 60
    earnings_right = 45 + (width - 105) / 2 - 18
    deductions_left = 60 + (width - 105) / 2 + 15
    deductions_right = width - 60

    draw_column_row(earnings_left, earnings_right, height - 290, "Basic Pay", draw_money(basic_pay))
    draw_column_row(earnings_left, earnings_right, height - 314, "Overtime Pay", draw_money(overtime_pay))
    draw_column_row(earnings_left, earnings_right, height - 338, "Bonus", draw_money(bonus))
    draw_column_row(
        earnings_left,
        earnings_right,
        height - 362,
        "Pay Before Deductions",
        draw_money(basic_pay + overtime_pay + bonus),
    )
    draw_column_row(earnings_left, earnings_right, height - 386, "Gross Pay", draw_money(gross_pay), bold=True)

    total_deduction_amount = tax + deductions + insurance_deduction + pension_deduction + benefits_deduction
    draw_column_row(deductions_left, deductions_right, height - 290, "Tax", draw_money(tax))
    draw_column_row(deductions_left, deductions_right, height - 314, "Other Deductions", draw_money(deductions))
    draw_column_row(deductions_left, deductions_right, height - 338, "Insurance", draw_money(insurance_deduction))
    draw_column_row(deductions_left, deductions_right, height - 362, "Pension", draw_money(pension_deduction))
    draw_column_row(deductions_left, deductions_right, height - 386, "Benefits", draw_money(benefits_deduction))
    draw_column_row(
        deductions_left,
        deductions_right,
        height - 410,
        "Total Deductions",
        draw_money(total_deduction_amount),
        bold=True,
    )
    draw_column_row(deductions_left, deductions_right, height - 434, "Take Home Pay", draw_money(net_pay), bold=True)

    c.setFillColor(colors.HexColor("#DBEAFE"))
    c.roundRect(45, height - 530, width - 90, 54, 18, stroke=0, fill=1)
    c.setFillColor(colors.HexColor("#1E3A8A"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(62, height - 500, "Net Pay")
    c.drawRightString(width - 60, height - 500, draw_money(net_pay))

    c.setFillColor(colors.HexColor("#94A3B8"))
    c.setLineWidth(1)
    c.line(50, 52, width - 50, 52)
    c.setFillColor(colors.HexColor("#64748B"))
    c.setFont("Helvetica-Oblique", 9.5)
    c.drawString(50, 36, "Generated by Emplora using the official payroll paystub template.")
    c.drawRightString(width - 50, 36, f"Employee copy | Pay date {pay_date}")

    c.showPage()
    c.save()
    pdf = buffer.getvalue()
    buffer.close()
    return pdf


def make_payroll_review_pdf(review: "PayrollReviewResponse") -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    logo_candidates = [
        ROOT_DIR.parent / "frontend" / "assets" / "images" / "icon.png",
        ROOT_DIR / "icon.png",
    ]
    logo_path = next((path for path in logo_candidates if path.exists()), None)

    def draw_money(value: float) -> str:
        return f"${float(value or 0):,.2f}"

    c.setStrokeColor(colors.HexColor("#D9E2F0"))
    c.setFillColor(colors.HexColor("#0F172A"))
    c.setLineWidth(1)

    if logo_path:
        try:
            c.drawImage(ImageReader(str(logo_path)), 48, height - 84, width=36, height=36, mask="auto")
        except Exception:
            pass

    c.setFont("Helvetica-Bold", 18)
    c.drawString(94, height - 56, "Emplora Payroll Review")
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#64748B"))
    c.drawString(94, height - 72, "Payroll run summary and budget estimate")

    c.setFillColor(colors.HexColor("#2563EB"))
    c.roundRect(width - 220, height - 94, 165, 44, 14, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawCentredString(width - 137.5, height - 69, f"{review.pay_period_start} to {review.pay_period_end}")

    c.setFillColor(colors.white)
    c.roundRect(45, height - 190, width - 90, 92, 18, stroke=1, fill=1)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(62, height - 126, "Payroll Budget Needed")
    c.setFont("Helvetica-Bold", 24)
    c.drawString(62, height - 156, draw_money(review.total_budget))

    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#475569"))
    c.drawString(300, height - 126, f"Employees: {review.employee_count}")
    c.drawString(300, height - 144, f"Total hours: {review.total_hours:.2f}")
    c.drawString(300, height - 162, f"Gross pay: {draw_money(review.total_gross)}")
    c.drawString(300, height - 180, f"Total deductions: {draw_money(review.total_deductions)}")

    y = height - 230
    c.setFillColor(colors.HexColor("#F8FAFC"))
    c.roundRect(45, y - 24, width - 90, 24, 8, stroke=0, fill=1)
    c.setFillColor(colors.HexColor("#334155"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(56, y - 14, "Employee")
    c.drawString(245, y - 14, "Hours")
    c.drawString(310, y - 14, "Gross")
    c.drawString(390, y - 14, "Deductions")
    c.drawRightString(width - 58, y - 14, "Net")

    y -= 40
    c.setFont("Helvetica", 9.5)
    max_rows = 14
    for row in review.rows[:max_rows]:
        c.setFillColor(colors.HexColor("#0F172A"))
        c.drawString(56, y, row.employee_name[:28])
        c.setFillColor(colors.HexColor("#475569"))
        c.drawString(245, y, f"{row.hours_worked:.2f}")
        c.drawString(310, y, draw_money(row.gross_pay))
        c.drawString(390, y, draw_money(row.total_deductions))
        c.drawRightString(width - 58, y, draw_money(row.net_pay))
        y -= 20

    if len(review.rows) > max_rows:
        c.setFillColor(colors.HexColor("#64748B"))
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(56, y - 6, f"+ {len(review.rows) - max_rows} more employee rows in this payroll run")

    c.setFillColor(colors.HexColor("#94A3B8"))
    c.line(50, 44, width - 50, 44)
    c.setFillColor(colors.HexColor("#64748B"))
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(50, 28, "Generated by Emplora payroll review")
    c.drawRightString(width - 50, 28, f"Prepared {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")

    c.showPage()
    c.save()
    pdf = buffer.getvalue()
    buffer.close()
    return pdf


async def build_payroll_review(company_id: str, pay_period_start: str, pay_period_end: str) -> "PayrollReviewResponse":
    employees = await db.employees.find({"company_id": company_id, "status": {"$ne": "archived"}}).to_list(2000)
    departments = {
        department["id"]: department["name"]
        for department in await db.departments.find({"company_id": company_id}).to_list(500)
    }

    attendance_records = await db.attendance.find(
        {
            "company_id": company_id,
            "date": {"$gte": pay_period_start, "$lte": pay_period_end},
        }
    ).to_list(10000)

    attendance_by_employee: Dict[str, List[dict]] = {}
    for record in attendance_records:
        attendance_by_employee.setdefault(record["employee_id"], []).append(record)

    rows: List[PayrollReviewRow] = []
    total_budget = 0.0
    total_gross = 0.0
    total_net = 0.0
    total_hours = 0.0
    total_tax = 0.0
    total_deductions = 0.0

    for employee in employees:
        records = attendance_by_employee.get(employee["id"], [])
        worked_hours = round(sum(float(record.get("total_hours") or 0) for record in records), 2)

        pay_type = (employee.get("pay_type") or "hourly").lower()
        hourly_rate = float(employee.get("hourly_rate") or 0)
        annual_salary = float(employee.get("salary") or 0)
        base_rate = hourly_rate if pay_type == "hourly" else (annual_salary / 160 if annual_salary else 0)
        overtime_hours = round(max(0.0, worked_hours - 160), 2)
        overtime_rate = 1.5
        basic_salary = round(worked_hours * base_rate, 2)
        overtime_pay = round(overtime_hours * base_rate * overtime_rate, 2)
        bonus = 0.0
        deductions = 0.0
        tax = 0.0
        insurance_deduction = 0.0
        pension_deduction = 0.0
        benefits_deduction = 0.0
        gross_pay = round(basic_salary + overtime_pay + bonus, 2)
        total_deduction_amount = round(
            deductions + tax + insurance_deduction + pension_deduction + benefits_deduction,
            2,
        )
        net_pay = round(gross_pay - total_deduction_amount, 2)

        if worked_hours <= 0 and gross_pay <= 0:
            continue

        row = PayrollReviewRow(
            employee_id=employee["id"],
            employee_name=f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip() or "Unknown Employee",
            employee_code=employee.get("employee_id"),
            department_name=departments.get(employee.get("department_id")),
            job_title=employee.get("job_title"),
            hours_worked=worked_hours,
            base_rate=round(base_rate, 2),
            basic_salary=basic_salary,
            overtime_hours=overtime_hours,
            overtime_rate=overtime_rate,
            overtime_pay=overtime_pay,
            bonus=bonus,
            deductions=deductions,
            tax=tax,
            insurance_deduction=insurance_deduction,
            pension_deduction=pension_deduction,
            benefits_deduction=benefits_deduction,
            gross_pay=gross_pay,
            total_deductions=total_deduction_amount,
            net_pay=net_pay,
        )
        rows.append(row)

        total_budget += net_pay
        total_gross += gross_pay
        total_net += net_pay
        total_hours += worked_hours
        total_tax += tax
        total_deductions += total_deduction_amount

    rows.sort(key=lambda row: row.employee_name.lower())

    return PayrollReviewResponse(
        pay_period_start=pay_period_start,
        pay_period_end=pay_period_end,
        total_budget=round(total_budget, 2),
        total_gross=round(total_gross, 2),
        total_net=round(total_net, 2),
        total_hours=round(total_hours, 2),
        total_tax=round(total_tax, 2),
        total_deductions=round(total_deductions, 2),
        employee_count=len(rows),
        rows=rows,
    )


async def upsert_payroll_record_from_review(
    row: "PayrollReviewRow",
    pay_period_start: str,
    pay_period_end: str,
    company_id: str,
) -> dict:
    existing = await db.payroll.find_one(
        {
            "company_id": company_id,
            "employee_id": row.employee_id,
            "pay_period_start": pay_period_start,
            "pay_period_end": pay_period_end,
        }
    )

    payroll_doc = {
        "employee_id": row.employee_id,
        "company_id": company_id,
        "pay_period_start": pay_period_start,
        "pay_period_end": pay_period_end,
        "basic_salary": row.basic_salary,
        "overtime_hours": row.overtime_hours,
        "overtime_rate": row.overtime_rate,
        "overtime_pay": row.overtime_pay,
        "bonus": row.bonus,
        "gross_pay": row.gross_pay,
        "deductions": row.deductions,
        "tax": row.tax,
        "insurance_deduction": row.insurance_deduction,
        "pension_deduction": row.pension_deduction,
        "benefits_deduction": row.benefits_deduction,
        "net_pay": row.net_pay,
        "status": "pending",
        "notes": f"Payroll run generated for {pay_period_start} to {pay_period_end}",
        "updated_at": datetime.utcnow(),
    }

    if existing:
        await db.payroll.update_one({"id": existing["id"]}, {"$set": payroll_doc})
        saved = await db.payroll.find_one({"id": existing["id"]})
    else:
        payroll_doc["id"] = str(uuid.uuid4())
        payroll_doc["created_at"] = datetime.utcnow()
        await db.payroll.insert_one(payroll_doc)
        saved = payroll_doc

    return saved


async def seed_notification(title: str, message: str, target_role: str = "all", target_user_id: Optional[str] = None):
    notification = {
        "id": str(uuid.uuid4()),
        "type": "info",
        "title": title,
        "message": message,
        "target_role": target_role,
        "target_user_id": target_user_id,
        "read": False,
        "created_at": datetime.utcnow(),
    }
    await db.notifications.insert_one(notification)


def chunked(items: List[Any], size: int) -> List[List[Any]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


async def save_notification(
    title: str,
    message: str,
    notification_type: str = "info",
    target_role: str = "all",
    target_user_id: Optional[str] = None,
    company_id: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
):
    notification = {
        "id": str(uuid.uuid4()),
        "type": notification_type,
        "title": title,
        "message": message,
        "target_role": target_role,
        "target_user_id": target_user_id,
        "company_id": company_id,
        "data": data or {},
        "read": False,
        "created_at": datetime.utcnow(),
    }
    await db.notifications.insert_one(notification)
    return notification


async def get_active_push_tokens_for_user(user_id: str) -> List[str]:
    tokens = await db.push_tokens.find({"user_id": user_id, "active": True}).to_list(20)
    return [token["push_token"] for token in tokens if token.get("push_token")]


async def disable_invalid_push_tokens(tokens: List[str]):
    if not tokens:
        return

    await db.push_tokens.update_many(
        {"push_token": {"$in": tokens}},
        {"$set": {"active": False, "updated_at": datetime.utcnow()}},
    )


async def send_expo_push(tokens: List[str], title: str, message: str, data: Optional[Dict[str, Any]] = None):
    if not tokens:
        return

    payloads = [
        {
            "to": token,
            "title": title,
            "body": message,
            "sound": "default",
            "data": data or {},
        }
        for token in tokens
        if token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")
    ]

    if not payloads:
        return

    invalid_tokens: List[str] = []

    for batch in chunked(payloads, 100):
        body = json.dumps(batch).encode("utf-8")
        request = urllib_request.Request(
            "https://exp.host/--/api/v2/push/send",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            response_text = await asyncio.to_thread(lambda: urllib_request.urlopen(request, timeout=15).read().decode("utf-8"))
            response_json = json.loads(response_text)
            for ticket, payload in zip(response_json.get("data", []), batch):
                details = ticket.get("details") or {}
                if ticket.get("status") == "error" and details.get("error") == "DeviceNotRegistered":
                    invalid_tokens.append(payload["to"])
        except urllib_error.HTTPError as exc:
            logger.warning("Expo push request failed with HTTP %s", exc.code)
        except Exception as exc:
            logger.warning("Expo push request failed: %s", exc)

    if invalid_tokens:
        await disable_invalid_push_tokens(invalid_tokens)


async def notify_user(
    user_id: Optional[str],
    title: str,
    message: str,
    notification_type: str = "info",
    data: Optional[Dict[str, Any]] = None,
):
    if not user_id:
        return

    user = await db.users.find_one({"id": user_id})

    await save_notification(
        title=title,
        message=message,
        notification_type=notification_type,
        target_role="all",
        target_user_id=user_id,
        company_id=(user or {}).get("company_id"),
        data=data,
    )
    tokens = await get_active_push_tokens_for_user(user_id)
    await send_expo_push(tokens, title, message, data)


async def notify_employee_by_employee_id(
    employee_id: Optional[str],
    title: str,
    message: str,
    notification_type: str = "info",
    data: Optional[Dict[str, Any]] = None,
):
    if not employee_id:
        return

    employee = await db.employees.find_one({"id": employee_id})
    if not employee:
        return

    user = None
    if employee.get("user_id"):
        user = await db.users.find_one({"id": employee["user_id"]})
    if not user and employee.get("email"):
        user = await db.users.find_one({"email": employee["email"]})

    if not user:
        return

    await notify_user(user["id"], title, message, notification_type=notification_type, data=data)


async def apply_leave_balance_transition(
    employee_id: Optional[str],
    leave_type_id: Optional[str],
    days_count: Any,
    previous_status: Optional[str],
    new_status: Optional[str],
):
    if not employee_id or not leave_type_id or leave_type_id == "time_off":
        return

    try:
        requested_days = float(days_count or 0)
    except (TypeError, ValueError):
        return

    if requested_days <= 0:
        return

    delta = 0.0
    if previous_status != "approved" and new_status == "approved":
        delta = -requested_days
    elif previous_status == "approved" and new_status != "approved":
        delta = requested_days

    if not delta:
        return

    employee = await db.employees.find_one({"id": employee_id})
    if not employee:
        return

    current_balance = float((employee.get("leave_balance") or {}).get(leave_type_id, 0) or 0)
    next_balance = max(0.0, current_balance + delta)

    await db.employees.update_one(
        {"id": employee_id},
        {
            "$set": {
                f"leave_balance.{leave_type_id}": next_balance,
                "updated_at": datetime.utcnow(),
            }
        },
    )


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def normalize_time_string(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    for fmt in ("%H:%M", "%I:%M %p", "%I:%M%p", "%H:%M:%S"):
        try:
            parsed = datetime.strptime(text.upper(), fmt)
            return parsed.strftime("%H:%M")
        except ValueError:
            continue

    return None


def parse_schedule_datetime(date_value: str, time_value: Optional[str]) -> Optional[datetime]:
    normalized_time = normalize_time_string(time_value)
    if not normalized_time:
        return None

    try:
        return datetime.fromisoformat(f"{date_value}T{normalized_time}:00")
    except Exception:
        return None


def calculate_time_range_hours(start_time: Optional[str], end_time: Optional[str]) -> float:
    normalized_start = normalize_time_string(start_time)
    normalized_end = normalize_time_string(end_time)
    if not normalized_start or not normalized_end:
        return 0.0

    start_dt = parse_schedule_datetime("2026-01-01", normalized_start)
    end_dt = parse_schedule_datetime("2026-01-01", normalized_end)
    if not start_dt or not end_dt:
        return 0.0

    if end_dt <= start_dt:
        end_dt += timedelta(days=1)

    return round((end_dt - start_dt).total_seconds() / 3600, 2)


def validate_password_strength(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must include an uppercase letter")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must include a number")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(status_code=400, detail="Password must include a special character")


def get_shift_local_now(shift: Dict[str, Any]) -> datetime:
    timezone_name = shift.get("clock_in", {}).get("timezone") or "UTC"
    try:
        return datetime.now(ZoneInfo(timezone_name))
    except Exception:
        return datetime.utcnow()


async def get_schedule_for_employee_date(employee: dict, date_value: str) -> Optional[Dict[str, Any]]:
    scheduled = await db.schedules.find_one({"employee_id": employee["id"], "date": date_value})
    if scheduled:
        return scheduled

    regular_start = normalize_time_string(employee.get("regular_start_time"))
    regular_end = normalize_time_string(employee.get("regular_end_time"))
    if not regular_start or not regular_end:
        return None

    return {
        "id": f"regular-{employee['id']}-{date_value}",
        "employee_id": employee["id"],
        "date": date_value,
        "start_time": regular_start,
        "end_time": regular_end,
        "notes": "Regular hours of work",
        "is_regular_hours": True,
        "created_at": employee.get("created_at") or datetime.utcnow(),
        "updated_at": employee.get("updated_at") or datetime.utcnow(),
    }


def calculate_lateness(date_value: str, scheduled_start_time: Optional[str], actual_clock_in: Optional[datetime]) -> Dict[str, Any]:
    scheduled_dt = parse_schedule_datetime(date_value, scheduled_start_time)
    if not scheduled_dt or not actual_clock_in:
        return {"late_status": False, "minutes_late": 0}

    actual_naive = actual_clock_in.replace(tzinfo=None) if actual_clock_in.tzinfo else actual_clock_in
    minutes_late = max(0, int((actual_naive - scheduled_dt).total_seconds() // 60))
    return {"late_status": minutes_late > 0, "minutes_late": minutes_late}


def serialize_attendance_response(record: dict, employee_name: Optional[str] = None) -> "AttendanceResponse":
    return AttendanceResponse(
        id=record["id"],
        employee_id=record["employee_id"],
        employee_name=employee_name,
        date=record["date"],
        clock_in=record.get("clock_in"),
        clock_out=record.get("clock_out"),
        clock_in_location=record.get("clock_in_location"),
        clock_out_location=record.get("clock_out_location"),
        clock_in_local=record.get("clock_in_local"),
        clock_out_local=record.get("clock_out_local"),
        scheduled_start_time=record.get("scheduled_start_time"),
        scheduled_end_time=record.get("scheduled_end_time"),
        actual_clock_in=record.get("actual_clock_in"),
        actual_clock_out=record.get("actual_clock_out"),
        late_status=bool(record.get("late_status", False)),
        minutes_late=int(record.get("minutes_late", 0) or 0),
        missed_clock_in_alert_sent=bool(record.get("missed_clock_in_alert_sent", False)),
        timezone=record.get("timezone"),
        total_hours=record.get("total_hours"),
        status=record.get("status", "present"),
        notes=record.get("notes"),
        created_at=record.get("created_at", datetime.utcnow()),
    )


async def process_missed_clock_in_reminders():
    now = datetime.utcnow()
    today = now.strftime("%Y-%m-%d")
    employees = await db.employees.find(
        {
            "status": "active",
            "regular_start_time": {"$exists": True, "$ne": None},
            "regular_end_time": {"$exists": True, "$ne": None},
        }
    ).to_list(1000)

    for employee in employees:
        schedule = await get_schedule_for_employee_date(employee, today)
        if not schedule or not schedule.get("start_time"):
            continue

        scheduled_dt = parse_schedule_datetime(today, schedule.get("start_time"))
        if not scheduled_dt or now <= scheduled_dt:
            continue

        attendance = await db.attendance.find_one({"employee_id": employee["id"], "date": today})
        if attendance and attendance.get("clock_in"):
            continue
        if attendance and attendance.get("missed_clock_in_alert_sent"):
            continue

        if attendance:
            await db.attendance.update_one(
                {"id": attendance["id"]},
                {
                    "$set": {
                        "scheduled_start_time": normalize_time_string(schedule.get("start_time")),
                        "scheduled_end_time": normalize_time_string(schedule.get("end_time")),
                        "missed_clock_in_alert_sent": True,
                        "updated_at": now,
                    }
                },
            )
        else:
            await db.attendance.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "employee_id": employee["id"],
                    "date": today,
                    "clock_in": None,
                    "clock_out": None,
                    "clock_in_location": None,
                    "clock_out_location": None,
                    "clock_in_local": None,
                    "clock_out_local": None,
                    "scheduled_start_time": normalize_time_string(schedule.get("start_time")),
                    "scheduled_end_time": normalize_time_string(schedule.get("end_time")),
                    "actual_clock_in": None,
                    "actual_clock_out": None,
                    "late_status": False,
                    "minutes_late": 0,
                    "missed_clock_in_alert_sent": True,
                    "timezone": None,
                    "total_hours": None,
                    "status": "scheduled",
                    "notes": None,
                    "created_at": now,
                    "updated_at": now,
                }
            )

        start_label = schedule.get("start_time")
        await notify_employee_by_employee_id(
            employee["id"],
            "Scheduled shift reminder",
            f"You are scheduled to start at {start_label} and have not clocked in.",
            notification_type="missed_clock_in",
            data={"employee_id": employee["id"], "date": today, "scheduled_start_time": start_label},
        )


async def process_expired_breaks():
    now = datetime.utcnow()
    active_breaks = await db.shifts.find(
        {"status": "on_break", "current_break": {"$ne": None}}
    ).to_list(500)

    for shift in active_breaks:
        current_break = shift.get("current_break") or {}
        break_start = parse_iso_datetime(current_break.get("start") or current_break.get("start_local"))
        if not break_start:
            continue

        normalized_break_start = break_start.replace(tzinfo=None) if break_start.tzinfo else break_start
        if (now - normalized_break_start) < timedelta(minutes=60):
            continue

        break_end = now
        break_duration = int((break_end - normalized_break_start).total_seconds())
        completed_break = {
            "id": current_break.get("id", str(uuid.uuid4())),
            "start": current_break.get("start"),
            "start_local": current_break.get("start_local"),
            "start_location": current_break.get("start_location"),
            "end": break_end.isoformat(),
            "end_local": break_end.isoformat(),
            "duration_seconds": break_duration,
            "auto_ended": True,
        }
        breaks = shift.get("breaks", [])
        breaks.append(completed_break)

        await db.shifts.update_one(
            {"id": shift["id"], "status": "on_break"},
            {
                "$set": {
                    "status": "working",
                    "current_break": None,
                    "breaks": breaks,
                    "total_break_seconds": shift.get("total_break_seconds", 0) + break_duration,
                    "updated_at": now,
                    "auto_resumed_at": now,
                }
            },
        )

        await notify_employee_by_employee_id(
            shift.get("employee_id"),
            "Break ended",
            "Your break time expired and you were automatically clocked back in.",
            notification_type="break_auto_end",
            data={"shift_id": shift["id"], "employee_id": shift.get("employee_id")},
        )


async def process_after_hours_clock_out_reminders():
    active_shifts = await db.shifts.find({"status": {"$in": ["working", "on_break"]}}).to_list(500)

    for shift in active_shifts:
        if shift.get("after_hours_reminder_sent_at"):
            continue

        employee = await db.employees.find_one({"id": shift.get("employee_id")})
        if not employee:
            continue

        local_now = get_shift_local_now(shift)
        scheduled_end_time = normalize_time_string(employee.get("regular_end_time")) or "17:00"
        scheduled_end_dt = parse_schedule_datetime(shift.get("date"), scheduled_end_time)
        if not scheduled_end_dt:
            continue
        if local_now.replace(tzinfo=None) < (scheduled_end_dt + timedelta(minutes=5)):
            continue

        await db.shifts.update_one(
            {"id": shift["id"]},
            {"$set": {"after_hours_reminder_sent_at": datetime.utcnow(), "updated_at": datetime.utcnow()}},
        )

        await notify_employee_by_employee_id(
            shift.get("employee_id"),
            "Still clocked in",
            "You're still clocked in after normal work hours. Please clock out if your shift is finished.",
            notification_type="clock_out_reminder",
            data={"shift_id": shift["id"], "employee_id": shift.get("employee_id")},
        )


async def background_notification_worker():
    while True:
        try:
            await process_expired_breaks()
            await process_missed_clock_in_reminders()
            await process_after_hours_clock_out_reminders()
        except Exception as exc:
            logger.warning("Background notification worker error: %s", exc)
        await asyncio.sleep(60)


async def clear_demo_data():
    demo_emails = [
        "employee@test.com",
        "employee2@test.com",
        "hr@test.com",
        "manager@test.com",
        "superadmin@test.com",
        "employee@company.com",
        "hr@company.com",
        "manager@company.com",
        "superadmin@company.com",
    ]

    demo_users = await db.users.find({"email": {"$in": demo_emails}}).to_list(100)
    demo_user_ids = [u["id"] for u in demo_users]

    demo_employees = await db.employees.find({"email": {"$in": demo_emails}}).to_list(100)
    demo_employee_ids = [e["id"] for e in demo_employees]

    if demo_user_ids:
        await db.activity_logs.delete_many({"user_id": {"$in": demo_user_ids}})
        await db.notifications.delete_many({"target_user_id": {"$in": demo_user_ids}})
        await db.announcements.delete_many({"author_id": {"$in": demo_user_ids}})
        await db.users.delete_many({"id": {"$in": demo_user_ids}})

    if demo_employee_ids:
        await db.attendance.delete_many({"employee_id": {"$in": demo_employee_ids}})
        await db.shifts.delete_many({"employee_id": {"$in": demo_employee_ids}})
        await db.leave_requests.delete_many({"employee_id": {"$in": demo_employee_ids}})
        await db.time_off_requests.delete_many({"employee_id": {"$in": demo_employee_ids}})
        await db.payroll.delete_many({"employee_id": {"$in": demo_employee_ids}})
        await db.paystubs.delete_many({"employee_id": {"$in": demo_employee_ids}})
        await db.employees.delete_many({"id": {"$in": demo_employee_ids}})

    await db.training_videos.delete_many({"demo_seed": True})
    await db.leave_types.delete_many({"demo_seed": True})
    await db.departments.delete_many({"demo_seed": True})
    await db.work_locations.delete_many({"demo_seed": True})
    await db.notifications.delete_many({"demo_seed": True})


def serialize_backup_value(value: Any):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, bytes):
        return "<binary>"
    if isinstance(value, list):
        return [serialize_backup_value(item) for item in value]
    if isinstance(value, dict):
        return {
            key: serialize_backup_value(item)
            for key, item in value.items()
            if key not in {"_id", "pdf_content"}
        }
    return value
# User/Auth Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "employee"
    company_name: Optional[str] = None
    security_question: str
    security_answer: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifySecurityAnswerRequest(BaseModel):
    email: EmailStr
    security_answer: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    employee_id: Optional[str] = None
    company_id: Optional[str] = None
    security_question: Optional[str] = None
    onboarding_completed: bool = False
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class PushTokenRegister(BaseModel):
    push_token: str
    platform: Optional[str] = None

# Department Models
class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: Optional[str] = None
    budget: Optional[float] = None

class DepartmentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    budget: Optional[float] = None
    employee_count: int = 0
    created_at: datetime

# Work Location Models (GPS)
class WorkLocationCreate(BaseModel):
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    radius: int = 8047  # 5 miles in meters (default)
    department_id: Optional[str] = None
    is_active: bool = True

class WorkLocationResponse(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    radius: int  # in meters
    radius_miles: float = 5.0  # for display
    department_id: Optional[str] = None
    is_active: bool
    created_at: datetime

# Employee Models
class EmergencyContact(BaseModel):
    name: str
    relationship: str
    phone: str

class BankInfo(BaseModel):
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    routing_number: Optional[str] = None

class EmployeeCreate(BaseModel):
    user_id: Optional[str] = None
    employee_id: str
    first_name: str
    last_name: str
    email: EmailStr
    role: str = "employee"
    temporary_password: Optional[str] = None
    phone: Optional[str] = None
    job_title: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    manager_id: Optional[str] = None
    work_location_id: Optional[str] = None
    work_location: Optional[str] = "Office"
    employment_type: str = "Full-time"
    start_date: str
    date_of_birth: Optional[str] = None
    regular_start_time: Optional[str] = None
    regular_end_time: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = "USA"
    emergency_contact: Optional[EmergencyContact] = None
    bank_info: Optional[BankInfo] = None
    tax_id: Optional[str] = None
    salary: Optional[float] = None
    hourly_rate: Optional[float] = None
    skills: Optional[List[str]] = []
    notes: Optional[str] = None
    leave_balance: Optional[Dict[str, float]] = None

class EmployeeUpdate(BaseModel):
    employee_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    temporary_password: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    manager_id: Optional[str] = None
    work_location_id: Optional[str] = None
    work_location: Optional[str] = None
    employment_type: Optional[str] = None
    start_date: Optional[str] = None
    date_of_birth: Optional[str] = None
    regular_start_time: Optional[str] = None
    regular_end_time: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    emergency_contact: Optional[EmergencyContact] = None
    bank_info: Optional[BankInfo] = None
    tax_id: Optional[str] = None
    salary: Optional[float] = None
    hourly_rate: Optional[float] = None
    skills: Optional[List[str]] = None
    notes: Optional[str] = None
    leave_balance: Optional[Dict[str, float]] = None

class EmployeeResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    employee_id: str
    first_name: str
    last_name: str
    email: str
    role: str = "employee"
    phone: Optional[str] = None
    job_title: str
    department_id: str
    department_name: Optional[str] = None
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    work_location_id: Optional[str] = None
    work_location: Optional[str] = None
    employment_type: str
    start_date: str
    status: str = "active"
    date_of_birth: Optional[str] = None
    regular_start_time: Optional[str] = None
    regular_end_time: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    emergency_contact: Optional[EmergencyContact] = None
    bank_info: Optional[BankInfo] = None
    tax_id: Optional[str] = None
    salary: Optional[float] = None
    hourly_rate: Optional[float] = None
    skills: Optional[List[str]] = []
    notes: Optional[str] = None
    leave_balance: Optional[Dict[str, float]] = None
    leave_balance_hours: Optional[float] = None
    vacation_balance_hours: Optional[float] = None
    sick_balance_hours: Optional[float] = None
    created_at: datetime

# Leave Type Models
class LeaveTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    days_per_year: float
    is_paid: bool = True
    requires_approval: bool = True
    color: str = "#3B82F6"

class LeaveTypeResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    days_per_year: float
    is_paid: bool
    requires_approval: bool
    color: str
    created_at: datetime

# Leave Request Models
class LeaveRequestCreate(BaseModel):
    leave_type_id: str
    start_date: str
    end_date: str
    reason: Optional[str] = None
    half_day: bool = False

class LeaveRequestResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    leave_type_id: str
    leave_type_name: Optional[str] = None
    start_date: str
    end_date: str
    days_count: float
    reason: Optional[str] = None
    status: str = "pending"
    half_day: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    manager_comment: Optional[str] = None
    created_at: datetime

class LeaveRequestUpdate(BaseModel):
    status: str
    manager_comment: Optional[str] = None

# Attendance Models with GPS
class AttendanceClockIn(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    local_time: Optional[str] = None
    timezone: Optional[str] = None

class AttendanceClockOut(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    local_time: Optional[str] = None
    timezone: Optional[str] = None

class AttendanceResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    date: str
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    clock_in_location: Optional[Dict[str, float]] = None
    clock_out_location: Optional[Dict[str, float]] = None
    clock_in_local: Optional[str] = None
    clock_out_local: Optional[str] = None
    scheduled_start_time: Optional[str] = None
    scheduled_end_time: Optional[str] = None
    actual_clock_in: Optional[str] = None
    actual_clock_out: Optional[str] = None
    late_status: bool = False
    minutes_late: int = 0
    missed_clock_in_alert_sent: bool = False
    timezone: Optional[str] = None
    total_hours: Optional[float] = None
    status: str = "present"
    notes: Optional[str] = None
    created_at: datetime

# Employee Profile Update Model (Simplified - name, phone, next of kin only)
class EmployeeProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    next_of_kin_relationship: Optional[str] = None

class EmployeeLeaveBalanceUpdate(BaseModel):
    leave_balance: Dict[str, float]

class AttendanceManualCreate(BaseModel):
    employee_id: str
    date: str
    clock_in: str
    clock_out: Optional[str] = None
    status: str = "present"
    notes: Optional[str] = None


class ScheduleCreate(BaseModel):
    employee_id: str
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    notes: Optional[str] = None


class ScheduleUpdate(BaseModel):
    schedule_id: str
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    notes: Optional[str] = None


class DepartmentScheduleApply(BaseModel):
    department_id: str
    week_start_date: str
    start_time: str
    end_time: str
    weekdays: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])
    notes: Optional[str] = None


class ScheduleEntryResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    department_id: Optional[str] = None
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_hours: float = 0
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


async def build_schedule_entry_response(schedule: dict) -> ScheduleEntryResponse:
    employee = await db.employees.find_one({"id": schedule["employee_id"]})
    employee_name = None
    department_id = schedule.get("department_id")
    if employee:
        employee_name = f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
        department_id = department_id or employee.get("department_id")

    return ScheduleEntryResponse(
        id=schedule["id"],
        employee_id=schedule["employee_id"],
        employee_name=employee_name,
        department_id=department_id,
        date=schedule["date"],
        start_time=normalize_time_string(schedule.get("start_time")),
        end_time=normalize_time_string(schedule.get("end_time")),
        total_hours=calculate_time_range_hours(schedule.get("start_time"), schedule.get("end_time")),
        notes=schedule.get("notes"),
        created_at=schedule.get("created_at", datetime.utcnow()),
        updated_at=schedule.get("updated_at", datetime.utcnow()),
    )

# Payroll Models
# ===== Schedule Routes =====
@api_router.post("/schedule/create", response_model=ScheduleEntryResponse)
async def create_schedule_entry(payload: ScheduleCreate, current_user: dict = Depends(require_manager)):
    company_id = await get_current_company_id(current_user)
    employee = await db.employees.find_one({"id": payload.employee_id, "status": "active", "company_id": company_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if current_user["role"] == "manager":
        manager_employee = await db.employees.find_one({"user_id": current_user["id"], "company_id": company_id}) or await db.employees.find_one({"email": current_user["email"], "company_id": company_id})
        if not manager_employee or manager_employee.get("department_id") != employee.get("department_id"):
            raise HTTPException(status_code=403, detail="Managers can only schedule employees in their department")

    normalized_start = normalize_time_string(payload.start_time)
    normalized_end = normalize_time_string(payload.end_time)
    if (payload.start_time and not normalized_start) or (payload.end_time and not normalized_end):
        raise HTTPException(status_code=400, detail="Invalid schedule time format")

    existing = await db.schedules.find_one({"employee_id": payload.employee_id, "date": payload.date})
    now = datetime.utcnow()
    schedule_doc = {
        "employee_id": payload.employee_id,
        "company_id": company_id,
        "department_id": employee.get("department_id"),
        "date": payload.date,
        "start_time": normalized_start,
        "end_time": normalized_end,
        "notes": payload.notes,
        "updated_at": now,
    }

    if existing:
        await db.schedules.update_one({"id": existing["id"]}, {"$set": schedule_doc})
        saved = await db.schedules.find_one({"id": existing["id"]})
    else:
        schedule_id = str(uuid.uuid4())
        schedule_doc.update({"id": schedule_id, "created_at": now})
        await db.schedules.insert_one(schedule_doc)
        saved = schedule_doc

    await log_activity(current_user["id"], "schedule_created", f"Schedule assigned for employee {payload.employee_id} on {payload.date}")
    return await build_schedule_entry_response(saved)


@api_router.put("/schedule/update", response_model=ScheduleEntryResponse)
async def update_schedule_entry(payload: ScheduleUpdate, current_user: dict = Depends(require_manager)):
    company_id = await get_current_company_id(current_user)
    existing = await db.schedules.find_one({"id": payload.schedule_id, "company_id": company_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Schedule entry not found")

    update_fields = payload.dict(exclude_unset=True, exclude={"schedule_id"})
    if "start_time" in update_fields:
        update_fields["start_time"] = normalize_time_string(update_fields["start_time"])
        if payload.start_time and not update_fields["start_time"]:
            raise HTTPException(status_code=400, detail="Invalid start time")
    if "end_time" in update_fields:
        update_fields["end_time"] = normalize_time_string(update_fields["end_time"])
        if payload.end_time and not update_fields["end_time"]:
            raise HTTPException(status_code=400, detail="Invalid end time")
    update_fields["updated_at"] = datetime.utcnow()

    await db.schedules.update_one({"id": payload.schedule_id, "company_id": company_id}, {"$set": update_fields})
    saved = await db.schedules.find_one({"id": payload.schedule_id, "company_id": company_id})
    await log_activity(current_user["id"], "schedule_updated", f"Schedule updated for employee {saved['employee_id']} on {saved['date']}")
    return await build_schedule_entry_response(saved)


@api_router.get("/schedule/employee/{employee_id}", response_model=List[ScheduleEntryResponse])
async def get_employee_schedule(
    employee_id: str,
    week_start: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] == "employee":
        employee = await db.employees.find_one({"user_id": current_user["id"]}) or await db.employees.find_one({"email": current_user["email"]})
        if not employee or employee["id"] != employee_id:
            raise HTTPException(status_code=403, detail="You can only view your own schedule")

    query: Dict[str, Any] = {"employee_id": employee_id, "company_id": await get_current_company_id(current_user)}
    if week_start:
        start_dt = datetime.fromisoformat(week_start)
        end_dt = start_dt + timedelta(days=6)
        query["date"] = {"$gte": start_dt.strftime("%Y-%m-%d"), "$lte": end_dt.strftime("%Y-%m-%d")}

    schedules = await db.schedules.find(query).sort("date", 1).to_list(100)
    return [await build_schedule_entry_response(schedule) for schedule in schedules]


@api_router.get("/schedule/week/{date_value}", response_model=List[ScheduleEntryResponse])
async def get_schedule_week(date_value: str, current_user: dict = Depends(get_current_user)):
    start_dt = datetime.fromisoformat(date_value)
    end_dt = start_dt + timedelta(days=6)
    query: Dict[str, Any] = {
        "company_id": await get_current_company_id(current_user),
        "date": {"$gte": start_dt.strftime("%Y-%m-%d"), "$lte": end_dt.strftime("%Y-%m-%d")}
    }

    if current_user["role"] == "employee":
        employee = await db.employees.find_one({"user_id": current_user["id"]}) or await db.employees.find_one({"email": current_user["email"]})
        if not employee:
            return []
        query["employee_id"] = employee["id"]
    elif current_user["role"] == "manager":
        manager_employee = await db.employees.find_one({"user_id": current_user["id"]}) or await db.employees.find_one({"email": current_user["email"]})
        if not manager_employee:
            return []
        query["department_id"] = manager_employee.get("department_id")

    schedules = await db.schedules.find(query).sort([("date", 1), ("employee_id", 1)]).to_list(500)
    return [await build_schedule_entry_response(schedule) for schedule in schedules]


@api_router.post("/schedule/department/apply")
async def apply_schedule_to_department(payload: DepartmentScheduleApply, current_user: dict = Depends(require_manager)):
    company_id = await get_current_company_id(current_user)
    department = await db.departments.find_one({"id": payload.department_id, "company_id": company_id})
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    if current_user["role"] == "manager":
        manager_employee = await db.employees.find_one({"user_id": current_user["id"], "company_id": company_id}) or await db.employees.find_one({"email": current_user["email"], "company_id": company_id})
        if not manager_employee or manager_employee.get("department_id") != payload.department_id:
            raise HTTPException(status_code=403, detail="Managers can only apply schedules to their own department")

    normalized_start = normalize_time_string(payload.start_time)
    normalized_end = normalize_time_string(payload.end_time)
    if not normalized_start or not normalized_end:
        raise HTTPException(status_code=400, detail="Invalid schedule time format")

    week_start = datetime.fromisoformat(payload.week_start_date)
    employees = await db.employees.find({"department_id": payload.department_id, "status": "active", "company_id": company_id}).to_list(500)
    applied_count = 0
    now = datetime.utcnow()

    for employee in employees:
        for weekday in payload.weekdays:
            shift_date = (week_start + timedelta(days=int(weekday))).strftime("%Y-%m-%d")
            existing = await db.schedules.find_one({"employee_id": employee["id"], "date": shift_date})
            schedule_doc = {
                "employee_id": employee["id"],
                "company_id": company_id,
                "department_id": payload.department_id,
                "date": shift_date,
                "start_time": normalized_start,
                "end_time": normalized_end,
                "notes": payload.notes,
                "updated_at": now,
            }
            if existing:
                await db.schedules.update_one({"id": existing["id"]}, {"$set": schedule_doc})
            else:
                schedule_doc.update({"id": str(uuid.uuid4()), "created_at": now})
                await db.schedules.insert_one(schedule_doc)
            applied_count += 1

    await log_activity(current_user["id"], "department_schedule_applied", f"Applied schedule to department {payload.department_id}")
    return {"message": "Department schedule applied", "applied_count": applied_count}


# Payroll Models
class PayrollCreate(BaseModel):
    employee_id: str
    pay_period_start: str
    pay_period_end: str
    basic_salary: float
    overtime_hours: float = 0
    overtime_rate: float = 1.5
    bonus: float = 0
    deductions: float = 0
    tax: float = 0
    insurance_deduction: float = 0
    pension_deduction: float = 0
    benefits_deduction: float = 0
    notes: Optional[str] = None

class PayrollResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    job_title: Optional[str] = None
    pay_period_start: str
    pay_period_end: str
    basic_salary: float
    overtime_hours: float
    overtime_rate: float
    overtime_pay: float
    bonus: float
    gross_pay: float
    deductions: float
    tax: float
    insurance_deduction: float = 0
    pension_deduction: float = 0
    benefits_deduction: float
    net_pay: float
    status: str = "pending"
    notes: Optional[str] = None
    created_at: datetime

class PayrollReviewRequest(BaseModel):
    pay_period_start: str
    pay_period_end: str
    send_paystubs: bool = False

class PayrollReviewRow(BaseModel):
    employee_id: str
    employee_name: str
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    job_title: Optional[str] = None
    hours_worked: float
    base_rate: float
    basic_salary: float
    overtime_hours: float
    overtime_rate: float
    overtime_pay: float
    bonus: float = 0
    deductions: float = 0
    tax: float = 0
    insurance_deduction: float = 0
    pension_deduction: float = 0
    benefits_deduction: float = 0
    gross_pay: float
    total_deductions: float
    net_pay: float

class PayrollReviewResponse(BaseModel):
    pay_period_start: str
    pay_period_end: str
    total_budget: float
    total_gross: float
    total_net: float
    total_hours: float
    total_tax: float
    total_deductions: float
    employee_count: int
    rows: List[PayrollReviewRow]


class ContactRequest(BaseModel):
    business_name: str
    contact_name: str
    email: EmailStr
    phone: Optional[str] = None
    employees: Optional[str] = None
    message: Optional[str] = None

class PaystubCreate(BaseModel):
    employee_id: str
    payroll_id: Optional[str] = None
    pay_period_start: str
    pay_period_end: str
    gross_pay: float
    deductions: float = 0
    tax: float = 0
    insurance_deduction: float = 0
    pension_deduction: float = 0
    benefits_deduction: float = 0
    bonus: float = 0
    net_pay: float
    pay_date: Optional[str] = None
    pdf_base64: Optional[str] = None
    file_name: Optional[str] = None
    published: bool = True

class PaystubBulkSend(BaseModel):
    paystub_ids: List[str] = Field(default_factory=list)
    payroll_ids: List[str] = Field(default_factory=list)

# Training Models
class TrainingVideoCreate(BaseModel):
    title: str
    description: str
    video_url: str
    thumbnail_url: Optional[str] = None
    role: str  # all, super_admin, hr_admin, manager, employee
    category: str
    duration: Optional[str] = None
    order: int = 0

class TrainingVideoResponse(BaseModel):
    id: str
    title: str
    description: str
    video_url: str
    thumbnail_url: Optional[str] = None
    role: str
    category: str
    duration: Optional[str] = None
    order: int
    created_at: datetime

# Announcement Models
class AnnouncementCreate(BaseModel):
    title: str
    content: str
    type: str = "general"
    department_id: Optional[str] = None
    priority: str = "normal"
    expires_at: Optional[str] = None

class AnnouncementResponse(BaseModel):
    id: str
    title: str
    content: str
    type: str
    department_id: Optional[str] = None
    priority: str
    author_id: str
    author_name: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime

# Dashboard Stats
class DashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    new_hires_this_month: int
    employees_on_leave: int
    pending_leave_requests: int
    pending_timesheet_approvals: int
    upcoming_birthdays: List[Dict]
    upcoming_anniversaries: List[Dict]
    department_breakdown: List[Dict]
    attendance_today: Dict
    recent_activities: List[Dict]

# ===== Activity Log =====
async def log_activity(user_id: str, action: str, description: str, metadata: dict = None):
    activity = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "description": description,
        "metadata": metadata or {},
        "created_at": datetime.utcnow()
    }
    await db.activity_logs.insert_one(activity)

def map_time_off_status_to_leave_status(status_value: str) -> str:
    if status_value == "denied":
        return "rejected"
    return status_value

def map_leave_status_to_time_off_status(status_value: str) -> str:
    if status_value == "rejected":
        return "denied"
    return status_value

async def ensure_core_leave_types() -> List[dict]:
    core_leave_types = [
        ("Annual Leave", "Paid vacation days", 10.0, True, "#3B82F6"),
        ("Sick Leave", "Medical leave", 10.0, True, "#EF4444"),
        ("Maternity Leave", "Optional maternity leave balance", 0.0, True, "#EC4899"),
        ("Paternity Leave", "Optional paternity leave balance", 0.0, True, "#14B8A6"),
        ("Unpaid Leave", "Leave without pay", 0.0, False, "#6B7280"),
    ]

    existing = await db.leave_types.find().to_list(100)
    existing_by_name = {lt["name"]: lt for lt in existing}
    created_any = False

    for name, description, days_per_year, is_paid, color in core_leave_types:
        if name in existing_by_name:
            continue
        created_any = True
        leave_type = {
            "id": str(uuid.uuid4()),
            "name": name,
            "description": description,
            "days_per_year": days_per_year,
            "is_paid": is_paid,
            "requires_approval": True,
            "color": color,
            "created_at": datetime.utcnow(),
        }
        await db.leave_types.insert_one(leave_type)
        existing.append(leave_type)

    if created_any:
        existing.sort(key=lambda item: item["name"])

    return existing

def summarize_leave_balance(employee: dict, leave_types: List[dict]) -> dict:
    stored_balance = employee.get("leave_balance") or {}
    use_defaults = len(stored_balance) == 0

    total_hours = 0.0
    vacation_hours = 0.0
    sick_hours = 0.0
    normalized_balance: Dict[str, float] = {}
    name_aliases = {
        "annual": "Annual Leave",
        "annualleave": "Annual Leave",
        "vacation": "Annual Leave",
        "vacationleave": "Annual Leave",
        "paidleave": "Annual Leave",
        "sick": "Sick Leave",
        "sickleave": "Sick Leave",
        "medicalleave": "Sick Leave",
        "maternity": "Maternity Leave",
        "maternityleave": "Maternity Leave",
        "paternity": "Paternity Leave",
        "paternityleave": "Paternity Leave",
        "unpaid": "Unpaid Leave",
        "unpaidleave": "Unpaid Leave",
    }
    leave_type_by_id = {leave_type["id"]: leave_type for leave_type in leave_types}
    resolved_by_name: Dict[str, float] = {}

    def normalize_balance_key(value: str) -> str:
        return re.sub(r"[^a-z]", "", str(value).strip().lower())

    for key, value in stored_balance.items():
        try:
            numeric_value = max(0.0, float(value))
        except (TypeError, ValueError):
            continue

        matched_leave_type = leave_type_by_id.get(key)
        if matched_leave_type:
            resolved_by_name[matched_leave_type["name"]] = numeric_value
            continue

        normalized_key = normalize_balance_key(key)
        matched_name = next(
            (
                leave_type["name"]
                for leave_type in leave_types
                if normalize_balance_key(leave_type["name"]) == normalized_key
            ),
            name_aliases.get(normalized_key),
        )

        if matched_name:
            resolved_by_name[matched_name] = numeric_value

    direct_match_count = sum(1 for key in stored_balance if key in leave_type_by_id)
    ordered_legacy_values: List[float] = []
    if stored_balance and direct_match_count == 0 and not resolved_by_name:
        for value in stored_balance.values():
            try:
                ordered_legacy_values.append(max(0.0, float(value)))
            except (TypeError, ValueError):
                continue

    for index, leave_type in enumerate(leave_types):
        days = float(
            stored_balance.get(
                leave_type["id"],
                leave_type.get("days_per_year", 0) if use_defaults else 0,
            )
        )

        if leave_type["id"] not in stored_balance and leave_type["name"] in resolved_by_name:
            days = resolved_by_name[leave_type["name"]]
        elif (
            leave_type["id"] not in stored_balance
            and leave_type["name"] not in resolved_by_name
            and index < len(ordered_legacy_values)
        ):
            # Older demo data stored balances against pre-reset leave type IDs.
            days = ordered_legacy_values[index]

        normalized_balance[leave_type["id"]] = days
        total_hours += days * 8

        if leave_type["name"] == "Annual Leave":
            vacation_hours = days * 8
        if leave_type["name"] == "Sick Leave":
            sick_hours = days * 8

    return {
        "leave_balance": normalized_balance,
        "leave_balance_hours": round(total_hours, 2),
        "vacation_balance_hours": round(vacation_hours, 2),
        "sick_balance_hours": round(sick_hours, 2),
    }

def normalize_employee_role(role: Optional[str]) -> str:
    allowed_roles = {"employee", "manager", "hr_admin", "hr", "super_admin"}
    normalized = (role or "employee").strip().lower()
    if normalized not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid employee role")
    return normalized


def validate_password_strength(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must include an uppercase letter")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must include a number")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(status_code=400, detail="Password must include a special character")


def normalize_time_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    cleaned = str(value).strip()
    patterns = ["%H:%M", "%I:%M %p", "%I:%M%p", "%H:%M:%S"]
    for pattern in patterns:
        try:
            parsed = datetime.strptime(cleaned.upper(), pattern)
            return parsed.strftime("%H:%M")
        except ValueError:
            continue
    raise HTTPException(status_code=400, detail=f"Invalid time format: {value}")


def calculate_schedule_hours(start_time: Optional[str], end_time: Optional[str]) -> float:
    if not start_time or not end_time:
        return 0.0
    start = datetime.strptime(start_time, "%H:%M")
    end = datetime.strptime(end_time, "%H:%M")
    hours = (end - start).total_seconds() / 3600
    return round(max(hours, 0), 2)


async def get_employee_schedule_for_date(employee: dict, date_value: str) -> Dict[str, Optional[str]]:
    schedule = await db.schedules.find_one({"employee_id": employee["id"], "date": date_value})
    if schedule:
        return {
            "scheduled_start_time": schedule.get("start_time"),
            "scheduled_end_time": schedule.get("end_time"),
            "schedule_id": schedule.get("id"),
        }

    return {
        "scheduled_start_time": employee.get("regular_start_time"),
        "scheduled_end_time": employee.get("regular_end_time"),
        "schedule_id": None,
    }


def get_local_date_string(local_time: Optional[str], fallback: datetime) -> str:
    parsed_local = parse_iso_datetime(local_time)
    if parsed_local:
        return parsed_local.date().isoformat()
    return fallback.strftime("%Y-%m-%d")


def calculate_late_metrics(
    date_value: str,
    scheduled_start_time: Optional[str],
    local_time: Optional[str],
    fallback_time: datetime,
) -> Dict[str, Any]:
    if not scheduled_start_time:
        return {"late_status": False, "minutes_late": 0}

    actual_local_dt = parse_iso_datetime(local_time) or fallback_time
    scheduled_dt = datetime.strptime(f"{date_value} {scheduled_start_time}", "%Y-%m-%d %H:%M")
    actual_naive = actual_local_dt.replace(tzinfo=None) if actual_local_dt.tzinfo else actual_local_dt

    if actual_naive <= scheduled_dt:
        return {"late_status": False, "minutes_late": 0}

    minutes_late = int((actual_naive - scheduled_dt).total_seconds() // 60)
    return {
        "late_status": minutes_late > 0,
        "minutes_late": max(minutes_late, 0),
    }


def build_schedule_response(schedule: dict, employee_name: Optional[str] = None) -> ScheduleEntryResponse:
    return ScheduleEntryResponse(
        id=schedule["id"],
        employee_id=schedule["employee_id"],
        employee_name=employee_name,
        department_id=schedule.get("department_id"),
        date=schedule["date"],
        start_time=schedule.get("start_time"),
        end_time=schedule.get("end_time"),
        total_hours=calculate_schedule_hours(schedule.get("start_time"), schedule.get("end_time")),
        notes=schedule.get("notes"),
        created_at=schedule["created_at"],
        updated_at=schedule["updated_at"],
    )

async def ensure_employee_user_account(
    employee_id: str,
    email: str,
    first_name: str,
    last_name: str,
    role: str,
    temporary_password: Optional[str],
    company_id: Optional[str],
    existing_user_id: Optional[str] = None,
):
    normalized_email = email.lower()
    user = None

    if temporary_password:
        validate_password_strength(temporary_password)

    if existing_user_id:
        user = await db.users.find_one({"id": existing_user_id})
    if not user:
        user = await db.users.find_one({"email": normalized_email})

    update_fields = {
        "email": normalized_email,
        "first_name": first_name,
        "last_name": last_name,
        "role": role,
        "employee_id": employee_id,
        "company_id": company_id,
        "updated_at": datetime.utcnow(),
    }
    if temporary_password:
        update_fields["password_hash"] = get_password_hash(temporary_password)

    if user:
        await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
        return user["id"]

    if not temporary_password:
        return existing_user_id

    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "email": normalized_email,
        "password_hash": get_password_hash(temporary_password),
        "first_name": first_name,
        "last_name": last_name,
        "role": role,
        "employee_id": employee_id,
        "company_id": company_id,
        "security_question": None,
        "security_answer_hash": None,
        "security_reset_failed_attempts": 0,
        "security_reset_locked_until": None,
        "security_reset_token": None,
        "security_reset_token_expires_at": None,
        "onboarding_completed": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    })
    return user_id

async def sync_shift_clock_in_to_attendance(employee: dict, local_time: Optional[str], timezone: Optional[str], latitude: Optional[float], longitude: Optional[float], clock_in_time: datetime):
    today = clock_in_time.strftime("%Y-%m-%d")
    existing = await db.attendance.find_one({"employee_id": employee["id"], "date": today, "company_id": employee.get("company_id")})
    schedule = await get_schedule_for_employee_date(employee, today)
    scheduled_start_time = normalize_time_string((schedule or {}).get("start_time"))
    scheduled_end_time = normalize_time_string((schedule or {}).get("end_time"))
    lateness = calculate_lateness(today, scheduled_start_time, clock_in_time)

    payload = {
        "employee_id": employee["id"],
        "company_id": employee.get("company_id"),
        "date": today,
        "clock_in": clock_in_time,
        "clock_in_local": local_time,
        "actual_clock_in": local_time or clock_in_time.isoformat(),
        "timezone": timezone,
        "clock_in_location": {"latitude": latitude, "longitude": longitude} if latitude is not None and longitude is not None else None,
        "scheduled_start_time": scheduled_start_time,
        "scheduled_end_time": scheduled_end_time,
        "late_status": lateness["late_status"],
        "minutes_late": lateness["minutes_late"],
        "missed_clock_in_alert_sent": bool(existing.get("missed_clock_in_alert_sent")) if existing else False,
        "status": "late" if lateness["late_status"] else "present",
        "updated_at": datetime.utcnow(),
    }

    if existing:
        await db.attendance.update_one({"id": existing["id"]}, {"$set": payload})
        return existing["id"]

    attendance_id = str(uuid.uuid4())
    payload.update({
        "id": attendance_id,
        "company_id": employee.get("company_id"),
        "clock_out": None,
        "clock_out_local": None,
        "clock_out_location": None,
        "total_hours": 0,
        "notes": None,
        "created_at": datetime.utcnow(),
    })
    await db.attendance.insert_one(payload)
    return attendance_id

async def sync_shift_clock_out_to_attendance(employee: dict, local_time: Optional[str], timezone: Optional[str], latitude: Optional[float], longitude: Optional[float], clock_out_time: datetime, work_hours: float):
    today = clock_out_time.strftime("%Y-%m-%d")
    existing = await db.attendance.find_one({"employee_id": employee["id"], "date": today})

    payload = {
        "clock_out": clock_out_time,
        "clock_out_local": local_time,
        "actual_clock_out": local_time or clock_out_time.isoformat(),
        "timezone": timezone,
        "clock_out_location": {"latitude": latitude, "longitude": longitude} if latitude is not None and longitude is not None else None,
        "total_hours": work_hours,
        "status": "late" if existing and existing.get("late_status") else "present",
        "updated_at": datetime.utcnow(),
    }

    if existing:
        await db.attendance.update_one({"id": existing["id"]}, {"$set": payload})
        return existing["id"]

    attendance_id = str(uuid.uuid4())
    payload.update({
        "id": attendance_id,
        "employee_id": employee["id"],
        "company_id": employee.get("company_id"),
        "date": today,
        "clock_in": None,
        "clock_in_local": None,
        "clock_in_location": None,
        "scheduled_start_time": normalize_time_string(employee.get("regular_start_time")),
        "scheduled_end_time": normalize_time_string(employee.get("regular_end_time")),
        "actual_clock_in": None,
        "notes": None,
        "created_at": datetime.utcnow(),
    })
    await db.attendance.insert_one(payload)
    return attendance_id

# ===== Authentication Routes =====
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate, background_tasks: BackgroundTasks):
    existing_user = await db.users.find_one({"email": user_data.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    validate_password_strength(user_data.password)
    user_id = str(uuid.uuid4())
    company_id = None
    company_name = None
    if user_data.role in ["super_admin", "hr_admin", "hr"]:
        company_name = (user_data.company_name or "").strip()
        if not company_name:
            raise HTTPException(status_code=400, detail="Company name is required for HR registration")
        company_id = str(uuid.uuid4())
        now = datetime.utcnow()
        await db.companies.insert_one({
            "id": company_id,
            "name": company_name,
            "owner_user_id": user_id,
            "created_at": now,
            "updated_at": now,
        })
    user = {
        "id": user_id,
        "email": user_data.email.lower(),
        "password_hash": get_password_hash(user_data.password),
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "role": user_data.role,
        "company_id": company_id,
        "security_question": user_data.security_question,
        "security_answer_hash": get_password_hash(user_data.security_answer.strip().lower()),
        "security_reset_failed_attempts": 0,
        "security_reset_locked_until": None,
        "security_reset_token": None,
        "security_reset_token_expires_at": None,
        "employee_id": None,
        "onboarding_completed": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db.users.insert_one(user)
    
    access_token = create_access_token(data={"sub": user_id, "role": user["role"]})
    await log_activity(user_id, "user_registered", f"New user registered: {user_data.email}")

    if company_name and email_delivery_enabled():
        try:
            background_tasks.add_task(
                send_hr_welcome_email,
                recipient_email=user["email"],
                first_name=user["first_name"],
                company_name=company_name,
            )
        except Exception as exc:
            logger.warning("Failed to queue welcome email for %s: %s", user["email"], exc)
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            email=user["email"],
            first_name=user["first_name"],
            last_name=user["last_name"],
            role=user["role"],
            employee_id=user["employee_id"],
            company_id=user.get("company_id"),
            security_question=user.get("security_question"),
            onboarding_completed=user["onboarding_completed"],
            created_at=user["created_at"]
        )
    )


@api_router.post("/contact")
async def contact_us(payload: ContactRequest):
    if not email_delivery_enabled():
        raise HTTPException(status_code=503, detail="Contact email is not configured")

    try:
        send_contact_email(payload)
    except Exception as exc:
        logger.warning("Failed to send contact email for %s: %s", payload.email, exc)
        raise HTTPException(status_code=500, detail="Unable to send contact request right now")

    return {
        "message": "Contact request sent successfully",
        "sent_to": os.environ.get("SUPPORT_EMAIL", "support@emplora.org").strip() or "support@emplora.org",
    }

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email.lower()})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Set token expiry based on remember_me
    if credentials.remember_me:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_REMEMBER_ME)
    else:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]}, expires_delta=expires_delta)
    await log_activity(user["id"], "user_login", f"User logged in: {user['email']}")
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            first_name=user["first_name"],
            last_name=user["last_name"],
            role=user["role"],
            employee_id=user.get("employee_id"),
            company_id=user.get("company_id"),
            security_question=user.get("security_question"),
            onboarding_completed=user.get("onboarding_completed", False),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        first_name=current_user["first_name"],
        last_name=current_user["last_name"],
        role=current_user["role"],
        employee_id=current_user.get("employee_id"),
        company_id=current_user.get("company_id"),
        security_question=current_user.get("security_question"),
        onboarding_completed=current_user.get("onboarding_completed", False),
        created_at=current_user["created_at"]
    )


@api_router.post("/notifications/push-token")
async def register_push_token(payload: PushTokenRegister, current_user: dict = Depends(get_current_user)):
    now = datetime.utcnow()
    await db.push_tokens.update_one(
        {"push_token": payload.push_token},
        {
            "$set": {
                "user_id": current_user["id"],
                "platform": payload.platform,
                "active": True,
                "updated_at": now,
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "created_at": now,
            },
        },
        upsert=True,
    )
    return {"message": "Push token registered"}


@api_router.delete("/notifications/push-token")
async def unregister_push_token(payload: PushTokenRegister, current_user: dict = Depends(get_current_user)):
    await db.push_tokens.update_one(
        {"push_token": payload.push_token, "user_id": current_user["id"]},
        {"$set": {"active": False, "updated_at": datetime.utcnow()}},
    )
    return {"message": "Push token unregistered"}

@api_router.put("/auth/complete-onboarding")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"onboarding_completed": True, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Onboarding completed"}

@api_router.put("/auth/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_user)
):
    if not verify_password(password_data.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid current password")
    validate_password_strength(password_data.new_password)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": get_password_hash(password_data.new_password), "updated_at": datetime.utcnow()}}
    )
    await log_activity(current_user["id"], "password_changed", "Password changed")
    return {"message": "Password changed successfully"}


@api_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    locked_until = user.get("security_reset_locked_until")
    if locked_until and isinstance(locked_until, datetime) and locked_until > datetime.utcnow():
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    if not user.get("security_question"):
        raise HTTPException(status_code=400, detail="Security question is not configured for this account")

    return {"email": user["email"], "security_question": user["security_question"]}


@api_router.post("/auth/verify-security-answer")
async def verify_security_answer(payload: VerifySecurityAnswerRequest):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.utcnow()
    locked_until = user.get("security_reset_locked_until")
    if locked_until and isinstance(locked_until, datetime) and locked_until > now:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    answer_hash = user.get("security_answer_hash")
    is_valid = bool(answer_hash) and verify_password(payload.security_answer.strip().lower(), answer_hash)
    if not is_valid:
        failed_attempts = int(user.get("security_reset_failed_attempts", 0) or 0) + 1
        update_fields: Dict[str, Any] = {
            "security_reset_failed_attempts": failed_attempts,
            "updated_at": now,
        }
        if failed_attempts >= 5:
            update_fields["security_reset_locked_until"] = now + timedelta(minutes=15)
        await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
        raise HTTPException(status_code=400, detail="Incorrect security answer")

    reset_token = str(uuid.uuid4())
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "security_reset_failed_attempts": 0,
                "security_reset_locked_until": None,
                "security_reset_token": reset_token,
                "security_reset_token_expires_at": now + timedelta(minutes=15),
                "updated_at": now,
            }
        },
    )
    return {"reset_token": reset_token, "expires_in_minutes": 15}


@api_router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token = user.get("security_reset_token")
    expires_at = user.get("security_reset_token_expires_at")
    if token != payload.reset_token or not expires_at or expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset token is invalid or expired")

    validate_password_strength(payload.new_password)

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "password_hash": get_password_hash(payload.new_password),
                "security_reset_failed_attempts": 0,
                "security_reset_locked_until": None,
                "security_reset_token": None,
                "security_reset_token_expires_at": None,
                "updated_at": datetime.utcnow(),
            }
        },
    )
    await log_activity(user["id"], "password_reset", "Password reset using security question verification")
    return {"message": "Password reset successfully"}

# ===== Shift/Break Management Routes (NEW SIMPLIFIED) =====

class ShiftClockRequest(BaseModel):
    local_time: str
    timezone: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@api_router.get("/shifts/current")
async def get_current_shift(current_user: dict = Depends(get_current_user)):
    """Get the current active shift for the employee"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    if not employee:
        return None
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    shift = await db.shifts.find_one({
        "employee_id": employee["id"],
        "date": today,
        "status": {"$in": ["working", "on_break"]}
    })
    
    if not shift:
        return None
    
    return {
        "id": shift["id"],
        "status": shift["status"],
        "clock_in": shift.get("clock_in", {}).get("timestamp"),
        "clock_in_local": shift.get("clock_in", {}).get("local_time"),
        "current_break": shift.get("current_break"),
        "breaks": shift.get("breaks", []),
        "total_break_seconds": shift.get("total_break_seconds", 0)
    }

@api_router.post("/shifts/clock-in")
async def shift_clock_in(data: ShiftClockRequest, current_user: dict = Depends(get_current_user)):
    """Clock in and start a new shift"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    if not employee:
        raise HTTPException(status_code=400, detail="Employee profile not found")
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Check for existing active shift
    existing = await db.shifts.find_one({
        "employee_id": employee["id"],
        "date": today,
        "status": {"$in": ["working", "on_break"]}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active shift")
    
    shift_id = str(uuid.uuid4())
    clock_in_time = datetime.utcnow()
    shift = {
        "id": shift_id,
        "employee_id": employee["id"],
        "date": today,
        "status": "working",
        "clock_in": {
            "timestamp": clock_in_time,
            "local_time": data.local_time,
            "timezone": data.timezone,
            "location": {"latitude": data.latitude, "longitude": data.longitude} if data.latitude else None
        },
        "breaks": [],
        "total_break_seconds": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.shifts.insert_one(shift)
    await sync_shift_clock_in_to_attendance(
        employee=employee,
        local_time=data.local_time,
        timezone=data.timezone,
        latitude=data.latitude,
        longitude=data.longitude,
        clock_in_time=clock_in_time,
    )
    await log_activity(current_user["id"], "shift_clock_in", f"Clocked in at {data.local_time}")
    
    return {
        "id": shift_id,
        "status": "working",
        "clock_in": shift["clock_in"]["timestamp"].isoformat(),
        "clock_in_local": data.local_time,
        "breaks": [],
        "total_break_seconds": 0
    }

@api_router.post("/shifts/clock-out")
async def shift_clock_out(data: ShiftClockRequest, current_user: dict = Depends(get_current_user)):
    """Clock out and end the current shift"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    if not employee:
        raise HTTPException(status_code=400, detail="Employee profile not found")
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    shift = await db.shifts.find_one({
        "employee_id": employee["id"],
        "date": today,
        "status": {"$in": ["working", "on_break"]}
    })
    
    if not shift:
        raise HTTPException(status_code=400, detail="No active shift found")
    
    if shift["status"] == "on_break":
        raise HTTPException(status_code=400, detail="Please end your break before clocking out")
    
    clock_out_time = datetime.utcnow()
    clock_in_time = shift["clock_in"]["timestamp"]
    total_seconds = (clock_out_time - clock_in_time).total_seconds()
    work_seconds = total_seconds - shift.get("total_break_seconds", 0)
    work_hours = round(work_seconds / 3600, 2)
    
    await db.shifts.update_one(
        {"id": shift["id"]},
        {"$set": {
            "status": "completed",
            "clock_out": {
                "timestamp": clock_out_time,
                "local_time": data.local_time,
                "timezone": data.timezone,
                "location": {"latitude": data.latitude, "longitude": data.longitude} if data.latitude else None
            },
            "total_work_hours": work_hours,
            "updated_at": datetime.utcnow()
        }}
    )
    await sync_shift_clock_out_to_attendance(
        employee=employee,
        local_time=data.local_time,
        timezone=data.timezone,
        latitude=data.latitude,
        longitude=data.longitude,
        clock_out_time=clock_out_time,
        work_hours=work_hours,
    )
    
    await log_activity(current_user["id"], "shift_clock_out", f"Clocked out. Worked {work_hours} hours")
    return {"message": "Clocked out successfully", "work_hours": work_hours}

@api_router.post("/shifts/break/start")
async def start_break(data: ShiftClockRequest, current_user: dict = Depends(get_current_user)):
    """Start a break during an active shift"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    if not employee:
        raise HTTPException(status_code=400, detail="Employee profile not found")
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    shift = await db.shifts.find_one({
        "employee_id": employee["id"],
        "date": today,
        "status": "working"
    })
    
    if not shift:
        raise HTTPException(status_code=400, detail="You must be clocked in to start a break")
    
    break_id = str(uuid.uuid4())
    current_break = {
        "id": break_id,
        "start": datetime.utcnow().isoformat(),
        "start_local": data.local_time,
        "start_location": {"latitude": data.latitude, "longitude": data.longitude} if data.latitude else None
    }
    
    await db.shifts.update_one(
        {"id": shift["id"]},
        {"$set": {
            "status": "on_break",
            "current_break": current_break,
            "updated_at": datetime.utcnow()
        }}
    )
    
    await log_activity(current_user["id"], "break_start", f"Started break at {data.local_time}")
    
    return {
        "id": shift["id"],
        "status": "on_break",
        "clock_in": shift["clock_in"]["timestamp"].isoformat() if isinstance(shift["clock_in"]["timestamp"], datetime) else shift["clock_in"]["timestamp"],
        "clock_in_local": shift["clock_in"].get("local_time"),
        "current_break": current_break,
        "breaks": shift.get("breaks", []),
        "total_break_seconds": shift.get("total_break_seconds", 0)
    }

@api_router.post("/shifts/break/end")
async def end_break(data: ShiftClockRequest, current_user: dict = Depends(get_current_user)):
    """End the current break and resume work"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    if not employee:
        raise HTTPException(status_code=400, detail="Employee profile not found")
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    shift = await db.shifts.find_one({
        "employee_id": employee["id"],
        "date": today,
        "status": "on_break"
    })
    
    if not shift:
        raise HTTPException(status_code=400, detail="You are not currently on a break")
    
    current_break = shift.get("current_break")
    if not current_break:
        raise HTTPException(status_code=400, detail="No active break found")
    
    break_start = datetime.fromisoformat(current_break["start"])
    break_end = datetime.utcnow()
    break_duration = int((break_end - break_start).total_seconds())
    
    completed_break = {
        "id": current_break["id"],
        "start": current_break["start"],
        "start_local": current_break.get("start_local"),
        "start_location": current_break.get("start_location"),
        "end": break_end.isoformat(),
        "end_local": data.local_time,
        "end_location": {"latitude": data.latitude, "longitude": data.longitude} if data.latitude else None,
        "duration_seconds": break_duration
    }
    
    breaks = shift.get("breaks", [])
    breaks.append(completed_break)
    total_break_seconds = shift.get("total_break_seconds", 0) + break_duration
    
    await db.shifts.update_one(
        {"id": shift["id"]},
        {"$set": {
            "status": "working",
            "current_break": None,
            "breaks": breaks,
            "total_break_seconds": total_break_seconds,
            "updated_at": datetime.utcnow()
        }}
    )
    
    await log_activity(current_user["id"], "break_end", f"Ended break after {break_duration // 60} minutes")
    
    return {
        "id": shift["id"],
        "status": "working",
        "clock_in": shift["clock_in"]["timestamp"].isoformat() if isinstance(shift["clock_in"]["timestamp"], datetime) else shift["clock_in"]["timestamp"],
        "clock_in_local": shift["clock_in"].get("local_time"),
        "current_break": None,
        "breaks": breaks,
        "total_break_seconds": total_break_seconds
    }

@api_router.get("/shifts/history")
async def get_shift_history(
    limit: int = Query(default=30, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get shift history for the employee"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    if not employee:
        return []
    
    shifts = await db.shifts.find(
        {"employee_id": employee["id"]}
    ).sort("date", -1).limit(limit).to_list(limit)
    
    return [{
        "id": s["id"],
        "date": s["date"],
        "status": s["status"],
        "clock_in_local": s.get("clock_in", {}).get("local_time"),
        "clock_out_local": s.get("clock_out", {}).get("local_time"),
        "total_work_hours": s.get("total_work_hours"),
        "breaks_count": len(s.get("breaks", []))
    } for s in shifts]

# ===== Time-Off Request Routes (NEW SIMPLIFIED) =====

class TimeOffRequest(BaseModel):
    start_date: str
    end_date: str
    note: Optional[str] = None
    leave_type_id: Optional[str] = None

@api_router.get("/time-off")
async def get_time_off_requests(current_user: dict = Depends(get_current_user)):
    """Get all time-off requests for the current user"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    if not employee:
        return []
    
    requests = await db.time_off_requests.find(
        {"employee_id": employee["id"]}
    ).sort("created_at", -1).to_list(100)
    
    return [{
        "id": r["id"],
        "start_date": r["start_date"],
        "end_date": r["end_date"],
        "leave_type_id": r.get("leave_type_id"),
        "leave_type_name": r.get("leave_type_name", "Time Off"),
        "note": r.get("note"),
        "status": r["status"],
        "days_count": r.get("days_count", 1),
        "created_at": r["created_at"].isoformat() if isinstance(r["created_at"], datetime) else r["created_at"],
        "review_note": r.get("review_note")
    } for r in requests]

@api_router.post("/time-off")
async def create_time_off_request(data: TimeOffRequest, current_user: dict = Depends(get_current_user)):
    """Submit a new time-off request"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    if not employee:
        raise HTTPException(status_code=400, detail="Employee profile not found")
    
    start = datetime.strptime(data.start_date, "%Y-%m-%d")
    end = datetime.strptime(data.end_date, "%Y-%m-%d")
    days_count = calculate_days(data.start_date, data.end_date, False)
    
    if days_count < 1:
        raise HTTPException(status_code=400, detail="Invalid date range")

    selected_leave_type_id = data.leave_type_id
    leave_type_name = "Time Off"

    if selected_leave_type_id:
        leave_type = await db.leave_types.find_one({"id": selected_leave_type_id})
        if not leave_type:
            raise HTTPException(status_code=404, detail="Leave type not found")
        leave_type_name = leave_type["name"]

        current_balance = float(employee.get("leave_balance", {}).get(selected_leave_type_id, 0))
        if current_balance < days_count:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough {leave_type_name.lower()} balance remaining"
            )
    
    request_id = str(uuid.uuid4())
    request = {
        "id": request_id,
        "employee_id": employee["id"],
        "company_id": employee.get("company_id"),
        "leave_type_id": selected_leave_type_id,
        "leave_type_name": leave_type_name,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "note": data.note,
        "status": "pending",
        "days_count": days_count,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.time_off_requests.insert_one(request)

    mirrored_leave_request = {
        "id": str(uuid.uuid4()),
        "employee_id": employee["id"],
        "company_id": employee.get("company_id"),
        "leave_type_id": selected_leave_type_id or "time_off",
        "leave_type_name": leave_type_name,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "days_count": float(days_count),
        "reason": data.note,
        "status": "pending",
        "half_day": False,
        "approved_by": None,
        "approved_at": None,
        "manager_comment": None,
        "created_at": request["created_at"],
        "source_time_off_request_id": request_id,
    }
    await db.leave_requests.insert_one(mirrored_leave_request)
    await log_activity(current_user["id"], "time_off_request", f"Requested {days_count} days off: {data.start_date} to {data.end_date}")
    
    return {
        "id": request_id,
        "message": "Time-off request submitted successfully"
    }

@api_router.delete("/time-off/{request_id}")
async def cancel_time_off_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a pending time-off request"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    if not employee:
        raise HTTPException(status_code=400, detail="Employee profile not found")
    
    request = await db.time_off_requests.find_one({
        "id": request_id,
        "employee_id": employee["id"]
    })
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    
    await db.time_off_requests.delete_one({"id": request_id})
    await db.leave_requests.delete_many({"source_time_off_request_id": request_id})
    await log_activity(current_user["id"], "time_off_cancelled", f"Cancelled time-off request")
    
    return {"message": "Request cancelled successfully"}

# ===== Paystub Routes (NEW) =====

def decode_paystub_pdf(pdf_base64: Optional[str]) -> Optional[bytes]:
    if not pdf_base64:
        return None

    encoded = pdf_base64.split(",", 1)[1] if "," in pdf_base64 else pdf_base64
    try:
        return base64.b64decode(encoded)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid paystub PDF content") from exc

async def upsert_paystub(payload: PaystubCreate, current_user: dict) -> dict:
    employee = await db.employees.find_one({"id": payload.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    payroll_record = None
    if payload.payroll_id:
        payroll_record = await db.payroll.find_one({"id": payload.payroll_id})

    department_name = None
    if employee.get("department_id"):
        department = await db.departments.find_one({"id": employee["department_id"]})
        if department:
            department_name = department.get("name")

    pay_date = payload.pay_date or datetime.utcnow().strftime("%Y-%m-%d")
    employee_name = f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip() or "Employee"
    employee_code = employee.get("employee_id", payload.employee_id)
    pdf_bytes = decode_paystub_pdf(payload.pdf_base64) or make_pdf_bytes(
        employee_name=employee_name,
        employee_code=employee_code,
        pay_period_start=payload.pay_period_start,
        pay_period_end=payload.pay_period_end,
        pay_date=pay_date,
        gross_pay=payload.gross_pay,
        net_pay=payload.net_pay,
        basic_pay=(payroll_record or {}).get("basic_salary", max(0, payload.gross_pay - payload.bonus)),
        overtime_pay=(payroll_record or {}).get("overtime_pay", 0),
        bonus=payload.bonus,
        tax=payload.tax,
        deductions=payload.deductions,
        insurance_deduction=payload.insurance_deduction,
        pension_deduction=payload.pension_deduction,
        benefits_deduction=payload.benefits_deduction,
        department_name=department_name,
        job_title=employee.get("job_title"),
    )

    existing_paystub = None
    if payload.payroll_id:
        existing_paystub = await db.paystubs.find_one({"payroll_id": payload.payroll_id})

    if not existing_paystub:
        existing_paystub = await db.paystubs.find_one({
            "employee_id": payload.employee_id,
            "pay_period_start": payload.pay_period_start,
            "pay_period_end": payload.pay_period_end,
        })
    was_published = bool(existing_paystub and existing_paystub.get("published"))

    update_doc = {
        "employee_id": payload.employee_id,
        "payroll_id": payload.payroll_id,
        "pay_period_start": payload.pay_period_start,
        "pay_period_end": payload.pay_period_end,
        "pay_date": pay_date,
        "gross_pay": payload.gross_pay,
        "deductions": payload.deductions,
        "tax": payload.tax,
        "insurance_deduction": payload.insurance_deduction,
        "pension_deduction": payload.pension_deduction,
        "benefits_deduction": payload.benefits_deduction,
        "bonus": payload.bonus,
        "net_pay": payload.net_pay,
        "pdf_filename": payload.file_name or f"{employee_code}_{pay_date}.pdf",
        "pdf_content": pdf_bytes,
        "published": payload.published,
        "updated_at": datetime.utcnow(),
    }

    if existing_paystub:
        paystub_id = existing_paystub["id"]
        await db.paystubs.update_one({"id": paystub_id}, {"$set": update_doc})
        action = "paystub_updated"
    else:
        paystub_id = str(uuid.uuid4())
        update_doc["id"] = paystub_id
        update_doc["created_at"] = datetime.utcnow()
        await db.paystubs.insert_one(update_doc)
        action = "paystub_created"

    if payload.payroll_id:
        await db.payroll.update_one(
            {"id": payload.payroll_id},
            {"$set": {"status": "sent"}}
        )

    if payload.published and not was_published:
        await notify_employee_by_employee_id(
            payload.employee_id,
            "New paystub received",
            f"Your paystub for {payload.pay_period_start} to {payload.pay_period_end} is now available in the Pay tab.",
            notification_type="paystub_received",
            data={
                "employee_id": payload.employee_id,
                "payroll_id": payload.payroll_id,
                "pay_period_start": payload.pay_period_start,
                "pay_period_end": payload.pay_period_end,
                "pay_date": pay_date,
            },
        )

    await log_activity(
        current_user["id"],
        action,
        f"Paystub saved for {employee_name} ({payload.pay_period_start} to {payload.pay_period_end})",
        metadata={"employee_id": payload.employee_id, "payroll_id": payload.payroll_id, "paystub_id": paystub_id},
    )

    saved = await db.paystubs.find_one({"id": paystub_id})
    if not saved:
        raise HTTPException(status_code=500, detail="Paystub could not be saved")
    return saved

@api_router.get("/paystubs")
async def get_paystubs(current_user: dict = Depends(get_current_user)):
    """Get all paystubs for the current employee"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    if not employee:
        return []
    
    paystubs = await db.paystubs.find(
        {"employee_id": employee["id"], "published": True}
    ).sort("pay_date", -1).to_list(100)
    
    return [{
        "id": p["id"],
        "pay_period_start": p["pay_period_start"],
        "pay_period_end": p["pay_period_end"],
        "pay_date": p["pay_date"],
        "gross_pay": p.get("gross_pay", 0),
        "net_pay": p.get("net_pay", 0),
        "pdf_filename": p.get("pdf_filename", "Paystub.pdf"),
        "published": p.get("published", False),
    } for p in paystubs]

@api_router.post("/paystubs")
async def create_or_update_paystub(payload: PaystubCreate, current_user: dict = Depends(require_admin)):
    saved = await upsert_paystub(payload, current_user)
    return {
        "message": "Paystub saved successfully",
        "id": saved["id"],
        "payroll_id": saved.get("payroll_id"),
        "pay_date": saved.get("pay_date"),
        "pdf_filename": saved.get("pdf_filename"),
    }

@api_router.post("/paystubs/send")
async def send_paystubs(payload: PaystubBulkSend, current_user: dict = Depends(require_admin)):
    requested_ids = payload.payroll_ids or payload.paystub_ids
    if not requested_ids:
        raise HTTPException(status_code=400, detail="No paystubs selected")

    requested_ids = list(dict.fromkeys(requested_ids))
    sent_paystub_ids: List[str] = []

    existing_paystubs = await db.paystubs.find({"id": {"$in": requested_ids}}).to_list(len(requested_ids))
    for paystub in existing_paystubs:
        sent_paystub_ids.append(paystub["id"])
        if paystub.get("payroll_id"):
            await db.payroll.update_one(
                {"id": paystub["payroll_id"]},
                {"$set": {"status": "sent"}}
            )

    existing_paystub_ids = {paystub["id"] for paystub in existing_paystubs}
    unresolved_ids = [item_id for item_id in requested_ids if item_id not in existing_paystub_ids]

    if unresolved_ids:
        payroll_records = await db.payroll.find({"id": {"$in": unresolved_ids}}).to_list(len(unresolved_ids))
        payroll_ids_found = {payroll["id"] for payroll in payroll_records}

        for payroll in payroll_records:
            saved = await upsert_paystub(
                PaystubCreate(
                    employee_id=payroll["employee_id"],
                    payroll_id=payroll["id"],
                    pay_period_start=payroll["pay_period_start"],
                    pay_period_end=payroll["pay_period_end"],
                    gross_pay=payroll["gross_pay"],
                    deductions=payroll.get("deductions", 0),
                    tax=payroll.get("tax", 0),
                    insurance_deduction=payroll.get("insurance_deduction", 0),
                    pension_deduction=payroll.get("pension_deduction", 0),
                    benefits_deduction=payroll.get("benefits_deduction", 0),
                    bonus=payroll.get("bonus", 0),
                    net_pay=payroll["net_pay"],
                    pay_date=payroll.get("pay_period_end"),
                ),
                current_user,
            )
            sent_paystub_ids.append(saved["id"])

        missing_ids = [item_id for item_id in unresolved_ids if item_id not in payroll_ids_found]
    else:
        missing_ids = []

    await log_activity(
        current_user["id"],
        "paystubs_sent",
        f"Processed {len(sent_paystub_ids)} paystubs for delivery",
        metadata={"requested_ids": requested_ids, "sent_paystub_ids": sent_paystub_ids, "missing_ids": missing_ids},
    )

    return {
        "message": f"Processed {len(sent_paystub_ids)} paystub(s)",
        "processed_count": len(sent_paystub_ids),
        "paystub_ids": sent_paystub_ids,
        "missing_ids": missing_ids,
    }

@api_router.get("/paystubs/{paystub_id}/download")
async def download_paystub(paystub_id: str, token: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Download a paystub PDF"""
    if current_user["role"] in ["super_admin", "hr_admin", "manager", "hr"]:
        paystub = await db.paystubs.find_one({"id": paystub_id})
    else:
        employee = await db.employees.find_one({"user_id": current_user["id"]})
        if not employee:
            employee = await db.employees.find_one({"email": current_user["email"]})
        
        paystub = await db.paystubs.find_one({
            "id": paystub_id,
            "employee_id": employee["id"] if employee else None
        })
    
    if not paystub:
        raise HTTPException(status_code=404, detail="Paystub not found")
    
    # Return a placeholder PDF or the actual file
    pdf_content = paystub.get("pdf_content")
    if pdf_content:
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={paystub.get('pdf_filename', 'paystub.pdf')}"}
        )
    
    raise HTTPException(status_code=404, detail="PDF not available")

# ===== Admin Time-Off Management Routes =====

@api_router.get("/admin/time-off")
async def admin_get_time_off_requests(
    status: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Get all time-off requests (admin/manager only)"""
    company_id = await get_current_company_id(current_user)
    query = {"company_id": company_id} if company_id else {}
    if status:
        query["status"] = status
    
    requests = await db.time_off_requests.find(query).sort("created_at", -1).to_list(500)
    
    result = []
    for r in requests:
        employee = await db.employees.find_one({"id": r["employee_id"]})
        result.append({
            "id": r["id"],
            "employee_id": r["employee_id"],
            "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}" if employee else "Unknown",
            "start_date": r["start_date"],
            "end_date": r["end_date"],
            "leave_type_id": r.get("leave_type_id"),
            "leave_type_name": r.get("leave_type_name", "Time Off"),
            "note": r.get("note"),
            "status": r["status"],
            "days_count": r.get("days_count", 1),
            "created_at": r["created_at"].isoformat() if isinstance(r["created_at"], datetime) else r["created_at"],
            "review_note": r.get("review_note")
        })
    
    return result

@api_router.put("/admin/time-off/{request_id}")
async def admin_review_time_off(
    request_id: str,
    action: str = Query(..., regex="^(approve|deny)$"),
    note: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Approve or deny a time-off request (admin/manager only)"""
    request = await db.time_off_requests.find_one({"id": request_id})
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    new_status = "approved" if action == "approve" else "denied"
    previous_status = request.get("status", "pending")
    
    await db.time_off_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": new_status,
            "reviewed_by": current_user["id"],
            "reviewed_at": datetime.utcnow(),
            "review_note": note,
            "updated_at": datetime.utcnow()
        }}
    )
    await db.leave_requests.update_many(
        {"source_time_off_request_id": request_id},
        {
            "$set": {
                "status": new_status,
                "manager_comment": note,
                "approved_by": current_user["id"],
                "approved_at": datetime.utcnow(),
            }
        },
    )
    await apply_leave_balance_transition(
        employee_id=request.get("employee_id"),
        leave_type_id=request.get("leave_type_id"),
        days_count=request.get("days_count"),
        previous_status=previous_status,
        new_status=new_status,
    )

    await notify_employee_by_employee_id(
        request["employee_id"],
        f"Leave request {new_status}",
        f"Your {request.get('leave_type_name', 'leave')} request from {request['start_date']} to {request['end_date']} was {new_status}.",
        notification_type="leave_reviewed",
        data={"request_id": request_id, "status": new_status},
    )
    
    await log_activity(current_user["id"], f"time_off_{action}d", f"Time-off request {action}d")
    
    return {"message": f"Request {new_status}"}

# ===== Admin Shift Routes =====

@api_router.get("/admin/shifts")
async def admin_get_shifts(
    date: Optional[str] = None,
    employee_id: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Get all shifts (admin/manager only)"""
    query = {}
    if date:
        query["date"] = date
    if employee_id:
        query["employee_id"] = employee_id
    
    shifts = await db.shifts.find(query).sort("date", -1).limit(500).to_list(500)
    
    result = []
    for s in shifts:
        employee = await db.employees.find_one({"id": s["employee_id"]})
        result.append({
            "id": s["id"],
            "employee_id": s["employee_id"],
            "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}" if employee else "Unknown",
            "date": s["date"],
            "status": s["status"],
            "clock_in": s.get("clock_in"),
            "clock_out": s.get("clock_out"),
            "breaks": s.get("breaks", []),
            "total_work_hours": s.get("total_work_hours"),
            "total_break_seconds": s.get("total_break_seconds", 0)
        })
    
    return result

# ===== Work Location Routes (GPS) =====
@api_router.post("/work-locations", response_model=WorkLocationResponse)
async def create_work_location(location: WorkLocationCreate, current_user: dict = Depends(require_admin)):
    loc_id = str(uuid.uuid4())
    work_location = {
        "id": loc_id,
        "name": location.name,
        "address": location.address,
        "latitude": location.latitude,
        "longitude": location.longitude,
        "radius": location.radius,
        "department_id": location.department_id,
        "is_active": location.is_active,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db.work_locations.insert_one(work_location)
    await log_activity(current_user["id"], "work_location_created", f"Work location created: {location.name}")
    
    return WorkLocationResponse(**work_location)

@api_router.get("/work-locations", response_model=List[WorkLocationResponse])
async def get_work_locations(current_user: dict = Depends(get_current_user)):
    locations = await db.work_locations.find({"is_active": True}).to_list(100)
    return [WorkLocationResponse(**loc) for loc in locations]

@api_router.put("/work-locations/{loc_id}", response_model=WorkLocationResponse)
async def update_work_location(loc_id: str, location: WorkLocationCreate, current_user: dict = Depends(require_admin)):
    await db.work_locations.update_one(
        {"id": loc_id},
        {"$set": {
            "name": location.name,
            "address": location.address,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "radius": location.radius,
            "department_id": location.department_id,
            "is_active": location.is_active,
            "updated_at": datetime.utcnow()
        }}
    )
    loc = await db.work_locations.find_one({"id": loc_id})
    await log_activity(current_user["id"], "work_location_updated", f"Work location updated: {location.name}")
    return WorkLocationResponse(**loc)

@api_router.delete("/work-locations/{loc_id}")
async def delete_work_location(loc_id: str, current_user: dict = Depends(require_admin)):
    await db.work_locations.update_one({"id": loc_id}, {"$set": {"is_active": False}})
    await log_activity(current_user["id"], "work_location_deleted", f"Work location deleted: {loc_id}")
    return {"message": "Work location deleted"}

async def verify_location(lat: float, lon: float, employee: dict = None) -> tuple[bool, str]:
    """Verify if the given coordinates are within any approved work location"""
    locations = await db.work_locations.find({"is_active": True}).to_list(100)
    
    if not locations:
        # No locations configured, allow clock in anywhere
        return True, "No work locations configured"
    
    for loc in locations:
        # Check department restriction
        if loc.get("department_id") and employee:
            if loc["department_id"] != employee.get("department_id"):
                continue
        
        distance = haversine_distance(lat, lon, loc["latitude"], loc["longitude"])
        if distance <= loc["radius"]:
            return True, f"Within {loc['name']} ({int(distance)}m from center)"
    
    return False, "Not within any approved work location"

# ===== Department Routes =====
@api_router.post("/departments", response_model=DepartmentResponse)
async def create_department(dept: DepartmentCreate, current_user: dict = Depends(require_admin)):
    company_id = await get_current_company_id(current_user)
    dept_id = str(uuid.uuid4())
    manager_name = None
    if dept.manager_id:
        manager = await db.employees.find_one({"id": dept.manager_id})
        if manager:
            manager_name = f"{manager['first_name']} {manager['last_name']}"
    
    department = {
        "id": dept_id,
        "company_id": company_id,
        "name": dept.name,
        "description": dept.description,
        "manager_id": dept.manager_id,
        "budget": dept.budget,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db.departments.insert_one(department)
    await log_activity(current_user["id"], "department_created", f"Department created: {dept.name}")
    
    return DepartmentResponse(
        id=dept_id,
        name=dept.name,
        description=dept.description,
        manager_id=dept.manager_id,
        manager_name=manager_name,
        budget=dept.budget,
        employee_count=0,
        created_at=department["created_at"]
    )

@api_router.get("/departments", response_model=List[DepartmentResponse])
async def get_departments(current_user: dict = Depends(get_current_user)):
    company_id = await get_current_company_id(current_user)
    department_query: Dict[str, Any] = {"company_id": company_id}
    if current_user["role"] == "manager":
        manager_employee = await db.employees.find_one({"user_id": current_user["id"], "company_id": company_id}) or await db.employees.find_one({"email": current_user["email"], "company_id": company_id})
        if not manager_employee or not manager_employee.get("department_id"):
            return []
        department_query["id"] = manager_employee["department_id"]

    departments = await db.departments.find(department_query).to_list(1000)
    result = []
    for dept in departments:
        employee_count = await db.employees.count_documents({"department_id": dept["id"], "status": "active", "company_id": company_id})
        manager_name = None
        if dept.get("manager_id"):
            manager = await db.employees.find_one({"id": dept["manager_id"]})
            if manager:
                manager_name = f"{manager['first_name']} {manager['last_name']}"
        result.append(DepartmentResponse(
            id=dept["id"],
            name=dept["name"],
            description=dept.get("description"),
            manager_id=dept.get("manager_id"),
            manager_name=manager_name,
            budget=dept.get("budget"),
            employee_count=employee_count,
            created_at=dept["created_at"]
        ))
    return result

@api_router.get("/departments/{dept_id}", response_model=DepartmentResponse)
async def get_department(dept_id: str, current_user: dict = Depends(get_current_user)):
    company_id = await get_current_company_id(current_user)
    dept = await db.departments.find_one({"id": dept_id, "company_id": company_id})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    employee_count = await db.employees.count_documents({"department_id": dept_id, "status": "active", "company_id": company_id})
    manager_name = None
    if dept.get("manager_id"):
        manager = await db.employees.find_one({"id": dept["manager_id"]})
        if manager:
            manager_name = f"{manager['first_name']} {manager['last_name']}"
    
    return DepartmentResponse(
        id=dept["id"],
        name=dept["name"],
        description=dept.get("description"),
        manager_id=dept.get("manager_id"),
        manager_name=manager_name,
        budget=dept.get("budget"),
        employee_count=employee_count,
        created_at=dept["created_at"]
    )

@api_router.put("/departments/{dept_id}", response_model=DepartmentResponse)
async def update_department(dept_id: str, dept_data: DepartmentCreate, current_user: dict = Depends(require_admin)):
    company_id = await get_current_company_id(current_user)
    await db.departments.update_one(
        {"id": dept_id, "company_id": company_id},
        {"$set": {
            "name": dept_data.name,
            "description": dept_data.description,
            "manager_id": dept_data.manager_id,
            "budget": dept_data.budget,
            "updated_at": datetime.utcnow()
        }}
    )
    await log_activity(current_user["id"], "department_updated", f"Department updated: {dept_data.name}")
    return await get_department(dept_id, current_user)

@api_router.delete("/departments/{dept_id}")
async def delete_department(dept_id: str, current_user: dict = Depends(require_admin)):
    company_id = await get_current_company_id(current_user)
    await db.departments.delete_one({"id": dept_id, "company_id": company_id})
    await log_activity(current_user["id"], "department_deleted", f"Department deleted: {dept_id}")
    return {"message": "Department deleted"}


async def resolve_employee_department(
    company_id: Optional[str],
    department_id: Optional[str] = None,
    department_name: Optional[str] = None,
) -> dict:
    resolved_department = None

    if department_id:
        resolved_department = await db.departments.find_one({"id": department_id, "company_id": company_id})

    normalized_name = (department_name or "").strip()
    if not resolved_department and normalized_name:
        resolved_department = await db.departments.find_one({
            "name": {"$regex": f"^{re.escape(normalized_name)}$", "$options": "i"},
            "company_id": company_id,
        })

    if not resolved_department and normalized_name:
        now = datetime.utcnow()
        resolved_department = {
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "name": normalized_name,
            "description": None,
            "manager_id": None,
            "budget": None,
            "created_at": now,
            "updated_at": now,
        }
        await db.departments.insert_one(resolved_department)

    if not resolved_department:
        raise HTTPException(status_code=400, detail="Department is required")

    return resolved_department

# ===== Employee Routes =====
@api_router.post("/employees", response_model=EmployeeResponse)
async def create_employee(emp: EmployeeCreate, current_user: dict = Depends(require_admin)):
    company_id = await get_current_company_id(current_user)
    existing = await db.employees.find_one({"employee_id": emp.employee_id, "company_id": company_id})
    if existing:
        raise HTTPException(status_code=400, detail="Employee ID already exists")

    existing_email = await db.employees.find_one({"email": emp.email.lower(), "company_id": company_id})
    if existing_email:
        raise HTTPException(status_code=400, detail="Employee email already exists")

    if not emp.user_id:
        existing_user = await db.users.find_one({"email": emp.email.lower()})
        if existing_user:
            raise HTTPException(status_code=400, detail="A user account with this email already exists")
    
    emp_id = str(uuid.uuid4())
    role = normalize_employee_role(emp.role)
    dept = await resolve_employee_department(
        company_id=company_id,
        department_id=emp.department_id,
        department_name=emp.department_name,
    )
    dept_name = dept["name"] if dept else None
    
    manager_name = None
    if emp.manager_id:
        manager = await db.employees.find_one({"id": emp.manager_id})
        if manager:
            manager_name = f"{manager['first_name']} {manager['last_name']}"
    
    leave_types = await ensure_core_leave_types()
    leave_balance = {lt["id"]: lt["days_per_year"] for lt in leave_types}
    if emp.leave_balance:
        for leave_type_id, balance_value in emp.leave_balance.items():
            leave_balance[leave_type_id] = max(0.0, float(balance_value))
    leave_balance_summary = summarize_leave_balance({"leave_balance": leave_balance}, leave_types)

    user_id = await ensure_employee_user_account(
        employee_id=emp_id,
        email=emp.email,
        first_name=emp.first_name,
        last_name=emp.last_name,
        role=role,
        temporary_password=emp.temporary_password,
        company_id=company_id,
        existing_user_id=emp.user_id,
    )
    
    employee = {
        "id": emp_id,
        "user_id": user_id,
        "employee_id": emp.employee_id,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "email": emp.email.lower(),
        "role": role,
        "company_id": company_id,
        "phone": emp.phone,
        "job_title": emp.job_title,
        "department_id": dept["id"],
        "manager_id": emp.manager_id,
        "work_location_id": emp.work_location_id,
        "work_location": emp.work_location,
        "employment_type": emp.employment_type,
        "start_date": emp.start_date,
        "regular_start_time": normalize_time_string(emp.regular_start_time),
        "regular_end_time": normalize_time_string(emp.regular_end_time),
        "status": "active",
        "date_of_birth": emp.date_of_birth,
        "address": emp.address,
        "city": emp.city,
        "state": emp.state,
        "zip_code": emp.zip_code,
        "country": emp.country,
        "emergency_contact": emp.emergency_contact.dict() if emp.emergency_contact else None,
        "bank_info": emp.bank_info.dict() if emp.bank_info else None,
        "tax_id": emp.tax_id,
        "salary": emp.salary,
        "hourly_rate": emp.hourly_rate,
        "skills": emp.skills or [],
        "notes": emp.notes,
        "leave_balance": leave_balance_summary["leave_balance"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db.employees.insert_one(employee)
    await log_activity(current_user["id"], "employee_created", f"Employee created: {emp.first_name} {emp.last_name}")
    
    return EmployeeResponse(
        id=emp_id,
        user_id=user_id,
        employee_id=emp.employee_id,
        first_name=emp.first_name,
        last_name=emp.last_name,
        email=emp.email,
        role=role,
        phone=emp.phone,
        job_title=emp.job_title,
        department_id=dept["id"],
        department_name=dept_name,
        manager_id=emp.manager_id,
        manager_name=manager_name,
        work_location_id=emp.work_location_id,
        work_location=emp.work_location,
        employment_type=emp.employment_type,
        start_date=emp.start_date,
        regular_start_time=normalize_time_string(emp.regular_start_time),
        regular_end_time=normalize_time_string(emp.regular_end_time),
        status="active",
        date_of_birth=emp.date_of_birth,
        address=emp.address,
        city=emp.city,
        state=emp.state,
        zip_code=emp.zip_code,
        country=emp.country,
        emergency_contact=emp.emergency_contact,
        bank_info=emp.bank_info,
        tax_id=emp.tax_id,
        salary=emp.salary,
        hourly_rate=emp.hourly_rate,
        skills=emp.skills,
        notes=emp.notes,
        leave_balance=leave_balance_summary["leave_balance"],
        leave_balance_hours=leave_balance_summary["leave_balance_hours"],
        vacation_balance_hours=leave_balance_summary["vacation_balance_hours"],
        sick_balance_hours=leave_balance_summary["sick_balance_hours"],
        created_at=employee["created_at"]
    )

@api_router.get("/employees", response_model=List[EmployeeResponse])
async def get_employees(
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company_id = await get_current_company_id(current_user)
    query = {"company_id": company_id} if company_id else {}
    if status:
        query["status"] = status
    if department_id:
        query["department_id"] = department_id
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"employee_id": {"$regex": search, "$options": "i"}}
        ]

    if current_user["role"] == "manager":
        manager_employee = await db.employees.find_one({"user_id": current_user["id"], "company_id": company_id}) or await db.employees.find_one({"email": current_user["email"], "company_id": company_id})
        if not manager_employee:
            return []
        query["department_id"] = manager_employee.get("department_id")
    
    employees = await db.employees.find(query).to_list(1000)
    departments = {
        d["id"]: d["name"]
        for d in await db.departments.find({"company_id": company_id}).to_list(1000)
    }
    leave_types = await ensure_core_leave_types()
    emp_names = {e["id"]: f"{e['first_name']} {e['last_name']}" for e in employees}
    
    result = []
    for emp in employees:
        leave_balance_summary = summarize_leave_balance(emp, leave_types)
        result.append(EmployeeResponse(
            id=emp["id"],
            user_id=emp.get("user_id"),
            employee_id=emp["employee_id"],
            first_name=emp["first_name"],
            last_name=emp["last_name"],
            email=emp["email"],
            role=emp.get("role", "employee"),
            phone=emp.get("phone"),
            job_title=emp["job_title"],
            department_id=emp["department_id"],
            department_name=departments.get(emp["department_id"]),
            manager_id=emp.get("manager_id"),
            manager_name=emp_names.get(emp.get("manager_id")),
            work_location_id=emp.get("work_location_id"),
            work_location=emp.get("work_location"),
            employment_type=emp["employment_type"],
            start_date=emp["start_date"],
            regular_start_time=emp.get("regular_start_time"),
            regular_end_time=emp.get("regular_end_time"),
            status=emp["status"],
            date_of_birth=emp.get("date_of_birth"),
            address=emp.get("address"),
            city=emp.get("city"),
            state=emp.get("state"),
            zip_code=emp.get("zip_code"),
            country=emp.get("country"),
            emergency_contact=EmergencyContact(**emp["emergency_contact"]) if emp.get("emergency_contact") else None,
            bank_info=BankInfo(**emp["bank_info"]) if emp.get("bank_info") else None,
            tax_id=emp.get("tax_id"),
            salary=emp.get("salary"),
            hourly_rate=emp.get("hourly_rate"),
            skills=emp.get("skills", []),
            notes=emp.get("notes"),
            leave_balance=leave_balance_summary["leave_balance"],
            leave_balance_hours=leave_balance_summary["leave_balance_hours"],
            vacation_balance_hours=leave_balance_summary["vacation_balance_hours"],
            sick_balance_hours=leave_balance_summary["sick_balance_hours"],
            created_at=emp["created_at"]
        ))
    return result

@api_router.get("/employees/{emp_id}", response_model=EmployeeResponse)
async def get_employee(emp_id: str, current_user: dict = Depends(get_current_user)):
    company_id = await get_current_company_id(current_user)
    emp = await db.employees.find_one({"id": emp_id, "company_id": company_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    dept = await db.departments.find_one({"id": emp["department_id"], "company_id": company_id})
    leave_types = await ensure_core_leave_types()
    leave_balance_summary = summarize_leave_balance(emp, leave_types)
    dept_name = dept["name"] if dept else None
    
    manager_name = None
    if emp.get("manager_id"):
        manager = await db.employees.find_one({"id": emp["manager_id"]})
        if manager:
            manager_name = f"{manager['first_name']} {manager['last_name']}"
    
    return EmployeeResponse(
        id=emp["id"],
        user_id=emp.get("user_id"),
        employee_id=emp["employee_id"],
        first_name=emp["first_name"],
        last_name=emp["last_name"],
        email=emp["email"],
        role=emp.get("role", "employee"),
        phone=emp.get("phone"),
        job_title=emp["job_title"],
        department_id=emp["department_id"],
        department_name=dept_name,
        manager_id=emp.get("manager_id"),
        manager_name=manager_name,
        work_location_id=emp.get("work_location_id"),
        work_location=emp.get("work_location"),
        employment_type=emp["employment_type"],
        start_date=emp["start_date"],
        regular_start_time=emp.get("regular_start_time"),
        regular_end_time=emp.get("regular_end_time"),
        status=emp["status"],
        date_of_birth=emp.get("date_of_birth"),
        address=emp.get("address"),
        city=emp.get("city"),
        state=emp.get("state"),
        zip_code=emp.get("zip_code"),
        country=emp.get("country"),
        emergency_contact=EmergencyContact(**emp["emergency_contact"]) if emp.get("emergency_contact") else None,
        bank_info=BankInfo(**emp["bank_info"]) if emp.get("bank_info") else None,
        tax_id=emp.get("tax_id"),
        salary=emp.get("salary"),
        hourly_rate=emp.get("hourly_rate"),
        skills=emp.get("skills", []),
        notes=emp.get("notes"),
        leave_balance=leave_balance_summary["leave_balance"],
        leave_balance_hours=leave_balance_summary["leave_balance_hours"],
        vacation_balance_hours=leave_balance_summary["vacation_balance_hours"],
        sick_balance_hours=leave_balance_summary["sick_balance_hours"],
        created_at=emp["created_at"]
    )

# ===== Employee Profile Self-Service Routes =====
@api_router.get("/employees/me")
async def get_my_employee_profile(current_user: dict = Depends(get_current_user)):
    """Get the current user's employee profile with all personal info"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    if not employee:
        # Return basic info from user if no employee record exists
        return {
            "first_name": current_user.get("first_name", ""),
            "last_name": current_user.get("last_name", ""),
            "email": current_user.get("email", ""),
            "phone": "",
            "next_of_kin_name": "",
            "next_of_kin_phone": "",
            "next_of_kin_relationship": ""
        }
    
    # Get next of kin info from emergency_contact if available
    emergency = employee.get("emergency_contact") or {}
    
    return {
        "id": employee.get("id"),
        "first_name": employee.get("first_name", ""),
        "last_name": employee.get("last_name", ""),
        "email": employee.get("email", ""),
        "phone": employee.get("phone", ""),
        "next_of_kin_name": employee.get("next_of_kin_name") or emergency.get("name", ""),
        "next_of_kin_phone": employee.get("next_of_kin_phone") or emergency.get("phone", ""),
        "next_of_kin_relationship": employee.get("next_of_kin_relationship") or emergency.get("relationship", "")
    }

@api_router.put("/employees/me")
async def update_my_employee_profile(data: EmployeeProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update the current user's personal profile (name, phone, next of kin)"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    update_dict = {}
    
    # Only update provided fields (name, phone, next of kin)
    if data.first_name is not None:
        update_dict["first_name"] = data.first_name
    if data.last_name is not None:
        update_dict["last_name"] = data.last_name
    if data.phone is not None:
        update_dict["phone"] = data.phone
    
    # Store next of kin as separate fields for easy access
    if data.next_of_kin_name is not None:
        update_dict["next_of_kin_name"] = data.next_of_kin_name
    if data.next_of_kin_phone is not None:
        update_dict["next_of_kin_phone"] = data.next_of_kin_phone
    if data.next_of_kin_relationship is not None:
        update_dict["next_of_kin_relationship"] = data.next_of_kin_relationship
    
    # Also update emergency_contact for compatibility
    if data.next_of_kin_name or data.next_of_kin_phone or data.next_of_kin_relationship:
        current_emergency = employee.get("emergency_contact") if employee else {}
        if not current_emergency:
            current_emergency = {}
        update_dict["emergency_contact"] = {
            "name": data.next_of_kin_name or current_emergency.get("name", ""),
            "phone": data.next_of_kin_phone or current_emergency.get("phone", ""),
            "relationship": data.next_of_kin_relationship or current_emergency.get("relationship", "")
        }
    
    update_dict["updated_at"] = datetime.utcnow()
    
    if employee:
        await db.employees.update_one({"id": employee["id"]}, {"$set": update_dict})
        await log_activity(current_user["id"], "profile_updated", "Employee updated their personal profile")
    else:
        # Create a minimal employee record if one doesn't exist
        emp_id = str(uuid.uuid4())
        new_employee = {
            "id": emp_id,
            "company_id": await get_current_company_id(current_user),
            "user_id": current_user["id"],
            "employee_id": f"EMP{emp_id[:8].upper()}",
            "first_name": data.first_name or current_user.get("first_name", ""),
            "last_name": data.last_name or current_user.get("last_name", ""),
            "email": current_user["email"],
            "phone": data.phone or "",
            "job_title": "Employee",
            "department_id": "",
            "employment_type": "Full-time",
            "start_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "status": "active",
            "next_of_kin_name": data.next_of_kin_name or "",
            "next_of_kin_phone": data.next_of_kin_phone or "",
            "next_of_kin_relationship": data.next_of_kin_relationship or "",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await db.employees.insert_one(new_employee)
        await log_activity(current_user["id"], "profile_created", "Employee created their profile")
    
    # Also update the user record if name changed
    if data.first_name or data.last_name:
        user_update = {}
        if data.first_name:
            user_update["first_name"] = data.first_name
        if data.last_name:
            user_update["last_name"] = data.last_name
        user_update["updated_at"] = datetime.utcnow()
        await db.users.update_one({"id": current_user["id"]}, {"$set": user_update})
    
    return {"message": "Profile updated successfully"}

@api_router.put("/employees/{emp_id}", response_model=EmployeeResponse)
async def update_employee(emp_id: str, emp_data: EmployeeUpdate, current_user: dict = Depends(require_manager)):
    current_company_id = await get_current_company_id(current_user)
    employee = await db.employees.find_one({"id": emp_id, "company_id": current_company_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_dict = emp_data.dict(exclude_unset=True, exclude={"temporary_password"})
    company_id = employee.get("company_id") or current_company_id

    if update_dict.get("employee_id") and update_dict["employee_id"] != employee.get("employee_id"):
        duplicate_employee_id = await db.employees.find_one({
            "employee_id": update_dict["employee_id"],
            "id": {"$ne": emp_id},
        })
        if duplicate_employee_id:
            raise HTTPException(status_code=400, detail="Employee ID already exists")

    if update_dict.get("email") and update_dict["email"].lower() != employee.get("email"):
        duplicate_email = await db.employees.find_one({
            "email": update_dict["email"].lower(),
            "id": {"$ne": emp_id},
        })
        if duplicate_email:
            raise HTTPException(status_code=400, detail="Employee email already exists")
        existing_user_with_email = await db.users.find_one({"email": update_dict["email"].lower()})
        if existing_user_with_email and existing_user_with_email["id"] != employee.get("user_id"):
            raise HTTPException(status_code=400, detail="A user account with this email already exists")
        update_dict["email"] = update_dict["email"].lower()

    if "role" in update_dict and update_dict["role"] is not None:
        update_dict["role"] = normalize_employee_role(update_dict["role"])

    if "department_id" in update_dict or "department_name" in update_dict:
        resolved_department = await resolve_employee_department(
            company_id=company_id,
            department_id=update_dict.get("department_id") or employee.get("department_id"),
            department_name=update_dict.get("department_name"),
        )
        update_dict["department_id"] = resolved_department["id"]
        update_dict.pop("department_name", None)

    if "regular_start_time" in update_dict:
        update_dict["regular_start_time"] = normalize_time_string(update_dict["regular_start_time"])
    if "regular_end_time" in update_dict:
        update_dict["regular_end_time"] = normalize_time_string(update_dict["regular_end_time"])

    if "leave_balance" in update_dict and update_dict["leave_balance"] is not None:
        update_dict["leave_balance"] = {
            leave_type_id: max(0.0, float(balance_value))
            for leave_type_id, balance_value in update_dict["leave_balance"].items()
        }

    if "emergency_contact" in update_dict and update_dict["emergency_contact"]:
        update_dict["emergency_contact"] = update_dict["emergency_contact"]
    if "bank_info" in update_dict and update_dict["bank_info"]:
        update_dict["bank_info"] = update_dict["bank_info"]

    merged = {**employee, **update_dict}
    user_id = await ensure_employee_user_account(
        employee_id=merged["id"],
        email=merged["email"],
        first_name=merged["first_name"],
        last_name=merged["last_name"],
        role=merged.get("role", "employee"),
        temporary_password=emp_data.temporary_password,
        company_id=company_id,
        existing_user_id=employee.get("user_id"),
    )

    update_dict["user_id"] = user_id
    update_dict["updated_at"] = datetime.utcnow()

    await db.employees.update_one({"id": emp_id, "company_id": current_company_id}, {"$set": update_dict})
    await log_activity(
        current_user["id"],
        "employee_updated",
        f"Employee updated: {merged.get('first_name', employee.get('first_name', ''))} {merged.get('last_name', employee.get('last_name', ''))}"
    )

    return await get_employee(emp_id, current_user)

@api_router.put("/employees/{emp_id}/leave-balance", response_model=EmployeeResponse)
async def update_employee_leave_balance(
    emp_id: str,
    payload: EmployeeLeaveBalanceUpdate,
    current_user: dict = Depends(require_admin)
):
    company_id = await get_current_company_id(current_user)
    employee = await db.employees.find_one({"id": emp_id, "company_id": company_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    leave_types = await ensure_core_leave_types()
    allowed_leave_type_ids = {lt["id"] for lt in leave_types}
    updated_balance = dict(employee.get("leave_balance", {}))

    for leave_type_id, balance_value in payload.leave_balance.items():
        if leave_type_id not in allowed_leave_type_ids:
            raise HTTPException(status_code=400, detail="Invalid leave type in balance update")
        updated_balance[leave_type_id] = max(0.0, float(balance_value))

    await db.employees.update_one(
        {"id": emp_id, "company_id": company_id},
        {
            "$set": {
                "leave_balance": updated_balance,
                "updated_at": datetime.utcnow(),
            }
        }
    )
    await log_activity(current_user["id"], "employee_leave_balance_updated", f"Leave balance updated for employee: {emp_id}")
    return await get_employee(emp_id, current_user)

@api_router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, current_user: dict = Depends(require_admin)):
    company_id = await get_current_company_id(current_user)
    emp = await db.employees.find_one({"id": emp_id, "company_id": company_id})
    await db.employees.update_one(
        {"id": emp_id, "company_id": company_id},
        {"$set": {"status": "terminated", "updated_at": datetime.utcnow()}}
    )
    await log_activity(current_user["id"], "employee_terminated", f"Employee terminated: {emp_id}")
    return {"message": "Employee terminated"}

# ===== Leave Type Routes =====
@api_router.post("/leave-types", response_model=LeaveTypeResponse)
async def create_leave_type(lt: LeaveTypeCreate, current_user: dict = Depends(require_admin)):
    lt_id = str(uuid.uuid4())
    leave_type = {
        "id": lt_id,
        "name": lt.name,
        "description": lt.description,
        "days_per_year": lt.days_per_year,
        "is_paid": lt.is_paid,
        "requires_approval": lt.requires_approval,
        "color": lt.color,
        "created_at": datetime.utcnow()
    }
    await db.leave_types.insert_one(leave_type)
    return LeaveTypeResponse(**leave_type)

@api_router.get("/leave-types", response_model=List[LeaveTypeResponse])
async def get_leave_types(current_user: dict = Depends(get_current_user)):
    leave_types = await ensure_core_leave_types()
    return [LeaveTypeResponse(**lt) for lt in leave_types]

@api_router.put("/leave-types/{lt_id}", response_model=LeaveTypeResponse)
async def update_leave_type(lt_id: str, lt_data: LeaveTypeCreate, current_user: dict = Depends(require_admin)):
    await db.leave_types.update_one({"id": lt_id}, {"$set": lt_data.dict()})
    lt = await db.leave_types.find_one({"id": lt_id})
    return LeaveTypeResponse(**lt)

@api_router.delete("/leave-types/{lt_id}")
async def delete_leave_type(lt_id: str, current_user: dict = Depends(require_admin)):
    await db.leave_types.delete_one({"id": lt_id})
    return {"message": "Leave type deleted"}

# ===== Leave Request Routes =====
def calculate_days(start_date: str, end_date: str, half_day: bool = False) -> float:
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    business_days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:
            business_days += 1
        current += timedelta(days=1)
    return 0.5 if half_day else float(business_days)

@api_router.post("/leave-requests", response_model=LeaveRequestResponse)
async def create_leave_request(lr: LeaveRequestCreate, current_user: dict = Depends(get_current_user)):
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    if not employee:
        raise HTTPException(status_code=400, detail="No employee profile found")
    
    leave_type = await db.leave_types.find_one({"id": lr.leave_type_id})
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")
    
    days_count = calculate_days(lr.start_date, lr.end_date, lr.half_day)
    current_balance = employee.get("leave_balance", {}).get(lr.leave_type_id, 0)
    if current_balance < days_count:
        raise HTTPException(status_code=400, detail=f"Insufficient leave balance. Available: {current_balance} days")
    
    lr_id = str(uuid.uuid4())
    leave_request = {
        "id": lr_id,
        "employee_id": employee["id"],
        "company_id": employee.get("company_id"),
        "leave_type_id": lr.leave_type_id,
        "start_date": lr.start_date,
        "end_date": lr.end_date,
        "days_count": days_count,
        "reason": lr.reason,
        "status": "pending",
        "half_day": lr.half_day,
        "approved_by": None,
        "approved_at": None,
        "manager_comment": None,
        "created_at": datetime.utcnow()
    }
    await db.leave_requests.insert_one(leave_request)
    await log_activity(current_user["id"], "leave_requested", f"Leave request created: {days_count} days of {leave_type['name']}")
    
    return LeaveRequestResponse(
        id=lr_id,
        employee_id=employee["id"],
        employee_name=f"{employee['first_name']} {employee['last_name']}",
        leave_type_id=lr.leave_type_id,
        leave_type_name=leave_type["name"],
        start_date=lr.start_date,
        end_date=lr.end_date,
        days_count=days_count,
        reason=lr.reason,
        status="pending",
        half_day=lr.half_day,
        created_at=leave_request["created_at"]
    )

@api_router.get("/leave-requests", response_model=List[LeaveRequestResponse])
async def get_leave_requests(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company_id = await get_current_company_id(current_user)
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    
    if current_user["role"] == "employee":
        employee = await db.employees.find_one({"user_id": current_user["id"]})
        if not employee:
            employee = await db.employees.find_one({"email": current_user["email"]})
        if employee:
            query["employee_id"] = employee["id"]
        else:
            return []
    elif current_user["role"] == "manager":
        manager_employee = await db.employees.find_one({"user_id": current_user["id"]})
        if not manager_employee:
            manager_employee = await db.employees.find_one({"email": current_user["email"]})
        if not manager_employee:
            return []

        team_query: Dict[str, Any] = {"status": "active", "company_id": company_id}
        if manager_employee.get("department_id"):
            team_query["department_id"] = manager_employee["department_id"]

        team_employees = await db.employees.find(team_query).to_list(500)
        team_employee_ids = {employee["id"] for employee in team_employees}
        if not team_employee_ids:
            return []

        if employee_id:
            if employee_id not in team_employee_ids:
                return []
            query["employee_id"] = employee_id
        else:
            query["employee_id"] = {"$in": list(team_employee_ids)}
    elif employee_id:
        query["employee_id"] = employee_id
    
    leave_requests = await db.leave_requests.find(query).sort("created_at", -1).to_list(1000)
    employees = {e["id"]: f"{e['first_name']} {e['last_name']}" for e in await db.employees.find({"company_id": company_id}).to_list(1000)}
    leave_types = {lt["id"]: lt["name"] for lt in await ensure_core_leave_types()}
    mirrored_time_off_ids = {
        lr.get("source_time_off_request_id")
        for lr in leave_requests
        if lr.get("source_time_off_request_id")
    }

    time_off_query = {"company_id": company_id} if company_id else {}
    if status:
        time_off_query["status"] = map_leave_status_to_time_off_status(status)
    if query.get("employee_id"):
        time_off_query["employee_id"] = query["employee_id"]

    time_off_requests = await db.time_off_requests.find(time_off_query).sort("created_at", -1).to_list(1000)
    
    result = []
    for lr in leave_requests:
        result.append(LeaveRequestResponse(
            id=lr["id"],
            employee_id=lr["employee_id"],
            employee_name=employees.get(lr["employee_id"]),
            leave_type_id=lr["leave_type_id"],
            leave_type_name=leave_types.get(lr["leave_type_id"]) or lr.get("leave_type_name") or ("Time Off" if lr["leave_type_id"] == "time_off" else None),
            start_date=lr["start_date"],
            end_date=lr["end_date"],
            days_count=lr["days_count"],
            reason=lr.get("reason"),
            status=lr["status"],
            half_day=lr.get("half_day", False),
            approved_by=lr.get("approved_by"),
            approved_at=lr.get("approved_at"),
            manager_comment=lr.get("manager_comment"),
            created_at=lr["created_at"]
        ))

    for req in time_off_requests:
        if req["id"] in mirrored_time_off_ids:
            continue
        result.append(LeaveRequestResponse(
            id=req["id"],
            employee_id=req["employee_id"],
            employee_name=employees.get(req["employee_id"]),
            leave_type_id=req.get("leave_type_id") or "time_off",
            leave_type_name=req.get("leave_type_name") or leave_types.get(req.get("leave_type_id") or "time_off") or "Time Off",
            start_date=req["start_date"],
            end_date=req["end_date"],
            days_count=float(req.get("days_count", 1)),
            reason=req.get("note"),
            status=map_time_off_status_to_leave_status(req["status"]),
            half_day=False,
            approved_by=req.get("approved_by"),
            approved_at=req.get("approved_at"),
            manager_comment=req.get("review_note"),
            created_at=req["created_at"]
        ))
    result.sort(key=lambda x: x.created_at, reverse=True)
    return result

@api_router.get("/leave-requests/my", response_model=List[LeaveRequestResponse])
async def get_my_leave_requests(current_user: dict = Depends(get_current_user)):
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    if not employee:
        return []
    return await get_leave_requests(employee_id=employee["id"], current_user=current_user)
@api_router.get("/leave-balance/me")
async def get_my_leave_balance(current_user: dict = Depends(get_current_user)):
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})

    if not employee:
        return {
            "leave_balance_hours": 0,
            "balance_hours": 0,
            "available_hours": 0,
            "details": {}
        }

    leave_types = await ensure_core_leave_types()
    leave_balance_summary = summarize_leave_balance(employee, leave_types)

    details = {}

    for lt in leave_types:
        days = float(leave_balance_summary["leave_balance"].get(lt["id"], 0))
        details[lt["name"]] = {
            "days": days,
            "hours": round(days * 8, 2),
            "leave_type_id": lt["id"],
        }

    return {
        "leave_balance_hours": leave_balance_summary["leave_balance_hours"],
        "balance_hours": leave_balance_summary["leave_balance_hours"],
        "available_hours": leave_balance_summary["leave_balance_hours"],
        "details": details,
    }
@api_router.put("/leave-requests/{lr_id}", response_model=LeaveRequestResponse)
async def update_leave_request(lr_id: str, update: LeaveRequestUpdate, current_user: dict = Depends(require_manager)):
    lr = await db.leave_requests.find_one({"id": lr_id})
    time_off_request = None
    previous_status = None

    if not lr:
        time_off_request = await db.time_off_requests.find_one({"id": lr_id})
        if not time_off_request:
            raise HTTPException(status_code=404, detail="Leave request not found")
        previous_status = map_time_off_status_to_leave_status(time_off_request.get("status", "pending"))
        lr = {
            "id": lr_id,
            "employee_id": time_off_request["employee_id"],
            "leave_type_id": time_off_request.get("leave_type_id") or "time_off",
            "days_count": float(time_off_request.get("days_count", 1)),
        }
    else:
        previous_status = lr.get("status", "pending")
    
    update_dict = {
        "status": update.status,
        "manager_comment": update.manager_comment,
        "approved_by": current_user["id"],
        "approved_at": datetime.utcnow()
    }
    
    if time_off_request:
        await db.time_off_requests.update_one(
            {"id": lr_id},
            {"$set": {
                "status": map_leave_status_to_time_off_status(update.status),
                "review_note": update.manager_comment,
                "approved_by": current_user["id"],
                "approved_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }}
        )
    else:
        await db.leave_requests.update_one({"id": lr_id}, {"$set": update_dict})

        source_time_off_request_id = lr.get("source_time_off_request_id")
        if source_time_off_request_id:
            await db.time_off_requests.update_one(
                {"id": source_time_off_request_id},
                {"$set": {
                    "status": map_leave_status_to_time_off_status(update.status),
                    "review_note": update.manager_comment,
                    "approved_by": current_user["id"],
                    "approved_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }}
            )
    
    await apply_leave_balance_transition(
        employee_id=lr.get("employee_id"),
        leave_type_id=lr.get("leave_type_id"),
        days_count=lr.get("days_count"),
        previous_status=previous_status,
        new_status=update.status,
    )

    leave_type_name = None
    if lr.get("leave_type_id"):
        leave_type = await db.leave_types.find_one({"id": lr["leave_type_id"]})
        if leave_type:
            leave_type_name = leave_type.get("name")

    await notify_employee_by_employee_id(
        lr["employee_id"],
        f"Leave request {update.status}",
        f"Your {(leave_type_name or lr.get('leave_type_name') or 'leave')} request from {lr.get('start_date')} to {lr.get('end_date')} was {update.status}.",
        notification_type="leave_reviewed",
        data={"request_id": lr_id, "status": update.status},
    )
    
    await log_activity(current_user["id"], f"leave_{update.status}", f"Leave request {update.status}")
    
    leave_requests = await get_leave_requests(current_user=current_user)
    for req in leave_requests:
        if req.id == lr_id:
            return req
    raise HTTPException(status_code=404, detail="Leave request not found after update")

# ===== Attendance Routes with GPS =====
@api_router.post("/attendance/clock-in", response_model=AttendanceResponse)
async def clock_in(data: AttendanceClockIn, current_user: dict = Depends(get_current_user)):
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    if not employee:
        raise HTTPException(status_code=400, detail="No employee profile found")
    
    # Verify GPS location if provided
    if data.latitude is not None and data.longitude is not None:
        is_valid, message = await verify_location(data.latitude, data.longitude, employee)
        if not is_valid:
            await log_activity(current_user["id"], "clock_in_failed", f"Location verification failed: {message}", {
                "latitude": data.latitude,
                "longitude": data.longitude
            })
            raise HTTPException(status_code=400, detail=f"Clock-in blocked: {message}")
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    existing = await db.attendance.find_one({"employee_id": employee["id"], "date": today})
    if existing and existing.get("clock_in"):
        raise HTTPException(status_code=400, detail="Already clocked in today")
    
    # Use local time from device if provided, otherwise use server time
    if data.local_time:
        try:
            now = datetime.fromisoformat(data.local_time.replace('Z', '+00:00'))
        except:
            now = datetime.utcnow()
    else:
        now = datetime.utcnow()

    schedule = await get_schedule_for_employee_date(employee, today)
    scheduled_start_time = normalize_time_string((schedule or {}).get("start_time"))
    scheduled_end_time = normalize_time_string((schedule or {}).get("end_time"))
    lateness = calculate_lateness(today, scheduled_start_time, now)
    att_id = existing["id"] if existing else str(uuid.uuid4())
    status = "late" if lateness["late_status"] else "present"
    
    attendance = {
        "id": att_id,
        "employee_id": employee["id"],
        "company_id": employee.get("company_id"),
        "date": today,
        "clock_in": now,
        "clock_out": None,
        "clock_in_location": {"latitude": data.latitude, "longitude": data.longitude} if data.latitude else None,
        "clock_out_location": None,
        "clock_in_local": data.local_time,
        "clock_out_local": None,
        "scheduled_start_time": scheduled_start_time,
        "scheduled_end_time": scheduled_end_time,
        "actual_clock_in": data.local_time or now.isoformat(),
        "actual_clock_out": None,
        "late_status": lateness["late_status"],
        "minutes_late": lateness["minutes_late"],
        "missed_clock_in_alert_sent": bool(existing.get("missed_clock_in_alert_sent")) if existing else False,
        "timezone": data.timezone,
        "total_hours": None,
        "status": status,
        "notes": data.notes,
        "created_at": existing.get("created_at", now) if existing else now,
        "updated_at": now,
    }
    if existing:
        await db.attendance.update_one({"id": existing["id"]}, {"$set": attendance})
    else:
        await db.attendance.insert_one(attendance)
    await log_activity(current_user["id"], "clock_in", f"Clocked in at {now.strftime('%H:%M')} ({data.timezone or 'UTC'})")
    return serialize_attendance_response(attendance, f"{employee['first_name']} {employee['last_name']}")

@api_router.post("/attendance/clock-out", response_model=AttendanceResponse)
async def clock_out(data: AttendanceClockOut, current_user: dict = Depends(get_current_user)):
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    if not employee:
        raise HTTPException(status_code=400, detail="No employee profile found")
    
    # Verify GPS location if provided
    if data.latitude is not None and data.longitude is not None:
        is_valid, message = await verify_location(data.latitude, data.longitude, employee)
        if not is_valid:
            await log_activity(current_user["id"], "clock_out_failed", f"Location verification failed: {message}", {
                "latitude": data.latitude,
                "longitude": data.longitude
            })
            raise HTTPException(status_code=400, detail=f"Clock-out blocked: {message}")
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    attendance = await db.attendance.find_one({"employee_id": employee["id"], "date": today, "company_id": employee.get("company_id")})
    if not attendance:
        raise HTTPException(status_code=400, detail="No clock-in record found for today")
    if attendance.get("clock_out"):
        raise HTTPException(status_code=400, detail="Already clocked out today")
    
    # Use local time from device if provided, otherwise use server time
    if data.local_time:
        try:
            now = datetime.fromisoformat(data.local_time.replace('Z', '+00:00'))
        except:
            now = datetime.utcnow()
    else:
        now = datetime.utcnow()
    
    clock_in = attendance["clock_in"]
    total_hours = round((now - clock_in).total_seconds() / 3600, 2)
    
    await db.attendance.update_one(
        {"id": attendance["id"]},
        {"$set": {
            "clock_out": now,
            "clock_out_location": {"latitude": data.latitude, "longitude": data.longitude} if data.latitude else None,
            "clock_out_local": data.local_time,
            "actual_clock_out": data.local_time or now.isoformat(),
            "total_hours": total_hours,
            "notes": data.notes or attendance.get("notes"),
            "updated_at": now,
        }}
    )
    await log_activity(current_user["id"], "clock_out", f"Clocked out at {now.strftime('%H:%M')} ({data.timezone or 'UTC'}), worked {total_hours}h")
    updated = await db.attendance.find_one({"id": attendance["id"]})
    return serialize_attendance_response(updated, f"{employee['first_name']} {employee['last_name']}")

@api_router.get("/attendance/today", response_model=Optional[AttendanceResponse])
async def get_today_attendance(current_user: dict = Depends(get_current_user)):
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    if not employee:
        return None
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    attendance = await db.attendance.find_one({"employee_id": employee["id"], "date": today, "company_id": employee.get("company_id")})
    
    if not attendance:
        return None
    
    return serialize_attendance_response(attendance, f"{employee['first_name']} {employee['last_name']}")

@api_router.get("/attendance", response_model=List[AttendanceResponse])
async def get_attendance(
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company_id = await get_current_company_id(current_user)
    query = {"company_id": company_id} if company_id else {}
    
    if current_user["role"] == "employee":
        employee = await db.employees.find_one({"user_id": current_user["id"]})
        if employee:
            query["employee_id"] = employee["id"]
    elif current_user["role"] == "manager":
        manager_employee = await db.employees.find_one({"user_id": current_user["id"]})
        if not manager_employee:
            manager_employee = await db.employees.find_one({"email": current_user["email"]})
        if not manager_employee:
            return []

        team_query: Dict[str, Any] = {"status": "active"}
        if manager_employee.get("department_id"):
            team_query["department_id"] = manager_employee["department_id"]

        team_employees = await db.employees.find(team_query).to_list(500)
        team_employee_ids = {employee["id"] for employee in team_employees}
        if not team_employee_ids:
            return []

        if employee_id:
            if employee_id not in team_employee_ids:
                return []
            query["employee_id"] = employee_id
        else:
            query["employee_id"] = {"$in": list(team_employee_ids)}
    elif employee_id:
        query["employee_id"] = employee_id
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    records = await db.attendance.find(query).sort("date", -1).to_list(1000)
    employees = {e["id"]: f"{e['first_name']} {e['last_name']}" for e in await db.employees.find({"company_id": company_id}).to_list(1000)}
    active_shift_query = {"status": {"$in": ["working", "on_break"]}, "company_id": company_id}
    if query.get("employee_id"):
        active_shift_query["employee_id"] = query["employee_id"]
    if start_date and end_date and start_date == end_date:
        active_shift_query["date"] = start_date
    active_shifts = await db.shifts.find(active_shift_query).to_list(1000)
    active_shift_map = {
        (shift["employee_id"], shift["date"]): shift
        for shift in active_shifts
    }
    
    return [
        serialize_attendance_response(
            {
                **r,
                "total_hours": (
                    r.get("total_hours")
                    if r.get("total_hours") not in [None, 0] or r.get("clock_out")
                    else round(
                        max(
                            0,
                            (
                                datetime.utcnow()
                                - (
                                    active_shift_map.get((r["employee_id"], r["date"]), {}).get("clock_in", {}).get("timestamp")
                                    if active_shift_map.get((r["employee_id"], r["date"]))
                                    else r.get("clock_in")
                                )
                            ).total_seconds()
                            - active_shift_map.get((r["employee_id"], r["date"]), {}).get("total_break_seconds", 0)
                        ) / 3600,
                        2,
                    )
                    if (
                        not r.get("clock_out")
                        and (
                            active_shift_map.get((r["employee_id"], r["date"]), {}).get("clock_in", {}).get("timestamp")
                            or r.get("clock_in")
                        )
                    )
                    else r.get("total_hours")
                ),
            },
            employees.get(r["employee_id"]),
        )
        for r in records
    ]

@api_router.post("/attendance/manual", response_model=AttendanceResponse)
async def create_manual_attendance(data: AttendanceManualCreate, current_user: dict = Depends(require_manager)):
    employee = await db.employees.find_one({"id": data.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    att_id = str(uuid.uuid4())
    clock_in = datetime.strptime(f"{data.date} {data.clock_in}", "%Y-%m-%d %H:%M")
    clock_out = None
    total_hours = None
    if data.clock_out:
        clock_out = datetime.strptime(f"{data.date} {data.clock_out}", "%Y-%m-%d %H:%M")
        total_hours = round((clock_out - clock_in).total_seconds() / 3600, 2)
    schedule = await get_schedule_for_employee_date(employee, data.date)
    scheduled_start_time = normalize_time_string((schedule or {}).get("start_time"))
    scheduled_end_time = normalize_time_string((schedule or {}).get("end_time"))
    lateness = calculate_lateness(data.date, scheduled_start_time, clock_in)
    
    attendance = {
        "id": att_id,
        "employee_id": data.employee_id,
        "company_id": employee.get("company_id"),
        "date": data.date,
        "clock_in": clock_in,
        "clock_out": clock_out,
        "scheduled_start_time": scheduled_start_time,
        "scheduled_end_time": scheduled_end_time,
        "actual_clock_in": clock_in.isoformat(),
        "actual_clock_out": clock_out.isoformat() if clock_out else None,
        "late_status": lateness["late_status"],
        "minutes_late": lateness["minutes_late"],
        "missed_clock_in_alert_sent": False,
        "total_hours": total_hours,
        "status": "late" if lateness["late_status"] else data.status,
        "notes": data.notes,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.attendance.insert_one(attendance)
    await log_activity(current_user["id"], "manual_attendance", f"Manual attendance created for {employee['first_name']} {employee['last_name']}")
    return serialize_attendance_response(attendance, f"{employee['first_name']} {employee['last_name']}")


@api_router.post("/clockin", response_model=AttendanceResponse)
async def clock_in_alias(data: AttendanceClockIn, current_user: dict = Depends(get_current_user)):
    return await clock_in(data, current_user)


@api_router.post("/clockout", response_model=AttendanceResponse)
async def clock_out_alias(data: AttendanceClockOut, current_user: dict = Depends(get_current_user)):
    return await clock_out(data, current_user)


@api_router.get("/attendance/late-report")
async def get_late_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_manager),
):
    query: Dict[str, Any] = {"late_status": True}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})
        query["date"]["$lte"] = end_date

    if current_user["role"] == "manager":
        manager_employee = await db.employees.find_one({"user_id": current_user["id"]}) or await db.employees.find_one({"email": current_user["email"]})
        if not manager_employee:
            return []
        team_employees = await db.employees.find({"department_id": manager_employee.get("department_id"), "status": "active"}).to_list(500)
        query["employee_id"] = {"$in": [employee["id"] for employee in team_employees]}

    records = await db.attendance.find(query).sort("date", -1).to_list(500)
    employees = {employee["id"]: employee for employee in await db.employees.find().to_list(1000)}
    return [
        {
            "attendance_id": record["id"],
            "employee_id": record["employee_id"],
            "employee_name": f"{employees.get(record['employee_id'], {}).get('first_name', '')} {employees.get(record['employee_id'], {}).get('last_name', '')}".strip(),
            "date": record["date"],
            "scheduled_start_time": record.get("scheduled_start_time"),
            "actual_clock_in": record.get("actual_clock_in"),
            "minutes_late": int(record.get("minutes_late", 0) or 0),
            "department_id": employees.get(record["employee_id"], {}).get("department_id"),
        }
        for record in records
    ]

# ===== Payroll Routes =====
@api_router.post("/payroll", response_model=PayrollResponse)
async def create_payroll(pr: PayrollCreate, current_user: dict = Depends(require_admin)):
    company_id = await get_current_company_id(current_user)
    employee = await db.employees.find_one({"id": pr.employee_id, "company_id": company_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    dept = await db.departments.find_one({"id": employee["department_id"]})
    
    overtime_pay = pr.overtime_hours * (pr.basic_salary / 160) * pr.overtime_rate
    gross_pay = pr.basic_salary + overtime_pay + pr.bonus
    net_pay = gross_pay - pr.deductions - pr.tax - pr.insurance_deduction - pr.pension_deduction - pr.benefits_deduction
    
    pr_id = str(uuid.uuid4())
    payroll = {
        "id": pr_id,
        "employee_id": pr.employee_id,
        "company_id": company_id,
        "pay_period_start": pr.pay_period_start,
        "pay_period_end": pr.pay_period_end,
        "basic_salary": pr.basic_salary,
        "overtime_hours": pr.overtime_hours,
        "overtime_rate": pr.overtime_rate,
        "overtime_pay": overtime_pay,
        "bonus": pr.bonus,
        "gross_pay": gross_pay,
        "deductions": pr.deductions,
        "tax": pr.tax,
        "insurance_deduction": pr.insurance_deduction,
        "pension_deduction": pr.pension_deduction,
        "benefits_deduction": pr.benefits_deduction,
        "net_pay": net_pay,
        "status": "pending",
        "notes": pr.notes,
        "created_at": datetime.utcnow()
    }
    await db.payroll.insert_one(payroll)
    await log_activity(current_user["id"], "payroll_created", f"Payroll created for {employee['first_name']} {employee['last_name']}")
    
    return PayrollResponse(
        id=pr_id,
        employee_id=pr.employee_id,
        employee_name=f"{employee['first_name']} {employee['last_name']}",
        employee_code=employee["employee_id"],
        department_name=dept["name"] if dept else None,
        job_title=employee["job_title"],
        pay_period_start=pr.pay_period_start,
        pay_period_end=pr.pay_period_end,
        basic_salary=pr.basic_salary,
        overtime_hours=pr.overtime_hours,
        overtime_rate=pr.overtime_rate,
        overtime_pay=overtime_pay,
        bonus=pr.bonus,
        gross_pay=gross_pay,
        deductions=pr.deductions,
        tax=pr.tax,
        insurance_deduction=pr.insurance_deduction,
        pension_deduction=pr.pension_deduction,
        benefits_deduction=pr.benefits_deduction,
        net_pay=net_pay,
        status="pending",
        notes=pr.notes,
        created_at=payroll["created_at"]
    )


@api_router.post("/payroll/review", response_model=PayrollReviewResponse)
async def review_payroll_run(payload: PayrollReviewRequest, current_user: dict = Depends(require_admin)):
    company_id = await get_current_company_id(current_user)
    if not company_id:
        raise HTTPException(status_code=400, detail="Company workspace not found")

    review = await build_payroll_review(company_id, payload.pay_period_start, payload.pay_period_end)
    await log_activity(
        current_user["id"],
        "payroll_reviewed",
        f"Reviewed payroll run for {payload.pay_period_start} to {payload.pay_period_end}",
        metadata={
            "pay_period_start": payload.pay_period_start,
            "pay_period_end": payload.pay_period_end,
            "employee_count": review.employee_count,
            "total_budget": review.total_budget,
        },
    )
    return review


@api_router.post("/payroll/review/pdf")
async def payroll_review_pdf(payload: PayrollReviewRequest, current_user: dict = Depends(require_admin)):
    company_id = await get_current_company_id(current_user)
    if not company_id:
        raise HTTPException(status_code=400, detail="Company workspace not found")

    review = await build_payroll_review(company_id, payload.pay_period_start, payload.pay_period_end)
    pdf_bytes = make_payroll_review_pdf(review)
    filename = f"payroll_review_{payload.pay_period_start}_{payload.pay_period_end}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/payroll/run")
async def run_payroll(payload: PayrollReviewRequest, current_user: dict = Depends(require_admin)):
    company_id = await get_current_company_id(current_user)
    if not company_id:
        raise HTTPException(status_code=400, detail="Company workspace not found")

    review = await build_payroll_review(company_id, payload.pay_period_start, payload.pay_period_end)
    if not review.rows:
        raise HTTPException(status_code=400, detail="No payable attendance found for the selected payroll period")

    payroll_ids: List[str] = []
    paystub_ids: List[str] = []

    for row in review.rows:
        payroll_record = await upsert_payroll_record_from_review(
            row,
            payload.pay_period_start,
            payload.pay_period_end,
            company_id,
        )
        payroll_ids.append(payroll_record["id"])

        if payload.send_paystubs:
            saved_paystub = await upsert_paystub(
                PaystubCreate(
                    employee_id=row.employee_id,
                    payroll_id=payroll_record["id"],
                    pay_period_start=payload.pay_period_start,
                    pay_period_end=payload.pay_period_end,
                    gross_pay=row.gross_pay,
                    deductions=row.deductions,
                    tax=row.tax,
                    insurance_deduction=row.insurance_deduction,
                    pension_deduction=row.pension_deduction,
                    benefits_deduction=row.benefits_deduction,
                    bonus=row.bonus,
                    net_pay=row.net_pay,
                    pay_date=payload.pay_period_end,
                    published=True,
                ),
                current_user,
            )
            paystub_ids.append(saved_paystub["id"])

    await log_activity(
        current_user["id"],
        "payroll_run_completed" if payload.send_paystubs else "payroll_run_saved",
        f"Processed payroll run for {payload.pay_period_start} to {payload.pay_period_end}",
        metadata={
            "pay_period_start": payload.pay_period_start,
            "pay_period_end": payload.pay_period_end,
            "payroll_ids": payroll_ids,
            "paystub_ids": paystub_ids,
            "total_budget": review.total_budget,
            "employee_count": review.employee_count,
        },
    )

    return {
        "message": "Payroll processed and paystubs sent" if payload.send_paystubs else "Payroll processed successfully",
        "payroll_ids": payroll_ids,
        "paystub_ids": paystub_ids,
        "employee_count": review.employee_count,
        "total_budget": review.total_budget,
        "pay_period_start": payload.pay_period_start,
        "pay_period_end": payload.pay_period_end,
    }

@api_router.get("/payroll", response_model=List[PayrollResponse])
async def get_payroll(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company_id = await get_current_company_id(current_user)
    query = {"company_id": company_id} if company_id else {}
    
    if current_user["role"] == "employee":
        employee = await db.employees.find_one({"user_id": current_user["id"]})
        if employee:
            query["employee_id"] = employee["id"]
    elif employee_id:
        query["employee_id"] = employee_id
    
    if status:
        query["status"] = status
    
    payrolls = await db.payroll.find(query).sort("created_at", -1).to_list(1000)
    employees = {e["id"]: e for e in await db.employees.find({"company_id": company_id}).to_list(1000)}
    departments = {d["id"]: d["name"] for d in await db.departments.find({"company_id": company_id}).to_list(100)}
    
    result = []
    for pr in payrolls:
        emp = employees.get(pr["employee_id"], {})
        result.append(PayrollResponse(
            id=pr["id"],
            employee_id=pr["employee_id"],
            employee_name=f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip() or None,
            employee_code=emp.get("employee_id"),
            department_name=departments.get(emp.get("department_id")),
            job_title=emp.get("job_title"),
            pay_period_start=pr["pay_period_start"],
            pay_period_end=pr["pay_period_end"],
            basic_salary=pr["basic_salary"],
            overtime_hours=pr["overtime_hours"],
            overtime_rate=pr["overtime_rate"],
            overtime_pay=pr["overtime_pay"],
            bonus=pr["bonus"],
            gross_pay=pr["gross_pay"],
            deductions=pr["deductions"],
            tax=pr["tax"],
            insurance_deduction=pr.get("insurance_deduction", 0),
            pension_deduction=pr.get("pension_deduction", 0),
            benefits_deduction=pr["benefits_deduction"],
            net_pay=pr["net_pay"],
            status=pr["status"],
            notes=pr.get("notes"),
            created_at=pr["created_at"]
        ))
    return result

@api_router.get("/payroll/{pr_id}", response_model=PayrollResponse)
async def get_payroll_by_id(pr_id: str, current_user: dict = Depends(get_current_user)):
    pr = await db.payroll.find_one({"id": pr_id})
    if not pr:
        raise HTTPException(status_code=404, detail="Payroll not found")
    
    emp = await db.employees.find_one({"id": pr["employee_id"]})
    dept = await db.departments.find_one({"id": emp["department_id"]}) if emp else None
    
    return PayrollResponse(
        id=pr["id"],
        employee_id=pr["employee_id"],
        employee_name=f"{emp['first_name']} {emp['last_name']}" if emp else None,
        employee_code=emp["employee_id"] if emp else None,
        department_name=dept["name"] if dept else None,
        job_title=emp["job_title"] if emp else None,
        pay_period_start=pr["pay_period_start"],
        pay_period_end=pr["pay_period_end"],
        basic_salary=pr["basic_salary"],
        overtime_hours=pr["overtime_hours"],
        overtime_rate=pr["overtime_rate"],
        overtime_pay=pr["overtime_pay"],
        bonus=pr["bonus"],
        gross_pay=pr["gross_pay"],
        deductions=pr["deductions"],
        tax=pr["tax"],
        insurance_deduction=pr.get("insurance_deduction", 0),
        pension_deduction=pr.get("pension_deduction", 0),
        benefits_deduction=pr["benefits_deduction"],
        net_pay=pr["net_pay"],
        status=pr["status"],
        notes=pr.get("notes"),
        created_at=pr["created_at"]
    )

@api_router.put("/payroll/{pr_id}/status")
async def update_payroll_status(pr_id: str, status: str, current_user: dict = Depends(require_admin)):
    if status not in ["pending", "approved", "paid"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    await db.payroll.update_one({"id": pr_id}, {"$set": {"status": status}})
    await log_activity(current_user["id"], "payroll_status_updated", f"Payroll status updated to {status}")
    return {"message": f"Payroll status updated to {status}"}

# ===== Training Routes =====
@api_router.post("/training", response_model=TrainingVideoResponse)
async def create_training_video(video: TrainingVideoCreate, current_user: dict = Depends(require_admin)):
    video_id = str(uuid.uuid4())
    training_video = {
        "id": video_id,
        "title": video.title,
        "description": video.description,
        "video_url": video.video_url,
        "thumbnail_url": video.thumbnail_url,
        "role": video.role,
        "category": video.category,
        "duration": video.duration,
        "order": video.order,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db.training_videos.insert_one(training_video)
    return TrainingVideoResponse(**training_video)

@api_router.get("/training", response_model=List[TrainingVideoResponse])
async def get_training_videos(
    role: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Filter by role - show videos for user's role and "all"
    user_role = current_user["role"]
    if role:
        query["role"] = role
    else:
        query["$or"] = [{"role": "all"}, {"role": user_role}]
    
    if category:
        query["category"] = category
    
    videos = await db.training_videos.find(query).sort("order", 1).to_list(100)
    return [TrainingVideoResponse(**v) for v in videos]

@api_router.get("/training/categories")
async def get_training_categories(current_user: dict = Depends(get_current_user)):
    videos = await db.training_videos.find().to_list(100)
    categories = list(set(v["category"] for v in videos))
    return {"categories": categories}

@api_router.delete("/training/{video_id}")
async def delete_training_video(video_id: str, current_user: dict = Depends(require_admin)):
    await db.training_videos.delete_one({"id": video_id})
    return {"message": "Training video deleted"}

# ===== Announcements Routes =====
@api_router.post("/announcements", response_model=AnnouncementResponse)
async def create_announcement(ann: AnnouncementCreate, current_user: dict = Depends(require_admin)):
    ann_id = str(uuid.uuid4())
    announcement = {
        "id": ann_id,
        "title": ann.title,
        "content": ann.content,
        "type": ann.type,
        "department_id": ann.department_id,
        "priority": ann.priority,
        "author_id": current_user["id"],
        "expires_at": datetime.strptime(ann.expires_at, "%Y-%m-%d") if ann.expires_at else None,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    await db.announcements.insert_one(announcement)
    
    return AnnouncementResponse(
        id=ann_id,
        title=ann.title,
        content=ann.content,
        type=ann.type,
        department_id=ann.department_id,
        priority=ann.priority,
        author_id=current_user["id"],
        author_name=f"{current_user['first_name']} {current_user['last_name']}",
        expires_at=announcement["expires_at"],
        is_active=True,
        created_at=announcement["created_at"]
    )

@api_router.get("/announcements", response_model=List[AnnouncementResponse])
async def get_announcements(current_user: dict = Depends(get_current_user)):
    query = {"is_active": True}
    announcements = await db.announcements.find(query).sort("created_at", -1).to_list(100)
    users = {u["id"]: f"{u['first_name']} {u['last_name']}" for u in await db.users.find().to_list(1000)}
    
    result = []
    now = datetime.utcnow()
    for ann in announcements:
        if ann.get("expires_at") and ann["expires_at"] < now:
            continue
        result.append(AnnouncementResponse(
            id=ann["id"],
            title=ann["title"],
            content=ann["content"],
            type=ann["type"],
            department_id=ann.get("department_id"),
            priority=ann["priority"],
            author_id=ann["author_id"],
            author_name=users.get(ann["author_id"]),
            expires_at=ann.get("expires_at"),
            is_active=ann["is_active"],
            created_at=ann["created_at"]
        ))
    return result

@api_router.delete("/announcements/{ann_id}")
async def delete_announcement(ann_id: str, current_user: dict = Depends(require_admin)):
    await db.announcements.update_one({"id": ann_id}, {"$set": {"is_active": False}})
    return {"message": "Announcement deleted"}

# ===== Export Routes =====
@api_router.get("/export/employees")
async def export_employees(
    format: str = Query(default="csv", enum=["csv", "json"]),
    current_user: dict = Depends(require_admin)
):
    employees = await db.employees.find().to_list(1000)
    departments = {d["id"]: d["name"] for d in await db.departments.find().to_list(100)}
    
    if format == "json":
        return employees
    
    # CSV export
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee ID", "First Name", "Last Name", "Email", "Phone", "Job Title", "Department", "Status", "Start Date", "Employment Type"])
    
    for emp in employees:
        writer.writerow([
            emp["employee_id"],
            emp["first_name"],
            emp["last_name"],
            emp["email"],
            emp.get("phone", ""),
            emp["job_title"],
            departments.get(emp["department_id"], ""),
            emp["status"],
            emp["start_date"],
            emp["employment_type"]
        ])
    
    output.seek(0)
    await log_activity(current_user["id"], "export_employees", "Exported employees data")
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=employees_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@api_router.get("/export/attendance")
async def export_attendance(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = Query(default="csv", enum=["csv", "json"]),
    current_user: dict = Depends(require_manager)
):
    query = {}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    records = await db.attendance.find(query).sort("date", -1).to_list(10000)
    employees = {e["id"]: f"{e['first_name']} {e['last_name']}" for e in await db.employees.find().to_list(1000)}
    
    if format == "json":
        return records
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Employee", "Clock In", "Clock Out", "Total Hours", "Status", "Notes"])
    
    for r in records:
        writer.writerow([
            r["date"],
            employees.get(r["employee_id"], "Unknown"),
            r.get("clock_in").strftime("%H:%M") if r.get("clock_in") else "",
            r.get("clock_out").strftime("%H:%M") if r.get("clock_out") else "",
            r.get("total_hours", ""),
            r["status"],
            r.get("notes", "")
        ])
    
    output.seek(0)
    await log_activity(current_user["id"], "export_attendance", "Exported attendance data")
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@api_router.get("/export/leave")
async def export_leave(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = Query(default="csv", enum=["csv", "json"]),
    current_user: dict = Depends(require_manager)
):
    query = {}
    if start_date:
        query["start_date"] = {"$gte": start_date}
    if end_date:
        if "end_date" in query:
            query["end_date"]["$lte"] = end_date
        else:
            query["end_date"] = {"$lte": end_date}
    
    records = await db.leave_requests.find(query).sort("created_at", -1).to_list(10000)
    employees = {e["id"]: f"{e['first_name']} {e['last_name']}" for e in await db.employees.find().to_list(1000)}
    leave_types = {lt["id"]: lt["name"] for lt in await db.leave_types.find().to_list(100)}
    
    if format == "json":
        return records
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee", "Leave Type", "Start Date", "End Date", "Days", "Status", "Reason"])
    
    for r in records:
        writer.writerow([
            employees.get(r["employee_id"], "Unknown"),
            leave_types.get(r["leave_type_id"], "Unknown"),
            r["start_date"],
            r["end_date"],
            r["days_count"],
            r["status"],
            r.get("reason", "")
        ])
    
    output.seek(0)
    await log_activity(current_user["id"], "export_leave", "Exported leave data")
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=leave_requests_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@api_router.get("/export/payroll")
async def export_payroll(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = Query(default="csv", enum=["csv", "json"]),
    current_user: dict = Depends(require_admin)
):
    query = {}
    if start_date:
        query["pay_period_start"] = {"$gte": start_date}
    if end_date:
        if "pay_period_end" in query:
            query["pay_period_end"]["$lte"] = end_date
        else:
            query["pay_period_end"] = {"$lte": end_date}
    
    records = await db.payroll.find(query).sort("created_at", -1).to_list(10000)
    employees = {e["id"]: e for e in await db.employees.find().to_list(1000)}
    
    if format == "json":
        return records
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee", "Employee ID", "Period Start", "Period End", "Basic Salary", "Overtime Pay", "Bonus", "Gross Pay", "Tax", "Other Deductions", "Insurance", "Pension", "Benefits", "Total Deductions", "Net Pay", "Status"])
    
    for r in records:
        emp = employees.get(r["employee_id"], {})
        writer.writerow([
            f"{emp.get('first_name', '')} {emp.get('last_name', '')}",
            emp.get("employee_id", ""),
            r["pay_period_start"],
            r["pay_period_end"],
            r["basic_salary"],
            r["overtime_pay"],
            r["bonus"],
            r["gross_pay"],
            r["tax"],
            r["deductions"],
            r.get("insurance_deduction", 0),
            r.get("pension_deduction", 0),
            r["benefits_deduction"],
            r["deductions"] + r.get("insurance_deduction", 0) + r.get("pension_deduction", 0) + r["benefits_deduction"],
            r["net_pay"],
            r["status"]
        ])
    
    output.seek(0)
    await log_activity(current_user["id"], "export_payroll", "Exported payroll data")
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=payroll_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@api_router.get("/export/me")
async def export_my_data(current_user: dict = Depends(get_current_user)):
    """Export all personal data for the current user"""
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    
    data = {
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "first_name": current_user["first_name"],
            "last_name": current_user["last_name"],
            "role": current_user["role"],
            "created_at": current_user["created_at"].isoformat()
        },
        "employee": None,
        "attendance": [],
        "leave_requests": [],
        "payroll": []
    }
    
    if employee:
        data["employee"] = {k: v for k, v in employee.items() if k != "_id"}
        if data["employee"].get("created_at"):
            data["employee"]["created_at"] = data["employee"]["created_at"].isoformat()
        
        attendance = await db.attendance.find({"employee_id": employee["id"]}).to_list(1000)
        data["attendance"] = [{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in a.items() if k != "_id"} for a in attendance]
        
        leave_requests = await db.leave_requests.find({"employee_id": employee["id"]}).to_list(100)
        data["leave_requests"] = [{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in lr.items() if k != "_id"} for lr in leave_requests]
        
        payroll = await db.payroll.find({"employee_id": employee["id"]}).to_list(100)
        data["payroll"] = [{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in p.items() if k != "_id"} for p in payroll]
    
    await log_activity(current_user["id"], "export_personal_data", "Exported personal data")
    
    return data


@api_router.get("/admin/backup")
async def export_admin_backup(current_user: dict = Depends(require_admin)):
    collection_names = [
        "users",
        "employees",
        "departments",
        "work_locations",
        "leave_types",
        "leave_requests",
        "time_off_requests",
        "attendance",
        "shifts",
        "payroll",
        "paystubs",
        "announcements",
        "notifications",
        "activity_logs",
    ]

    backup_data = {
        "generated_at": datetime.utcnow().isoformat(),
        "generated_by": {
            "id": current_user["id"],
            "email": current_user["email"],
            "role": current_user["role"],
        },
        "collections": {},
    }

    for collection_name in collection_names:
        records = await db[collection_name].find().to_list(20000)
        backup_data["collections"][collection_name] = [
            serialize_backup_value(record) for record in records
        ]

    await log_activity(current_user["id"], "admin_backup_export", "Exported full app backup data")
    return backup_data

# ===== Dashboard Routes =====
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    now = datetime.utcnow()
    today = now.strftime("%Y-%m-%d")
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    company_id = await get_current_company_id(current_user)

    employee_base_query = {"company_id": company_id} if company_id else {}
    active_employee_query = {**employee_base_query, "status": "active"}
    leave_base_query = {"company_id": company_id} if company_id else {}
    attendance_base_query = {"company_id": company_id} if company_id else {}
    activity_base_query = {"company_id": company_id} if company_id else {}

    total_employees, active_employees, new_hires, employees_on_leave, pending_leave, present_count, late_count, attendance_count, employees, departments, activities = await asyncio.gather(
        db.employees.count_documents(employee_base_query),
        db.employees.count_documents(active_employee_query),
        db.employees.count_documents({
            **active_employee_query,
            "start_date": {"$gte": month_start},
        }),
        db.leave_requests.count_documents({
            **leave_base_query,
            "status": "approved",
            "start_date": {"$lte": today},
            "end_date": {"$gte": today},
        }),
        db.leave_requests.count_documents({**leave_base_query, "status": "pending"}),
        db.attendance.count_documents({**attendance_base_query, "date": today, "status": "present"}),
        db.attendance.count_documents({**attendance_base_query, "date": today, "status": "late"}),
        db.attendance.count_documents({**attendance_base_query, "date": today}),
        db.employees.find(active_employee_query).to_list(1000),
        db.departments.find({"company_id": company_id}).to_list(1000),
        db.activity_logs.find(activity_base_query).sort("created_at", -1).limit(10).to_list(10),
    )

    pending_timesheets = 0
    upcoming_birthdays = []
    upcoming_anniversaries = []
    
    for emp in employees:
        if emp.get("date_of_birth"):
            try:
                dob = datetime.strptime(emp["date_of_birth"], "%Y-%m-%d")
                this_year_bday = dob.replace(year=now.year)
                if this_year_bday < now:
                    this_year_bday = this_year_bday.replace(year=now.year + 1)
                days_until = (this_year_bday - now).days
                if 0 <= days_until <= 30:
                    upcoming_birthdays.append({
                        "employee_id": emp["id"],
                        "name": f"{emp['first_name']} {emp['last_name']}",
                        "date": emp["date_of_birth"],
                        "days_until": days_until
                    })
            except:
                pass
        
        if emp.get("start_date"):
            try:
                start = datetime.strptime(emp["start_date"], "%Y-%m-%d")
                this_year_ann = start.replace(year=now.year)
                if this_year_ann < now:
                    this_year_ann = this_year_ann.replace(year=now.year + 1)
                days_until = (this_year_ann - now).days
                years = now.year - start.year
                if 0 <= days_until <= 30 and years > 0:
                    upcoming_anniversaries.append({
                        "employee_id": emp["id"],
                        "name": f"{emp['first_name']} {emp['last_name']}",
                        "date": emp["start_date"],
                        "years": years,
                        "days_until": days_until
                    })
            except:
                pass
    
    upcoming_birthdays.sort(key=lambda x: x["days_until"])
    upcoming_anniversaries.sort(key=lambda x: x["days_until"])
    
    department_breakdown = []
    for dept in departments:
        count = sum(1 for emp in employees if emp.get("department_id") == dept["id"])
        department_breakdown.append({
            "department_id": dept["id"],
            "name": dept["name"],
            "employee_count": count
        })

    attendance_today = {
        "present": present_count,
        "late": late_count,
        "absent": max(active_employees - attendance_count, 0),
        "on_leave": employees_on_leave
    }

    recent_activities = [
        {
            "id": a["id"],
            "action": a["action"],
            "description": a["description"],
            "created_at": a["created_at"].isoformat()
        }
        for a in activities
    ]
    
    return DashboardStats(
        total_employees=total_employees,
        active_employees=active_employees,
        new_hires_this_month=new_hires,
        employees_on_leave=employees_on_leave,
        pending_leave_requests=pending_leave,
        pending_timesheet_approvals=pending_timesheets,
        upcoming_birthdays=upcoming_birthdays[:5],
        upcoming_anniversaries=upcoming_anniversaries[:5],
        department_breakdown=department_breakdown,
        attendance_today=attendance_today,
        recent_activities=recent_activities
    )

@api_router.get("/manager/dashboard")
async def get_manager_dashboard(
    target_date: Optional[str] = None,
    current_user: dict = Depends(require_manager)
):
    company_id = await get_current_company_id(current_user)
    manager_employee = await db.employees.find_one({"user_id": current_user["id"], "company_id": company_id})
    if not manager_employee:
        manager_employee = await db.employees.find_one({"email": current_user["email"], "company_id": company_id})
    if not manager_employee:
        raise HTTPException(status_code=404, detail="Manager employee profile not found")

    date_value = target_date or datetime.utcnow().strftime("%Y-%m-%d")
    employee_query: Dict[str, Any] = {"status": "active", "company_id": company_id}

    if current_user["role"] == "manager":
        employee_query["department_id"] = manager_employee.get("department_id")

    employees = await db.employees.find(employee_query).to_list(500)
    employee_ids = [employee["id"] for employee in employees]
    if not employee_ids:
        return {
            "date": date_value,
            "summary": {
                "total_employees": 0,
                "working": 0,
                "on_break": 0,
                "clocked_out": 0,
                "late": 0,
                "pending_leave_requests": 0,
            },
            "employees": [],
            "pending_leave_requests": [],
        }

    shifts, attendance_records, pending_leave_requests, departments = await asyncio.gather(
        db.shifts.find({"employee_id": {"$in": employee_ids}, "date": date_value}).to_list(500),
        db.attendance.find({"employee_id": {"$in": employee_ids}, "date": date_value, "company_id": company_id}).to_list(500),
        db.leave_requests.find({
            "employee_id": {"$in": employee_ids},
            "company_id": company_id,
            "status": "pending",
        }).sort("created_at", -1).to_list(100),
        db.departments.find({"company_id": company_id}).to_list(200),
    )

    shift_by_employee = {shift["employee_id"]: shift for shift in shifts}
    attendance_by_employee = {record["employee_id"]: record for record in attendance_records}
    employee_map = {employee["id"]: employee for employee in employees}
    department_map = {department["id"]: department["name"] for department in departments}

    employee_rows = []
    late_count = 0

    for employee in employees:
        shift = shift_by_employee.get(employee["id"], {})
        attendance = attendance_by_employee.get(employee["id"], {})
        shift_status = shift.get("status")

        if shift_status == "on_break":
            workforce_status = "on_break"
        elif shift_status in {"clocked_in", "working"} or (attendance.get("clock_in") and not attendance.get("clock_out")):
            workforce_status = "working"
        else:
            workforce_status = "clocked_out"

        clock_in_value = attendance.get("clock_in_local") or shift.get("clock_in", {}).get("local_time")
        is_late_today = False

        if clock_in_value:
            try:
                parsed_clock_in = datetime.fromisoformat(clock_in_value.replace("Z", "+00:00")) if "T" in str(clock_in_value) else datetime.strptime(clock_in_value, "%Y-%m-%d %H:%M:%S")
                is_late_today = parsed_clock_in.hour >= 9 and (parsed_clock_in.hour > 9 or parsed_clock_in.minute > 0)
            except Exception:
                is_late_today = False

        if is_late_today:
            late_count += 1

        employee_rows.append({
            "id": employee["id"],
            "employee_id": employee.get("employee_id"),
            "name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
            "department_name": None,
            "job_title": employee.get("job_title"),
            "status": workforce_status,
            "is_late_today": is_late_today,
            "today_hours": float(attendance.get("total_hours", 0) or 0),
            "clock_in_local": clock_in_value,
            "clock_in_location": attendance.get("clock_in_location") or shift.get("clock_in", {}).get("location"),
            "clock_out_location": attendance.get("clock_out_location"),
            "break_started_local": shift.get("current_break", {}).get("start_local") if shift.get("current_break") else None,
            "assigned_work_location": employee.get("work_location"),
        })

    for row in employee_rows:
        employee_doc = employee_map.get(row["id"])
        if employee_doc:
            row["department_name"] = department_map.get(employee_doc.get("department_id"))

    leave_type_names = {leave_type["id"]: leave_type["name"] for leave_type in await ensure_core_leave_types()}
    leave_request_rows = [
        {
            "id": leave_request["id"],
            "employee_id": leave_request["employee_id"],
            "employee_name": next((row["name"] for row in employee_rows if row["id"] == leave_request["employee_id"]), "Employee"),
            "leave_type_name": leave_request.get("leave_type_name") or leave_type_names.get(leave_request.get("leave_type_id"), "Leave"),
            "start_date": leave_request["start_date"],
            "end_date": leave_request["end_date"],
            "status": leave_request["status"],
            "reason": leave_request.get("reason"),
            "created_at": leave_request["created_at"].isoformat() if isinstance(leave_request["created_at"], datetime) else leave_request["created_at"],
        }
        for leave_request in pending_leave_requests
    ]

    return {
        "date": date_value,
        "summary": {
            "total_employees": len(employee_rows),
            "working": sum(1 for row in employee_rows if row["status"] == "working"),
            "on_break": sum(1 for row in employee_rows if row["status"] == "on_break"),
            "clocked_out": sum(1 for row in employee_rows if row["status"] == "clocked_out"),
            "late": late_count,
            "pending_leave_requests": len(leave_request_rows),
        },
        "employees": employee_rows,
        "pending_leave_requests": leave_request_rows,
    }

# ===== Activity Log Routes =====
@api_router.get("/activity-logs")
async def get_activity_logs(
    limit: int = Query(default=50, le=200),
    current_user: dict = Depends(require_admin)
):
    logs = await db.activity_logs.find().sort("created_at", -1).limit(limit).to_list(limit)
    return [{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in log.items() if k != "_id"} for log in logs]

# ===== Seed Data Route =====
@api_router.post("/seed-data")
async def seed_demo_data(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can seed data")

    # Prevent duplicate huge seeds
    existing_company_demo = await db.users.find_one({"email": "superadmin@company.com"})
    if existing_company_demo:
        return {
            "message": "Demo data already seeded",
            "accounts": [
                {"email": "superadmin@company.com", "password": "Test123!"},
                {"email": "hr@company.com", "password": "Test123!"},
                {"email": "manager@company.com", "password": "Test123!"},
                {"email": "employee@company.com", "password": "Test123!"},
                {"email": "employee2@test.com", "password": "Test123!"},
            ],
        }

    legacy_demo = await db.users.find_one({"email": "superadmin@test.com"})
    if legacy_demo:
        await clear_demo_data()

    now = datetime.utcnow()
    test_password_hash = get_password_hash("Test123!")

    # ===== Work Locations =====
    work_locations = [
        {
            "id": str(uuid.uuid4()),
            "name": "Main Office - San Francisco",
            "address": "123 Market Street, San Francisco, CA 94102",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "radius": 8047,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Remote Hub - New York",
            "address": "456 Broadway, New York, NY 10012",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "radius": 8047,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db.work_locations.insert_many(work_locations)

    # ===== Departments =====
    departments = [
        {
            "id": str(uuid.uuid4()),
            "name": "Engineering",
            "description": "Software Development Team",
            "budget": 500000,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Human Resources",
            "description": "HR Operations",
            "budget": 150000,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Marketing",
            "description": "Marketing & Communications",
            "budget": 200000,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Sales",
            "description": "Sales Team",
            "budget": 300000,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Finance",
            "description": "Finance & Accounting",
            "budget": 180000,
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db.departments.insert_many(departments)

    engineering = departments[0]
    hr_dept = departments[1]
    marketing = departments[2]
    sales = departments[3]
    finance = departments[4]

    # ===== Leave Types =====
    leave_types = [
        {
            "id": str(uuid.uuid4()),
            "name": "Annual Leave",
            "description": "Paid vacation days",
            "days_per_year": 10,
            "is_paid": True,
            "requires_approval": True,
            "color": "#3B82F6",
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Sick Leave",
            "description": "Medical leave",
            "days_per_year": 10,
            "is_paid": True,
            "requires_approval": True,
            "color": "#EF4444",
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Maternity Leave",
            "description": "Optional maternity leave balance",
            "days_per_year": 0,
            "is_paid": True,
            "requires_approval": True,
            "color": "#EC4899",
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Paternity Leave",
            "description": "Optional paternity leave balance",
            "days_per_year": 0,
            "is_paid": True,
            "requires_approval": True,
            "color": "#14B8A6",
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Unpaid Leave",
            "description": "Leave without pay",
            "days_per_year": 0,
            "is_paid": False,
            "requires_approval": True,
            "color": "#6B7280",
            "created_at": now,
        },
    ]
    await db.leave_types.insert_many(leave_types)
    leave_balance = {lt["id"]: lt["days_per_year"] for lt in leave_types}

    # ===== Training Videos =====
    training_videos = [
        {
            "id": str(uuid.uuid4()),
            "title": "Getting Started with WorkPulse HR",
            "description": "Learn the basics of navigating WorkPulse HR",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "role": "all",
            "category": "Getting Started",
            "duration": "5 min",
            "order": 1,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Managing Employee Profiles",
            "description": "How to create and update employee information",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "role": "hr_admin",
            "category": "HR Management",
            "duration": "8 min",
            "order": 2,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Clocking In & Out",
            "description": "How to use the attendance system",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "role": "employee",
            "category": "Attendance",
            "duration": "3 min",
            "order": 3,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Running Payroll",
            "description": "Complete guide to processing payroll",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "role": "hr_admin",
            "category": "Payroll",
            "duration": "10 min",
            "order": 4,
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db.training_videos.insert_many(training_videos)

    # ===== Test Users + Linked Employees =====
    demo_people = [
        {
            "email": "superadmin@company.com",
            "first_name": "Admin",
            "last_name": "Super",
            "role": "super_admin",
            "department_id": hr_dept["id"],
            "job_title": "Super Admin",
            "salary": 120000,
            "employee_code": "EMP-SA01",
        },
        {
            "email": "hr@company.com",
            "first_name": "Sarah",
            "last_name": "HR",
            "role": "hr_admin",
            "department_id": hr_dept["id"],
            "job_title": "HR Admin",
            "salary": 95000,
            "employee_code": "EMP-HR01",
        },
        {
            "email": "manager@company.com",
            "first_name": "Mike",
            "last_name": "Manager",
            "role": "manager",
            "department_id": engineering["id"],
            "job_title": "Engineering Manager",
            "salary": 105000,
            "employee_code": "EMP-MG01",
        },
        {
            "email": "employee@company.com",
            "first_name": "John",
            "last_name": "Employee",
            "role": "employee",
            "department_id": engineering["id"],
            "job_title": "Frontend Developer",
            "salary": 75000,
            "employee_code": "EMP-EM01",
        },
        {
            "email": "employee2@test.com",
            "first_name": "Mia",
            "last_name": "Tester",
            "role": "employee",
            "department_id": sales["id"],
            "job_title": "Sales Associate",
            "salary": 68000,
            "employee_code": "EMP-EM02",
        },
        {
            "email": "john.smith@company.com",
            "first_name": "John",
            "last_name": "Smith",
            "role": "employee",
            "department_id": engineering["id"],
            "job_title": "Senior Software Engineer",
            "salary": 120000,
            "employee_code": "EMP001",
        },
        {
            "email": "sarah.johnson@company.com",
            "first_name": "Sarah",
            "last_name": "Johnson",
            "role": "employee",
            "department_id": hr_dept["id"],
            "job_title": "HR Manager",
            "salary": 95000,
            "employee_code": "EMP002",
        },
        {
            "email": "michael.brown@company.com",
            "first_name": "Michael",
            "last_name": "Brown",
            "role": "employee",
            "department_id": marketing["id"],
            "job_title": "Marketing Director",
            "salary": 110000,
            "employee_code": "EMP003",
        },
        {
            "email": "emily.davis@company.com",
            "first_name": "Emily",
            "last_name": "Davis",
            "role": "employee",
            "department_id": sales["id"],
            "job_title": "Sales Representative",
            "salary": 65000,
            "employee_code": "EMP004",
        },
        {
            "email": "david.wilson@company.com",
            "first_name": "David",
            "last_name": "Wilson",
            "role": "employee",
            "department_id": finance["id"],
            "job_title": "Financial Analyst",
            "salary": 85000,
            "employee_code": "EMP005",
        },
    ]

    created_users = []
    employees = []

    for idx, person in enumerate(demo_people):
        user_id = str(uuid.uuid4())
        employee_id = str(uuid.uuid4())

        user_doc = {
            "id": user_id,
            "email": person["email"],
            "password_hash": test_password_hash,
            "first_name": person["first_name"],
            "last_name": person["last_name"],
            "role": person["role"],
            "employee_id": employee_id,
            "onboarding_completed": True,
            "created_at": now,
            "updated_at": now,
        }
        await db.users.insert_one(user_doc)

        employee_doc = {
            "id": employee_id,
            "user_id": user_id,
            "employee_id": person["employee_code"],
            "first_name": person["first_name"],
            "last_name": person["last_name"],
            "email": person["email"],
            "role": person["role"],
            "phone": f"+1-555-01{str(idx + 1).zfill(2)}",
            "job_title": person["job_title"],
            "department_id": person["department_id"],
            "manager_id": None,
            "work_location_id": work_locations[0]["id"],
            "work_location": "Office",
            "employment_type": "Full-time",
            "start_date": "2024-01-15",
            "status": "active",
            "date_of_birth": "1990-01-15",
            "address": f"{100 + idx} Main Street",
            "city": "San Francisco",
            "state": "CA",
            "zip_code": "94102",
            "country": "USA",
            "emergency_contact": {
                "name": "Emergency Contact",
                "relationship": "Spouse",
                "phone": "+1-555-9999",
            },
            "bank_info": {
                "bank_name": "Chase Bank",
                "account_number": "****1234",
                "routing_number": "****5678",
            },
            "tax_id": "***-**-1234",
            "salary": person["salary"],
            "hourly_rate": None,
            "skills": ["Communication", "Teamwork"],
            "notes": None,
            "leave_balance": leave_balance.copy(),
            "created_at": now,
            "updated_at": now,
        }
        await db.employees.insert_one(employee_doc)
        employees.append(employee_doc)

        created_users.append({
            "email": person["email"],
            "role": person["role"],
            "password": "Test123!",
        })

    # ===== Leave Requests =====
    leave_requests = [
        {
            "id": str(uuid.uuid4()),
            "employee_id": employees[3]["id"],
            "leave_type_id": leave_types[0]["id"],
            "start_date": (now + timedelta(days=7)).strftime("%Y-%m-%d"),
            "end_date": (now + timedelta(days=9)).strftime("%Y-%m-%d"),
            "days_count": 3,
            "reason": "Family vacation",
            "status": "pending",
            "half_day": False,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "employee_id": employees[4]["id"],
            "leave_type_id": leave_types[1]["id"],
            "start_date": (now - timedelta(days=6)).strftime("%Y-%m-%d"),
            "end_date": (now - timedelta(days=5)).strftime("%Y-%m-%d"),
            "days_count": 2,
            "reason": "Not feeling well",
            "status": "approved",
            "half_day": False,
            "approved_by": employees[1]["user_id"],
            "approved_at": now,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "employee_id": employees[9]["id"],
            "leave_type_id": leave_types[2]["id"],
            "start_date": (now + timedelta(days=12)).strftime("%Y-%m-%d"),
            "end_date": (now + timedelta(days=12)).strftime("%Y-%m-%d"),
            "days_count": 1,
            "reason": "Personal appointment",
            "status": "rejected",
            "half_day": False,
            "approved_by": employees[2]["user_id"],
            "approved_at": now,
            "manager_comment": "Busy sales day",
            "created_at": now,
        },
    ]
    await db.leave_requests.insert_many(leave_requests)

    # ===== Time Off Requests =====
    time_off_requests = [
        {
            "id": str(uuid.uuid4()),
            "employee_id": employees[3]["id"],
            "start_date": (now + timedelta(days=15)).strftime("%Y-%m-%d"),
            "end_date": (now + timedelta(days=16)).strftime("%Y-%m-%d"),
            "note": "Weekend trip extension",
            "status": "pending",
            "days_count": 2,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "employee_id": employees[4]["id"],
            "start_date": (now + timedelta(days=20)).strftime("%Y-%m-%d"),
            "end_date": (now + timedelta(days=20)).strftime("%Y-%m-%d"),
            "note": "Family event",
            "status": "approved",
            "days_count": 1,
            "review_note": "Approved",
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db.time_off_requests.insert_many(time_off_requests)

    # ===== Attendance Records =====
    attendance_records = []
    today = datetime.utcnow()

    for i, emp in enumerate(employees[:5]):
        clock_in = today.replace(hour=8, minute=30 + i * 5, second=0, microsecond=0)
        clock_out = today.replace(hour=17, minute=30, second=0, microsecond=0)
        attendance_records.append({
            "id": str(uuid.uuid4()),
            "employee_id": emp["id"],
            "date": today.strftime("%Y-%m-%d"),
            "clock_in": clock_in,
            "clock_out": clock_out,
            "clock_in_location": {"latitude": 37.7749, "longitude": -122.4194},
            "clock_out_location": {"latitude": 37.7749, "longitude": -122.4194},
            "clock_in_local": clock_in.isoformat(),
            "clock_out_local": clock_out.isoformat(),
            "timezone": "America/Los_Angeles",
            "total_hours": round((clock_out - clock_in).total_seconds() / 3600, 2),
            "status": "present" if i < 3 else "late",
            "notes": None,
            "created_at": now,
        })

    await db.attendance.insert_many(attendance_records)

    # ===== Shifts =====
    shifts = []

    # completed shifts
    for i, emp in enumerate(employees[:3]):
        shift_start = today.replace(hour=8, minute=15 + i * 5, second=0, microsecond=0)
        shift_end = today.replace(hour=17, minute=0, second=0, microsecond=0)

        shifts.append({
            "id": str(uuid.uuid4()),
            "employee_id": emp["id"],
            "date": today.strftime("%Y-%m-%d"),
            "status": "completed",
            "clock_in": {
                "timestamp": shift_start,
                "local_time": shift_start.isoformat(),
                "timezone": "America/Los_Angeles",
                "location": {"latitude": 37.7749, "longitude": -122.4194},
            },
            "clock_out": {
                "timestamp": shift_end,
                "local_time": shift_end.isoformat(),
                "timezone": "America/Los_Angeles",
                "location": {"latitude": 37.7749, "longitude": -122.4194},
            },
            "breaks": [],
            "current_break": None,
            "total_break_seconds": 0,
            "total_work_hours": round((shift_end - shift_start).total_seconds() / 3600, 2),
            "created_at": now,
            "updated_at": now,
        })

    # one active working shift
    active_shift_start = today.replace(hour=9, minute=0, second=0, microsecond=0)
    shifts.append({
        "id": str(uuid.uuid4()),
        "employee_id": employees[5]["id"],
        "date": today.strftime("%Y-%m-%d"),
        "status": "working",
        "clock_in": {
            "timestamp": active_shift_start,
            "local_time": active_shift_start.isoformat(),
            "timezone": "America/Los_Angeles",
            "location": {"latitude": 37.7749, "longitude": -122.4194},
        },
        "breaks": [],
        "current_break": None,
        "total_break_seconds": 0,
        "created_at": now,
        "updated_at": now,
    })

    # one employee on break
    break_shift_start = today.replace(hour=8, minute=0, second=0, microsecond=0)
    break_start = today.replace(hour=12, minute=15, second=0, microsecond=0)
    shifts.append({
        "id": str(uuid.uuid4()),
        "employee_id": employees[6]["id"],
        "date": today.strftime("%Y-%m-%d"),
        "status": "on_break",
        "clock_in": {
            "timestamp": break_shift_start,
            "local_time": break_shift_start.isoformat(),
            "timezone": "America/Los_Angeles",
            "location": {"latitude": 37.7749, "longitude": -122.4194},
        },
        "breaks": [],
        "current_break": {
            "id": str(uuid.uuid4()),
            "start": break_start.isoformat(),
            "start_local": break_start.isoformat(),
            "start_location": {"latitude": 37.7749, "longitude": -122.4194},
        },
        "total_break_seconds": 0,
        "created_at": now,
        "updated_at": now,
    })

    await db.shifts.insert_many(shifts)

    # ===== Payroll + Paystubs =====
    payroll_records = []
    paystub_records = []

    for emp in employees[:5]:
        basic = round(emp["salary"] / 12, 2)
        overtime_pay = 0
        bonus = 500
        tax = round(basic * 0.22, 2)
        benefits = round(basic * 0.05, 2)
        gross_pay = round(basic + overtime_pay + bonus, 2)
        net_pay = round(gross_pay - 100 - tax - benefits, 2)

        payroll_id = str(uuid.uuid4())

        payroll_records.append({
            "id": payroll_id,
            "employee_id": emp["id"],
            "pay_period_start": "2025-06-01",
            "pay_period_end": "2025-06-30",
            "basic_salary": basic,
            "overtime_hours": 0,
            "overtime_rate": 1.5,
            "overtime_pay": overtime_pay,
            "bonus": bonus,
            "gross_pay": gross_pay,
            "deductions": 100,
            "tax": tax,
            "benefits_deduction": benefits,
            "net_pay": net_pay,
            "status": "paid",
            "notes": "June 2025 Payroll",
            "created_at": now,
        })

        pdf_bytes = make_demo_paystub_pdf(
            employee_name=f"{emp['first_name']} {emp['last_name']}",
            employee_code=emp["employee_id"],
            pay_period_start="2025-06-01",
            pay_period_end="2025-06-30",
            pay_date="2025-07-01",
            gross_pay=gross_pay,
            net_pay=net_pay,
        )

        paystub_records.append({
            "id": str(uuid.uuid4()),
            "employee_id": emp["id"],
            "payroll_id": payroll_id,
            "pay_period_start": "2025-06-01",
            "pay_period_end": "2025-06-30",
            "pay_date": "2025-07-01",
            "gross_pay": gross_pay,
            "net_pay": net_pay,
            "pdf_filename": f"{emp['employee_id']}_2025-07-01.pdf",
            "pdf_content": pdf_bytes,
            "created_at": now,
        })

    await db.payroll.insert_many(payroll_records)
    await db.paystubs.insert_many(paystub_records)

    # ===== Announcements =====
    announcements = [
        {
            "id": str(uuid.uuid4()),
            "title": "Welcome to Emplora!",
            "content": "We are excited to launch our new HR management system. Please explore all the features and let us know if you have any feedback.",
            "type": "general",
            "priority": "high",
            "author_id": current_user["id"],
            "is_active": True,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Q3 Company Meeting",
            "content": "Please join us for our quarterly company meeting on July 25th at 2 PM in the main conference room.",
            "type": "general",
            "priority": "normal",
            "author_id": current_user["id"],
            "is_active": True,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "New Health Benefits Package",
            "content": "Starting August 1st, we will be offering enhanced health benefits. Check your email for more details.",
            "type": "hr_notice",
            "priority": "high",
            "author_id": current_user["id"],
            "is_active": True,
            "created_at": now,
        },
    ]
    await db.announcements.insert_many(announcements)

    # ===== Notifications =====
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": "info",
        "title": "Demo data ready",
        "message": "Seeded demo users, employees, leave requests, attendance, payroll, and paystubs.",
        "target_role": "hr_admin",
        "read": False,
        "created_at": now,
    })

    return {
        "message": "Demo data seeded successfully",
        "employees_created": len(employees),
        "test_accounts": created_users,
    }


@api_router.post("/seed-test-users")
async def seed_test_users():
    """Seed test users for all roles - can be called without auth"""
    existing = await db.users.find_one({"email": "superadmin@company.com"})
    if existing:
        return {
            "message": "Test users already seeded",
            "users": [
                {"email": "employee@company.com", "password": "Test123!"},
                {"email": "hr@company.com", "password": "Test123!"},
                {"email": "manager@company.com", "password": "Test123!"},
                {"email": "superadmin@company.com", "password": "Test123!"},
            ],
        }

    legacy_existing = await db.users.find_one({"email": "superadmin@test.com"})
    if legacy_existing:
        await clear_demo_data()

    # create minimal super admin first so you can log in and run /seed-data
    now = datetime.utcnow()
    test_password = get_password_hash("Test123!")

    # Get or create departments
    hr_dept = await db.departments.find_one({"name": "Human Resources"})
    eng_dept = await db.departments.find_one({"name": "Engineering"})

    if not hr_dept:
        hr_dept = {
            "id": str(uuid.uuid4()),
            "name": "Human Resources",
            "description": "HR Operations",
            "budget": 150000,
            "created_at": now,
            "updated_at": now,
        }
        await db.departments.insert_one(hr_dept)

    if not eng_dept:
        eng_dept = {
            "id": str(uuid.uuid4()),
            "name": "Engineering",
            "description": "Software Development Team",
            "budget": 500000,
            "created_at": now,
            "updated_at": now,
        }
        await db.departments.insert_one(eng_dept)

    leave_types = await db.leave_types.find().to_list(100)
    if not leave_types:
        leave_types = [
            {
                "id": str(uuid.uuid4()),
                "name": "Annual Leave",
                "description": "Paid vacation days",
                "days_per_year": 10,
                "is_paid": True,
                "requires_approval": True,
                "color": "#3B82F6",
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Sick Leave",
                "description": "Medical leave",
                "days_per_year": 10,
                "is_paid": True,
                "requires_approval": True,
                "color": "#EF4444",
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Maternity Leave",
                "description": "Optional maternity leave balance",
                "days_per_year": 0,
                "is_paid": True,
                "requires_approval": True,
                "color": "#EC4899",
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Paternity Leave",
                "description": "Optional paternity leave balance",
                "days_per_year": 0,
                "is_paid": True,
                "requires_approval": True,
                "color": "#14B8A6",
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Unpaid Leave",
                "description": "Leave without pay",
                "days_per_year": 0,
                "is_paid": False,
                "requires_approval": True,
                "color": "#6B7280",
                "created_at": now,
            },
        ]
        await db.leave_types.insert_many(leave_types)

    default_leave_balance = {lt["id"]: float(lt.get("days_per_year", 0)) for lt in leave_types}

    # Get or create a work location
    work_loc = await db.work_locations.find_one({})
    if not work_loc:
        work_loc = {
            "id": str(uuid.uuid4()),
            "name": "Main Office",
            "address": "123 Market Street, San Francisco, CA 94102",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "radius": 8047,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        await db.work_locations.insert_one(work_loc)

    test_users = [
        {
            "email": "employee@company.com",
            "first_name": "John",
            "last_name": "Employee",
            "role": "employee",
            "department": eng_dept,
        },
        {
            "email": "hr@company.com",
            "first_name": "Sarah",
            "last_name": "HR",
            "role": "hr_admin",
            "department": hr_dept,
        },
        {
            "email": "manager@company.com",
            "first_name": "Mike",
            "last_name": "Manager",
            "role": "manager",
            "department": eng_dept,
        },
        {
            "email": "superadmin@company.com",
            "first_name": "Admin",
            "last_name": "Super",
            "role": "super_admin",
            "department": hr_dept,
        },
    ]

    created_users = []
    for user_data in test_users:
        existing_user = await db.users.find_one({"email": user_data["email"]})
        if existing_user:
            created_users.append({
                "email": user_data["email"],
                "status": "already exists",
                "password": "Test123!",
            })
            continue

        user_id = str(uuid.uuid4())
        employee_id = str(uuid.uuid4())
        emp_code = f"EMP-{user_data['first_name'][:3].upper()}{str(uuid.uuid4())[:4].upper()}"

        user = {
            "id": user_id,
            "email": user_data["email"],
            "password_hash": test_password,
            "first_name": user_data["first_name"],
            "last_name": user_data["last_name"],
            "role": user_data["role"],
            "employee_id": employee_id,
            "onboarding_completed": True,
            "created_at": now,
            "updated_at": now,
        }
        await db.users.insert_one(user)

        employee = {
            "id": employee_id,
            "user_id": user_id,
            "employee_id": emp_code,
            "first_name": user_data["first_name"],
            "last_name": user_data["last_name"],
            "email": user_data["email"],
            "role": user_data["role"],
            "phone": "555-0100",
            "department_id": user_data["department"]["id"],
            "job_title": f"{user_data['role'].replace('_', ' ').title()}",
            "employment_type": "Full-time",
            "status": "active",
            "start_date": "2024-01-15",
            "work_location_id": work_loc["id"],
            "work_location": "Office",
            "salary": 75000 if user_data["role"] == "employee" else 95000,
            "leave_balance": default_leave_balance.copy(),
            "created_at": now,
            "updated_at": now,
        }
        await db.employees.insert_one(employee)

        created_users.append({
            "email": user_data["email"],
            "status": "created",
            "password": "Test123!",
        })

    return {"message": "Test users seeded", "users": created_users}

# ===== Notifications Routes =====
@api_router.get("/notifications")
async def get_notifications(
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for the current user"""
    company_id = await get_current_company_id(current_user)
    query = {"$and": []}
    
    # HR and admin see all notifications
    if current_user["role"] in ["super_admin", "hr_admin"]:
        query["$and"].append({"$or": [{"target_role": {"$in": ["all", "hr_admin", "super_admin"]}}, {"target_user_id": current_user["id"]}]})
    else:
        query["$and"].append({"$or": [{"target_role": "all"}, {"target_role": current_user["role"]}, {"target_user_id": current_user["id"]}]})

    query["$and"].append({"$or": [{"company_id": company_id}, {"target_user_id": current_user["id"]}]})
    
    notifications = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in n.items() if k != "_id"} for n in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True, "read_at": datetime.utcnow()}}
    )
    return {"message": "Notification marked as read"}

# ===== Auto Clock-Out Route =====
@api_router.post("/attendance/auto-clock-out")
async def auto_clock_out_midnight(background_tasks: BackgroundTasks, current_user: dict = Depends(require_admin)):
    """Manually trigger auto clock-out for all employees who forgot to clock out. Usually run at midnight via cron."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Find all attendance records for today without clock_out
    open_records = await db.attendance.find({
        "date": today,
        "clock_out": None
    }).to_list(1000)
    
    auto_clocked = []
    midnight = datetime.utcnow().replace(hour=23, minute=59, second=59)
    
    for record in open_records:
        # Auto clock out at 11:59 PM
        clock_in_time = datetime.fromisoformat(record["clock_in"]) if isinstance(record["clock_in"], str) else record["clock_in"]
        total_hours = (midnight - clock_in_time).total_seconds() / 3600
        
        await db.attendance.update_one(
            {"id": record["id"]},
            {"$set": {
                "clock_out": midnight.isoformat(),
                "total_hours": round(total_hours, 2),
                "auto_clocked_out": True,
                "notes": "Auto clocked out at midnight - forgot to clock out",
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Get employee info
        employee = await db.employees.find_one({"id": record["employee_id"]})
        if employee:
            auto_clocked.append({
                "employee_id": record["employee_id"],
                "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}",
                "clock_in": record["clock_in"]
            })
            await notify_employee_by_employee_id(
                record["employee_id"],
                "Clocked out automatically",
                "You were still clocked in after hours, so the system clocked you out automatically. HR can review it if needed.",
                notification_type="auto_clock_out",
                data={"attendance_id": record["id"], "employee_id": record["employee_id"]},
            )
    
    # Create notification for HR if there were auto clock-outs
    if auto_clocked:
        notification = {
            "id": str(uuid.uuid4()),
            "type": "auto_clock_out",
            "title": f"Auto Clock-Out: {len(auto_clocked)} employee(s)",
            "message": f"{len(auto_clocked)} employee(s) were auto clocked out at midnight. Please review and adjust if needed.",
            "target_role": "hr_admin",
            "data": {"employees": auto_clocked},
            "read": False,
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
        
        await log_activity(current_user["id"], "auto_clock_out", f"Auto clocked out {len(auto_clocked)} employees at midnight")
    
    return {"message": f"Auto clocked out {len(auto_clocked)} employees", "employees": auto_clocked}

@api_router.put("/attendance/{attendance_id}/adjust")
async def adjust_attendance(
    attendance_id: str,
    clock_in: Optional[str] = None,
    clock_out: Optional[str] = None,
    notes: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Allow HR to adjust attendance records (for missed clock-outs, corrections, etc.)"""
    record = await db.attendance.find_one({"id": attendance_id})
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    update_data = {"updated_at": datetime.utcnow(), "adjusted_by": current_user["id"]}
    
    if clock_in:
        update_data["clock_in"] = clock_in
    if clock_out:
        update_data["clock_out"] = clock_out
    if notes:
        update_data["notes"] = notes
    
    # Recalculate total hours if both clock_in and clock_out are available
    final_clock_in = clock_in or record.get("clock_in")
    final_clock_out = clock_out or record.get("clock_out")
    
    if final_clock_in and final_clock_out:
        try:
            ci = datetime.fromisoformat(final_clock_in) if isinstance(final_clock_in, str) else final_clock_in
            co = datetime.fromisoformat(final_clock_out) if isinstance(final_clock_out, str) else final_clock_out
            update_data["total_hours"] = round((co - ci).total_seconds() / 3600, 2)
        except:
            pass
    
    await db.attendance.update_one({"id": attendance_id}, {"$set": update_data})
    await log_activity(current_user["id"], "adjust_attendance", f"Adjusted attendance record {attendance_id}")
    
    return {"message": "Attendance record adjusted successfully"}

# ===== Role-based Dashboard Stats =====
@api_router.get("/dashboard/my-stats")
async def get_my_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get personal dashboard stats for employees"""
    now = datetime.utcnow()
    today = now.strftime("%Y-%m-%d")
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    
    # Find employee profile
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        return {
            "total_hours_this_month": 0,
            "attendance_this_month": [],
            "today_attendance": None,
            "leave_balance": {},
            "recent_attendance": []
        }
    
    # Get attendance for this month
    attendance_records = await db.attendance.find({
        "employee_id": employee["id"],
        "date": {"$gte": month_start}
    }).sort("date", -1).to_list(100)
    
    total_hours = sum(r.get("total_hours", 0) for r in attendance_records)
    
    # Get today's attendance
    today_attendance = await db.attendance.find_one({
        "employee_id": employee["id"],
        "date": today
    })
    
    # Get recent attendance (last 7 days)
    recent = await db.attendance.find({
        "employee_id": employee["id"]
    }).sort("date", -1).limit(7).to_list(7)
    
    return {
        "total_hours_this_month": round(total_hours, 2),
        "days_worked_this_month": len(attendance_records),
        "today_attendance": {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in today_attendance.items() if k != "_id"} if today_attendance else None,
        "recent_attendance": [{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in r.items() if k != "_id"} for r in recent],
        "employee_info": {
            "id": employee["id"],
            "name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}",
            "department_id": employee.get("department_id"),
            "job_title": employee.get("job_title")
        }
    }

# ===== Health Check =====
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "app": "Emplora", "timestamp": datetime.utcnow().isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
