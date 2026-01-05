"""Settings Routes - Kategorien, Abteilungen, Owner-Rollen, Templates"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
import uuid

import sys
sys.path.append('/app/backend')

from config import db, logger

router = APIRouter(tags=["Settings"])

# ============ DEPENDENCIES ============
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from config import SECRET_KEY, ALGORITHM, security

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    except JWTError:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    return user

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"] and not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Admin-Berechtigung erforderlich")
    return current_user

def get_org_filter(current_user: dict) -> dict:
    if current_user.get("is_super_admin"):
        return {}
    return {"organization_id": current_user.get("organization_id")}

# ============ MODELS ============
class OwnerRoleBase(BaseModel):
    name: str
    emails: List[str] = []
    department_id: Optional[str] = None

class OwnerRoleResponse(OwnerRoleBase):
    id: str

class CategoryBase(BaseModel):
    name: str
    color: str = "#3b82f6"

class CategoryResponse(CategoryBase):
    id: str

class DepartmentBase(BaseModel):
    name: str
    color: str = "#10b981"

class DepartmentResponse(DepartmentBase):
    id: str

class OrgSettingsBase(BaseModel):
    company_logo: Optional[str] = None
    primary_color: str = "#3b82f6"
    email_notifications: bool = True
    task_reminders: bool = True
    reminder_days_before: int = 3
    data_retention_days: int = 1095
    audit_retention_days: int = 365

# ============ OWNER ROLES ROUTES ============

@router.get("/owner-roles", response_model=List[OwnerRoleResponse])
async def get_owner_roles(current_user: dict = Depends(get_current_user)):
    query = get_org_filter(current_user)
    roles = await db.owner_roles.find(query, {"_id": 0}).to_list(100)
    return [OwnerRoleResponse(**r) for r in roles]

@router.post("/owner-roles", response_model=OwnerRoleResponse)
async def create_owner_role(data: OwnerRoleBase, admin: dict = Depends(require_admin)):
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

@router.put("/owner-roles/{role_id}", response_model=OwnerRoleResponse)
async def update_owner_role(role_id: str, data: OwnerRoleBase, admin: dict = Depends(require_admin)):
    query = {"id": role_id, **get_org_filter(admin)}
    await db.owner_roles.update_one(query, {"$set": {"name": data.name, "emails": data.emails, "department_id": data.department_id}})
    updated = await db.owner_roles.find_one(query, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")
    return OwnerRoleResponse(**updated)

@router.delete("/owner-roles/{role_id}")
async def delete_owner_role(role_id: str, admin: dict = Depends(require_admin)):
    query = {"id": role_id, **get_org_filter(admin)}
    result = await db.owner_roles.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")
    return {"message": "Gelöscht"}

# ============ CATEGORIES ROUTES ============

@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(current_user: dict = Depends(get_current_user)):
    query = get_org_filter(current_user)
    categories = await db.categories.find(query, {"_id": 0}).to_list(100)
    return [CategoryResponse(**c) for c in categories]

@router.post("/categories", response_model=CategoryResponse)
async def create_category(data: CategoryBase, admin: dict = Depends(require_admin)):
    category_id = str(uuid.uuid4())
    doc = {
        "id": category_id,
        "name": data.name,
        "color": data.color,
        "organization_id": admin["organization_id"]
    }
    await db.categories.insert_one(doc)
    return CategoryResponse(**doc)

@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, data: CategoryBase, admin: dict = Depends(require_admin)):
    query = {"id": category_id, **get_org_filter(admin)}
    await db.categories.update_one(query, {"$set": {"name": data.name, "color": data.color}})
    updated = await db.categories.find_one(query, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    return CategoryResponse(**updated)

@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, admin: dict = Depends(require_admin)):
    query = {"id": category_id, **get_org_filter(admin)}
    result = await db.categories.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    return {"message": "Gelöscht"}

# ============ DEPARTMENTS ROUTES ============

@router.get("/departments", response_model=List[DepartmentResponse])
async def get_departments(current_user: dict = Depends(get_current_user)):
    query = get_org_filter(current_user)
    departments = await db.departments.find(query, {"_id": 0}).to_list(100)
    return [DepartmentResponse(**d) for d in departments]

@router.post("/departments", response_model=DepartmentResponse)
async def create_department(data: DepartmentBase, admin: dict = Depends(require_admin)):
    department_id = str(uuid.uuid4())
    doc = {
        "id": department_id,
        "name": data.name,
        "color": data.color,
        "organization_id": admin["organization_id"]
    }
    await db.departments.insert_one(doc)
    return DepartmentResponse(**doc)

@router.put("/departments/{department_id}", response_model=DepartmentResponse)
async def update_department(department_id: str, data: DepartmentBase, admin: dict = Depends(require_admin)):
    query = {"id": department_id, **get_org_filter(admin)}
    await db.departments.update_one(query, {"$set": {"name": data.name, "color": data.color}})
    updated = await db.departments.find_one(query, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Abteilung nicht gefunden")
    return DepartmentResponse(**updated)

@router.delete("/departments/{department_id}")
async def delete_department(department_id: str, admin: dict = Depends(require_admin)):
    query = {"id": department_id, **get_org_filter(admin)}
    result = await db.departments.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Abteilung nicht gefunden")
    return {"message": "Gelöscht"}

# ============ ORG SETTINGS ROUTES ============

@router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("organization_id")
    if not org_id:
        return OrgSettingsBase()
    
    settings = await db.org_settings.find_one({"organization_id": org_id}, {"_id": 0})
    if not settings:
        return OrgSettingsBase()
    return settings

@router.put("/settings")
async def update_settings(data: OrgSettingsBase, admin: dict = Depends(require_admin)):
    org_id = admin.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    settings_dict = data.dict()
    settings_dict["organization_id"] = org_id
    settings_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.org_settings.update_one(
        {"organization_id": org_id},
        {"$set": settings_dict},
        upsert=True
    )
    
    return settings_dict
