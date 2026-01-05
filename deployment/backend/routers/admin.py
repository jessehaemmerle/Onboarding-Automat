from fastapi import APIRouter, HTTPException, Depends, Header
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid

from config import db, logger
from models.organization import LicenseKeyCreate, LicenseKeyResponse, OrganizationCreate, OrganizationResponse
from models.user import TokenResponse, UserResponse
from services.auth import (
    require_super_admin, verify_master_key, generate_license_key,
    get_password_hash, create_access_token
)
from services.audit import log_audit

router = APIRouter(prefix="/admin", tags=["Super Admin"])

@router.post("/generate-license-keys", response_model=List[LicenseKeyResponse])
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
    expires_at = None
    if data.expires_in_days:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)).isoformat()
    
    for _ in range(data.count):
        key = generate_license_key()
        license_doc = {
            "id": str(uuid.uuid4()),
            "key": key,
            "status": "unused",
            "user_limit": data.user_limit,
            "created_at": now,
            "expires_at": expires_at,
            "activated_at": None,
            "organization_id": None,
            "is_used": False
        }
        await db.license_keys.insert_one(license_doc)
        keys.append(LicenseKeyResponse(**license_doc))
    
    logger.info(f"Generated {data.count} license keys with limit {data.user_limit}")
    return keys

@router.get("/users")
async def get_all_users(admin: dict = Depends(require_super_admin)):
    """Get all users across all organizations - Super-Admin only"""
    users = await db.users.find({}, {"_id": 0, "hashed_password": 0, "password_hash": 0}).sort("created_at", -1).to_list(10000)
    
    org_cache = {}
    for user in users:
        org_id = user.get("organization_id")
        if org_id and org_id not in org_cache:
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1})
            org_cache[org_id] = org["name"] if org else "Unknown"
        user["organization_name"] = org_cache.get(org_id, "Super Admin" if user.get("is_super_admin") else "Unknown")
        user["is_super_admin"] = user.get("is_super_admin", False)
    
    return users

@router.patch("/users/{user_id}/status")
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
    
    return {"message": f"Benutzer-Status auf '{new_status}' gesetzt", "user_id": user_id}

@router.post("/users/{user_id}/reset-password")
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

@router.get("/organizations")
async def get_all_organizations(admin: dict = Depends(require_super_admin)):
    """Get all organizations - Super-Admin only"""
    orgs = await db.organizations.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for org in orgs:
        org["user_count"] = await db.users.count_documents({"organization_id": org["id"]})
    return orgs

@router.patch("/organizations/{org_id}/status")
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

@router.patch("/organizations/{org_id}/user-limit")
async def update_organization_user_limit(org_id: str, user_limit: int, admin: dict = Depends(require_super_admin)):
    """Change user limit for an organization - Super-Admin only"""
    if user_limit < 1:
        raise HTTPException(status_code=400, detail="Benutzer-Limit muss mindestens 1 sein")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    
    old_limit = org.get("user_limit", 20)
    await db.organizations.update_one({"id": org_id}, {"$set": {"user_limit": user_limit}})
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

@router.delete("/organizations/{org_id}")
async def delete_organization(org_id: str, confirm: bool = False, admin: dict = Depends(require_super_admin)):
    """Delete an organization and all associated data - Super-Admin only"""
    if not confirm:
        raise HTTPException(status_code=400, detail="Bestätigung erforderlich (confirm=true)")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    
    await db.users.delete_many({"organization_id": org_id})
    await db.cases.delete_many({"organization_id": org_id})
    await db.tasks.delete_many({"organization_id": org_id})
    await db.templates.delete_many({"organization_id": org_id})
    await db.owner_roles.delete_many({"organization_id": org_id})
    await db.categories.delete_many({"organization_id": org_id})
    await db.departments.delete_many({"organization_id": org_id})
    await db.organizations.delete_one({"id": org_id})
    await db.license_keys.update_one({"organization_id": org_id}, {"$set": {"status": "revoked"}})
    
    await log_audit(
        user=admin,
        action="delete",
        resource_type="organization",
        resource_id=org_id,
        resource_name=org.get("name"),
        details="Organisation und alle zugehörigen Daten gelöscht"
    )
    
    return {"message": "Organisation erfolgreich gelöscht", "org_id": org_id}

