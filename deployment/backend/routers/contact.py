from fastapi import APIRouter, Depends, BackgroundTasks
from datetime import datetime, timezone
import uuid

from config import db, logger
from models.gdpr import SalesContactRequest
from services.auth import require_super_admin
from services.email import send_sales_notification_email

router = APIRouter(prefix="/contact", tags=["Contact"])

@router.post("/sales")
async def submit_sales_contact(data: SalesContactRequest, background_tasks: BackgroundTasks):
    """Submit a sales contact request - sends email notification"""
    now = datetime.now(timezone.utc).isoformat()
    
    contact_request = {
        "id": str(uuid.uuid4()),
        "company": data.company,
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "employees": data.employees,
        "message": data.message,
        "status": "new",
        "created_at": now
    }
    
    await db.contact_requests.insert_one(contact_request)
    
    background_tasks.add_task(send_sales_notification_email, contact_request)
    
    logger.info(f"New sales contact request from {data.company} ({data.email})")
    
    return {"message": "Anfrage erfolgreich gesendet", "id": contact_request["id"]}

@router.get("/requests")
async def get_contact_requests(admin: dict = Depends(require_super_admin)):
    """Get all contact requests - Super Admin only"""
    requests = await db.contact_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests
