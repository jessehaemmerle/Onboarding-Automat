from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, Header
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
import os
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import io
import asyncio

try:
    from .auth import (
        create_access_token,
        generate_license_key,
        get_current_user,
        get_org_filter,
        get_password_hash,
        require_admin,
        require_super_admin,
        verify_master_key,
        verify_password,
    )
    from .config import client, db, logger
except ImportError:  # pragma: no cover - fallback for direct module execution
    from auth import (  # type: ignore
        create_access_token,
        generate_license_key,
        get_current_user,
        get_org_filter,
        get_password_hash,
        require_admin,
        require_super_admin,
        verify_master_key,
        verify_password,
    )
    from config import client, db, logger  # type: ignore

app = FastAPI(title="OnboardIQ API")
api_router = APIRouter(prefix="/api")

# ============ HEALTH CHECK ENDPOINT (for Kubernetes) ============
@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes liveness/readiness probes"""
    return {"status": "healthy", "service": "onboarding-automat"}

# ============ BACKGROUND CRON JOB ============

async def data_retention_cleanup():
    """Background task for DSGVO-compliant data retention cleanup"""
    while True:
        try:
            # Wait until next run (every 24 hours at 3 AM)
            now = datetime.now(timezone.utc)
            next_run = now.replace(hour=3, minute=0, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)
            wait_seconds = (next_run - now).total_seconds()
            
            logger.info(f"Data retention cleanup scheduled for {next_run.isoformat()}")
            await asyncio.sleep(wait_seconds)
            
            # Get retention settings
            settings = await db.settings.find_one({}, {"_id": 0})
            retention_days = settings.get("data_retention_days", 1095) if settings else 1095  # Default 3 years
            audit_retention_days = settings.get("audit_retention_days", 365) if settings else 365  # 1 year for audit logs
            
            cutoff_date = (datetime.now(timezone.utc) - timedelta(days=retention_days)).isoformat()
            audit_cutoff = (datetime.now(timezone.utc) - timedelta(days=audit_retention_days)).isoformat()
            
            logger.info(f"Running data retention cleanup. Cutoff: {cutoff_date}")
            
            # Find old completed cases
            old_cases = await db.cases.find({
                "status": "completed",
                "created_at": {"$lt": cutoff_date}
            }, {"_id": 0, "id": 1, "employee_name": 1, "employee_email": 1}).to_list(1000)
            
            anonymized_count = 0
            if old_cases:
                # OPTIMIZED: Batch operations instead of individual updates
                case_ids = [case["id"] for case in old_cases]
                now_iso = datetime.now(timezone.utc).isoformat()
                
                # Batch anonymize all cases at once
                await db.cases.update_many(
                    {"id": {"$in": case_ids}},
                    {"$set": {
                        "employee_name": "[ANONYMISIERT]",
                        "employee_email": "[ANONYMISIERT]",
                        "anonymized_at": now_iso
                    }}
                )
                anonymized_count = len(case_ids)
                
                # OPTIMIZED: Delete evidence in batch - get all task IDs first, then delete all evidence
                all_tasks = await db.tasks.find({"case_id": {"$in": case_ids}}, {"_id": 0, "id": 1}).to_list(10000)
                if all_tasks:
                    task_ids = [task["id"] for task in all_tasks]
                    await db.evidence.delete_many({"task_id": {"$in": task_ids}})
            
            # Clean old audit logs (keep structure but remove sensitive details)
            old_audit_result = await db.audit_logs.update_many(
                {"timestamp": {"$lt": audit_cutoff}},
                {"$set": {
                    "user_name": "Archiviert",
                    "user_email": "archiviert@system",
                    "details": "Archiviert gemäß Aufbewahrungsfrist",
                    "old_value": None,
                    "new_value": None
                }}
            )
            
            # Log cleanup result
            cleanup_log = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "user_id": "system",
                "user_email": "system@cron",
                "user_name": "System Cron",
                "action": "cleanup",
                "resource_type": "retention",
                "details": f"Datenbereinigung: {anonymized_count} Cases anonymisiert, {old_audit_result.modified_count} Audit-Logs archiviert",
                "old_value": f"retention_days={retention_days}",
                "new_value": f"cutoff={cutoff_date}"
            }
            await db.audit_logs.insert_one(cleanup_log)
            
            logger.info(f"Data retention cleanup completed: {anonymized_count} cases anonymized, {old_audit_result.modified_count} audit logs archived")
            
        except Exception as e:
            logger.error(f"Data retention cleanup error: {e}")
            await asyncio.sleep(3600)  # Wait 1 hour on error before retry

async def create_indexes():
    """Create database indexes for optimal query performance"""
    try:
        # Organization-based queries (most common filter)
        await db.users.create_index("organization_id")
        await db.cases.create_index([("organization_id", 1), ("status", 1)])
        await db.cases.create_index([("organization_id", 1), ("case_type", 1)])
        await db.tasks.create_index([("organization_id", 1), ("case_id", 1)])
        await db.tasks.create_index([("organization_id", 1), ("owner_email", 1)])
        await db.templates.create_index("organization_id")
        await db.owner_roles.create_index("organization_id")
        await db.categories.create_index("organization_id")
        await db.departments.create_index("organization_id")
        
        # Text search on cases
        await db.cases.create_index([("employee_name", "text"), ("employee_email", "text")])

        # Evidence lookup optimization
        await db.evidence.create_index("task_id")
        
        # License key lookup
        await db.license_keys.create_index([("key", 1), ("status", 1)])
        
        logger.info("✅ Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation: {e} (may already exist)")

async def ensure_super_admin():
    """Create or update Super-Admin on startup - for deployment"""
    try:
        # Get Super-Admin credentials from environment
        admin_email = os.environ.get('SUPER_ADMIN_EMAIL', 'jesse@haemmerle.at')
        admin_password = os.environ.get('SUPER_ADMIN_PASSWORD', 'Admin2024!')
        admin_name = os.environ.get('SUPER_ADMIN_NAME', 'Jesse (Super Admin)')
        
        # Check if super admin with this email exists
        existing_super_admin = await db.users.find_one({"email": admin_email}, {"_id": 0})
        
        if existing_super_admin:
            # Update password and ensure is_super_admin flag is set
            hashed_password = pwd_context.hash(admin_password)
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {
                    "hashed_password": hashed_password,
                    "password_hash": hashed_password,
                    "is_super_admin": True,
                    "status": "active",
                    "name": admin_name
                }}
            )
            logger.info(f"✅ Super-Admin updated: {admin_email}")
            return
        
        # Check if any other super admin exists
        any_super_admin = await db.users.find_one({"is_super_admin": True}, {"_id": 0, "email": 1})
        if any_super_admin:
            logger.info(f"✅ Super-Admin exists: {any_super_admin.get('email')}")
            return
        
        # Create new Super-Admin
        super_admin = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": admin_name,
            "hashed_password": pwd_context.hash(admin_password),
            "password_hash": pwd_context.hash(admin_password),
            "role": "admin",
            "is_super_admin": True,
            "organization_id": None,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(super_admin)
        logger.info(f"✅ Super-Admin created: {admin_email}")
        
    except Exception as e:
        logger.error(f"Error with Super-Admin: {e}")

# Start background task on app startup
@app.on_event("startup")
async def start_background_tasks():
    await create_indexes()
    await ensure_super_admin()
    asyncio.create_task(data_retention_cleanup())
    asyncio.create_task(daily_reminder_job())
    logger.info("✅ Application startup complete - indexes created, data retention + reminders scheduled")

# ============ PYDANTIC MODELS ============

# License and Organization Models
class LicenseKeyCreate(BaseModel):
    count: int = 1
    user_limit: int = 10
    notes: str = ""

class LicenseKeyResponse(BaseModel):
    id: str
    key: str
    status: str  # unused, active, revoked
    user_limit: int
    notes: str
    created_at: str
    activated_at: Optional[str] = None
    organization_id: Optional[str] = None

class OrganizationBase(BaseModel):
    name: str

class OrganizationCreate(OrganizationBase):
    license_key: str
    admin_name: str
    admin_email: EmailStr
    admin_password: str

class OrganizationResponse(OrganizationBase):
    id: str
    license_key: str
    user_limit: int
    user_count: int
    status: str
    created_at: str

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "owner"  # admin, manager, owner, readonly
    department_id: Optional[str] = None

class UserCreate(UserBase):
    password: str
    organization_id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: str
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    is_super_admin: bool = False
    created_at: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class OwnerRoleBase(BaseModel):
    name: str
    emails: List[str]
    department_id: Optional[str] = None

class OwnerRoleCreate(OwnerRoleBase):
    pass

class OwnerRoleResponse(OwnerRoleBase):
    id: str
    department_id: Optional[str] = None

# Category Models
class CategoryBase(BaseModel):
    name: str
    color: str = "#3b82f6"  # Default blue

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: str

# Department Models
class DepartmentBase(BaseModel):
    name: str
    color: str = "#3b82f6"

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: str

class TemplateTaskBase(BaseModel):
    id: Optional[str] = None  # Optional ID, will be generated if not provided
    title: str
    description: str = ""
    category: str  # IT, Admin, Manager, Security
    owner_role: str
    offset_days: int = 0
    evidence_required: bool = False
    sort_order: int = 0
    depends_on: Optional[str] = None  # ID of the task this depends on (within template)

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
    start_date: str  # For offboarding this is exit_date, for rolechange this is transition_date
    location: str = ""
    manager_email: EmailStr
    case_type: str = "onboarding"  # onboarding, offboarding, or rolechange
    linked_case_id: Optional[str] = None  # Link offboarding/rolechange to existing case
    new_role: Optional[str] = None  # For rolechange: the new role name
    old_role: Optional[str] = None  # For rolechange: the previous role name

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
    depends_on: Optional[str] = None  # ID of the task this depends on
    is_blocked: bool = False  # True if depends_on task is not completed

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
    case_type: str = "onboarding"  # onboarding, offboarding, or rolechange
    start_date: str  # For offboarding this is exit_date, for rolechange this is transition_date
    location: str
    manager_email: str
    status: str
    linked_case_id: Optional[str] = None  # Link offboarding/rolechange to onboarding
    new_role: Optional[str] = None  # For rolechange: the new role name
    old_role: Optional[str] = None  # For rolechange: the previous role name
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
    active_rolechanges: int = 0
    completed_rolechanges: int = 0

class OrgSettingsBase(BaseModel):
    org_name: str = "Meine Firma"
    org_timezone: str = "Europe/Berlin"
    reminder_days_before: int = 3
    reminder_days_after: int = 2
    data_retention_days: int = 365 * 3  # 3 Jahre Standard
    privacy_policy_url: str = ""
    dpo_email: str = ""  # Datenschutzbeauftragter

class OrgSettingsResponse(OrgSettingsBase):
    id: str

# ============ AUDIT LOG MODELS ============

class AuditLogEntry(BaseModel):
    id: str
    timestamp: str
    user_id: str
    user_email: str
    user_name: str
    action: str  # create, update, delete, access, export, login, logout
    resource_type: str  # user, case, task, template, evidence, settings
    resource_id: Optional[str] = None
    resource_name: Optional[str] = None
    details: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    ip_address: Optional[str] = None

class AuditLogResponse(BaseModel):
    entries: List[AuditLogEntry]
    total: int
    page: int
    page_size: int

# ============ CONTACT/SALES MODELS ============

class SalesContactRequest(BaseModel):
    company: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    employees: Optional[str] = None
    message: Optional[str] = None

# ============ DSGVO/GDPR MODELS ============

class ConsentRecord(BaseModel):
    id: str
    user_id: str
    consent_type: str  # privacy_policy, data_processing, marketing
    consented: bool
    consented_at: str
    ip_address: Optional[str] = None
    revoked_at: Optional[str] = None

class DataExportRequest(BaseModel):
    format: str = "json"  # json or csv

class DataDeletionRequest(BaseModel):
    confirm: bool
    reason: Optional[str] = None

# ============ AUDIT LOG HELPER ============

async def log_audit(
    user: dict,
    action: str,
    resource_type: str,
    resource_id: str = None,
    resource_name: str = None,
    details: str = None,
    old_value: str = None,
    new_value: str = None,
    ip_address: str = None
):
    """Log an audit entry for DSGVO compliance"""
    audit_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user.get("id", "system"),
        "user_email": user.get("email", "system"),
        "user_name": user.get("name", "System"),
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "resource_name": resource_name,
        "details": details,
        "old_value": old_value,
        "new_value": new_value,
        "ip_address": ip_address
    }
    await db.audit_logs.insert_one(audit_entry)
    logger.info(f"AUDIT: {user.get('email', 'system')} - {action} - {resource_type} - {resource_id}")
    return audit_entry

# ============ LICENSE & ORGANIZATION ROUTES ============

@api_router.post("/admin/generate-license-keys", response_model=List[LicenseKeyResponse])
async def generate_license_keys(
    data: LicenseKeyCreate,
    x_master_key: str = Header(None, alias="X-Master-Key")
):
    """Generate new license keys - requires Master Admin Key"""
    if not x_master_key:
        raise HTTPException(status_code=403, detail="Master-Admin-Key fehlt")
    verify_master_key(x_master_key)
    
    now = datetime.now(timezone.utc).isoformat()
    keys = []
    
    for _ in range(data.count):
        key = generate_license_key()
        license_doc = {
            "id": str(uuid.uuid4()),
            "key": key,
            "status": "unused",
            "user_limit": data.user_limit,
            "notes": data.notes,
            "created_at": now,
            "activated_at": None,
            "organization_id": None
        }
        await db.license_keys.insert_one(license_doc)
        keys.append(LicenseKeyResponse(**license_doc))
    
    logger.info(f"Generated {data.count} license keys with limit {data.user_limit}")
    return keys

@api_router.post("/auth/register-organization", response_model=TokenResponse)
async def register_organization(data: OrganizationCreate):
    """Register a new organization with a license key"""
    # Validate license key
    license_key = await db.license_keys.find_one({"key": data.license_key}, {"_id": 0})
    if not license_key:
        raise HTTPException(status_code=400, detail="Ungültiger Lizenzschlüssel")
    
    if license_key["status"] != "unused":
        raise HTTPException(status_code=400, detail="Lizenzschlüssel wurde bereits verwendet")
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": data.admin_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="E-Mail-Adresse wird bereits verwendet")
    
    now = datetime.now(timezone.utc).isoformat()
    org_id = str(uuid.uuid4())
    
    # Create organization
    org_doc = {
        "id": org_id,
        "name": data.name,
        "license_key": data.license_key,
        "user_limit": license_key["user_limit"],
        "status": "active",
        "created_at": now
    }
    await db.organizations.insert_one(org_doc)
    
    # Create admin user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.admin_email,
        "name": data.admin_name,
        "role": "admin",
        "organization_id": org_id,
        "is_super_admin": False,
        "hashed_password": get_password_hash(data.admin_password),
        "created_at": now
    }
    await db.users.insert_one(user_doc)
    
    # Update license key status
    await db.license_keys.update_one(
        {"id": license_key["id"]},
        {"$set": {
            "status": "active",
            "activated_at": now,
            "organization_id": org_id
        }}
    )
    
    # Create default owner roles for the organization
    default_roles = [
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "IT", "emails": []},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "HR", "emails": []},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "Office", "emails": []},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "Manager", "emails": []},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "Security", "emails": []},
    ]
    await db.owner_roles.insert_many(default_roles)
    
    # Create default categories for the organization
    default_categories = [
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "IT", "color": "#3b82f6"},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "Admin", "color": "#8b5cf6"},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "Manager", "color": "#10b981"},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "HR", "color": "#f59e0b"},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "Security", "color": "#ef4444"},
    ]
    await db.categories.insert_many(default_categories)
    
    # Create default departments for the organization
    default_departments = [
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "IT", "color": "#3b82f6"},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "HR", "color": "#f59e0b"},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "Management", "color": "#10b981"},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "Office", "color": "#8b5cf6"},
        {"id": str(uuid.uuid4()), "organization_id": org_id, "name": "Security", "color": "#ef4444"},
    ]
    await db.departments.insert_many(default_departments)
    
    logger.info(f"New organization registered: {data.name} (ID: {org_id})")
    
    # Generate token
    token = create_access_token({"sub": user_id})
    user_response = UserResponse(
        id=user_id,
        email=data.admin_email,
        name=data.admin_name,
        role="admin",
        organization_id=org_id,
        organization_name=data.name,
        is_super_admin=False,
        created_at=now
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/organizations/{org_id}", response_model=OrganizationResponse)
async def get_organization(org_id: str, current_user: dict = Depends(get_current_user)):
    """Get organization details"""
    # Check permission
    if not current_user.get("is_super_admin") and current_user.get("organization_id") != org_id:
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    
    # Count users
    user_count = await db.users.count_documents({"organization_id": org_id})
    org["user_count"] = user_count
    
    return OrganizationResponse(**org)

@api_router.get("/admin/licenses")
async def get_all_licenses(admin: dict = Depends(require_super_admin)):
    """Get all license keys with enriched data - Super-Admin only"""
    licenses = await db.license_keys.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with organization info
    for lic in licenses:
        if lic.get("organization_id"):
            org = await db.organizations.find_one({"id": lic["organization_id"]}, {"_id": 0, "name": 1})
            lic["organization_name"] = org["name"] if org else "Unknown"
            lic["current_users"] = await db.users.count_documents({"organization_id": lic["organization_id"]})
        else:
            lic["organization_name"] = None
            lic["current_users"] = 0
    
    return licenses

@api_router.get("/admin/licenses/{license_id}")
async def get_license_details(license_id: str, admin: dict = Depends(require_super_admin)):
    """Get detailed license info - Super-Admin only"""
    license_key = await db.license_keys.find_one({"id": license_id}, {"_id": 0})
    if not license_key:
        raise HTTPException(status_code=404, detail="Lizenz nicht gefunden")
    
    # Enrich with organization and subscription info
    if license_key.get("organization_id"):
        org = await db.organizations.find_one({"id": license_key["organization_id"]}, {"_id": 0})
        license_key["organization"] = org
        license_key["current_users"] = await db.users.count_documents({"organization_id": license_key["organization_id"]})
        
        # Get subscription info
        subscription = await db.subscriptions.find_one({"organization_id": license_key["organization_id"]}, {"_id": 0})
        license_key["subscription"] = subscription
    
    return license_key

@api_router.put("/admin/licenses/{license_id}")
async def update_license(license_id: str, user_limit: int = None, expires_at: str = None, notes: str = None, admin: dict = Depends(require_super_admin)):
    """Update license settings - Super-Admin only"""
    license_key = await db.license_keys.find_one({"id": license_id}, {"_id": 0})
    if not license_key:
        raise HTTPException(status_code=404, detail="Lizenz nicht gefunden")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": admin["email"]}
    
    if user_limit is not None:
        if user_limit < 1 and user_limit != -1:
            raise HTTPException(status_code=400, detail="Benutzer-Limit muss mindestens 1 sein (oder -1 für unbegrenzt)")
        update_data["user_limit"] = user_limit
        
        # Also update organization if assigned
        if license_key.get("organization_id"):
            await db.organizations.update_one(
                {"id": license_key["organization_id"]},
                {"$set": {"user_limit": user_limit}}
            )
    
    if expires_at is not None:
        update_data["expires_at"] = expires_at
    
    if notes is not None:
        update_data["notes"] = notes
    
    await db.license_keys.update_one({"id": license_id}, {"$set": update_data})
    
    await log_audit(
        user=admin,
        action="update",
        resource_type="license",
        resource_id=license_id,
        resource_name=license_key["key"],
        details=f"Lizenz aktualisiert: {update_data}"
    )
    
    return {"message": "Lizenz aktualisiert", "license_id": license_id}

@api_router.patch("/admin/licenses/{license_id}/revoke")
async def revoke_license(license_id: str, reason: str = "", admin: dict = Depends(require_super_admin)):
    """Revoke a license - Super-Admin only"""
    license_key = await db.license_keys.find_one({"id": license_id}, {"_id": 0})
    if not license_key:
        raise HTTPException(status_code=404, detail="Lizenz nicht gefunden")
    
    if license_key["status"] == "revoked":
        raise HTTPException(status_code=400, detail="Lizenz ist bereits widerrufen")
    
    # Update license status
    await db.license_keys.update_one(
        {"id": license_id},
        {"$set": {
            "status": "revoked",
            "revoked_at": datetime.now(timezone.utc).isoformat(),
            "revoked_by": admin["email"],
            "revocation_reason": reason
        }}
    )
    
    # Suspend organization if assigned
    if license_key.get("organization_id"):
        await db.organizations.update_one(
            {"id": license_key["organization_id"]},
            {"$set": {"status": "suspended", "suspended_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Update subscription status
        await db.subscriptions.update_one(
            {"organization_id": license_key["organization_id"]},
            {"$set": {"status": "canceled"}}
        )
    
    await log_audit(
        user=admin,
        action="revoke",
        resource_type="license",
        resource_id=license_id,
        resource_name=license_key["key"],
        details=f"Lizenz widerrufen. Grund: {reason}"
    )
    
    return {"message": "Lizenz widerrufen", "license_id": license_id}

@api_router.patch("/admin/licenses/{license_id}/reactivate")
async def reactivate_license(license_id: str, admin: dict = Depends(require_super_admin)):
    """Reactivate a revoked license - Super-Admin only"""
    license_key = await db.license_keys.find_one({"id": license_id}, {"_id": 0})
    if not license_key:
        raise HTTPException(status_code=404, detail="Lizenz nicht gefunden")
    
    if license_key["status"] not in ["revoked", "expired"]:
        raise HTTPException(status_code=400, detail="Lizenz ist nicht widerrufen oder abgelaufen")
    
    # Determine new status
    new_status = "active" if license_key.get("organization_id") else "unused"
    
    await db.license_keys.update_one(
        {"id": license_id},
        {"$set": {
            "status": new_status,
            "reactivated_at": datetime.now(timezone.utc).isoformat(),
            "reactivated_by": admin["email"]
        }}
    )
    
    # Reactivate organization if assigned
    if license_key.get("organization_id"):
        await db.organizations.update_one(
            {"id": license_key["organization_id"]},
            {"$set": {"status": "active"}}
        )
        await db.subscriptions.update_one(
            {"organization_id": license_key["organization_id"]},
            {"$set": {"status": "active"}}
        )
    
    await log_audit(
        user=admin,
        action="reactivate",
        resource_type="license",
        resource_id=license_id,
        resource_name=license_key["key"],
        details="Lizenz reaktiviert"
    )
    
    return {"message": "Lizenz reaktiviert", "license_id": license_id, "new_status": new_status}

@api_router.delete("/admin/licenses/{license_id}")
async def delete_license(license_id: str, confirm: bool = False, admin: dict = Depends(require_super_admin)):
    """Delete an unused license - Super-Admin only"""
    if not confirm:
        raise HTTPException(status_code=400, detail="Bestätigung erforderlich (confirm=true)")
    
    license_key = await db.license_keys.find_one({"id": license_id}, {"_id": 0})
    if not license_key:
        raise HTTPException(status_code=404, detail="Lizenz nicht gefunden")
    
    if license_key["status"] == "active":
        raise HTTPException(status_code=400, detail="Aktive Lizenzen können nicht gelöscht werden. Erst widerrufen.")
    
    await db.license_keys.delete_one({"id": license_id})
    
    await log_audit(
        user=admin,
        action="delete",
        resource_type="license",
        resource_id=license_id,
        resource_name=license_key["key"],
        details="Lizenz gelöscht"
    )
    
    return {"message": "Lizenz gelöscht", "license_id": license_id}

@api_router.post("/admin/licenses/{license_id}/add-users")
async def add_users_to_license(license_id: str, additional_users: int, admin: dict = Depends(require_super_admin)):
    """Add more users to a license - Super-Admin only"""
    if additional_users < 1:
        raise HTTPException(status_code=400, detail="Anzahl muss mindestens 1 sein")
    
    license_key = await db.license_keys.find_one({"id": license_id}, {"_id": 0})
    if not license_key:
        raise HTTPException(status_code=404, detail="Lizenz nicht gefunden")
    
    current_limit = license_key.get("user_limit", 10)
    if current_limit == -1:
        raise HTTPException(status_code=400, detail="Lizenz hat bereits unbegrenzte Benutzer")
    
    new_limit = current_limit + additional_users
    
    await db.license_keys.update_one(
        {"id": license_id},
        {"$set": {
            "user_limit": new_limit,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": admin["email"]
        }}
    )
    
    # Also update organization if assigned
    if license_key.get("organization_id"):
        await db.organizations.update_one(
            {"id": license_key["organization_id"]},
            {"$set": {"user_limit": new_limit}}
        )
    
    await log_audit(
        user=admin,
        action="update",
        resource_type="license",
        resource_id=license_id,
        resource_name=license_key["key"],
        details=f"Benutzer-Limit erhöht: {current_limit} -> {new_limit} (+{additional_users})"
    )
    
    return {
        "message": f"Benutzer-Limit erhöht auf {new_limit}",
        "license_id": license_id,
        "old_limit": current_limit,
        "new_limit": new_limit
    }

@api_router.get("/admin/organizations")
async def get_all_organizations(admin: dict = Depends(require_super_admin)):
    """Get all organizations with stats - Super-Admin only"""
    orgs = await db.organizations.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Add user count and case count for each org
    for org in orgs:
        org["user_count"] = await db.users.count_documents({"organization_id": org["id"]})
        org["case_count"] = await db.cases.count_documents({"organization_id": org["id"]})
    
    return orgs

# ============ SUPER-ADMIN FUNCTIONS ============

@api_router.get("/admin/users")
async def get_all_users(admin: dict = Depends(require_super_admin)):
    """Get all users across all organizations - Super-Admin only"""
    users = await db.users.find({}, {"_id": 0, "hashed_password": 0, "password_hash": 0}).sort("created_at", -1).to_list(10000)
    
    # Enrich with organization names
    org_cache = {}
    for user in users:
        org_id = user.get("organization_id")
        if org_id and org_id not in org_cache:
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1})
            org_cache[org_id] = org["name"] if org else "Unknown"
        user["organization_name"] = org_cache.get(org_id, "Super Admin" if user.get("is_super_admin") else "Unknown")
        user["is_super_admin"] = user.get("is_super_admin", False)
    
    return users

@api_router.patch("/admin/users/{user_id}/status")
async def update_user_status(user_id: str, new_status: str, admin: dict = Depends(require_super_admin)):
    """Block/Unblock a user - Super-Admin only"""
    if new_status not in ["active", "blocked"]:
        raise HTTPException(status_code=400, detail="Status muss 'active' oder 'blocked' sein")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    if user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super-Admin kann nicht gesperrt werden")
    
    old_status = user.get("status", "active")
    await db.users.update_one({"id": user_id}, {"$set": {"status": new_status}})
    
    await log_audit(
        user=admin,
        action="update",
        resource_type="user",
        resource_id=user_id,
        resource_name=user.get("email"),
        details=f"Benutzer-Status geändert: {old_status} -> {new_status}",
        old_value=old_status,
        new_value=new_status
    )
    
    return {"message": f"Benutzer-Status auf '{status}' gesetzt", "user_id": user_id}

@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, new_password: str, admin: dict = Depends(require_super_admin)):
    """Reset password for any user - Super-Admin only"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 8 Zeichen haben")
    
    hashed = get_password_hash(new_password)
    await db.users.update_one({"id": user_id}, {"$set": {"hashed_password": hashed, "password_hash": hashed}})
    
    await log_audit(
        user=admin,
        action="update",
        resource_type="user",
        resource_id=user_id,
        resource_name=user.get("email"),
        details="Passwort durch Super-Admin zurückgesetzt"
    )
    
    return {"message": "Passwort erfolgreich zurückgesetzt", "user_id": user_id}

