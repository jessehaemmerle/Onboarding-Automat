from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import io
import base64
from jinja2 import Environment, FileSystemLoader

# File upload settings
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'onboarding-automat-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI(title="Onboarding-Automat API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ PYDANTIC MODELS ============

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "owner"  # admin, manager, owner, readonly

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class OwnerRoleBase(BaseModel):
    name: str
    emails: List[str]

class OwnerRoleCreate(OwnerRoleBase):
    pass

class OwnerRoleResponse(OwnerRoleBase):
    id: str

class TemplateTaskBase(BaseModel):
    title: str
    description: str = ""
    category: str  # IT, Admin, Manager, Security
    owner_role: str
    offset_days: int = 0
    evidence_required: bool = False
    sort_order: int = 0

class TemplateBase(BaseModel):
    name: str
    description: str = ""
    template_type: str = "onboarding"  # onboarding or offboarding

class TemplateCreate(TemplateBase):
    tasks: List[TemplateTaskBase] = []

class TemplateTaskResponse(TemplateTaskBase):
    id: str

class TemplateResponse(TemplateBase):
    id: str
    tasks: List[TemplateTaskResponse]
    created_at: str
    updated_at: str

# Evidence Models
class EvidenceResponse(BaseModel):
    id: str
    task_id: str
    filename: str
    file_type: str
    file_size: int
    uploaded_by: str
    uploaded_by_name: str
    uploaded_at: str

class OnboardingCaseCreate(BaseModel):
    employee_name: str
    employee_email: EmailStr
    template_id: str
    start_date: str  # For offboarding this is exit_date
    location: str = ""
    manager_email: EmailStr
    case_type: str = "onboarding"  # onboarding or offboarding
    linked_case_id: Optional[str] = None  # Link offboarding to existing onboarding case

class TaskResponse(BaseModel):
    id: str
    case_id: str
    title: str
    description: str
    category: str
    owner_email: str
    owner_role_snapshot: str
    offset_days: int
    due_date: str
    status: str
    evidence_required: bool = False
    evidence_uploaded: bool = False
    completed_at: Optional[str] = None
    completed_by: Optional[str] = None
    created_at: str

class TaskCommentCreate(BaseModel):
    body: str

class TaskCommentResponse(BaseModel):
    id: str
    task_id: str
    user_id: str
    user_name: str
    user_email: str
    body: str
    created_at: str

class OnboardingCaseResponse(BaseModel):
    id: str
    employee_name: str
    employee_email: str
    template_id: str
    template_name_snapshot: str
    case_type: str = "onboarding"  # onboarding or offboarding
    start_date: str  # For offboarding this is exit_date
    location: str
    manager_email: str
    status: str
    linked_case_id: Optional[str] = None  # Link offboarding to onboarding
    created_by: str
    created_at: str
    tasks: List[TaskResponse] = []

class RescheduleRequest(BaseModel):
    new_start_date: str

class DashboardStats(BaseModel):
    overdue_tasks: int
    due_in_7_days: int
    active_cases: int
    completed_cases: int
    active_offboardings: int = 0
    completed_offboardings: int = 0

class OrgSettingsBase(BaseModel):
    org_name: str = "Meine Firma"
    org_timezone: str = "Europe/Berlin"
    reminder_days_before: int = 3
    reminder_days_after: int = 2

class OrgSettingsResponse(OrgSettingsBase):
    id: str

# ============ AUTH HELPERS ============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Ungültiges Token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Ungültiges Token")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")
    return user

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin-Rechte erforderlich")
    return current_user

# ============ AUTH ROUTES ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    
    user_count = await db.users.count_documents({})
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": "admin" if user_count == 0 else user_data.role,
        "password_hash": get_password_hash(user_data.password),
        "created_at": now
    }
    await db.users.insert_one(user_doc)
    
    token = create_access_token({"sub": user_id})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, email=user_data.email, name=user_data.name, role=user_doc["role"], created_at=now)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    token = create_access_token({"sub": user["id"]})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user["id"], email=user["email"], name=user["name"], role=user["role"], created_at=user["created_at"])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ============ USERS ROUTES ============

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.patch("/users/{user_id}")
async def update_user(user_id: str, role: str, admin: dict = Depends(require_admin)):
    if role not in ["admin", "manager", "owner", "readonly"]:
        raise HTTPException(status_code=400, detail="Ungültige Rolle")
    await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    return {"message": "Benutzer aktualisiert"}

# ============ OWNER ROLES ROUTES ============

@api_router.get("/owner-roles", response_model=List[OwnerRoleResponse])
async def get_owner_roles(current_user: dict = Depends(get_current_user)):
    roles = await db.owner_roles.find({}, {"_id": 0}).to_list(100)
    return [OwnerRoleResponse(**r) for r in roles]

