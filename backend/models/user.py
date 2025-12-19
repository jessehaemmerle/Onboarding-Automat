from pydantic import BaseModel, EmailStr
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "user"
    department_id: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: str
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    status: str = "active"
    is_super_admin: bool = False
    department_name: Optional[str] = None

class TokenResponse(BaseModel):
    token: str
    user: UserResponse
    is_super_admin: bool = False