@api_router.patch("/admin/organizations/{org_id}/status")
async def update_organization_status(org_id: str, new_status: str, admin: dict = Depends(require_super_admin)):
    """Activate/Deactivate an organization - Super-Admin only"""
    if new_status not in ["active", "inactive", "suspended"]:
        raise HTTPException(status_code=400, detail="Status muss 'active', 'inactive' oder 'suspended' sein")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    
    old_status = org.get("status", "active")
    await db.organizations.update_one({"id": org_id}, {"$set": {"status": new_status}})
    
    await log_audit(
        user=admin,
        action="update",
        resource_type="organization",
        resource_id=org_id,
        resource_name=org.get("name"),
        details=f"Organisations-Status geändert: {old_status} -> {new_status}",
        old_value=old_status,
        new_value=new_status
    )
    
    return {"message": f"Organisations-Status auf '{new_status}' gesetzt", "org_id": org_id}

@api_router.patch("/admin/organizations/{org_id}/user-limit")
async def update_organization_user_limit(org_id: str, user_limit: int, admin: dict = Depends(require_super_admin)):
    """Change user limit for an organization - Super-Admin only"""
    if user_limit < 1:
        raise HTTPException(status_code=400, detail="Benutzer-Limit muss mindestens 1 sein")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    
    old_limit = org.get("user_limit", 10)
    await db.organizations.update_one({"id": org_id}, {"$set": {"user_limit": user_limit}})
    
    # Update license key as well
    await db.license_keys.update_one({"organization_id": org_id}, {"$set": {"user_limit": user_limit}})
    
    await log_audit(
        user=admin,
        action="update",
        resource_type="organization",
        resource_id=org_id,
        resource_name=org.get("name"),
        details=f"Benutzer-Limit geändert: {old_limit} -> {user_limit}",
        old_value=str(old_limit),
        new_value=str(user_limit)
    )
    
    return {"message": f"Benutzer-Limit auf {user_limit} gesetzt", "org_id": org_id}