@api_router.post("/owner-roles", response_model=OwnerRoleResponse)
async def create_owner_role(data: OwnerRoleCreate, admin: dict = Depends(require_admin)):
    role_id = str(uuid.uuid4())
    doc = {"id": role_id, "name": data.name, "emails": data.emails}
    await db.owner_roles.insert_one(doc)
    return OwnerRoleResponse(**doc)

@api_router.put("/owner-roles/{role_id}", response_model=OwnerRoleResponse)
async def update_owner_role(role_id: str, data: OwnerRoleCreate, admin: dict = Depends(require_admin)):
    await db.owner_roles.update_one({"id": role_id}, {"$set": {"name": data.name, "emails": data.emails}})
    updated = await db.owner_roles.find_one({"id": role_id}, {"_id": 0})
    return OwnerRoleResponse(**updated)

@api_router.delete("/owner-roles/{role_id}")
async def delete_owner_role(role_id: str, admin: dict = Depends(require_admin)):
    await db.owner_roles.delete_one({"id": role_id})
    return {"message": "Gelöscht"}

# ============ TEMPLATES ROUTES ============

@api_router.get("/templates", response_model=List[TemplateResponse])
async def get_templates(template_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if template_type:
        query["template_type"] = template_type
    templates = await db.templates.find(query, {"_id": 0}).to_list(100)
    # Add template_type for backward compatibility
    for t in templates:
        if "template_type" not in t:
            t["template_type"] = "onboarding"
    return [TemplateResponse(**t) for t in templates]

@api_router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, current_user: dict = Depends(get_current_user)):
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template nicht gefunden")
    if "template_type" not in template:
        template["template_type"] = "onboarding"
    return TemplateResponse(**template)

@api_router.post("/templates", response_model=TemplateResponse)
async def create_template(data: TemplateCreate, admin: dict = Depends(require_admin)):
    template_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    tasks = [{"id": str(uuid.uuid4()), **t.model_dump()} for t in data.tasks]
    doc = {
        "id": template_id, "name": data.name, "description": data.description,
        "template_type": data.template_type,
        "tasks": tasks, "created_at": now, "updated_at": now
    }
    await db.templates.insert_one(doc)
    return TemplateResponse(**doc)

@api_router.put("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: str, data: TemplateCreate, admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    tasks = [{"id": str(uuid.uuid4()), **t.model_dump()} for t in data.tasks]
    await db.templates.update_one(
        {"id": template_id},
        {"$set": {"name": data.name, "description": data.description, "template_type": data.template_type, "tasks": tasks, "updated_at": now}}
    )
    updated = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if "template_type" not in updated:
        updated["template_type"] = "onboarding"
    return TemplateResponse(**updated)

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, admin: dict = Depends(require_admin)):
    await db.templates.delete_one({"id": template_id})
    return {"message": "Gelöscht"}

@api_router.post("/templates/{template_id}/duplicate", response_model=TemplateResponse)
async def duplicate_template(template_id: str, admin: dict = Depends(require_admin)):
    original = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Template nicht gefunden")
    
    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    tasks = [{"id": str(uuid.uuid4()), **{k: v for k, v in t.items() if k != "id"}} for t in original["tasks"]]
    doc = {
        "id": new_id, "name": f"{original['name']} (Kopie)", "description": original["description"],
        "template_type": original.get("template_type", "onboarding"),
        "tasks": tasks, "created_at": now, "updated_at": now
    }
    await db.templates.insert_one(doc)
    return TemplateResponse(**doc)

# ============ ONBOARDING/OFFBOARDING CASES ROUTES ============

async def resolve_owner_email(owner_role: str) -> str:
    role = await db.owner_roles.find_one({"name": owner_role}, {"_id": 0})
    if role and role.get("emails"):
        return role["emails"][0]
    return ""

