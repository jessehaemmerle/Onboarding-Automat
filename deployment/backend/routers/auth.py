from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from config import db
from models.user import UserCreate, UserLogin, UserResponse, TokenResponse
from services.auth import (
    get_current_user, require_admin, verify_password, 
    get_password_hash, create_access_token, get_org_filter
)
from services.audit import log_audit

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate, current_user: dict = Depends(require_admin)):
    """Register a new user within an organization - Admin only"""
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
        "status": "active",
        "privacy_accepted_at": now,
        "data_processing_accepted_at": now
    }
    await db.users.insert_one(user_doc)
    
    await log_audit(
        user=current_user,
        action="create",
        resource_type="user",
        resource_id=user_id,
        resource_name=user_data.email,
        details=f"Neuer Benutzer registriert von {current_user['email']}"
    )
    
    await db.consents.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "consent_type": "privacy_policy",
        "consented": True,
        "consented_at": now
    })
    
    token = create_access_token({"sub": user_id})
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_doc["role"],
            organization_id=org_id,
            organization_name=current_user.get("organization_name", "Unknown"),
            is_super_admin=False
        ),
        is_super_admin=False
    )

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get("password_hash", user.get("hashed_password", ""))):
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
    
    if user.get("status") == "blocked":
        raise HTTPException(status_code=403, detail="Ihr Konto wurde gesperrt. Kontaktieren Sie Ihren Administrator.")
    
    if not user.get("is_super_admin") and user.get("organization_id"):
        org = await db.organizations.find_one({"id": user["organization_id"]}, {"_id": 0})
        if org and org.get("status") in ["suspended", "inactive"]:
            raise HTTPException(status_code=403, detail="Ihre Organisation wurde deaktiviert. Kontaktieren Sie den Support.")
    
    org_name = "Unknown"
    if user.get("organization_id"):
        org = await db.organizations.find_one({"id": user["organization_id"]}, {"_id": 0, "name": 1})
        org_name = org["name"] if org else "Unknown"
    
    await log_audit(
        user=user,
        action="login",
        resource_type="auth",
        details="Erfolgreicher Login"
    )
    
    token = create_access_token({"sub": user["id"]})
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            organization_id=user.get("organization_id", ""),
            organization_name=org_name,
            is_super_admin=user.get("is_super_admin", False)
        ),
        is_super_admin=user.get("is_super_admin", False)
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    org_name = ""
    if current_user.get("organization_id"):
        org = await db.organizations.find_one({"id": current_user["organization_id"]}, {"_id": 0, "name": 1})
        org_name = org["name"] if org else ""
    
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        role=current_user["role"],
        organization_id=current_user.get("organization_id", ""),
        organization_name=org_name,
        status=current_user.get("status", "active"),
        is_super_admin=current_user.get("is_super_admin", False),
        department_id=current_user.get("department_id")
    )