@api_router.delete("/admin/organizations/{org_id}")
async def delete_organization(org_id: str, confirm: bool = False, admin: dict = Depends(require_super_admin)):
    """Delete an organization and all its data - Super-Admin only"""
    if not confirm:
        raise HTTPException(status_code=400, detail="Bestätigung erforderlich: confirm=true")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    
    # Delete all organization data
    await db.users.delete_many({"organization_id": org_id})
    await db.cases.delete_many({"organization_id": org_id})
    await db.templates.delete_many({"organization_id": org_id})
    await db.owner_roles.delete_many({"organization_id": org_id})
    await db.audit_logs.delete_many({"organization_id": org_id})
    await db.license_keys.update_one({"organization_id": org_id}, {"$set": {"status": "revoked", "organization_id": None}})
    await db.organizations.delete_one({"id": org_id})
    
    await log_audit(
        user=admin,
        action="delete",
        resource_type="organization",
        resource_id=org_id,
        resource_name=org.get("name"),
        details="Organisation und alle zugehörigen Daten gelöscht"
    )
    
    return {"message": f"Organisation '{org.get('name')}' erfolgreich gelöscht", "org_id": org_id}

@api_router.get("/admin/audit-logs")
async def get_system_audit_logs(
    limit: int = 100,
    offset: int = 0,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    admin: dict = Depends(require_super_admin)
):
    """Get system-wide audit logs - Super-Admin only"""
    query = {}
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)
    total = await db.audit_logs.count_documents(query)
    
    return {"logs": logs, "total": total, "limit": limit, "offset": offset}

