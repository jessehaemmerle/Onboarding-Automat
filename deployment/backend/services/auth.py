from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timezone, timedelta
import uuid
import secrets
import string

from config import (
    pwd_context, security, SECRET_KEY, ALGORITHM, 
    ACCESS_TOKEN_EXPIRE_DAYS, MASTER_ADMIN_KEY, db
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
    """Generate a unique license key in format: XXXX-XXXX-XXXX-XXXX"""
    chars = string.ascii_uppercase + string.digits
    parts = [''.join(secrets.choice(chars) for _ in range(4)) for _ in range(4)]
    return '-'.join(parts)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ihr Konto wurde gesperrt. Kontaktieren Sie Ihren Administrator."
        )
    
    return user

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"] and not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Admin-Berechtigung erforderlich")
    return current_user

async def require_super_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super-Admin-Berechtigung erforderlich")
    return current_user

def verify_master_key(key: str):
    if key != MASTER_ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Ungültiger Master-Key")
    return True

def get_org_filter(current_user: dict) -> dict:
    """Get organization filter for queries"""
    if current_user.get("is_super_admin"):
        return {}
    return {"organization_id": current_user.get("organization_id")}
