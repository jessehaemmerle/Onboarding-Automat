from pydantic import BaseModel, Field
from typing import List, Optional

class OwnerRoleBase(BaseModel):
    name: str
    emails: List[str] = []
    department_id: Optional[str] = None

class OwnerRoleCreate(OwnerRoleBase):
    pass

class OwnerRoleResponse(OwnerRoleBase):
    id: str

class CategoryBase(BaseModel):
    name: str
    color: str = "#3b82f6"

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: str

class DepartmentBase(BaseModel):
    name: str
    color: str = "#10b981"

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: str

class TemplateTaskBase(BaseModel):
    id: Optional[str] = None
    title: str
    description: str = ""
    category: str = ""
    owner_role: str
    offset_days: int = 0
    evidence_required: bool = False
    sort_order: int = 0
    depends_on: Optional[str] = None

class TemplateBase(BaseModel):
    name: str
    description: str = ""
    template_type: str = "onboarding"
    tasks: List[TemplateTaskBase] = []

class TemplateCreate(TemplateBase):
    pass

class TemplateTaskResponse(TemplateTaskBase):
    pass

class TemplateResponse(TemplateBase):
    id: str
    created_at: str
    created_by: str
    tasks: List[TemplateTaskResponse] = []

class OrgSettingsBase(BaseModel):
    company_logo: Optional[str] = None
    primary_color: str = "#3b82f6"
    email_notifications: bool = True
    task_reminders: bool = True
    reminder_days_before: int = 3
    data_retention_days: int = 1095
    audit_retention_days: int = 365

class OrgSettingsResponse(OrgSettingsBase):
    pass