@api_router.get("/admin/system-stats")
async def get_system_stats(admin: dict = Depends(require_super_admin)):
    """Get system-wide statistics - Super-Admin only"""
    now = datetime.now(timezone.utc)
    last_30_days = (now - timedelta(days=30)).isoformat()
    last_7_days = (now - timedelta(days=7)).isoformat()
    
    # Total counts
    total_orgs = await db.organizations.count_documents({})
    total_users = await db.users.count_documents({})
    total_cases = await db.cases.count_documents({})
    total_templates = await db.templates.count_documents({})
    
    # Active counts
    active_orgs = await db.organizations.count_documents({"status": "active"})
    active_users = await db.users.count_documents({"status": {"$ne": "blocked"}})
    active_cases = await db.cases.count_documents({"status": "active"})
    
    # License stats
    total_licenses = await db.license_keys.count_documents({})
    unused_licenses = await db.license_keys.count_documents({"status": "unused"})
    active_licenses = await db.license_keys.count_documents({"status": "active"})
    
    # Recent activity
    new_orgs_30d = await db.organizations.count_documents({"created_at": {"$gte": last_30_days}})
    new_users_30d = await db.users.count_documents({"created_at": {"$gte": last_30_days}})
    new_cases_7d = await db.cases.count_documents({"created_at": {"$gte": last_7_days}})
    
    # Case type distribution
    onboarding_count = await db.cases.count_documents({"case_type": "onboarding"})
    offboarding_count = await db.cases.count_documents({"case_type": "offboarding"})
    rolechange_count = await db.cases.count_documents({"case_type": "rolechange"})
    
    return {
        "totals": {
            "organizations": total_orgs,
            "users": total_users,
            "cases": total_cases,
            "templates": total_templates
        },
        "active": {
            "organizations": active_orgs,
            "users": active_users,
            "cases": active_cases
        },
        "licenses": {
            "total": total_licenses,
            "unused": unused_licenses,
            "active": active_licenses
        },
        "recent": {
            "new_orgs_30d": new_orgs_30d,
            "new_users_30d": new_users_30d,
            "new_cases_7d": new_cases_7d
        },
        "case_types": {
            "onboarding": onboarding_count,
            "offboarding": offboarding_count,
            "rolechange": rolechange_count
        },
        "generated_at": now.isoformat()
    }

@api_router.patch("/admin/licenses/{license_id}/expiry")
async def set_license_expiry(license_id: str, expiry_date: str, admin: dict = Depends(require_super_admin)):
    """Set expiry date for a license - Super-Admin only"""
    license_key = await db.license_keys.find_one({"id": license_id}, {"_id": 0})
    if not license_key:
        raise HTTPException(status_code=404, detail="Lizenz nicht gefunden")
    
    # Validate date format
    try:
        datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Ungültiges Datumsformat. Verwenden Sie ISO 8601 (z.B. 2025-12-31)")
    
    await db.license_keys.update_one({"id": license_id}, {"$set": {"expiry_date": expiry_date}})
    
    await log_audit(
        user=admin,
        action="update",
        resource_type="license",
        resource_id=license_id,
        resource_name=license_key.get("key"),
        details=f"Lizenz-Ablaufdatum gesetzt: {expiry_date}"
    )
    
    return {"message": f"Ablaufdatum auf {expiry_date} gesetzt", "license_id": license_id}

# ============ ORGANIZATION ADMIN FUNCTIONS (for company admins) ============

class OrgUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "user"  # user or admin
    department_id: Optional[str] = None

@api_router.post("/org/users")
async def create_org_user(user_data: OrgUserCreate, current_user: dict = Depends(require_admin)):
    """Create a new user in the current organization - Org Admin only"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="Diese E-Mail-Adresse ist bereits registriert")
    
    # Validate role
    if user_data.role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Rolle muss 'user' oder 'admin' sein")
    
    # Check user limit for organization
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    
    current_user_count = await db.users.count_documents({"organization_id": org_id})
    user_limit = org.get("user_limit", 10)
    
    if current_user_count >= user_limit:
        raise HTTPException(
            status_code=403, 
            detail=f"Benutzer-Limit erreicht ({current_user_count}/{user_limit}). Kontaktieren Sie den Support für ein Upgrade."
        )
    
    # Validate password
    if len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 8 Zeichen haben")
    
    # Create user
    new_user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "name": user_data.name,
        "hashed_password": pwd_context.hash(user_data.password),
        "password_hash": pwd_context.hash(user_data.password),
        "role": user_data.role,
        "department_id": user_data.department_id,
        "organization_id": org_id,
        "is_super_admin": False,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(new_user)
    
    await log_audit(
        user=current_user,
        action="create",
        resource_type="user",
        resource_id=new_user["id"],
        resource_name=user_data.email,
        details=f"Neuer Benutzer erstellt: {user_data.name} ({user_data.role})"
    )
    
    return {
        "message": f"Benutzer '{user_data.name}' erfolgreich erstellt",
        "user_id": new_user["id"],
        "email": user_data.email
    }

@api_router.get("/org/info")
async def get_org_info(current_user: dict = Depends(require_admin)):
    """Get organization info including user limit - Org Admin only"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    
    user_count = await db.users.count_documents({"organization_id": org_id})
    user_limit = org.get("user_limit", 10)
    
    return {
        "id": org["id"],
        "name": org["name"],
        "status": org.get("status", "active"),
        "user_count": user_count,
        "user_limit": user_limit,
        "created_at": org.get("created_at")
    }

@api_router.patch("/org/users/{user_id}/role")
async def update_org_user_role(user_id: str, role: str, current_user: dict = Depends(require_admin)):
    """Change role of a user in the organization - Org Admin only"""
    if role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Rolle muss 'user' oder 'admin' sein")
    
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    if user.get("organization_id") != org_id:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diesen Benutzer")
    
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=400, detail="Eigene Rolle kann nicht geändert werden")
    
    old_role = user.get("role")
    await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    
    await log_audit(
        user=current_user,
        action="update",
        resource_type="user",
        resource_id=user_id,
        resource_name=user.get("email"),
        details=f"Benutzer-Rolle geändert: {old_role} -> {role}",
        old_value=old_role,
        new_value=role
    )
    
    return {"message": f"Benutzer-Rolle auf '{role}' geändert", "user_id": user_id}

@api_router.patch("/org/users/{user_id}/department")
async def change_user_department(user_id: str, department_id: Optional[str] = None, current_user: dict = Depends(require_admin)):
    """Change user's department - Org Admin only"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    if user.get("organization_id") != org_id:
        raise HTTPException(status_code=403, detail="Benutzer gehört nicht zu Ihrer Organisation")
    
    # Validate department exists if provided
    if department_id:
        dept = await db.departments.find_one({"id": department_id, "organization_id": org_id}, {"_id": 0})
        if not dept:
            raise HTTPException(status_code=404, detail="Abteilung nicht gefunden")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"department_id": department_id}}
    )
    
    await log_audit(
        user=current_user,
        action="update",
        resource_type="user",
        resource_id=user_id,
        resource_name=user.get("email"),
        details=f"Abteilung geändert: {department_id or 'Keine'}"
    )
    
    return {"message": "Abteilung erfolgreich geändert", "user_id": user_id}

@api_router.get("/org/users")
async def get_org_users(current_user: dict = Depends(require_admin)):
    """Get all users in the current organization - Org Admin only"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    users = await db.users.find(
        {"organization_id": org_id},
        {"_id": 0, "hashed_password": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(1000)
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1})
    org_name = org["name"] if org else "Unknown"
    
    # Get all departments for this org to map IDs to names
    departments = await db.departments.find({"organization_id": org_id}, {"_id": 0}).to_list(100)
    dept_map = {d["id"]: d["name"] for d in departments}
    
    for user in users:
        user["organization_name"] = org_name
        user["is_super_admin"] = user.get("is_super_admin", False)
        user["department_name"] = dept_map.get(user.get("department_id")) if user.get("department_id") else None
    
    return users

