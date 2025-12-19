from pydantic import BaseModel, EmailStr
from typing import Optional, List

class LicenseKeyCreate(BaseModel):
    count: int = 1
    user_limit: int = 20
    expires_in_days: Optional[int] = 365

class LicenseKeyResponse(BaseModel):
    id: str
    key: str
    user_limit: int
    is_used: bool
    used_by_organization: Optional[str] = None
    expires_at: Optional[str] = None
    created_at: str

class OrganizationBase(BaseModel):
    name: str

class OrganizationCreate(OrganizationBase):
    license_key: str
    admin_email: EmailStr
    admin_password: str
    admin_name: str

class OrganizationResponse(OrganizationBase):
    id: str
    license_key: str
    user_count: int = 0
    user_limit: int = 20
    status: str = "active"
    created_at: str

class OrgUserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = "user"
    department_id: Optional[str] = None
