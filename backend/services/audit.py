from datetime import datetime, timezone
import uuid
from config import db, logger

async def log_audit(
    user: dict,
    action: str,
    resource_type: str,
    resource_id: str = None,
    resource_name: str = None,
    details: str = None,
    ip_address: str = None,
    old_value: str = None,
    new_value: str = None
):
    """Log an audit entry for DSGVO compliance"""
    try:
        entry = {
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
            "ip_address": ip_address,
            "old_value": old_value,
            "new_value": new_value,
            "organization_id": user.get("organization_id")
        }
        await db.audit_logs.insert_one(entry)
    except Exception as e:
        logger.error(f"Failed to log audit entry: {e}")