@api_router.post("/org/users/{user_id}/reset-password")
async def org_reset_user_password(user_id: str, new_password: str, current_user: dict = Depends(require_admin)):
    """Reset password for a user in the same organization - Org Admin only"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    # Ensure user belongs to same organization
    if user.get("organization_id") != org_id:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diesen Benutzer")
    
    # Cannot reset own password through this endpoint
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=400, detail="Eigenes Passwort über Profil-Einstellungen ändern")
    
    # Cannot reset admin password if not admin yourself
    if user.get("role") == "admin" and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Keine Berechtigung für Admin-Passwort")
    
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 8 Zeichen haben")
    
    hashed = get_password_hash(new_password)
    await db.users.update_one({"id": user_id}, {"$set": {"hashed_password": hashed, "password_hash": hashed}})
    
    await log_audit(
        user=current_user,
        action="update",
        resource_type="user",
        resource_id=user_id,
        resource_name=user.get("email"),
        details="Passwort durch Organisations-Admin zurückgesetzt"
    )
    
    return {"message": "Passwort erfolgreich zurückgesetzt", "user_id": user_id}

@api_router.patch("/org/users/{user_id}/status")
async def org_update_user_status(user_id: str, new_status: str, current_user: dict = Depends(require_admin)):
    """Block/Unblock a user in the same organization - Org Admin only"""
    if new_status not in ["active", "blocked"]:
        raise HTTPException(status_code=400, detail="Status muss 'active' oder 'blocked' sein")
    
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    if user.get("organization_id") != org_id:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diesen Benutzer")
    
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=400, detail="Eigenen Status kann nicht geändert werden")
    
    if user.get("role") == "admin" and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Keine Berechtigung für Admin-Status")
    
    old_status = user.get("status", "active")
    await db.users.update_one({"id": user_id}, {"$set": {"status": new_status}})
    
    await log_audit(
        user=current_user,
        action="update",
        resource_type="user",
        resource_id=user_id,
        resource_name=user.get("email"),
        details=f"Benutzer-Status geändert: {old_status} -> {new_status}",
        old_value=old_status,
        new_value=new_status
    )
    
    return {"message": f"Benutzer-Status auf '{new_status}' gesetzt", "user_id": user_id}

@api_router.delete("/org/users/{user_id}")
async def org_delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Delete a user from the organization - Org Admin only"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    if user.get("organization_id") != org_id:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diesen Benutzer")
    
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=400, detail="Eigenen Account kann nicht gelöscht werden")
    
    if user.get("role") == "admin":
        # Check if this is the last admin
        admin_count = await db.users.count_documents({"organization_id": org_id, "role": "admin"})
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Letzter Admin kann nicht gelöscht werden")
    
    await db.users.delete_one({"id": user_id})
    
    await log_audit(
        user=current_user,
        action="delete",
        resource_type="user",
        resource_id=user_id,
        resource_name=user.get("email"),
        details="Benutzer aus Organisation gelöscht"
    )
    
    return {"message": f"Benutzer '{user.get('email')}' erfolgreich gelöscht", "user_id": user_id}

# ============ AUTH ROUTES ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate, current_user: dict = Depends(require_admin)):
    """Register a new user within an organization - Admin only"""
    # Check user limit
    org = await db.organizations.find_one({"id": current_user["organization_id"]}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=400, detail="Organisation nicht gefunden")
    
    user_count = await db.users.count_documents({"organization_id": current_user["organization_id"]})
    if user_count >= org["user_limit"]:
        raise HTTPException(status_code=400, detail=f"Benutzer-Limit erreicht ({org['user_limit']})")
    
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    org_id = current_user["organization_id"]
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "organization_id": org_id,
        "is_super_admin": False,
        "hashed_password": get_password_hash(user_data.password),
        "created_at": now,
        "privacy_accepted_at": now,
        "data_processing_accepted_at": now
    }
    await db.users.insert_one(user_doc)
    
    # Audit Log
    await log_audit(
        user=current_user,
        action="create",
        resource_type="user",
        resource_id=user_id,
        resource_name=user_data.email,
        details=f"Neuer Benutzer registriert von {current_user['email']}"
    )
    
    # Record consent
    await db.consents.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "consent_type": "privacy_policy",
        "consented": True,
        "consented_at": now
    })
    
    token = create_access_token({"sub": user_id})
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_doc["role"],
            organization_id=org_id,
            organization_name=current_user["organization_name"],
            is_super_admin=False,
            created_at=now
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get("password_hash", user.get("hashed_password", ""))):
        # Log failed attempt (without user details for security)
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": "unknown",
            "user_email": credentials.email,
            "user_name": "Unknown",
            "action": "login_failed",
            "resource_type": "auth",
            "details": "Fehlgeschlagener Login-Versuch"
        })
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    # Check if user is blocked
    if user.get("status") == "blocked":
        raise HTTPException(status_code=403, detail="Ihr Konto wurde gesperrt. Kontaktieren Sie Ihren Administrator.")
    
    # Check if organization is suspended (unless super admin)
    if not user.get("is_super_admin") and user.get("organization_id"):
        org = await db.organizations.find_one({"id": user["organization_id"]}, {"_id": 0})
        if org and org.get("status") in ["suspended", "inactive"]:
            raise HTTPException(status_code=403, detail="Ihre Organisation wurde deaktiviert. Kontaktieren Sie den Support.")
    
    # Get organization info
    org_name = "Unknown"
    if user.get("organization_id"):
        org = await db.organizations.find_one({"id": user["organization_id"]}, {"_id": 0, "name": 1})
        org_name = org["name"] if org else "Unknown"
    
    # Audit Log
    await log_audit(
        user=user,
        action="login",
        resource_type="auth",
        details="Erfolgreicher Login"
    )
    
    token = create_access_token({"sub": user["id"]})
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            organization_id=user.get("organization_id", ""),
            organization_name=org_name,
            is_super_admin=user.get("is_super_admin", False),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ============ USERS ROUTES ============

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    await log_audit(user=current_user, action="access", resource_type="user", details="Benutzerliste abgerufen")
    users = await db.users.find({}, {"_id": 0, "password_hash": 0, "hashed_password": 0}).to_list(1000)
    
    # Fix missing organization info for each user
    for user in users:
        if not user.get("organization_id"):
            user["organization_id"] = ""
            user["organization_name"] = "Super Admin" if user.get("is_super_admin") else "Unknown"
        elif not user.get("organization_name"):
            # Fetch organization name if missing
            org = await db.organizations.find_one({"id": user["organization_id"]}, {"_id": 0, "name": 1})
            user["organization_name"] = org["name"] if org else "Unknown"
        
        # Ensure is_super_admin field exists
        if "is_super_admin" not in user:
            user["is_super_admin"] = False
    
    return [UserResponse(**u) for u in users]

@api_router.patch("/users/{user_id}")
async def update_user(user_id: str, role: str, admin: dict = Depends(require_admin)):
    if role not in ["admin", "manager", "owner", "readonly"]:
        raise HTTPException(status_code=400, detail="Ungültige Rolle")
    
    old_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    old_role = old_user.get("role") if old_user else None
    
    await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    
    await log_audit(
        user=admin,
        action="update",
        resource_type="user",
        resource_id=user_id,
        resource_name=old_user.get("email") if old_user else None,
        details="Benutzerrolle geändert",
        old_value=old_role,
        new_value=role
    )
    
    return {"message": "Benutzer aktualisiert"}

# ============ OWNER ROLES ROUTES ============

@api_router.get("/owner-roles", response_model=List[OwnerRoleResponse])
async def get_owner_roles(current_user: dict = Depends(get_current_user)):
    query = get_org_filter(current_user)
    roles = await db.owner_roles.find(query, {"_id": 0}).to_list(100)
    return [OwnerRoleResponse(**r) for r in roles]

@api_router.post("/owner-roles", response_model=OwnerRoleResponse)
async def create_owner_role(data: OwnerRoleCreate, admin: dict = Depends(require_admin)):
    role_id = str(uuid.uuid4())
    doc = {
        "id": role_id,
        "name": data.name,
        "emails": data.emails,
        "department_id": data.department_id,
        "organization_id": admin["organization_id"]
    }
    await db.owner_roles.insert_one(doc)
    return OwnerRoleResponse(**doc)

@api_router.put("/owner-roles/{role_id}", response_model=OwnerRoleResponse)
async def update_owner_role(role_id: str, data: OwnerRoleCreate, admin: dict = Depends(require_admin)):
    query = {"id": role_id, **get_org_filter(admin)}
    await db.owner_roles.update_one(query, {"$set": {"name": data.name, "emails": data.emails, "department_id": data.department_id}})
    updated = await db.owner_roles.find_one(query, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")
    return OwnerRoleResponse(**updated)

@api_router.delete("/owner-roles/{role_id}")
async def delete_owner_role(role_id: str, admin: dict = Depends(require_admin)):
    query = {"id": role_id, **get_org_filter(admin)}
    result = await db.owner_roles.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")
    return {"message": "Gelöscht"}

# ============ CATEGORIES ROUTES ============

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(current_user: dict = Depends(get_current_user)):
    query = get_org_filter(current_user)
    categories = await db.categories.find(query, {"_id": 0}).to_list(100)
    return [CategoryResponse(**c) for c in categories]

@api_router.post("/categories", response_model=CategoryResponse)
async def create_category(data: CategoryCreate, admin: dict = Depends(require_admin)):
    category_id = str(uuid.uuid4())
    doc = {
        "id": category_id,
        "name": data.name,
        "color": data.color,
        "organization_id": admin["organization_id"]
    }
    await db.categories.insert_one(doc)
    return CategoryResponse(**doc)

@api_router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, data: CategoryCreate, admin: dict = Depends(require_admin)):
    query = {"id": category_id, **get_org_filter(admin)}
    await db.categories.update_one(query, {"$set": {"name": data.name, "color": data.color}})
    updated = await db.categories.find_one(query, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    return CategoryResponse(**updated)

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, admin: dict = Depends(require_admin)):
    query = {"id": category_id, **get_org_filter(admin)}
    result = await db.categories.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    return {"message": "Gelöscht"}

# ============ DEPARTMENTS ROUTES ============

@api_router.get("/departments", response_model=List[DepartmentResponse])
async def get_departments(current_user: dict = Depends(get_current_user)):
    query = get_org_filter(current_user)
    departments = await db.departments.find(query, {"_id": 0}).to_list(100)
    return [DepartmentResponse(**d) for d in departments]

@api_router.post("/departments", response_model=DepartmentResponse)
async def create_department(data: DepartmentCreate, admin: dict = Depends(require_admin)):
    department_id = str(uuid.uuid4())
    doc = {
        "id": department_id,
        "name": data.name,
        "color": data.color,
        "organization_id": admin["organization_id"]
    }
    await db.departments.insert_one(doc)
    return DepartmentResponse(**doc)

@api_router.put("/departments/{department_id}", response_model=DepartmentResponse)
async def update_department(department_id: str, data: DepartmentCreate, admin: dict = Depends(require_admin)):
    query = {"id": department_id, **get_org_filter(admin)}
    await db.departments.update_one(query, {"$set": {"name": data.name, "color": data.color}})
    updated = await db.departments.find_one(query, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Abteilung nicht gefunden")
    return DepartmentResponse(**updated)

@api_router.delete("/departments/{department_id}")
async def delete_department(department_id: str, admin: dict = Depends(require_admin)):
    query = {"id": department_id, **get_org_filter(admin)}
    result = await db.departments.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Abteilung nicht gefunden")
    return {"message": "Gelöscht"}


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
                {"id": str(uuid.uuid4()), "title": "Laptop bereitstellen", "description": "MacBook/Windows nach Präferenz", "category": "IT", "owner_role": "IT", "offset_days": 3, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "E-Mail Account erstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 2, "evidence_required": False, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "GitHub/GitLab Zugang", "description": "Repository-Zugriff einrichten", "category": "IT", "owner_role": "IT", "offset_days": 1, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "VPN Zugang einrichten", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Arbeitsplatz vorbereiten", "description": "Schreibtisch, Stuhl, Monitor", "category": "Admin", "owner_role": "Office", "offset_days": 1, "evidence_required": False, "sort_order": 5},
                {"id": str(uuid.uuid4()), "title": "Welcome Pack", "description": "Firmenmaterial überreichen", "category": "Admin", "owner_role": "HR", "offset_days": 0, "evidence_required": False, "sort_order": 6},
                {"id": str(uuid.uuid4()), "title": "Onboarding-Meeting planen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 0, "evidence_required": False, "sort_order": 7},
                {"id": str(uuid.uuid4()), "title": "Buddy zuweisen", "description": "Mentor für erste Wochen", "category": "Manager", "owner_role": "Manager", "offset_days": 0, "evidence_required": False, "sort_order": 8},
                {"id": str(uuid.uuid4()), "title": "IDE & Tools Setup", "description": "VS Code, Docker, etc.", "category": "IT", "owner_role": "IT", "offset_days": 1, "evidence_required": False, "sort_order": 9},
                {"id": str(uuid.uuid4()), "title": "Erste Ziele definieren", "description": "30/60/90 Tage Plan", "category": "Manager", "owner_role": "Manager", "offset_days": -7, "evidence_required": False, "sort_order": 10},
            ]
        },
        {
            "id": str(uuid.uuid4()), "name": "Sales", "description": "Onboarding für Vertriebsmitarbeiter",
            "template_type": "onboarding",
            "created_at": now, "updated_at": now,
            "tasks": [
                {"id": str(uuid.uuid4()), "title": "Laptop bereitstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 3, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "E-Mail Account erstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 2, "evidence_required": False, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "CRM Zugang (Salesforce/HubSpot)", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 1, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "Telefon einrichten", "description": "VoIP oder Mobiltelefon", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Visitenkarten bestellen", "description": "", "category": "Admin", "owner_role": "Office", "offset_days": 5, "evidence_required": False, "sort_order": 5},
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
                {"id": str(uuid.uuid4()), "title": "Laptop bereitstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 3, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "E-Mail Account erstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 2, "evidence_required": False, "sort_order": 2},
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
                {"id": str(uuid.uuid4()), "title": "Laptop bereitstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 3, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "E-Mail Account erstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 2, "evidence_required": False, "sort_order": 2},
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
                {"id": str(uuid.uuid4()), "title": "Laptop bereitstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 3, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "E-Mail Account erstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 2, "evidence_required": False, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "Ticketsystem Zugang (Zendesk/Freshdesk)", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "Headset bereitstellen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 1, "evidence_required": False, "sort_order": 4},
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
                {"id": str(uuid.uuid4()), "title": "Praktikumsvertrag", "description": "", "category": "Admin", "owner_role": "HR", "offset_days": 5, "evidence_required": True, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "Betreuer zuweisen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 3, "evidence_required": False, "sort_order": 4},
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
                {"id": str(uuid.uuid4()), "title": "Wissenstransfer dokumentieren", "description": "Übergabedokumentation erstellen", "category": "Manager", "owner_role": "Manager", "offset_days": 5, "evidence_required": True, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "Nachfolger einarbeiten", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 3, "evidence_required": False, "sort_order": 3},
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
                {"id": str(uuid.uuid4()), "title": "Alle Passwörter ändern", "description": "Shared Accounts, Adminzugänge", "category": "Security", "owner_role": "Security", "offset_days": 3, "evidence_required": True, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "SSH-Keys entfernen", "description": "Aus allen Servern entfernen", "category": "IT", "owner_role": "IT", "offset_days": 2, "evidence_required": True, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "Code-Review offener PRs", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 2, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "GitHub/GitLab Zugang entfernen", "description": "", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": True, "sort_order": 4},
                {"id": str(uuid.uuid4()), "title": "Cloud-Konsolen Zugang sperren", "description": "AWS, Azure, GCP", "category": "Security", "owner_role": "Security", "offset_days": 0, "evidence_required": True, "sort_order": 5},
                {"id": str(uuid.uuid4()), "title": "API-Keys rotieren", "description": "Alle vom MA erstellten Keys", "category": "Security", "owner_role": "Security", "offset_days": 0, "evidence_required": True, "sort_order": 6},
                {"id": str(uuid.uuid4()), "title": "Laptop einsammeln und löschen", "description": "Sichere Datenlöschung", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": True, "sort_order": 7},
                {"id": str(uuid.uuid4()), "title": "Dokumentation aktualisieren", "description": "Wiki, Runbooks updaten", "category": "IT", "owner_role": "IT", "offset_days": 0, "evidence_required": False, "sort_order": 8},
                {"id": str(uuid.uuid4()), "title": "On-Call Rotation anpassen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 1, "evidence_required": False, "sort_order": 9},
                {"id": str(uuid.uuid4()), "title": "Security-Audit durchführen", "description": "Prüfen ob alle Zugänge entfernt", "category": "Security", "owner_role": "Security", "offset_days": 1, "evidence_required": True, "sort_order": 10},
            ]
        },
        {
            "id": str(uuid.uuid4()), "name": "Führungskraft Offboarding", "description": "Offboarding für Manager und Führungskräfte",
            "template_type": "offboarding",
            "created_at": now, "updated_at": now,
            "tasks": [
                {"id": str(uuid.uuid4()), "title": "Nachfolger kommunizieren", "description": "Intern und extern", "category": "Manager", "owner_role": "HR", "offset_days": 14, "evidence_required": False, "sort_order": 1},
                {"id": str(uuid.uuid4()), "title": "Team-Übergabe planen", "description": "", "category": "Manager", "owner_role": "Manager", "offset_days": 10, "evidence_required": True, "sort_order": 2},
                {"id": str(uuid.uuid4()), "title": "Kundenkontakte übergeben", "description": "Wichtige Kontakte vorstellen", "category": "Manager", "owner_role": "Manager", "offset_days": -7, "evidence_required": False, "sort_order": 3},
                {"id": str(uuid.uuid4()), "title": "Budget-Verantwortung übertragen", "description": "", "category": "Admin", "owner_role": "HR", "offset_days": 5, "evidence_required": True, "sort_order": 4},
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

# ============ AUDIT LOG ROUTES (DSGVO Art. 30) ============

@api_router.get("/audit-logs")
async def get_audit_logs(
    page: int = 1,
    page_size: int = 50,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    user_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    admin: dict = Depends(require_admin)
):
    """Get audit logs - Admin only (DSGVO Art. 30 - Verzeichnis von Verarbeitungstätigkeiten)"""
    query = {}
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type
    if user_id:
        query["user_id"] = user_id
    if from_date:
        query["timestamp"] = {"$gte": from_date}
    if to_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = to_date
        else:
            query["timestamp"] = {"$lte": to_date}
    
    total = await db.audit_logs.count_documents(query)
    skip = (page - 1) * page_size
    
    entries = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(page_size).to_list(page_size)
    
    await log_audit(user=admin, action="access", resource_type="audit_log", details=f"Audit-Log abgerufen (Seite {page})")
    
    return {
        "entries": entries,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@api_router.get("/audit-logs/export")
async def export_audit_logs(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    admin: dict = Depends(require_admin)
):
    """Export audit logs as CSV (DSGVO Art. 30)"""
    query = {}
    if from_date:
        query["timestamp"] = {"$gte": from_date}
    if to_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = to_date
        else:
            query["timestamp"] = {"$lte": to_date}
    
    entries = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(10000)
    
    # Create CSV
    import csv
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Zeitstempel", "Benutzer", "E-Mail", "Aktion", "Ressource-Typ", "Ressource-ID", "Details", "Alter Wert", "Neuer Wert"])
    for e in entries:
        writer.writerow([
            e.get("timestamp", ""),
            e.get("user_name", ""),
            e.get("user_email", ""),
            e.get("action", ""),
            e.get("resource_type", ""),
            e.get("resource_id", ""),
            e.get("details", ""),
            e.get("old_value", ""),
            e.get("new_value", "")
        ])
    
    await log_audit(user=admin, action="export", resource_type="audit_log", details="Audit-Log exportiert")
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audit_log_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"}
    )

# ============ CONTACT/SALES ROUTES ============

@api_router.post("/contact/sales")
async def submit_sales_contact(data: SalesContactRequest, background_tasks: BackgroundTasks):
    """Submit a sales contact request - sends email notification"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Store the request in database
    contact_request = {
        "id": str(uuid.uuid4()),
        "company": data.company,
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "employees": data.employees,
        "message": data.message,
        "status": "new",
        "created_at": now
    }
    
    await db.contact_requests.insert_one(contact_request)
    
    # Send email notification in background
    background_tasks.add_task(send_sales_notification_email, contact_request)
    
    logger.info(f"New sales contact request from {data.company} ({data.email})")
    
    return {"message": "Anfrage erfolgreich gesendet", "id": contact_request["id"]}