@api_router.get("/cases", response_model=List[OnboardingCaseResponse])
async def get_cases(status: Optional[str] = None, case_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    if case_type:
        query["case_type"] = case_type
    
    if current_user["role"] == "manager":
        query["manager_email"] = current_user["email"]
    elif current_user["role"] == "owner":
        task_cases = await db.tasks.distinct("case_id", {"owner_email": current_user["email"]})
        query["id"] = {"$in": task_cases}
    
    cases = await db.cases.find(query, {"_id": 0}).to_list(1000)
    result = []
    for c in cases:
        # Backward compatibility
        if "case_type" not in c:
            c["case_type"] = "onboarding"
        if "linked_case_id" not in c:
            c["linked_case_id"] = None
        tasks = await db.tasks.find({"case_id": c["id"]}, {"_id": 0}).to_list(100)
        # Add evidence info to tasks
        for t in tasks:
            if "evidence_required" not in t:
                t["evidence_required"] = False
            evidence_count = await db.evidence.count_documents({"task_id": t["id"]})
            t["evidence_uploaded"] = evidence_count > 0
        c["tasks"] = tasks
        result.append(OnboardingCaseResponse(**c))
    return result

@api_router.get("/cases/{case_id}", response_model=OnboardingCaseResponse)
async def get_case(case_id: str, current_user: dict = Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case nicht gefunden")
    # Backward compatibility
    if "case_type" not in case:
        case["case_type"] = "onboarding"
    if "linked_case_id" not in case:
        case["linked_case_id"] = None
    tasks = await db.tasks.find({"case_id": case_id}, {"_id": 0}).to_list(100)
    # Add evidence info to tasks
    for t in tasks:
        if "evidence_required" not in t:
            t["evidence_required"] = False
        evidence_count = await db.evidence.count_documents({"task_id": t["id"]})
        t["evidence_uploaded"] = evidence_count > 0
    case["tasks"] = tasks
    return OnboardingCaseResponse(**case)

@api_router.post("/cases", response_model=OnboardingCaseResponse)
async def create_case(data: OnboardingCaseCreate, current_user: dict = Depends(get_current_user)):
    template = await db.templates.find_one({"id": data.template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template nicht gefunden")
    
    case_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    start_date = datetime.fromisoformat(data.start_date.replace("Z", "+00:00"))
    
    case_doc = {
        "id": case_id,
        "employee_name": data.employee_name,
        "employee_email": data.employee_email,
        "template_id": data.template_id,
        "template_name_snapshot": template["name"],
        "case_type": data.case_type,
        "start_date": data.start_date,
        "location": data.location,
        "manager_email": data.manager_email,
        "status": "active",
        "linked_case_id": data.linked_case_id,
        "created_by": current_user["id"],
        "created_at": now
    }
    await db.cases.insert_one(case_doc)
    
    tasks = []
    for t in template.get("tasks", []):
        owner_email = await resolve_owner_email(t["owner_role"])
        due_date = start_date + timedelta(days=t["offset_days"])
        task_doc = {
            "id": str(uuid.uuid4()),
            "case_id": case_id,
            "title": t["title"],
            "description": t.get("description", ""),
            "category": t["category"],
            "owner_email": owner_email,
            "owner_role_snapshot": t["owner_role"],
            "offset_days": t["offset_days"],
            "due_date": due_date.isoformat(),
            "status": "open",
            "evidence_required": t.get("evidence_required", False),
            "completed_at": None,
            "completed_by": None,
            "created_at": now
        }
        await db.tasks.insert_one(task_doc)
        task_doc["evidence_uploaded"] = False
        tasks.append(task_doc)
    
    case_doc["tasks"] = tasks
    return OnboardingCaseResponse(**case_doc)

# Get employees for offboarding (from completed onboardings)
@api_router.get("/employees/for-offboarding")
async def get_employees_for_offboarding(current_user: dict = Depends(get_current_user)):
    # Get all onboarding cases that are completed or active (employee exists)
    cases = await db.cases.find(
        {"case_type": {"$in": ["onboarding", None]}},
        {"_id": 0, "id": 1, "employee_name": 1, "employee_email": 1, "location": 1, "manager_email": 1, "status": 1}
    ).to_list(1000)
    
    # Filter out employees that already have an active offboarding
    active_offboardings = await db.cases.distinct("employee_email", {"case_type": "offboarding", "status": "active"})
    
    employees = []
    for c in cases:
        if c["employee_email"] not in active_offboardings:
            employees.append({
                "onboarding_case_id": c["id"],
                "employee_name": c["employee_name"],
                "employee_email": c["employee_email"],
                "location": c.get("location", ""),
                "manager_email": c["manager_email"],
                "status": c["status"]
            })
    
    return employees

@api_router.patch("/cases/{case_id}/reschedule")
async def reschedule_case(case_id: str, data: RescheduleRequest, current_user: dict = Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case nicht gefunden")
    
    new_start = datetime.fromisoformat(data.new_start_date.replace("Z", "+00:00"))
    await db.cases.update_one({"id": case_id}, {"$set": {"start_date": data.new_start_date}})
    
    open_tasks = await db.tasks.find({"case_id": case_id, "status": "open"}, {"_id": 0}).to_list(100)
    for task in open_tasks:
        new_due = new_start + timedelta(days=task["offset_days"])
        await db.tasks.update_one({"id": task["id"]}, {"$set": {"due_date": new_due.isoformat()}})
    
    return {"message": "Startdatum aktualisiert", "tasks_updated": len(open_tasks)}

@api_router.patch("/cases/{case_id}/status")
async def update_case_status(case_id: str, status: str, current_user: dict = Depends(get_current_user)):
    if status not in ["active", "completed"]:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    await db.cases.update_one({"id": case_id}, {"$set": {"status": status}})
    return {"message": "Status aktualisiert"}

# ============ TASKS ROUTES ============

@api_router.get("/tasks/my-tasks", response_model=List[TaskResponse])
async def get_my_tasks(current_user: dict = Depends(get_current_user)):
    tasks = await db.tasks.find({"owner_email": current_user["email"]}, {"_id": 0}).to_list(1000)
    for t in tasks:
        if "evidence_required" not in t:
            t["evidence_required"] = False
        evidence_count = await db.evidence.count_documents({"task_id": t["id"]})
        t["evidence_uploaded"] = evidence_count > 0
    return [TaskResponse(**t) for t in tasks]

@api_router.patch("/tasks/{task_id}/status")
async def update_task_status(task_id: str, status: str, current_user: dict = Depends(get_current_user)):
    if status not in ["open", "done"]:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    
    # Check if evidence is required and uploaded
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if task and task.get("evidence_required") and status == "done":
        evidence_count = await db.evidence.count_documents({"task_id": task_id})
        if evidence_count == 0:
            raise HTTPException(status_code=400, detail="Nachweis erforderlich bevor der Task abgeschlossen werden kann")
    
    update_data = {"status": status}
    if status == "done":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        update_data["completed_by"] = current_user["email"]
    else:
        update_data["completed_at"] = None
        update_data["completed_by"] = None
    
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    return {"message": "Task-Status aktualisiert"}

# ============ EVIDENCE UPLOAD ROUTES ============

@api_router.get("/tasks/{task_id}/evidence", response_model=List[EvidenceResponse])
async def get_task_evidence(task_id: str, current_user: dict = Depends(get_current_user)):
    evidence_list = await db.evidence.find({"task_id": task_id}, {"_id": 0, "file_data": 0}).to_list(50)
    return [EvidenceResponse(**e) for e in evidence_list]

@api_router.post("/tasks/{task_id}/evidence", response_model=EvidenceResponse)
async def upload_evidence(task_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    # Validate task exists
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task nicht gefunden")
    
    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Datei zu groß (max 10MB)")
    
    # Determine file type
    file_type = file.content_type or "application/octet-stream"
    
    evidence_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    evidence_doc = {
        "id": evidence_id,
        "task_id": task_id,
        "filename": file.filename,
        "file_type": file_type,
        "file_size": len(content),
        "file_data": base64.b64encode(content).decode("utf-8"),
        "uploaded_by": current_user["email"],
        "uploaded_by_name": current_user["name"],
        "uploaded_at": now
    }
    await db.evidence.insert_one(evidence_doc)
    
    return EvidenceResponse(
        id=evidence_id,
        task_id=task_id,
        filename=file.filename,
        file_type=file_type,
        file_size=len(content),
        uploaded_by=current_user["email"],
        uploaded_by_name=current_user["name"],
        uploaded_at=now
    )

@api_router.get("/evidence/{evidence_id}/download")
async def download_evidence(evidence_id: str, current_user: dict = Depends(get_current_user)):
    evidence = await db.evidence.find_one({"id": evidence_id}, {"_id": 0})
    if not evidence:
        raise HTTPException(status_code=404, detail="Nachweis nicht gefunden")
    
    file_data = base64.b64decode(evidence["file_data"])
    return StreamingResponse(
        io.BytesIO(file_data),
        media_type=evidence["file_type"],
        headers={"Content-Disposition": f"attachment; filename=\"{evidence['filename']}\""}
    )

@api_router.delete("/evidence/{evidence_id}")
async def delete_evidence(evidence_id: str, current_user: dict = Depends(get_current_user)):
    evidence = await db.evidence.find_one({"id": evidence_id}, {"_id": 0})
    if not evidence:
        raise HTTPException(status_code=404, detail="Nachweis nicht gefunden")
    
    # Only allow uploader or admin to delete
    if evidence["uploaded_by"] != current_user["email"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    await db.evidence.delete_one({"id": evidence_id})
    return {"message": "Nachweis gelöscht"}

@api_router.get("/tasks/{task_id}/comments", response_model=List[TaskCommentResponse])
async def get_task_comments(task_id: str, current_user: dict = Depends(get_current_user)):
    comments = await db.task_comments.find({"task_id": task_id}, {"_id": 0}).to_list(100)
    return [TaskCommentResponse(**c) for c in comments]

@api_router.post("/tasks/{task_id}/comments", response_model=TaskCommentResponse)
async def create_task_comment(task_id: str, data: TaskCommentCreate, current_user: dict = Depends(get_current_user)):
    comment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": comment_id,
        "task_id": task_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "user_email": current_user["email"],
        "body": data.body,
        "created_at": now
    }
    await db.task_comments.insert_one(doc)
    return TaskCommentResponse(**doc)

# ============ DASHBOARD ROUTES ============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    seven_days = now + timedelta(days=7)
    
    query = {}
    if current_user["role"] == "owner":
        query["owner_email"] = current_user["email"]
    
    all_tasks = await db.tasks.find(query, {"_id": 0}).to_list(10000)
    
    overdue = 0
    due_soon = 0
    for t in all_tasks:
        if t["status"] == "open":
            due_str = t["due_date"]
            if due_str.endswith("Z"):
                due_str = due_str.replace("Z", "+00:00")
            elif "+" not in due_str and "T" in due_str:
                due_str = due_str + "+00:00"
            
            try:
                due = datetime.fromisoformat(due_str)
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                
                if due < now:
                    overdue += 1
                elif due <= seven_days:
                    due_soon += 1
            except Exception as e:
                logger.warning(f"Failed to parse due_date {t['due_date']}: {e}")
                continue
    
    case_query = {}
    if current_user["role"] == "manager":
        case_query["manager_email"] = current_user["email"]
    
    active = await db.cases.count_documents({**case_query, "status": "active", "case_type": {"$in": ["onboarding", None]}})
    completed = await db.cases.count_documents({**case_query, "status": "completed", "case_type": {"$in": ["onboarding", None]}})
    active_offboardings = await db.cases.count_documents({**case_query, "status": "active", "case_type": "offboarding"})
    completed_offboardings = await db.cases.count_documents({**case_query, "status": "completed", "case_type": "offboarding"})
    
    return DashboardStats(
        overdue_tasks=overdue,
        due_in_7_days=due_soon,
        active_cases=active,
        completed_cases=completed,
        active_offboardings=active_offboardings,
        completed_offboardings=completed_offboardings
    )

# ============ ORG SETTINGS ROUTES ============

@api_router.get("/settings", response_model=OrgSettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {"id": "default", "org_name": "Meine Firma", "org_timezone": "Europe/Berlin", "reminder_days_before": 3, "reminder_days_after": 2}
        await db.settings.insert_one(settings)
    return OrgSettingsResponse(**settings)

@api_router.put("/settings", response_model=OrgSettingsResponse)
async def update_settings(data: OrgSettingsBase, admin: dict = Depends(require_admin)):
    await db.settings.update_one({}, {"$set": data.model_dump()}, upsert=True)
    settings = await db.settings.find_one({}, {"_id": 0})
    return OrgSettingsResponse(**settings)

# ============ REPORT / PDF ROUTES ============

@api_router.get("/cases/{case_id}/report")
async def get_case_report(case_id: str, current_user: dict = Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case nicht gefunden")
    
    tasks = await db.tasks.find({"case_id": case_id}, {"_id": 0}).to_list(100)
    settings = await db.settings.find_one({}, {"_id": 0}) or {"org_name": "Meine Firma"}
    
    completed_tasks = [t for t in tasks if t["status"] == "done"]
    open_tasks = [t for t in tasks if t["status"] == "open"]
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Onboarding Report - {case['employee_name']}</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: 'Helvetica', 'Arial', sans-serif; color: #1e293b; line-height: 1.6; padding: 40px; }}
            .header {{ background: #1e40af; color: white; padding: 30px; margin: -40px -40px 30px; }}
            .header h1 {{ font-size: 24px; margin-bottom: 5px; }}
            .header p {{ opacity: 0.9; font-size: 14px; }}
            .meta {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }}
            .meta-item {{ background: #f8fafc; padding: 15px; border-radius: 8px; }}
            .meta-item label {{ font-size: 11px; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 5px; }}
            .meta-item span {{ font-size: 14px; font-weight: 600; }}
            .section {{ margin-bottom: 30px; }}
            .section h2 {{ font-size: 16px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }}
            .stats {{ display: flex; gap: 20px; margin-bottom: 30px; }}
            .stat {{ background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px 20px; border-radius: 8px; text-align: center; }}
            .stat.warning {{ background: #fef3c7; border-color: #fcd34d; }}
            .stat-value {{ font-size: 28px; font-weight: 700; color: #166534; }}
            .stat.warning .stat-value {{ color: #92400e; }}
            .stat-label {{ font-size: 12px; color: #64748b; }}
            table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
            th, td {{ padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }}
            th {{ background: #f8fafc; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #64748b; }}
            .status {{ padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }}
            .status.done {{ background: #dcfce7; color: #166534; }}
            .status.open {{ background: #fee2e2; color: #991b1b; }}
            .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Onboarding Abschlussreport</h1>
            <p>{settings.get('org_name', 'Meine Firma')}</p>
        </div>
        
        <div class="meta">
            <div class="meta-item"><label>Mitarbeiter</label><span>{case['employee_name']}</span></div>
            <div class="meta-item"><label>E-Mail</label><span>{case['employee_email']}</span></div>
            <div class="meta-item"><label>Startdatum</label><span>{case['start_date'][:10]}</span></div>
            <div class="meta-item"><label>Template</label><span>{case['template_name_snapshot']}</span></div>
            <div class="meta-item"><label>Standort</label><span>{case.get('location', '-')}</span></div>
            <div class="meta-item"><label>Manager</label><span>{case['manager_email']}</span></div>
        </div>
        
        <div class="stats">
            <div class="stat"><div class="stat-value">{len(completed_tasks)}</div><div class="stat-label">Erledigt</div></div>
            <div class="stat warning"><div class="stat-value">{len(open_tasks)}</div><div class="stat-label">Offen</div></div>
            <div class="stat"><div class="stat-value">{len(tasks)}</div><div class="stat-label">Gesamt</div></div>
        </div>
        
        <div class="section">
            <h2>Aufgabenübersicht</h2>
            <table>
                <thead><tr><th>Aufgabe</th><th>Kategorie</th><th>Verantwortlich</th><th>Fällig</th><th>Status</th><th>Erledigt am</th></tr></thead>
                <tbody>
                    {''.join([f"<tr><td>{t['title']}</td><td>{t['category']}</td><td>{t['owner_role_snapshot']}</td><td>{t['due_date'][:10]}</td><td><span class='status {t['status']}'>{('Erledigt' if t['status']=='done' else 'Offen')}</span></td><td>{(t.get('completed_at', '')[:10] if t.get('completed_at') else '-')}</td></tr>" for t in tasks])}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>Erstellt am {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC • Onboarding-Automat</p>
        </div>
    </body>
    </html>
    """
    
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_content).write_pdf()
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=onboarding_report_{case['employee_name'].replace(' ', '_')}.pdf"}
        )
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        return StreamingResponse(
            io.BytesIO(html_content.encode()),
            media_type="text/html",
            headers={"Content-Disposition": f"attachment; filename=onboarding_report_{case['employee_name'].replace(' ', '_')}.html"}
        )

# ============ SEED DATA ============

@api_router.post("/seed")
async def seed_data():
    existing = await db.templates.count_documents({})
    if existing > 0:
        return {"message": "Daten bereits vorhanden"}
    
    # Seed Owner Roles
    owner_roles = [
        {"id": str(uuid.uuid4()), "name": "IT", "emails": ["it@example.com"]},
        {"id": str(uuid.uuid4()), "name": "HR", "emails": ["hr@example.com"]},
        {"id": str(uuid.uuid4()), "name": "Office", "emails": ["office@example.com"]},
        {"id": str(uuid.uuid4()), "name": "Manager", "emails": []},
        {"id": str(uuid.uuid4()), "name": "Security", "emails": ["security@example.com"]},
    ]
    await db.owner_roles.insert_many(owner_roles)
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Templates with tasks
    templates = [
        {
            "id": str(uuid.uuid4()), "name": "Entwickler", "description": "Onboarding für Software-Entwickler",
            "template_type": "onboarding",
            "created_at": now, "updated_at": now,
            "tasks": [
                {"id": str(uuid.uuid4()), "title": "Laptop bereitstellen", "description": "MacBook/Windows nach Präferenz", "category": "IT", "owner_role": "IT", "offset_days": -3, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "E-Mail Account erstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": -2, "evidence_required": False, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "GitHub/GitLab Zugang", "description": "Repository-Zugriff einrichten", "category": "IT", "owner_role": "IT", "offset_days": -1, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "VPN Zugang einrichten", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Arbeitsplatz vorbereiten", "description": "Schreibtisch, Stuhl, Monitor", "category": "Admin", "owner_role": "Office", "offset_days": -1, "evidence_required": False, "sort_order": 5},
                {"id": str(uuid.uuid4()), "title": "Welcome Pack", "description": "Firmenmaterial überreichen", "category": "Admin", "owner_role": "HR", "offset_days": 0, "evidence_required": False, "sort_order": 6},
                {"id": str(uuid.uuid4()), "title": "Onboarding-Meeting planen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 0, "evidence_required": False, "sort_order": 7},
                {"id": str(uuid.uuid4()), "title": "Buddy zuweisen", "description": "Mentor für erste Wochen", "category": "Manager", "owner_role": "Manager", "offset_days": 0, "evidence_required": False, "sort_order": 8},
                {"id": str(uuid.uuid4()), "title": "IDE & Tools Setup", "description": "VS Code, Docker, etc.", "category": "IT", "owner_role": "IT", "offset_days": 1, "evidence_required": False, "sort_order": 9},
                {"id": str(uuid.uuid4()), "title": "Erste Ziele definieren", "description": "30/60/90 Tage Plan", "category": "Manager", "owner_role": "Manager", "offset_days": 7, "evidence_required": False, "sort_order": 10},
            ]
        },
        {
            "id": str(uuid.uuid4()), "name": "Sales", "description": "Onboarding für Vertriebsmitarbeiter",
            "template_type": "onboarding",
            "created_at": now, "updated_at": now,
            "tasks": [
                {"id": str(uuid.uuid4()), "title": "Laptop bereitstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": -3, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "E-Mail Account erstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": -2, "evidence_required": False, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "CRM Zugang (Salesforce/HubSpot)", "description": "", "category": "IT", "owner_role": "IT", "offset_days": -1, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "Telefon einrichten", "description": "VoIP oder Mobiltelefon", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Visitenkarten bestellen", "description": "", "category": "Admin", "owner_role": "Office", "offset_days": -5, "evidence_required": False, "sort_order": 5},
                {"id": str(uuid.uuid4()), "title": "Produktschulung planen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 1, "evidence_required": False, "sort_order": 6},
                {"id": str(uuid.uuid4()), "title": "Sales Playbook übergeben", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 0, "evidence_required": False, "sort_order": 7},
                {"id": str(uuid.uuid4()), "title": "Territory/Accounts zuweisen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 3, "evidence_required": False, "sort_order": 8},
            ]
        },
        {
            "id": str(uuid.uuid4()), "name": "Marketing", "description": "Onboarding für Marketing-Team",
            "template_type": "onboarding",
            "created_at": now, "updated_at": now,
            "tasks": [
                {"id": str(uuid.uuid4()), "title": "Laptop bereitstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": -3, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "E-Mail Account erstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": -2, "evidence_required": False, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "Social Media Zugänge", "description": "LinkedIn, Twitter Admin", "category": "IT", "owner_role": "IT", "offset_days": 1, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "Design-Tools (Figma/Canva)", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Brand Guidelines übergeben", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 0, "evidence_required": False, "sort_order": 5},
                {"id": str(uuid.uuid4()), "title": "Content Calendar vorstellen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 2, "evidence_required": False, "sort_order": 6},
            ]
        },
        {
            "id": str(uuid.uuid4()), "name": "Finance", "description": "Onboarding für Finanzabteilung",
            "template_type": "onboarding",
            "created_at": now, "updated_at": now,
            "tasks": [
                {"id": str(uuid.uuid4()), "title": "Laptop bereitstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": -3, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "E-Mail Account erstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": -2, "evidence_required": False, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "ERP-System Zugang", "description": "SAP/DATEV etc.", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "Banking-Zugänge", "description": "Nach Genehmigung", "category": "IT", "owner_role": "Security", "offset_days": 7, "evidence_required": True, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Compliance-Schulung", "description": "", "category": "Admin", "owner_role": "HR", "offset_days": 1, "evidence_required": True, "sort_order": 5},
                {"id": str(uuid.uuid4()), "title": "Monatsabschluss-Prozess erklären", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 5, "evidence_required": False, "sort_order": 6},
            ]
        },
        {
            "id": str(uuid.uuid4()), "name": "Support", "description": "Onboarding für Kundensupport",
            "template_type": "onboarding",
            "created_at": now, "updated_at": now,
            "tasks": [
                {"id": str(uuid.uuid4()), "title": "Laptop bereitstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": -3, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "E-Mail Account erstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": -2, "evidence_required": False, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "Ticketsystem Zugang (Zendesk/Freshdesk)", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "Headset bereitstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": -1, "evidence_required": False, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Knowledge Base einführen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 0, "evidence_required": False, "sort_order": 5},
                {"id": str(uuid.uuid4()), "title": "Shadowing mit erfahrenem Agent", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 1, "evidence_required": False, "sort_order": 6},
            ]
        },
        {
            "id": str(uuid.uuid4()), "name": "Praktikant", "description": "Onboarding für Praktikanten",
            "template_type": "onboarding",
            "created_at": now, "updated_at": now,
            "tasks": [
                {"id": str(uuid.uuid4()), "title": "Laptop/Arbeitsgerät", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "E-Mail Account", "description": "Temporär", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "Praktikumsvertrag", "description": "", "category": "Admin", "owner_role": "HR", "offset_days": -5, "evidence_required": True, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "Betreuer zuweisen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": -3, "evidence_required": False, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Projektplan erstellen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 1, "evidence_required": False, "sort_order": 5},
            ]
        },
        # ============ OFFBOARDING TEMPLATES ============
        {
            "id": str(uuid.uuid4()), "name": "Standard Offboarding", "description": "Allgemeines Offboarding für alle Mitarbeiter",
            "template_type": "offboarding",
            "created_at": now, "updated_at": now,
            "tasks": [
                {"id": str(uuid.uuid4()), "title": "Exit-Interview planen", "description": "Feedback-Gespräch vereinbaren", "category": "Manager", "owner_role": "Manager", "offset_days": -7, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "Wissenstransfer dokumentieren", "description": "Übergabedokumentation erstellen", "category": "Manager", "owner_role": "Manager", "offset_days": -5, "evidence_required": True, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "Nachfolger einarbeiten", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": -3, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "E-Mail-Weiterleitung einrichten", "description": "Automatische Weiterleitung an Nachfolger", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Alle Zugänge deaktivieren", "description": "AD, VPN, Cloud-Dienste, etc.", "category": "Security", "owner_role": "Security", "offset_days": 0, "evidence_required": True, "sort_order": 5},
                {"id": str(uuid.uuid4()), "title": "Laptop einsammeln", "description": "Hardware zurückgeben lassen", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": True, "sort_order": 6},
                {"id": str(uuid.uuid4()), "title": "Firmenschlüssel/Badge einziehen", "description": "", "category": "Admin", "owner_role": "Office", "offset_days": 0, "evidence_required": True, "sort_order": 7},
                {"id": str(uuid.uuid4()), "title": "Arbeitszeugnis erstellen", "description": "", "category": "Admin", "owner_role": "HR", "offset_days": 0, "evidence_required": False, "sort_order": 8},
                {"id": str(uuid.uuid4()), "title": "Abschlussabrechnung vorbereiten", "description": "Resturlaub, Überstunden", "category": "Admin", "owner_role": "HR", "offset_days": 0, "evidence_required": False, "sort_order": 9},
                {"id": str(uuid.uuid4()), "title": "Exit-Interview durchführen", "description": "Feedback-Gespräch dokumentieren", "category": "Manager", "owner_role": "Manager", "offset_days": 0, "evidence_required": True, "sort_order": 10},
            ]
        },
        {
            "id": str(uuid.uuid4()), "name": "IT-Mitarbeiter Offboarding", "description": "Spezielles Offboarding für IT/Entwickler mit erhöhten Zugriffsrechten",
            "template_type": "offboarding",
            "created_at": now, "updated_at": now,
            "tasks": [
                {"id": str(uuid.uuid4()), "title": "Alle Passwörter ändern", "description": "Shared Accounts, Adminzugänge", "category": "Security", "owner_role": "Security", "offset_days": -3, "evidence_required": True, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "SSH-Keys entfernen", "description": "Aus allen Servern entfernen", "category": "IT", "owner_role": "IT", "offset_days": -2, "evidence_required": True, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "Code-Review offener PRs", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": -2, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "GitHub/GitLab Zugang entfernen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": True, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Cloud-Konsolen Zugang sperren", "description": "AWS, Azure, GCP", "category": "Security", "owner_role": "Security", "offset_days": 0, "evidence_required": True, "sort_order": 5},
                {"id": str(uuid.uuid4()), "title": "API-Keys rotieren", "description": "Alle vom MA erstellten Keys", "category": "Security", "owner_role": "Security", "offset_days": 0, "evidence_required": True, "sort_order": 6},
                {"id": str(uuid.uuid4()), "title": "Laptop einsammeln und löschen", "description": "Sichere Datenlöschung", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": True, "sort_order": 7},
                {"id": str(uuid.uuid4()), "title": "Dokumentation aktualisieren", "description": "Wiki, Runbooks updaten", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 8},
                {"id": str(uuid.uuid4()), "title": "On-Call Rotation anpassen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": -1, "evidence_required": False, "sort_order": 9},
                {"id": str(uuid.uuid4()), "title": "Security-Audit durchführen", "description": "Prüfen ob alle Zugänge entfernt", "category": "Security", "owner_role": "Security", "offset_days": 1, "evidence_required": True, "sort_order": 10},
            ]
        },
        {
            "id": str(uuid.uuid4()), "name": "Führungskraft Offboarding", "description": "Offboarding für Manager und Führungskräfte",
            "template_type": "offboarding",
            "created_at": now, "updated_at": now,
            "tasks": [
                {"id": str(uuid.uuid4()), "title": "Nachfolger kommunizieren", "description": "Intern und extern", "category": "Manager", "owner_role": "HR", "offset_days": -14, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "Team-Übergabe planen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": -10, "evidence_required": True, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "Kundenkontakte übergeben", "description": "Wichtige Kontakte vorstellen", "category": "Manager", "owner_role": "Manager", "offset_days": -7, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "Budget-Verantwortung übertragen", "description": "", "category": "Admin", "owner_role": "HR", "offset_days": -5, "evidence_required": True, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Unterschriftsberechtigungen entziehen", "description": "", "category": "Admin", "owner_role": "HR", "offset_days": 0, "evidence_required": True, "sort_order": 5},
                {"id": str(uuid.uuid4()), "title": "Firmenkreditkarte sperren", "description": "", "category": "Admin", "owner_role": "HR", "offset_days": 0, "evidence_required": True, "sort_order": 6},
                {"id": str(uuid.uuid4()), "title": "LinkedIn-Profil aktualisieren", "description": "Firmenverbindung entfernen", "category": "Admin", "owner_role": "HR", "offset_days": 0, "evidence_required": False, "sort_order": 7},
                {"id": str(uuid.uuid4()), "title": "Alle Zugänge deaktivieren", "description": "", "category": "Security", "owner_role": "Security", "offset_days": 0, "evidence_required": True, "sort_order": 8},
                {"id": str(uuid.uuid4()), "title": "Exit-Interview mit GF", "description": "", "category": "Manager", "owner_role": "HR", "offset_days": 0, "evidence_required": True, "sort_order": 9},
            ]
        },
    ]
    
    await db.templates.insert_many(templates)
    
    # Seed default settings
    await db.settings.insert_one({
        "id": "default",
        "org_name": "Meine Firma",
        "org_timezone": "Europe/Berlin",
        "reminder_days_before": 3,
        "reminder_days_after": 2
    })
    
    return {"message": "Seed-Daten erfolgreich erstellt", "templates": len(templates), "owner_roles": len(owner_roles)}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
