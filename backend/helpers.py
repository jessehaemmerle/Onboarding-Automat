"""Shared helper functions for Welkora API."""
import uuid
from datetime import datetime, timezone

try:
    from .config import db, logger
except ImportError:  # pragma: no cover
    from config import db, logger  # type: ignore


async def log_audit(
    user: dict,
    action: str,
    resource_type: str,
    resource_id: str = None,
    resource_name: str = None,
    details: str = None,
    old_value: str = None,
    new_value: str = None,
    ip_address: str = None,
):
    """Log an audit entry for DSGVO compliance."""
    audit_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user.get("id", "system"),
        "user_email": user.get("email", "system"),
        "user_name": user.get("name", "System"),
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "resource_name": resource_name,
        "details": details,
        "old_value": old_value,
        "new_value": new_value,
        "ip_address": ip_address,
    }
    await db.audit_logs.insert_one(audit_entry)
    logger.info(f"AUDIT: {user.get('email', 'system')} - {action} - {resource_type} - {resource_id}")
    return audit_entry


async def resolve_owner_email(owner_role: str, organization_id: str) -> str:
    role = await db.owner_roles.find_one(
        {"name": owner_role, "organization_id": organization_id}, {"_id": 0}
    )
    if role and role.get("emails"):
        return role["emails"][0]
    return ""