@router.get("/licenses")
async def get_all_licenses(admin: dict = Depends(require_super_admin)):
    """Get all license keys - Super-Admin only"""
    licenses = await db.license_keys.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for lic in licenses:
        lic["is_used"] = lic.get("status") != "unused"
        if lic.get("organization_id"):
            org = await db.organizations.find_one({"id": lic["organization_id"]}, {"_id": 0, "name": 1})
            lic["used_by_organization"] = org["name"] if org else "Unknown"
    return licenses

@router.patch("/licenses/{license_id}/revoke")
async def revoke_license(license_id: str, admin: dict = Depends(require_super_admin)):
    """Revoke a license key - Super-Admin only"""
    license_key = await db.license_keys.find_one({"id": license_id}, {"_id": 0})
    if not license_key:
        raise HTTPException(status_code=404, detail="Lizenz nicht gefunden")
    
    await db.license_keys.update_one({"id": license_id}, {"$set": {"status": "revoked"}})
    
    if license_key.get("organization_id"):
        await db.organizations.update_one(
            {"id": license_key["organization_id"]},
            {"$set": {"status": "suspended"}}
        )
    
    await log_audit(
        user=admin,
        action="revoke",
        resource_type="license",
        resource_id=license_id,
        details="Lizenz widerrufen"
    )
    
    return {"message": "Lizenz widerrufen", "license_id": license_id}

@router.patch("/licenses/{license_id}/expiry")
async def set_license_expiry(license_id: str, expiry_date: str, admin: dict = Depends(require_super_admin)):
    """Set expiry date for a license - Super-Admin only"""
    license_key = await db.license_keys.find_one({"id": license_id}, {"_id": 0})
    if not license_key:
        raise HTTPException(status_code=404, detail="Lizenz nicht gefunden")
    
    await db.license_keys.update_one({"id": license_id}, {"$set": {"expires_at": expiry_date}})
    
    await log_audit(
        user=admin,
        action="update",
        resource_type="license",
        resource_id=license_id,
        details=f"Ablaufdatum gesetzt: {expiry_date}"
    )
    
    return {"message": "Ablaufdatum gesetzt", "license_id": license_id, "expires_at": expiry_date}

@router.get("/audit-logs")
async def get_system_audit_logs(
    admin: dict = Depends(require_super_admin),
    page: int = 1,
    page_size: int = 50,
    action: Optional[str] = None,
    resource_type: Optional[str] = None
):
    """Get system-wide audit logs - Super-Admin only"""
    query = {}
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type
    
    total = await db.audit_logs.count_documents(query)
    skip = (page - 1) * page_size
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(page_size).to_list(page_size)
    
    return {"logs": logs, "total": total, "page": page, "page_size": page_size}

@router.get("/system-stats")
async def get_system_stats(admin: dict = Depends(require_super_admin)):
    """Get system-wide statistics - Super-Admin only"""
    total_orgs = await db.organizations.count_documents({})
    active_orgs = await db.organizations.count_documents({"status": "active"})
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"status": {"$ne": "blocked"}})
    total_cases = await db.cases.count_documents({})
    active_cases = await db.cases.count_documents({"status": "active"})
    total_licenses = await db.license_keys.count_documents({})
    used_licenses = await db.license_keys.count_documents({"status": {"$ne": "unused"}})
    
    return {
        "organizations": {"total": total_orgs, "active": active_orgs},
        "users": {"total": total_users, "active": active_users},
        "cases": {"total": total_cases, "active": active_cases},
        "licenses": {"total": total_licenses, "used": used_licenses}
    }
