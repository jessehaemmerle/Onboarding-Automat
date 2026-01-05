"""Organization Admin Routes - für Org-Admin Funktionen"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, EmailStr
import uuid

import sys
sys.path.append('/app/backend')

from config import db, pwd_context, logger
from services.audit import log_audit

router = APIRouter(prefix="/org", tags=["Organization Admin"])

# ============ DEPENDENCIES ============
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from config import SECRET_KEY, ALGORITHM, security

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Ungültige Anmeldedaten",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise credentials_exception
    
    if user.get("status") == "blocked":
        raise HTTPException(status_code=403, detail="Ihr Konto wurde gesperrt.")
    
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
class OrgUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "user"
    department_id: Optional[str] = None

# ============ ROUTES ============

@router.post("/users")
async def create_org_user(user_data: OrgUserCreate, current_user: dict = Depends(require_admin)):
    """Create a new user in the current organization - Org Admin only"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="Diese E-Mail-Adresse ist bereits registriert")
    
    if user_data.role not in ["user", "admin", "manager", "owner", "readonly"]:
        raise HTTPException(status_code=400, detail="Ungültige Rolle")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    
    current_user_count = await db.users.count_documents({"organization_id": org_id})
    user_limit = org.get("user_limit", 10)
    
    if current_user_count >= user_limit:
        raise HTTPException(
            status_code=403, 
            detail=f"Benutzer-Limit erreicht ({current_user_count}/{user_limit})"
        )
    
    if len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 8 Zeichen haben")
    
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

@router.get("/info")
async def get_org_info(current_user: dict = Depends(require_admin)):
    """Get organization info including user limit - Org Admin only"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    
    user_count = await db.users.count_documents({"organization_id": org_id})
    
    return {
        "id": org["id"],
        "name": org["name"],
        "user_count": user_count,
        "user_limit": org.get("user_limit", 10),
        "status": org.get("status", "active"),
        "created_at": org.get("created_at")
    }

@router.get("/users")
async def get_org_users(current_user: dict = Depends(require_admin)):
    """Get all users in the organization - Org Admin only"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    users = await db.users.find(
        {"organization_id": org_id},
        {"_id": 0, "hashed_password": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Enrich with department names
    for user in users:
        if user.get("department_id"):
            dept = await db.departments.find_one({"id": user["department_id"]}, {"_id": 0, "name": 1})
            user["department_name"] = dept["name"] if dept else None
    
    return users

@router.patch("/users/{user_id}/role")
async def update_org_user_role(user_id: str, role: str, current_user: dict = Depends(require_admin)):
    """Change user role within organization - Org Admin only"""
    if role not in ["user", "admin", "manager", "owner", "readonly"]:
        raise HTTPException(status_code=400, detail="Ungültige Rolle")
    
    org_id = current_user.get("organization_id")
    user = await db.users.find_one({"id": user_id, "organization_id": org_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    old_role = user.get("role")
    await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    
    await log_audit(
        user=current_user,
        action="update",
        resource_type="user",
        resource_id=user_id,
        resource_name=user.get("email"),
        details=f"Rolle geändert: {old_role} -> {role}",
        old_value=old_role,
        new_value=role
    )
    
    return {"message": f"Rolle auf '{role}' geändert", "user_id": user_id}

@router.patch("/users/{user_id}/department")
async def change_user_department(user_id: str, department_id: Optional[str] = None, current_user: dict = Depends(require_admin)):
    """Change user's department - Org Admin only"""
    org_id = current_user.get("organization_id")
    user = await db.users.find_one({"id": user_id, "organization_id": org_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    if department_id:
        dept = await db.departments.find_one({"id": department_id, "organization_id": org_id}, {"_id": 0})
        if not dept:
            raise HTTPException(status_code=404, detail="Abteilung nicht gefunden")
    
    await db.users.update_one({"id": user_id}, {"$set": {"department_id": department_id}})
    
    return {"message": "Abteilung geändert", "user_id": user_id}

@router.patch("/users/{user_id}/status")
async def org_update_user_status(user_id: str, new_status: str, current_user: dict = Depends(require_admin)):
    """Block/Unblock a user in the organization - Org Admin only"""
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

@router.post("/users/{user_id}/reset-password")
async def org_reset_user_password(user_id: str, new_password: str, current_user: dict = Depends(require_admin)):
    """Reset password for a user in the organization - Org Admin only"""
    org_id = current_user.get("organization_id")
    user = await db.users.find_one({"id": user_id, "organization_id": org_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 8 Zeichen haben")
    
    hashed = pwd_context.hash(new_password)
    await db.users.update_one({"id": user_id}, {"$set": {"hashed_password": hashed, "password_hash": hashed}})
    
    await log_audit(
        user=current_user,
        action="update",
        resource_type="user",
        resource_id=user_id,
        resource_name=user.get("email"),
        details="Passwort zurückgesetzt"
    )
    
    return {"message": "Passwort erfolgreich zurückgesetzt", "user_id": user_id}

@router.delete("/users/{user_id}")
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
        raise HTTPException(status_code=400, detail="Eigenes Konto kann nicht gelöscht werden")
    
    await db.users.delete_one({"id": user_id})
    
    await log_audit(
        user=current_user,
        action="delete",
        resource_type="user",
        resource_id=user_id,
        resource_name=user.get("email"),
        details=f"Benutzer gelöscht: {user.get('name')}"
    )
    
    return {"message": "Benutzer erfolgreich gelöscht", "user_id": user_id}