async def send_sales_notification_email(contact_data: dict):
    """Send email notification for new sales contact - using Resend"""
    import resend
    
    # Email settings
    SALES_EMAIL = "jesse@haemmerle.at"
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
    SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    
    if not RESEND_API_KEY or RESEND_API_KEY == "re_test_placeholder":
        # Resend not configured - just log the request
        logger.info(f"Resend not configured. Sales contact saved: {contact_data['company']} - {contact_data['email']}")
        return
    
    resend.api_key = RESEND_API_KEY
    
    # HTML email content
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">⚡ OnboardIQ</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">Neue Vertriebsanfrage</p>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Unternehmen:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{contact_data['company']}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Name:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{contact_data['name']}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>E-Mail:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><a href="mailto:{contact_data['email']}" style="color: #2563eb;">{contact_data['email']}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Telefon:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{contact_data.get('phone', '-')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Mitarbeiter:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{contact_data.get('employees', '-')}</td>
                    </tr>
                </table>
                <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <strong>Nachricht:</strong>
                    <p style="margin: 10px 0 0 0; white-space: pre-wrap;">{contact_data.get('message', '-')}</p>
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #64748b;">
                    Eingegangen am: {contact_data['created_at']}
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        # Send email via Resend (run sync SDK in thread)
        params = {
            "from": SENDER_EMAIL,
            "to": [SALES_EMAIL],
            "subject": f"[OnboardIQ] Neue Vertriebsanfrage von {contact_data['company']}",
            "html": html
        }
        
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        
        logger.info(f"Sales notification email sent for {contact_data['company']}, id: {email_result.get('id', 'unknown')}")
        
        # Update status in database
        await db.contact_requests.update_one(
            {"id": contact_data["id"]},
            {"$set": {"status": "email_sent", "email_sent_at": datetime.now(timezone.utc).isoformat(), "resend_email_id": email_result.get('id')}}
        )
        
    except Exception as e:
        logger.error(f"Failed to send sales notification email: {e}")
        await db.contact_requests.update_one(
            {"id": contact_data["id"]},
            {"$set": {"status": "email_failed", "email_error": str(e)}}
        )

@api_router.get("/contact/requests")
async def get_contact_requests(admin: dict = Depends(require_super_admin)):
    """Get all contact requests - Super Admin only"""
    requests = await db.contact_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

# ============ DSGVO/GDPR ROUTES ============

@api_router.get("/gdpr/my-data")
async def get_my_data(current_user: dict = Depends(get_current_user)):
    """DSGVO Art. 15 - Auskunftsrecht: Alle Daten des Benutzers abrufen"""
    user_id = current_user["id"]
    user_email = current_user["email"]
    
    # Collect all user data
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    
    # Cases created by user
    cases_created = await db.cases.find({"created_by": user_id}, {"_id": 0}).to_list(1000)
    
    # Tasks assigned to user
    tasks_assigned = await db.tasks.find({"owner_email": user_email}, {"_id": 0}).to_list(1000)
    
    # Comments by user
    comments = await db.task_comments.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    
    # Evidence uploaded by user
    evidence = await db.evidence.find({"uploaded_by": user_email}, {"_id": 0, "file_data": 0}).to_list(1000)
    
    # Consents
    consents = await db.consents.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    
    # Audit logs related to user
    audit_logs = await db.audit_logs.find({"user_id": user_id}, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)
    
    await log_audit(user=current_user, action="export", resource_type="personal_data", details="Eigene Daten abgerufen (DSGVO Art. 15)")
    
    return {
        "user": user_data,
        "cases_created": cases_created,
        "tasks_assigned": tasks_assigned,
        "comments": comments,
        "evidence_uploaded": evidence,
        "consents": consents,
        "recent_activities": audit_logs,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "data_categories": [
            {"category": "Stammdaten", "description": "Name, E-Mail, Rolle"},
            {"category": "Nutzungsdaten", "description": "Erstellte Onboardings, zugewiesene Tasks"},
            {"category": "Kommunikation", "description": "Kommentare zu Tasks"},
            {"category": "Nachweise", "description": "Hochgeladene Dateien"},
            {"category": "Protokolldaten", "description": "Login-Aktivitäten, Änderungen"}
        ]
    }

@api_router.get("/gdpr/export")
async def export_my_data(format: str = "json", current_user: dict = Depends(get_current_user)):
    """DSGVO Art. 20 - Datenübertragbarkeit: Daten in portablem Format exportieren"""
    data = await get_my_data(current_user)
    
    await log_audit(user=current_user, action="export", resource_type="personal_data", details=f"Datenexport im Format {format} (DSGVO Art. 20)")
    
    if format == "json":
        import json
        content = json.dumps(data, indent=2, ensure_ascii=False, default=str)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=meine_daten_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"}
        )
    else:
        # CSV export
        import csv
        output = io.StringIO()
        writer = csv.writer(output)
        
        # User data
        writer.writerow(["=== STAMMDATEN ==="])
        writer.writerow(["Feld", "Wert"])
        if data.get("user"):
            for key, value in data["user"].items():
                writer.writerow([key, value])
        
        writer.writerow([])
        writer.writerow(["=== ERSTELLTE ONBOARDINGS ==="])
        if data.get("cases_created"):
            writer.writerow(["ID", "Mitarbeiter", "E-Mail", "Template", "Status", "Erstellt am"])
            for c in data["cases_created"]:
                writer.writerow([c.get("id"), c.get("employee_name"), c.get("employee_email"), c.get("template_name_snapshot"), c.get("status"), c.get("created_at")])
        
        writer.writerow([])
        writer.writerow(["=== ZUGEWIESENE TASKS ==="])
        if data.get("tasks_assigned"):
            writer.writerow(["ID", "Titel", "Status", "Fällig", "Erstellt am"])
            for t in data["tasks_assigned"]:
                writer.writerow([t.get("id"), t.get("title"), t.get("status"), t.get("due_date"), t.get("created_at")])
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=meine_daten_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"}
        )

