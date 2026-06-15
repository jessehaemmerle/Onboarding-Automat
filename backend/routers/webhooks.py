"""Webhook system: CRUD + dispatch."""
import asyncio
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl

try:
    from ..auth import get_current_user, require_admin, get_org_filter
    from ..config import db, logger
except ImportError:  # pragma: no cover
    from auth import get_current_user, require_admin, get_org_filter  # type: ignore
    from config import db, logger  # type: ignore

router = APIRouter(tags=["Webhooks"])

SUPPORTED_EVENTS = [
    "case.created",
    "case.completed",
    "task.completed",
]


class WebhookCreate(BaseModel):
    url: str
    events: List[str]
    secret: Optional[str] = None
    description: str = ""


class WebhookResponse(BaseModel):
    id: str
    url: str
    events: List[str]
    description: str
    active: bool
    created_at: str


@router.get("/webhooks", response_model=List[WebhookResponse])
async def list_webhooks(admin: dict = Depends(require_admin)):
    docs = await db.webhooks.find(get_org_filter(admin), {"_id": 0}).to_list(100)
    return [WebhookResponse(**d) for d in docs]


@router.post("/webhooks", response_model=WebhookResponse)
async def create_webhook(data: WebhookCreate, admin: dict = Depends(require_admin)):
    invalid = [e for e in data.events if e not in SUPPORTED_EVENTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unbekannte Events: {invalid}")
    doc = {
        "id": str(uuid.uuid4()),
        "organization_id": admin["organization_id"],
        "url": data.url,
        "events": data.events,
        "secret": data.secret or "",
        "description": data.description,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.webhooks.insert_one(doc)
    return WebhookResponse(**doc)


@router.patch("/webhooks/{webhook_id}/toggle")
async def toggle_webhook(webhook_id: str, admin: dict = Depends(require_admin)):
    wh = await db.webhooks.find_one({"id": webhook_id, **get_org_filter(admin)})
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook nicht gefunden")
    new_active = not wh.get("active", True)
    await db.webhooks.update_one({"id": webhook_id}, {"$set": {"active": new_active}})
    return {"active": new_active}


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, admin: dict = Depends(require_admin)):
    result = await db.webhooks.delete_one({"id": webhook_id, **get_org_filter(admin)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook nicht gefunden")
    return {"message": "Gelöscht"}


async def dispatch_webhook(organization_id: str, event: str, payload: dict):
    """Fire all active webhooks subscribed to `event` for this org."""
    if not organization_id:
        return
    webhooks = await db.webhooks.find(
        {"organization_id": organization_id, "events": event, "active": True},
        {"_id": 0},
    ).to_list(50)

    if not webhooks:
        return

    body = json.dumps({"event": event, "timestamp": datetime.now(timezone.utc).isoformat(), "data": payload})

    async def _send(wh: dict):
        headers = {"Content-Type": "application/json", "X-Welkora-Event": event}
        if wh.get("secret"):
            sig = hmac.new(wh["secret"].encode(), body.encode(), hashlib.sha256).hexdigest()
            headers["X-Welkora-Signature"] = f"sha256={sig}"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(wh["url"], content=body, headers=headers)
        except Exception as e:
            logger.warning(f"Webhook delivery failed {wh['url']}: {e}")

    await asyncio.gather(*[_send(wh) for wh in webhooks], return_exceptions=True)
