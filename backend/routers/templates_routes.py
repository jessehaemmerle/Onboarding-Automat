"""Templates routes."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from typing import List, Optional
import uuid

try:
    from ..auth import get_current_user, require_superior_or_admin, get_org_filter
    from ..config import db
    from ..models import TemplateCreate, TemplateResponse
    from ..routers.billing import check_limit
except ImportError:  # pragma: no cover
    from auth import get_current_user, require_superior_or_admin, get_org_filter  # type: ignore
    from config import db  # type: ignore
    from models import TemplateCreate, TemplateResponse  # type: ignore
    from routers.billing import check_limit  # type: ignore

router = APIRouter(tags=["Templates"])


@router.get("/templates", response_model=List[TemplateResponse])
async def get_templates(
    template_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    query = get_org_filter(current_user)
    if template_type:
        query["template_type"] = template_type
    templates = await db.templates.find(query, {"_id": 0}).to_list(100)
    for t in templates:
        t.setdefault("template_type", "onboarding")
    return [TemplateResponse(**t) for t in templates]


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, current_user: dict = Depends(get_current_user)):
    query = {"id": template_id, **get_org_filter(current_user)}
    template = await db.templates.find_one(query, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template nicht gefunden")
    template.setdefault("template_type", "onboarding")
    return TemplateResponse(**template)


@router.post("/templates", response_model=TemplateResponse)
async def create_template(data: TemplateCreate, admin: dict = Depends(require_superior_or_admin)):
    org_id = admin.get("organization_id")
    if org_id:
        allowed, message = await check_limit(org_id, "templates", 1)
        if not allowed:
            raise HTTPException(status_code=403, detail=message)

    template_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    tasks = []
    for t in data.tasks:
        task_dict = t.model_dump()
        if not task_dict.get("id") or str(task_dict.get("id", "")).startswith("new-"):
            task_dict["id"] = str(uuid.uuid4())
        tasks.append(task_dict)

    doc = {
        "id": template_id,
        "name": data.name,
        "description": data.description,
        "template_type": data.template_type,
        "organization_id": admin["organization_id"],
        "tasks": tasks,
        "created_at": now,
        "updated_at": now,
    }
    await db.templates.insert_one(doc)
    return TemplateResponse(**doc)


@router.put("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: str, data: TemplateCreate, admin: dict = Depends(require_superior_or_admin)):
    now = datetime.now(timezone.utc).isoformat()
    tasks = []
    for t in data.tasks:
        task_dict = t.model_dump()
        if not task_dict.get("id") or str(task_dict.get("id", "")).startswith("new-"):
            task_dict["id"] = str(uuid.uuid4())
        tasks.append(task_dict)

    query = {"id": template_id, **get_org_filter(admin)}
    await db.templates.update_one(
        query,
        {"$set": {
            "name": data.name,
            "description": data.description,
            "template_type": data.template_type,
            "tasks": tasks,
            "updated_at": now,
        }},
    )
    updated = await db.templates.find_one(query, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Template nicht gefunden")
    updated.setdefault("template_type", "onboarding")
    return TemplateResponse(**updated)


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, admin: dict = Depends(require_superior_or_admin)):
    query = {"id": template_id, **get_org_filter(admin)}
    result = await db.templates.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template nicht gefunden")
    return {"message": "Gelöscht"}


@router.post("/templates/{template_id}/duplicate", response_model=TemplateResponse)
async def duplicate_template(template_id: str, admin: dict = Depends(require_superior_or_admin)):
    query = {"id": template_id, **get_org_filter(admin)}
    original = await db.templates.find_one(query, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Template nicht gefunden")

    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    tasks = [{"id": str(uuid.uuid4()), **{k: v for k, v in t.items() if k != "id"}} for t in original["tasks"]]
    doc = {
        "id": new_id,
        "name": f"{original['name']} (Kopie)",
        "description": original["description"],
        "template_type": original.get("template_type", "onboarding"),
        "organization_id": admin["organization_id"],
        "tasks": tasks,
        "created_at": now,
        "updated_at": now,
    }
    await db.templates.insert_one(doc)
    return TemplateResponse(**doc)
