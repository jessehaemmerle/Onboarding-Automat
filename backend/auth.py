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


# ============ ROLES ============
# Fine-grained role model:
#   admin    -> full access (org administration, users, settings, billing)
#   superior -> manage templates, onboardings/cases and their building blocks
#               (categories, owner-roles, departments, evidence policies)
#   manager  -> view AND edit all tasks of their own department
#   user     -> view/complete only their own tasks
ROLE_ADMIN = "admin"
ROLE_SUPERIOR = "superior"
ROLE_MANAGER = "manager"
ROLE_USER = "user"
VALID_ROLES = [ROLE_ADMIN, ROLE_SUPERIOR, ROLE_MANAGER, ROLE_USER]


def normalize_role(role) -> str:
    """Map legacy/unknown roles (owner, readonly, None) to 'user'."""
    return role if role in VALID_ROLES else ROLE_USER


def is_admin(user: dict) -> bool:
    return bool(user.get("is_super_admin")) or normalize_role(user.get("role")) == ROLE_ADMIN


def can_manage_content(user: dict) -> bool:
    """admin or superior — may manage templates, cases and their building blocks."""
    return bool(user.get("is_super_admin")) or normalize_role(user.get("role")) in (ROLE_ADMIN, ROLE_SUPERIOR)


async def require_admin(current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin-Rechte erforderlich")
    return current_user


async def require_superior_or_admin(current_user: dict = Depends(get_current_user)):
    if not can_manage_content(current_user):
        raise HTTPException(status_code=403, detail="Superior- oder Admin-Rechte erforderlich")
    return current_user


async def require_manager_or_admin(current_user: dict = Depends(get_current_user)):
    """Staff-level access: admin, superior or manager."""
    role = normalize_role(current_user.get("role"))
    if not (current_user.get("is_super_admin") or role in (ROLE_ADMIN, ROLE_SUPERIOR, ROLE_MANAGER)):
        raise HTTPException(status_code=403, detail="Mindestens Manager-Rechte erforderlich")
    return current_user


async def require_super_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super-Admin-Rechte erforderlich")
    return current_user


# ============ TASK / CASE VISIBILITY ============

async def department_role_names(user: dict) -> list:
    """Owner-role names belonging to the user's department (for manager scope)."""
    dept = user.get("department_id")
    if not dept:
        return []
    roles = await db.owner_roles.find(
        {"department_id": dept, **get_org_filter(user)}, {"_id": 0, "name": 1}
    ).to_list(500)
    return [r["name"] for r in roles]


async def task_scope_query(user: dict) -> dict:
    """Mongo filter for the tasks a user is allowed to see/act on."""
    if user.get("is_super_admin"):
        return {}
    org = get_org_filter(user)
    role = normalize_role(user.get("role"))
    if role in (ROLE_ADMIN, ROLE_SUPERIOR):
        return dict(org)
    if role == ROLE_MANAGER:
        names = await department_role_names(user)
        conds = [{"owner_email": user.get("email")}]
        if names:
            conds.append({"owner_role_snapshot": {"$in": names}})
        return {**org, "$or": conds}
    # plain user
    return {**org, "owner_email": user.get("email")}


async def can_modify_task(user: dict, task: dict) -> bool:
    """Whether the user may change a specific task (status, etc.)."""
    if user.get("is_super_admin"):
        return True
    role = normalize_role(user.get("role"))
    if role in (ROLE_ADMIN, ROLE_SUPERIOR):
        return True
    if task.get("owner_email") and task.get("owner_email") == user.get("email"):
        return True
    if role == ROLE_MANAGER:
        names = await department_role_names(user)
        return task.get("owner_role_snapshot") in names
    return False


async def visible_case_ids(user: dict):
    """Return None when the user may see all org cases, otherwise the list of
    case ids that contain at least one task the user is allowed to see."""
    if user.get("is_super_admin") or can_manage_content(user):
        return None
    tq = await task_scope_query(user)
    return await db.tasks.distinct("case_id", tq)


def verify_master_key(key: str):
    if key != MASTER_ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Ungültiger Master-Admin-Key")
    return True


def get_org_filter(current_user: dict) -> dict:
    if current_user.get("is_super_admin"):
        return {}
    return {"organization_id": current_user.get("organization_id")}
