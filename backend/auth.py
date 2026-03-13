from datetime import datetime, timedelta, timezone
import random
import string

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt

try:
    from .config import (
        ACCESS_TOKEN_EXPIRE_DAYS,
        ALGORITHM,
        MASTER_ADMIN_KEY,
        SECRET_KEY,
        db,
        pwd_context,
        security,
    )
except ImportError:  # pragma: no cover - fallback for direct module execution
    from config import (  # type: ignore
        ACCESS_TOKEN_EXPIRE_DAYS,
        ALGORITHM,
        MASTER_ADMIN_KEY,
        SECRET_KEY,
        db,
        pwd_context,
        security,
    )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def generate_license_key() -> str:
    """Generate a license key in format OA-XXXX-XXXX-XXXX."""
    chars = string.ascii_uppercase + string.digits
    parts = ["".join(random.choices(chars, k=4)) for _ in range(3)]
    return f"OA-{'-'.join(parts)}"


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Ungültiges Token")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Ungültiges Token") from exc

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")

    if user.get("organization_id"):
        org = await db.organizations.find_one({"id": user["organization_id"]}, {"_id": 0, "name": 1})
        user["organization_name"] = org["name"] if org else "Unknown"
    else:
        user["organization_id"] = ""
        user["organization_name"] = "Super Admin" if user.get("is_super_admin") else "Unknown"

    user["is_super_admin"] = user.get("is_super_admin", False)
    return user


async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin" and not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Admin-Rechte erforderlich")
    return current_user


async def require_manager_or_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "manager"] and not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Admin-Berechtigung erforderlich")
    return current_user


async def require_super_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super-Admin-Rechte erforderlich")
    return current_user


def verify_master_key(key: str):
    if key != MASTER_ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Ungültiger Master-Admin-Key")
    return True


def get_org_filter(current_user: dict) -> dict:
    if current_user.get("is_super_admin"):
        return {}
    return {"organization_id": current_user.get("organization_id")}