@api_router.post("/gdpr/delete-request")
async def request_data_deletion(request: DataDeletionRequest, current_user: dict = Depends(get_current_user)):
    """DSGVO Art. 17 - Recht auf Löschung: Löschantrag stellen"""
    if not request.confirm:
        raise HTTPException(status_code=400, detail="Bitte bestätigen Sie den Löschantrag")
    
    user_id = current_user["id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Create deletion request
    deletion_request = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_email": current_user["email"],
        "user_name": current_user["name"],
        "requested_at": now,
        "reason": request.reason,
        "status": "pending",  # pending, approved, completed, rejected
        "processed_at": None,
        "processed_by": None
    }
    await db.deletion_requests.insert_one(deletion_request)
    
    await log_audit(
        user=current_user,
        action="create",
        resource_type="deletion_request",
        resource_id=deletion_request["id"],
        details=f"Löschantrag gestellt (DSGVO Art. 17). Grund: {request.reason or 'Nicht angegeben'}"
    )
    
    return {
        "message": "Löschantrag eingereicht",
        "request_id": deletion_request["id"],
        "status": "pending",
        "info": "Ein Administrator wird Ihren Antrag innerhalb von 30 Tagen bearbeiten (DSGVO Art. 12 Abs. 3)"
    }

@api_router.get("/gdpr/deletion-requests")
async def get_deletion_requests(admin: dict = Depends(require_admin)):
    """Admin: Alle Löschanträge abrufen"""
    requests = await db.deletion_requests.find({}, {"_id": 0}).sort("requested_at", -1).to_list(100)
    return requests

