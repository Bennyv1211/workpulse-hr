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
from math import radians, cos, sin, asin, sqrt
import asyncio

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

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
    if current_user["role"] not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_manager(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["super_admin", "hr_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    return current_user

# ===== Pydantic Models =====

# User/Auth Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "employee"

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    employee_id: Optional[str] = None
    onboarding_completed: bool = False
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

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
    phone: Optional[str] = None
    job_title: str
    department_id: str
    manager_id: Optional[str] = None
    work_location_id: Optional[str] = None
    work_location: Optional[str] = "Office"
    employment_type: str = "Full-time"
    start_date: str
    date_of_birth: Optional[str] = None
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

class EmployeeResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    employee_id: str
    first_name: str
    last_name: str
    email: str
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

class AttendanceClockOut(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None

class AttendanceResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    date: str
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    clock_in_location: Optional[Dict[str, float]] = None
    clock_out_location: Optional[Dict[str, float]] = None
    total_hours: Optional[float] = None
    status: str = "present"
    notes: Optional[str] = None
    created_at: datetime

class AttendanceManualCreate(BaseModel):
    employee_id: str
    date: str
    clock_in: str
    clock_out: Optional[str] = None
    status: str = "present"
    notes: Optional[str] = None

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
    benefits_deduction: float
    net_pay: float
    status: str = "pending"
    notes: Optional[str] = None
    created_at: datetime

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

# ===== Authentication Routes =====
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"email": user_data.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email.lower(),
        "password_hash": get_password_hash(user_data.password),
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "role": user_data.role,
        "employee_id": None,
        "onboarding_completed": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db.users.insert_one(user)
    
    access_token = create_access_token(data={"sub": user_id, "role": user["role"]})
    await log_activity(user_id, "user_registered", f"New user registered: {user_data.email}")
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            email=user["email"],
            first_name=user["first_name"],
            last_name=user["last_name"],
            role=user["role"],
            employee_id=user["employee_id"],
            onboarding_completed=user["onboarding_completed"],
            created_at=user["created_at"]
        )
    )

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
        onboarding_completed=current_user.get("onboarding_completed", False),
        created_at=current_user["created_at"]
    )

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
    
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": get_password_hash(password_data.new_password), "updated_at": datetime.utcnow()}}
    )
    await log_activity(current_user["id"], "password_changed", "Password changed")
    return {"message": "Password changed successfully"}

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
    dept_id = str(uuid.uuid4())
    manager_name = None
    if dept.manager_id:
        manager = await db.employees.find_one({"id": dept.manager_id})
        if manager:
            manager_name = f"{manager['first_name']} {manager['last_name']}"
    
    department = {
        "id": dept_id,
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
    departments = await db.departments.find().to_list(1000)
    result = []
    for dept in departments:
        employee_count = await db.employees.count_documents({"department_id": dept["id"], "status": "active"})
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
    dept = await db.departments.find_one({"id": dept_id})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    employee_count = await db.employees.count_documents({"department_id": dept_id, "status": "active"})
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
    await db.departments.update_one(
        {"id": dept_id},
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
    await db.departments.delete_one({"id": dept_id})
    await log_activity(current_user["id"], "department_deleted", f"Department deleted: {dept_id}")
    return {"message": "Department deleted"}

# ===== Employee Routes =====
@api_router.post("/employees", response_model=EmployeeResponse)
async def create_employee(emp: EmployeeCreate, current_user: dict = Depends(require_admin)):
    existing = await db.employees.find_one({"employee_id": emp.employee_id})
    if existing:
        raise HTTPException(status_code=400, detail="Employee ID already exists")
    
    emp_id = str(uuid.uuid4())
    dept = await db.departments.find_one({"id": emp.department_id})
    dept_name = dept["name"] if dept else None
    
    manager_name = None
    if emp.manager_id:
        manager = await db.employees.find_one({"id": emp.manager_id})
        if manager:
            manager_name = f"{manager['first_name']} {manager['last_name']}"
    
    leave_types = await db.leave_types.find().to_list(100)
    leave_balance = {lt["id"]: lt["days_per_year"] for lt in leave_types}
    
    employee = {
        "id": emp_id,
        "user_id": emp.user_id,
        "employee_id": emp.employee_id,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "email": emp.email.lower(),
        "phone": emp.phone,
        "job_title": emp.job_title,
        "department_id": emp.department_id,
        "manager_id": emp.manager_id,
        "work_location_id": emp.work_location_id,
        "work_location": emp.work_location,
        "employment_type": emp.employment_type,
        "start_date": emp.start_date,
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
        "leave_balance": leave_balance,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db.employees.insert_one(employee)
    await log_activity(current_user["id"], "employee_created", f"Employee created: {emp.first_name} {emp.last_name}")
    
    return EmployeeResponse(
        id=emp_id,
        user_id=emp.user_id,
        employee_id=emp.employee_id,
        first_name=emp.first_name,
        last_name=emp.last_name,
        email=emp.email,
        phone=emp.phone,
        job_title=emp.job_title,
        department_id=emp.department_id,
        department_name=dept_name,
        manager_id=emp.manager_id,
        manager_name=manager_name,
        work_location_id=emp.work_location_id,
        work_location=emp.work_location,
        employment_type=emp.employment_type,
        start_date=emp.start_date,
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
        leave_balance=leave_balance,
        created_at=employee["created_at"]
    )

@api_router.get("/employees", response_model=List[EmployeeResponse])
async def get_employees(
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
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
    
    employees = await db.employees.find(query).to_list(1000)
    departments = {d["id"]: d["name"] for d in await db.departments.find().to_list(100)}
    emp_names = {e["id"]: f"{e['first_name']} {e['last_name']}" for e in employees}
    
    result = []
    for emp in employees:
        result.append(EmployeeResponse(
            id=emp["id"],
            user_id=emp.get("user_id"),
            employee_id=emp["employee_id"],
            first_name=emp["first_name"],
            last_name=emp["last_name"],
            email=emp["email"],
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
            leave_balance=emp.get("leave_balance"),
            created_at=emp["created_at"]
        ))
    return result

@api_router.get("/employees/{emp_id}", response_model=EmployeeResponse)
async def get_employee(emp_id: str, current_user: dict = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": emp_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    dept = await db.departments.find_one({"id": emp["department_id"]})
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
        leave_balance=emp.get("leave_balance"),
        created_at=emp["created_at"]
    )

@api_router.put("/employees/{emp_id}", response_model=EmployeeResponse)
async def update_employee(emp_id: str, emp_data: EmployeeCreate, current_user: dict = Depends(require_manager)):
    update_dict = emp_data.dict(exclude_unset=True)
    if "emergency_contact" in update_dict and update_dict["emergency_contact"]:
        update_dict["emergency_contact"] = update_dict["emergency_contact"]
    if "bank_info" in update_dict and update_dict["bank_info"]:
        update_dict["bank_info"] = update_dict["bank_info"]
    update_dict["updated_at"] = datetime.utcnow()
    
    await db.employees.update_one({"id": emp_id}, {"$set": update_dict})
    await log_activity(current_user["id"], "employee_updated", f"Employee updated: {emp_data.first_name} {emp_data.last_name}")
    
    return await get_employee(emp_id, current_user)

@api_router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, current_user: dict = Depends(require_admin)):
    emp = await db.employees.find_one({"id": emp_id})
    await db.employees.update_one(
        {"id": emp_id},
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
    leave_types = await db.leave_types.find().to_list(100)
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
    query = {}
    if status:
        query["status"] = status
    
    if current_user["role"] == "employee":
        employee = await db.employees.find_one({"user_id": current_user["id"]})
        if employee:
            query["employee_id"] = employee["id"]
    elif employee_id:
        query["employee_id"] = employee_id
    
    leave_requests = await db.leave_requests.find(query).sort("created_at", -1).to_list(1000)
    employees = {e["id"]: f"{e['first_name']} {e['last_name']}" for e in await db.employees.find().to_list(1000)}
    leave_types = {lt["id"]: lt["name"] for lt in await db.leave_types.find().to_list(100)}
    
    result = []
    for lr in leave_requests:
        result.append(LeaveRequestResponse(
            id=lr["id"],
            employee_id=lr["employee_id"],
            employee_name=employees.get(lr["employee_id"]),
            leave_type_id=lr["leave_type_id"],
            leave_type_name=leave_types.get(lr["leave_type_id"]),
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
    return result

@api_router.get("/leave-requests/my", response_model=List[LeaveRequestResponse])
async def get_my_leave_requests(current_user: dict = Depends(get_current_user)):
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    if not employee:
        return []
    return await get_leave_requests(employee_id=employee["id"], current_user=current_user)

@api_router.put("/leave-requests/{lr_id}", response_model=LeaveRequestResponse)
async def update_leave_request(lr_id: str, update: LeaveRequestUpdate, current_user: dict = Depends(require_manager)):
    lr = await db.leave_requests.find_one({"id": lr_id})
    if not lr:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    update_dict = {
        "status": update.status,
        "manager_comment": update.manager_comment,
        "approved_by": current_user["id"],
        "approved_at": datetime.utcnow()
    }
    
    await db.leave_requests.update_one({"id": lr_id}, {"$set": update_dict})
    
    if update.status == "approved":
        await db.employees.update_one(
            {"id": lr["employee_id"]},
            {"$inc": {f"leave_balance.{lr['leave_type_id']}": -lr["days_count"]}}
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
    
    now = datetime.utcnow()
    att_id = str(uuid.uuid4())
    status = "present"
    if now.hour >= 9 and now.minute > 15:
        status = "late"
    
    attendance = {
        "id": att_id,
        "employee_id": employee["id"],
        "date": today,
        "clock_in": now,
        "clock_out": None,
        "clock_in_location": {"latitude": data.latitude, "longitude": data.longitude} if data.latitude else None,
        "clock_out_location": None,
        "total_hours": None,
        "status": status,
        "notes": data.notes,
        "created_at": now
    }
    await db.attendance.insert_one(attendance)
    await log_activity(current_user["id"], "clock_in", f"Clocked in at {now.strftime('%H:%M')}")
    
    return AttendanceResponse(
        id=att_id,
        employee_id=employee["id"],
        employee_name=f"{employee['first_name']} {employee['last_name']}",
        date=today,
        clock_in=now,
        clock_out=None,
        clock_in_location=attendance["clock_in_location"],
        clock_out_location=None,
        total_hours=None,
        status=status,
        notes=data.notes,
        created_at=now
    )

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
    attendance = await db.attendance.find_one({"employee_id": employee["id"], "date": today})
    if not attendance:
        raise HTTPException(status_code=400, detail="No clock-in record found for today")
    if attendance.get("clock_out"):
        raise HTTPException(status_code=400, detail="Already clocked out today")
    
    now = datetime.utcnow()
    clock_in = attendance["clock_in"]
    total_hours = round((now - clock_in).total_seconds() / 3600, 2)
    
    await db.attendance.update_one(
        {"id": attendance["id"]},
        {"$set": {
            "clock_out": now,
            "clock_out_location": {"latitude": data.latitude, "longitude": data.longitude} if data.latitude else None,
            "total_hours": total_hours,
            "notes": data.notes or attendance.get("notes")
        }}
    )
    await log_activity(current_user["id"], "clock_out", f"Clocked out at {now.strftime('%H:%M')}, worked {total_hours}h")
    
    return AttendanceResponse(
        id=attendance["id"],
        employee_id=employee["id"],
        employee_name=f"{employee['first_name']} {employee['last_name']}",
        date=today,
        clock_in=clock_in,
        clock_out=now,
        clock_in_location=attendance.get("clock_in_location"),
        clock_out_location={"latitude": data.latitude, "longitude": data.longitude} if data.latitude else None,
        total_hours=total_hours,
        status=attendance["status"],
        notes=data.notes or attendance.get("notes"),
        created_at=attendance["created_at"]
    )

@api_router.get("/attendance/today", response_model=Optional[AttendanceResponse])
async def get_today_attendance(current_user: dict = Depends(get_current_user)):
    employee = await db.employees.find_one({"user_id": current_user["id"]})
    if not employee:
        employee = await db.employees.find_one({"email": current_user["email"]})
    if not employee:
        return None
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    attendance = await db.attendance.find_one({"employee_id": employee["id"], "date": today})
    
    if not attendance:
        return None
    
    return AttendanceResponse(
        id=attendance["id"],
        employee_id=employee["id"],
        employee_name=f"{employee['first_name']} {employee['last_name']}",
        date=today,
        clock_in=attendance.get("clock_in"),
        clock_out=attendance.get("clock_out"),
        clock_in_location=attendance.get("clock_in_location"),
        clock_out_location=attendance.get("clock_out_location"),
        total_hours=attendance.get("total_hours"),
        status=attendance["status"],
        notes=attendance.get("notes"),
        created_at=attendance["created_at"]
    )

@api_router.get("/attendance", response_model=List[AttendanceResponse])
async def get_attendance(
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if current_user["role"] == "employee":
        employee = await db.employees.find_one({"user_id": current_user["id"]})
        if employee:
            query["employee_id"] = employee["id"]
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
    employees = {e["id"]: f"{e['first_name']} {e['last_name']}" for e in await db.employees.find().to_list(1000)}
    
    return [
        AttendanceResponse(
            id=r["id"],
            employee_id=r["employee_id"],
            employee_name=employees.get(r["employee_id"]),
            date=r["date"],
            clock_in=r.get("clock_in"),
            clock_out=r.get("clock_out"),
            clock_in_location=r.get("clock_in_location"),
            clock_out_location=r.get("clock_out_location"),
            total_hours=r.get("total_hours"),
            status=r["status"],
            notes=r.get("notes"),
            created_at=r["created_at"]
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
    
    attendance = {
        "id": att_id,
        "employee_id": data.employee_id,
        "date": data.date,
        "clock_in": clock_in,
        "clock_out": clock_out,
        "total_hours": total_hours,
        "status": data.status,
        "notes": data.notes,
        "created_at": datetime.utcnow()
    }
    await db.attendance.insert_one(attendance)
    await log_activity(current_user["id"], "manual_attendance", f"Manual attendance created for {employee['first_name']} {employee['last_name']}")
    
    return AttendanceResponse(
        id=att_id,
        employee_id=data.employee_id,
        employee_name=f"{employee['first_name']} {employee['last_name']}",
        date=data.date,
        clock_in=clock_in,
        clock_out=clock_out,
        total_hours=total_hours,
        status=data.status,
        notes=data.notes,
        created_at=attendance["created_at"]
    )

# ===== Payroll Routes =====
@api_router.post("/payroll", response_model=PayrollResponse)
async def create_payroll(pr: PayrollCreate, current_user: dict = Depends(require_admin)):
    employee = await db.employees.find_one({"id": pr.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    dept = await db.departments.find_one({"id": employee["department_id"]})
    
    overtime_pay = pr.overtime_hours * (pr.basic_salary / 160) * pr.overtime_rate
    gross_pay = pr.basic_salary + overtime_pay + pr.bonus
    net_pay = gross_pay - pr.deductions - pr.tax - pr.benefits_deduction
    
    pr_id = str(uuid.uuid4())
    payroll = {
        "id": pr_id,
        "employee_id": pr.employee_id,
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
        benefits_deduction=pr.benefits_deduction,
        net_pay=net_pay,
        status="pending",
        notes=pr.notes,
        created_at=payroll["created_at"]
    )

@api_router.get("/payroll", response_model=List[PayrollResponse])
async def get_payroll(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if current_user["role"] == "employee":
        employee = await db.employees.find_one({"user_id": current_user["id"]})
        if employee:
            query["employee_id"] = employee["id"]
    elif employee_id:
        query["employee_id"] = employee_id
    
    if status:
        query["status"] = status
    
    payrolls = await db.payroll.find(query).sort("created_at", -1).to_list(1000)
    employees = {e["id"]: e for e in await db.employees.find().to_list(1000)}
    departments = {d["id"]: d["name"] for d in await db.departments.find().to_list(100)}
    
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
    writer.writerow(["Employee", "Employee ID", "Period Start", "Period End", "Basic Salary", "Overtime Pay", "Bonus", "Gross Pay", "Tax", "Deductions", "Net Pay", "Status"])
    
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
            r["deductions"] + r["benefits_deduction"],
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

# ===== Dashboard Routes =====
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    now = datetime.utcnow()
    today = now.strftime("%Y-%m-%d")
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    
    total_employees = await db.employees.count_documents({})
    active_employees = await db.employees.count_documents({"status": "active"})
    
    new_hires = await db.employees.count_documents({
        "start_date": {"$gte": month_start},
        "status": "active"
    })
    
    employees_on_leave = await db.leave_requests.count_documents({
        "status": "approved",
        "start_date": {"$lte": today},
        "end_date": {"$gte": today}
    })
    
    pending_leave = await db.leave_requests.count_documents({"status": "pending"})
    pending_timesheets = 0
    
    employees = await db.employees.find({"status": "active"}).to_list(1000)
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
    
    departments = await db.departments.find().to_list(100)
    department_breakdown = []
    for dept in departments:
        count = await db.employees.count_documents({"department_id": dept["id"], "status": "active"})
        department_breakdown.append({
            "department_id": dept["id"],
            "name": dept["name"],
            "employee_count": count
        })
    
    attendance_today = {
        "present": await db.attendance.count_documents({"date": today, "status": "present"}),
        "late": await db.attendance.count_documents({"date": today, "status": "late"}),
        "absent": active_employees - await db.attendance.count_documents({"date": today}),
        "on_leave": employees_on_leave
    }
    
    activities = await db.activity_logs.find().sort("created_at", -1).limit(10).to_list(10)
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
    
    if await db.departments.count_documents({}) > 0:
        return {"message": "Data already seeded"}
    
    # Create work locations with 5-mile radius (8047 meters)
    work_locations = [
        {"id": str(uuid.uuid4()), "name": "Main Office - San Francisco", "address": "123 Market Street, San Francisco, CA 94102", "latitude": 37.7749, "longitude": -122.4194, "radius": 8047, "is_active": True, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "name": "Remote Hub - New York", "address": "456 Broadway, New York, NY 10012", "latitude": 40.7128, "longitude": -74.0060, "radius": 8047, "is_active": True, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
    ]
    await db.work_locations.insert_many(work_locations)
    
    # Create departments
    departments = [
        {"id": str(uuid.uuid4()), "name": "Engineering", "description": "Software Development Team", "budget": 500000, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "name": "Human Resources", "description": "HR Operations", "budget": 150000, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "name": "Marketing", "description": "Marketing & Communications", "budget": 200000, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "name": "Sales", "description": "Sales Team", "budget": 300000, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "name": "Finance", "description": "Finance & Accounting", "budget": 180000, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
    ]
    await db.departments.insert_many(departments)
    
    # Create leave types
    leave_types = [
        {"id": str(uuid.uuid4()), "name": "Annual Leave", "description": "Paid vacation days", "days_per_year": 20, "is_paid": True, "requires_approval": True, "color": "#3B82F6", "created_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "name": "Sick Leave", "description": "Medical leave", "days_per_year": 10, "is_paid": True, "requires_approval": True, "color": "#EF4444", "created_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "name": "Personal Leave", "description": "Personal time off", "days_per_year": 5, "is_paid": True, "requires_approval": True, "color": "#8B5CF6", "created_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "name": "Unpaid Leave", "description": "Leave without pay", "days_per_year": 30, "is_paid": False, "requires_approval": True, "color": "#6B7280", "created_at": datetime.utcnow()},
    ]
    await db.leave_types.insert_many(leave_types)
    
    leave_balance = {lt["id"]: lt["days_per_year"] for lt in leave_types}
    
    # Create training videos
    training_videos = [
        {"id": str(uuid.uuid4()), "title": "Getting Started with WorkPulse HR", "description": "Learn the basics of navigating WorkPulse HR", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "role": "all", "category": "Getting Started", "duration": "5 min", "order": 1, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "title": "Managing Employee Profiles", "description": "How to create and update employee information", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "role": "hr_admin", "category": "HR Management", "duration": "8 min", "order": 2, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "title": "Approving Leave Requests", "description": "Learn how to review and approve time off requests", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "role": "manager", "category": "Approvals", "duration": "4 min", "order": 3, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "title": "Clocking In & Out", "description": "How to use the attendance system", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "role": "employee", "category": "Attendance", "duration": "3 min", "order": 4, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "title": "Requesting Time Off", "description": "How to submit leave requests", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "role": "employee", "category": "Leave", "duration": "4 min", "order": 5, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "title": "Understanding Your Payslip", "description": "How to read and download your payslips", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "role": "employee", "category": "Payroll", "duration": "5 min", "order": 6, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "title": "Running Payroll", "description": "Complete guide to processing payroll", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "role": "hr_admin", "category": "Payroll", "duration": "10 min", "order": 7, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "title": "Setting Up Work Locations", "description": "Configure GPS-verified attendance locations", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "role": "hr_admin", "category": "Settings", "duration": "6 min", "order": 8, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "title": "Exporting Reports", "description": "How to download and export HR data", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "role": "hr_admin", "category": "Reports", "duration": "5 min", "order": 9, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
    ]
    await db.training_videos.insert_many(training_videos)
    
    # Create demo employees
    employees_data = [
        {"employee_id": "EMP001", "first_name": "John", "last_name": "Smith", "email": "john.smith@company.com", "phone": "+1-555-0101", "job_title": "Senior Software Engineer", "department_id": departments[0]["id"], "employment_type": "Full-time", "start_date": "2022-03-15", "date_of_birth": "1988-07-20", "salary": 120000},
        {"employee_id": "EMP002", "first_name": "Sarah", "last_name": "Johnson", "email": "sarah.johnson@company.com", "phone": "+1-555-0102", "job_title": "HR Manager", "department_id": departments[1]["id"], "employment_type": "Full-time", "start_date": "2021-01-10", "date_of_birth": "1985-03-12", "salary": 95000},
        {"employee_id": "EMP003", "first_name": "Michael", "last_name": "Brown", "email": "michael.brown@company.com", "phone": "+1-555-0103", "job_title": "Marketing Director", "department_id": departments[2]["id"], "employment_type": "Full-time", "start_date": "2020-06-01", "date_of_birth": "1982-11-05", "salary": 110000},
        {"employee_id": "EMP004", "first_name": "Emily", "last_name": "Davis", "email": "emily.davis@company.com", "phone": "+1-555-0104", "job_title": "Sales Representative", "department_id": departments[3]["id"], "employment_type": "Full-time", "start_date": "2023-02-20", "date_of_birth": "1990-08-25", "salary": 65000},
        {"employee_id": "EMP005", "first_name": "David", "last_name": "Wilson", "email": "david.wilson@company.com", "phone": "+1-555-0105", "job_title": "Financial Analyst", "department_id": departments[4]["id"], "employment_type": "Full-time", "start_date": "2022-09-05", "date_of_birth": "1987-01-30", "salary": 85000},
        {"employee_id": "EMP006", "first_name": "Jessica", "last_name": "Taylor", "email": "jessica.taylor@company.com", "phone": "+1-555-0106", "job_title": "Frontend Developer", "department_id": departments[0]["id"], "employment_type": "Full-time", "start_date": "2023-04-10", "date_of_birth": "1992-05-18", "salary": 95000},
        {"employee_id": "EMP007", "first_name": "Robert", "last_name": "Anderson", "email": "robert.anderson@company.com", "phone": "+1-555-0107", "job_title": "Backend Developer", "department_id": departments[0]["id"], "employment_type": "Full-time", "start_date": "2022-11-15", "date_of_birth": "1989-12-03", "salary": 105000},
        {"employee_id": "EMP008", "first_name": "Amanda", "last_name": "Martinez", "email": "amanda.martinez@company.com", "phone": "+1-555-0108", "job_title": "HR Specialist", "department_id": departments[1]["id"], "employment_type": "Full-time", "start_date": "2023-06-01", "date_of_birth": "1991-09-22", "salary": 60000},
        {"employee_id": "EMP009", "first_name": "Christopher", "last_name": "Garcia", "email": "chris.garcia@company.com", "phone": "+1-555-0109", "job_title": "Content Manager", "department_id": departments[2]["id"], "employment_type": "Full-time", "start_date": "2022-07-20", "date_of_birth": "1986-04-15", "salary": 70000},
        {"employee_id": "EMP010", "first_name": "Michelle", "last_name": "Lee", "email": "michelle.lee@company.com", "phone": "+1-555-0110", "job_title": "Account Executive", "department_id": departments[3]["id"], "employment_type": "Full-time", "start_date": "2023-01-15", "date_of_birth": "1993-02-28", "salary": 75000},
    ]
    
    employees = []
    for emp_data in employees_data:
        emp = {
            "id": str(uuid.uuid4()),
            "user_id": None,
            "employee_id": emp_data["employee_id"],
            "first_name": emp_data["first_name"],
            "last_name": emp_data["last_name"],
            "email": emp_data["email"],
            "phone": emp_data["phone"],
            "job_title": emp_data["job_title"],
            "department_id": emp_data["department_id"],
            "manager_id": None,
            "work_location_id": work_locations[0]["id"],
            "work_location": "Office",
            "employment_type": emp_data["employment_type"],
            "start_date": emp_data["start_date"],
            "status": "active",
            "date_of_birth": emp_data["date_of_birth"],
            "address": f"{100 + int(emp_data['employee_id'][-3:])} Main Street",
            "city": "San Francisco",
            "state": "CA",
            "zip_code": "94102",
            "country": "USA",
            "emergency_contact": {"name": "Emergency Contact", "relationship": "Spouse", "phone": "+1-555-9999"},
            "bank_info": {"bank_name": "Chase Bank", "account_number": "****1234", "routing_number": "****5678"},
            "tax_id": "***-**-1234",
            "salary": emp_data["salary"],
            "hourly_rate": None,
            "skills": ["Communication", "Teamwork"],
            "notes": None,
            "leave_balance": leave_balance.copy(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        employees.append(emp)
    
    await db.employees.insert_many(employees)
    
    # Create leave requests
    leave_requests = [
        {"id": str(uuid.uuid4()), "employee_id": employees[0]["id"], "leave_type_id": leave_types[0]["id"], "start_date": "2025-07-15", "end_date": "2025-07-19", "days_count": 5, "reason": "Family vacation", "status": "pending", "half_day": False, "created_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "employee_id": employees[3]["id"], "leave_type_id": leave_types[1]["id"], "start_date": "2025-07-10", "end_date": "2025-07-11", "days_count": 2, "reason": "Not feeling well", "status": "approved", "half_day": False, "approved_by": "system", "approved_at": datetime.utcnow(), "created_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "employee_id": employees[5]["id"], "leave_type_id": leave_types[2]["id"], "start_date": "2025-07-20", "end_date": "2025-07-20", "days_count": 1, "reason": "Personal appointment", "status": "pending", "half_day": False, "created_at": datetime.utcnow()},
    ]
    await db.leave_requests.insert_many(leave_requests)
    
    # Create attendance records
    today = datetime.utcnow()
    attendance_records = []
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
            "total_hours": round((clock_out - clock_in).total_seconds() / 3600, 2),
            "status": "present" if i < 3 else "late",
            "notes": None,
            "created_at": datetime.utcnow()
        })
    await db.attendance.insert_many(attendance_records)
    
    # Create payroll records
    payroll_records = []
    for emp in employees[:5]:
        basic = emp["salary"] / 12
        overtime_pay = 0
        bonus = 500
        tax = basic * 0.22
        benefits = basic * 0.05
        payroll_records.append({
            "id": str(uuid.uuid4()),
            "employee_id": emp["id"],
            "pay_period_start": "2025-06-01",
            "pay_period_end": "2025-06-30",
            "basic_salary": basic,
            "overtime_hours": 0,
            "overtime_rate": 1.5,
            "overtime_pay": overtime_pay,
            "bonus": bonus,
            "gross_pay": basic + overtime_pay + bonus,
            "deductions": 100,
            "tax": tax,
            "benefits_deduction": benefits,
            "net_pay": basic + overtime_pay + bonus - 100 - tax - benefits,
            "status": "paid",
            "notes": "June 2025 Payroll",
            "created_at": datetime.utcnow()
        })
    await db.payroll.insert_many(payroll_records)
    
    # Create announcements
    announcements = [
        {"id": str(uuid.uuid4()), "title": "Welcome to Emplora!", "content": "We are excited to launch our new HR management system. Please explore all the features and let us know if you have any feedback.", "type": "general", "priority": "high", "author_id": current_user["id"], "is_active": True, "created_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "title": "Q3 Company Meeting", "content": "Please join us for our quarterly company meeting on July 25th at 2 PM in the main conference room.", "type": "general", "priority": "normal", "author_id": current_user["id"], "is_active": True, "created_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "title": "New Health Benefits Package", "content": "Starting August 1st, we will be offering enhanced health benefits. Check your email for more details.", "type": "hr_notice", "priority": "high", "author_id": current_user["id"], "is_active": True, "created_at": datetime.utcnow()},
    ]
    await db.announcements.insert_many(announcements)
    
    return {"message": "Demo data seeded successfully", "employees_created": len(employees)}

# ===== Seed Test Users Route =====
@api_router.post("/seed-test-users")
async def seed_test_users():
    """Seed test users for all roles - can be called without auth"""
    test_password = get_password_hash("Test123!")
    now = datetime.utcnow()
    
    # Get or create departments for test users
    hr_dept = await db.departments.find_one({"name": "Human Resources"})
    eng_dept = await db.departments.find_one({"name": "Engineering"})
    
    if not hr_dept:
        hr_dept = {"id": str(uuid.uuid4()), "name": "Human Resources", "created_at": now}
        await db.departments.insert_one(hr_dept)
    if not eng_dept:
        eng_dept = {"id": str(uuid.uuid4()), "name": "Engineering", "created_at": now}
        await db.departments.insert_one(eng_dept)
    
    # Get or create a work location
    work_loc = await db.work_locations.find_one({})
    if not work_loc:
        work_loc = {"id": str(uuid.uuid4()), "name": "Main Office", "latitude": 37.7749, "longitude": -122.4194, "radius": 8047, "is_active": True, "created_at": now}
        await db.work_locations.insert_one(work_loc)
    
    test_users = [
        {
            "email": "employee@test.com",
            "first_name": "John",
            "last_name": "Employee",
            "role": "employee",
            "department": eng_dept
        },
        {
            "email": "hr@test.com",
            "first_name": "Sarah",
            "last_name": "HR",
            "role": "hr_admin",
            "department": hr_dept
        },
        {
            "email": "manager@test.com",
            "first_name": "Mike",
            "last_name": "Manager",
            "role": "manager",
            "department": eng_dept
        },
        {
            "email": "superadmin@test.com",
            "first_name": "Admin",
            "last_name": "Super",
            "role": "super_admin",
            "department": hr_dept
        }
    ]
    
    created_users = []
    for user_data in test_users:
        # Check if user already exists
        existing = await db.users.find_one({"email": user_data["email"]})
        if existing:
            created_users.append({"email": user_data["email"], "status": "already exists"})
            continue
        
        user_id = str(uuid.uuid4())
        employee_id = str(uuid.uuid4())
        emp_code = f"EMP-{user_data['first_name'][:3].upper()}{str(uuid.uuid4())[:4].upper()}"
        
        # Create user
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
            "updated_at": now
        }
        await db.users.insert_one(user)
        
        # Create employee profile
        employee = {
            "id": employee_id,
            "user_id": user_id,
            "employee_id": emp_code,
            "first_name": user_data["first_name"],
            "last_name": user_data["last_name"],
            "email": user_data["email"],
            "phone": "555-0100",
            "department_id": user_data["department"]["id"],
            "job_title": f"{user_data['role'].replace('_', ' ').title()}",
            "employment_type": "full_time",
            "status": "active",
            "start_date": "2024-01-15",
            "work_location_id": work_loc["id"],
            "salary": 75000 if user_data["role"] == "employee" else 95000,
            "created_at": now,
            "updated_at": now
        }
        await db.employees.insert_one(employee)
        
        created_users.append({"email": user_data["email"], "status": "created", "password": "Test123!"})
    
    return {"message": "Test users seeded", "users": created_users}

# ===== Notifications Routes =====
@api_router.get("/notifications")
async def get_notifications(
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for the current user"""
    query = {}
    
    # HR and admin see all notifications
    if current_user["role"] in ["super_admin", "hr_admin"]:
        query = {"$or": [{"target_role": {"$in": ["all", "hr_admin", "super_admin"]}}, {"target_user_id": current_user["id"]}]}
    else:
        query = {"$or": [{"target_role": "all"}, {"target_role": current_user["role"]}, {"target_user_id": current_user["id"]}]}
    
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
