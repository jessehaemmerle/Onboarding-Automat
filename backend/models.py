"""Shared Pydantic models for OnboardIQ API."""
from pydantic import BaseModel, EmailStr
from typing import List, Optional


# ===== LICENSE & ORGANIZATION =====

class LicenseKeyCreate(BaseModel):
    count: int = 1
    user_limit: int = 10
    notes: str = ""

class LicenseKeyResponse(BaseModel):
    id: str
    key: str
    status: str
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


# ===== USERS =====

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "owner"
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

class OrgUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "user"
    department_id: Optional[str] = None


# ===== ROLES / CATEGORIES / DEPARTMENTS =====

class OwnerRoleBase(BaseModel):
    name: str
    emails: List[str]
    department_id: Optional[str] = None

class OwnerRoleCreate(OwnerRoleBase):
    pass

class OwnerRoleResponse(OwnerRoleBase):
    id: str
    department_id: Optional[str] = None

class CategoryBase(BaseModel):
    name: str
    color: str = "#3b82f6"

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: str

class DepartmentBase(BaseModel):
    name: str
    color: str = "#3b82f6"

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: str


# ===== TEMPLATES =====

class TemplateTaskBase(BaseModel):
    id: Optional[str] = None
    title: str
    description: str = ""
    category: str
    owner_role: str
    offset_days: int = 0
    evidence_required: bool = False
    sort_order: int = 0
    depends_on: Optional[str] = None

class TemplateBase(BaseModel):
    name: str
    description: str = ""
    template_type: str = "onboarding"

class TemplateCreate(TemplateBase):
    tasks: List[TemplateTaskBase] = []

class TemplateTaskResponse(TemplateTaskBase):
    id: str

class TemplateResponse(TemplateBase):
    id: str
    tasks: List[TemplateTaskResponse]
    created_at: str
    updated_at: str


# ===== CASES & TASKS =====

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
    start_date: str
    location: str = ""
    manager_email: EmailStr
    case_type: str = "onboarding"
    linked_case_id: Optional[str] = None
    new_role: Optional[str] = None
    old_role: Optional[str] = None

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
    depends_on: Optional[str] = None
    is_blocked: bool = False

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
    case_type: str = "onboarding"
    start_date: str
    location: str
    manager_email: str
    status: str
    linked_case_id: Optional[str] = None
    new_role: Optional[str] = None
    old_role: Optional[str] = None
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


# ===== SETTINGS =====

class OrgSettingsBase(BaseModel):
    org_name: str = "Meine Firma"
    org_timezone: str = "Europe/Berlin"
    reminder_days_before: int = 3
    reminder_days_after: int = 2
    data_retention_days: int = 365 * 3
    privacy_policy_url: str = ""
    dpo_email: str = ""

class OrgSettingsResponse(OrgSettingsBase):
    id: str


# ===== AUDIT LOG =====

class AuditLogEntry(BaseModel):
    id: str
    timestamp: str
    user_id: str
    user_email: str
    user_name: str
    action: str
    resource_type: str
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


# ===== CONTACT / DSGVO =====

class SalesContactRequest(BaseModel):
    company: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    employees: Optional[str] = None
    message: Optional[str] = None

class ConsentRecord(BaseModel):
    id: str
    user_id: str
    consent_type: str
    consented: bool
    consented_at: str
    ip_address: Optional[str] = None
    revoked_at: Optional[str] = None

class DataExportRequest(BaseModel):
    format: str = "json"

class DataDeletionRequest(BaseModel):
    confirm: bool
    reason: Optional[str] = None