@api_router.post("/gdpr/deletion-requests/{request_id}/process")
async def process_deletion_request(request_id: str, action: str, admin: dict = Depends(require_admin)):
    """Admin: Löschantrag bearbeiten"""
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Ungültige Aktion")
    
    deletion_req = await db.deletion_requests.find_one({"id": request_id}, {"_id": 0})
    if not deletion_req:
        raise HTTPException(status_code=404, detail="Löschantrag nicht gefunden")
    
    now = datetime.now(timezone.utc).isoformat()
    
    if action == "approve":
        user_id = deletion_req["user_id"]
        user_email = deletion_req["user_email"]
        
        # Anonymize user data instead of hard delete (for audit trail)
        anonymized_name = f"Gelöschter Benutzer {user_id[:8]}"
        anonymized_email = f"deleted_{user_id[:8]}@anonymized.local"
        
        # Update user
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "name": anonymized_name,
                "email": anonymized_email,
                "role": "deleted",
                "password_hash": "",
                "deleted_at": now,
                "deleted_reason": deletion_req.get("reason")
            }}
        )
        
        # Anonymize comments
        await db.task_comments.update_many(
            {"user_id": user_id},
            {"$set": {"user_name": anonymized_name, "user_email": anonymized_email}}
        )
        
        # Delete evidence files (actual data)
        await db.evidence.delete_many({"uploaded_by": user_email})
        
        # Anonymize audit logs
        await db.audit_logs.update_many(
            {"user_id": user_id},
            {"$set": {"user_name": anonymized_name, "user_email": anonymized_email}}
        )
        
        # Update deletion request
        await db.deletion_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "completed", "processed_at": now, "processed_by": admin["email"]}}
        )
        
        await log_audit(
            user=admin,
            action="delete",
            resource_type="user",
            resource_id=user_id,
            details="Löschantrag genehmigt und Daten anonymisiert (DSGVO Art. 17)"
        )
        
        return {"message": "Benutzerdaten wurden anonymisiert", "status": "completed"}
    
    else:  # reject
        await db.deletion_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "rejected", "processed_at": now, "processed_by": admin["email"]}}
        )
        
        await log_audit(
            user=admin,
            action="update",
            resource_type="deletion_request",
            resource_id=request_id,
            details="Löschantrag abgelehnt"
        )
        
        return {"message": "Löschantrag wurde abgelehnt", "status": "rejected"}

@api_router.get("/gdpr/consents")
async def get_my_consents(current_user: dict = Depends(get_current_user)):
    """DSGVO Art. 7 - Einwilligungen des Benutzers abrufen"""
    consents = await db.consents.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return consents

@api_router.post("/gdpr/consents/{consent_type}/revoke")
async def revoke_consent(consent_type: str, current_user: dict = Depends(get_current_user)):
    """DSGVO Art. 7 Abs. 3 - Einwilligung widerrufen"""
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.consents.update_one(
        {"user_id": current_user["id"], "consent_type": consent_type, "revoked_at": None},
        {"$set": {"revoked_at": now}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Einwilligung nicht gefunden oder bereits widerrufen")
    
    await log_audit(
        user=current_user,
        action="update",
        resource_type="consent",
        details=f"Einwilligung widerrufen: {consent_type} (DSGVO Art. 7 Abs. 3)"
    )
    
    return {"message": f"Einwilligung '{consent_type}' wurde widerrufen"}

@api_router.delete("/gdpr/delete-account")
async def delete_my_account(confirm: bool = False, current_user: dict = Depends(get_current_user)):
    """DSGVO Art. 17 - Recht auf Löschung: Account und alle Daten sofort löschen"""
    if not confirm:
        raise HTTPException(status_code=400, detail="Bitte bestätigen Sie die Löschung mit confirm=true")
    
    user_id = current_user["id"]
    user_email = current_user["email"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if user is the only admin in their organization
    org_id = current_user.get("organization_id")
    if org_id and current_user.get("role") == "admin":
        admin_count = await db.users.count_documents({"organization_id": org_id, "role": "admin", "id": {"$ne": user_id}})
        if admin_count == 0:
            raise HTTPException(
                status_code=400, 
                detail="Sie sind der einzige Administrator dieser Organisation. Bitte ernennen Sie zuerst einen anderen Administrator oder kontaktieren Sie den Support."
            )
    
    # Anonymize user data instead of hard delete (for audit trail)
    anonymized_name = f"Gelöschter Benutzer {user_id[:8]}"
    anonymized_email = f"deleted_{user_id[:8]}@anonymized.local"
    
    # Update user to anonymized state
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "name": anonymized_name,
            "email": anonymized_email,
            "role": "deleted",
            "password_hash": "",
            "hashed_password": "",
            "deleted_at": now,
            "deleted_by": "self"
        }}
    )
    
    # Anonymize comments
    await db.task_comments.update_many(
        {"user_id": user_id},
        {"$set": {"user_name": anonymized_name, "user_email": anonymized_email}}
    )
    
    # Delete evidence files (actual data)
    await db.evidence.delete_many({"uploaded_by": user_email})
    
    # Anonymize audit logs
    await db.audit_logs.update_many(
        {"user_id": user_id},
        {"$set": {"user_name": anonymized_name, "user_email": anonymized_email}}
    )
    
    # Delete consents
    await db.consents.delete_many({"user_id": user_id})
    
    await log_audit(
        user={"id": user_id, "email": anonymized_email, "name": anonymized_name},
        action="delete",
        resource_type="user",
        resource_id=user_id,
        details="Account selbst gelöscht (DSGVO Art. 17)"
    )
    
    return {
        "message": "Ihr Account wurde erfolgreich gelöscht",
        "info": "Ihre personenbezogenen Daten wurden anonymisiert. Für statistische Zwecke wurden einige anonymisierte Daten beibehalten."
    }

@api_router.post("/gdpr/consents")
async def save_consent(consent_type: str, granted: bool = True, current_user: dict = Depends(get_current_user)):
    """DSGVO Art. 7 - Einwilligung speichern"""
    now = datetime.now(timezone.utc).isoformat()
    
    consent = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "consent_type": consent_type,
        "granted": granted,
        "granted_at": now if granted else None,
        "revoked_at": None if granted else now,
        "ip_address": None,  # Optional: could capture IP
        "user_agent": None   # Optional: could capture user agent
    }
    
    # Upsert consent
    await db.consents.update_one(
        {"user_id": current_user["id"], "consent_type": consent_type},
        {"$set": consent},
        upsert=True
    )
    
    await log_audit(
        user=current_user,
        action="create" if granted else "revoke",
        resource_type="consent",
        details=f"Einwilligung {'erteilt' if granted else 'verweigert'}: {consent_type}"
    )
    
    return {"message": f"Einwilligung für '{consent_type}' wurde {'erteilt' if granted else 'verweigert'}"}

@api_router.get("/gdpr/privacy-info")
async def get_privacy_info():
    """DSGVO Art. 13/14 - Datenschutzinformationen"""
    settings = await db.settings.find_one({}, {"_id": 0})
    
    return {
        "data_controller": {
            "name": settings.get("org_name", "Meine Firma") if settings else "Meine Firma",
            "dpo_email": settings.get("dpo_email", "") if settings else ""
        },
        "data_categories": [
            {"category": "Stammdaten", "description": "Name, E-Mail-Adresse, Rolle", "retention": "Bis zur Löschung des Kontos", "legal_basis": "Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)"},
            {"category": "Onboarding-Daten", "description": "Mitarbeiterdaten, Startdatum, Standort", "retention": "3 Jahre nach Abschluss", "legal_basis": "Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO)"},
            {"category": "Aufgabendaten", "description": "Task-Status, Kommentare, Nachweise", "retention": "3 Jahre nach Abschluss", "legal_basis": "Vertragserfüllung"},
            {"category": "Protokolldaten", "description": "Login-Zeiten, Änderungshistorie", "retention": "1 Jahr", "legal_basis": "Berechtigtes Interesse (Sicherheit)"}
        ],
        "rights": [
            {"right": "Auskunftsrecht", "article": "Art. 15 DSGVO", "description": "Sie können jederzeit Auskunft über Ihre gespeicherten Daten verlangen."},
            {"right": "Berichtigungsrecht", "article": "Art. 16 DSGVO", "description": "Sie können die Berichtigung unrichtiger Daten verlangen."},
            {"right": "Löschungsrecht", "article": "Art. 17 DSGVO", "description": "Sie können die Löschung Ihrer Daten verlangen."},
            {"right": "Einschränkung der Verarbeitung", "article": "Art. 18 DSGVO", "description": "Sie können die Einschränkung der Verarbeitung verlangen."},
            {"right": "Datenübertragbarkeit", "article": "Art. 20 DSGVO", "description": "Sie können Ihre Daten in einem portablen Format erhalten."},
            {"right": "Widerspruchsrecht", "article": "Art. 21 DSGVO", "description": "Sie können der Verarbeitung widersprechen."},
            {"right": "Beschwerderecht", "article": "Art. 77 DSGVO", "description": "Sie können sich bei einer Aufsichtsbehörde beschweren."}
        ],
        "data_retention": {
            "default_days": settings.get("data_retention_days", 1095) if settings else 1095,
            "description": "Daten werden nach der angegebenen Zeit automatisch gelöscht oder anonymisiert."
        }
    }

# Import and include modular routers BEFORE adding to app
try:
    from .routers.billing import check_limit, router as billing_router
    from .routers.tasks import router as tasks_router
    from .routers.cases_routes import router as cases_router
    from .routers.templates_routes import router as templates_router
    from .routers.analytics import router as analytics_router
    from .routers.webhooks import router as webhooks_router
    from .routers.notifications import daily_reminder_job
except ImportError:  # pragma: no cover - fallback for direct module execution
    from routers.billing import check_limit, router as billing_router  # type: ignore
    from routers.tasks import router as tasks_router  # type: ignore
    from routers.cases_routes import router as cases_router  # type: ignore
    from routers.templates_routes import router as templates_router  # type: ignore
    from routers.analytics import router as analytics_router  # type: ignore
    from routers.webhooks import router as webhooks_router  # type: ignore
    from routers.notifications import daily_reminder_job  # type: ignore

api_router.include_router(tasks_router)
api_router.include_router(billing_router)
api_router.include_router(cases_router)
api_router.include_router(templates_router)
api_router.include_router(analytics_router)
api_router.include_router(webhooks_router)

# Include main router with all routes
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
