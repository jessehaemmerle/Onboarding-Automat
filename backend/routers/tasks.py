"""Tasks routes for evidence policies, uploads and task comments."""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import AliasChoices, BaseModel, Field
import uuid
import base64
import io

try:
    from ..auth import get_current_user, require_manager_or_admin, require_superior_or_admin, get_org_filter, can_manage_content
    from ..config import MAX_FILE_SIZE, db, logger
except ImportError:  # pragma: no cover - fallback for direct module execution
    from auth import get_current_user, require_manager_or_admin, require_superior_or_admin, get_org_filter, can_manage_content  # type: ignore
    from config import MAX_FILE_SIZE, db, logger  # type: ignore

router = APIRouter(tags=["Tasks"])

# ============ MODELS ============
class TaskCommentCreate(BaseModel):
    body: str = Field(validation_alias=AliasChoices("body", "content"))

class TaskCommentResponse(BaseModel):
    id: str
    task_id: str
    user_id: Optional[str] = None
    user_email: str
    user_name: str
    body: str
    content: Optional[str] = None
    created_at: str

class EvidenceResponse(BaseModel):
    id: str
    task_id: str
    filename: str
    file_type: str
    content_type: Optional[str] = None
    uploaded_by: str
    uploaded_by_name: Optional[str] = None
    uploaded_at: str
    file_size: int = 0

# ============ EVIDENCE POLICY MODELS ============
class EvidencePolicyCreate(BaseModel):
    name: str
    description: str = ""
    allowed_file_types: List[str] = ["application/pdf", "image/jpeg", "image/png", "image/gif"]
    max_file_size_mb: int = 10
    min_files_required: int = 1
    max_files_allowed: int = 10
    require_description: bool = False
    auto_approve: bool = True
    notify_on_upload: bool = False
    retention_days: int = 1095  # 3 years default

class EvidencePolicyResponse(EvidencePolicyCreate):
    id: str
    organization_id: str
    created_at: str
    updated_at: Optional[str] = None

# ============ EVIDENCE POLICIES ROUTES ============

@router.get("/evidence-policies", response_model=List[EvidencePolicyResponse])
async def get_evidence_policies(current_user: dict = Depends(get_current_user)):
    """Get all evidence policies for the organization"""
    query = get_org_filter(current_user)
    policies = await db.evidence_policies.find(query, {"_id": 0}).to_list(100)
    return policies

@router.post("/evidence-policies", response_model=EvidencePolicyResponse)
async def create_evidence_policy(data: EvidencePolicyCreate, admin: dict = Depends(require_superior_or_admin)):
    """Create a new evidence policy - Superior/Admin only"""
    org_id = admin.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    policy_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {
        "id": policy_id,
        "organization_id": org_id,
        "name": data.name,
        "description": data.description,
        "allowed_file_types": data.allowed_file_types,
        "max_file_size_mb": data.max_file_size_mb,
        "min_files_required": data.min_files_required,
        "max_files_allowed": data.max_files_allowed,
        "require_description": data.require_description,
        "auto_approve": data.auto_approve,
        "notify_on_upload": data.notify_on_upload,
        "retention_days": data.retention_days,
        "created_at": now
    }
    
    await db.evidence_policies.insert_one(doc)
    logger.info(f"Created evidence policy: {data.name} for org {org_id}")
    
    return EvidencePolicyResponse(**doc)

@router.put("/evidence-policies/{policy_id}", response_model=EvidencePolicyResponse)
async def update_evidence_policy(policy_id: str, data: EvidencePolicyCreate, admin: dict = Depends(require_superior_or_admin)):
    """Update an evidence policy - Superior/Admin only"""
    query = {"id": policy_id, **get_org_filter(admin)}
    
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.evidence_policies.update_one(query, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Policy nicht gefunden")
    
    updated = await db.evidence_policies.find_one(query, {"_id": 0})
    return EvidencePolicyResponse(**updated)

@router.delete("/evidence-policies/{policy_id}")
async def delete_evidence_policy(policy_id: str, admin: dict = Depends(require_superior_or_admin)):
    """Delete an evidence policy - Superior/Admin only"""
    query = {"id": policy_id, **get_org_filter(admin)}
    result = await db.evidence_policies.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Policy nicht gefunden")
    return {"message": "Policy gelöscht"}

@router.get("/evidence-policies/default")
async def get_default_evidence_policy():
    """Get the default evidence policy settings"""
    return {
        "allowed_file_types": ["application/pdf", "image/jpeg", "image/png", "image/gif", "application/msword", 
                               "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        "max_file_size_mb": 10,
        "min_files_required": 1,
        "max_files_allowed": 10,
        "require_description": False,
        "auto_approve": True,
        "retention_days": 1095
    }

# ============ EVIDENCE ROUTES ============

@router.get("/tasks/{task_id}/evidence", response_model=List[EvidenceResponse])
async def get_task_evidence(task_id: str, current_user: dict = Depends(get_current_user)):
    """Get all evidence files for a task"""
    evidence_list = await db.evidence.find({"task_id": task_id}, {"_id": 0, "file_data": 0}).to_list(50)
    return [EvidenceResponse(
        id=e["id"],
        task_id=e["task_id"],
        filename=e["filename"],
        file_type=e.get("file_type", "application/octet-stream"),
        content_type=e.get("file_type", "application/octet-stream"),
        uploaded_by=e["uploaded_by"],
        uploaded_by_name=e.get("uploaded_by_name"),
        uploaded_at=e["uploaded_at"],
        file_size=e.get("file_size", 0)
    ) for e in evidence_list]

@router.post("/tasks/{task_id}/evidence", response_model=EvidenceResponse)
async def upload_evidence(
    task_id: str,
    file: UploadFile = File(...),
    description: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Upload evidence while preserving the legacy API behavior."""
    # Validate task exists
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task nicht gefunden")

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Datei zu groß (max 10MB)")

    file_type = file.content_type or "application/octet-stream"
    evidence_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    evidence_doc = {
        "id": evidence_id,
        "task_id": task_id,
        "filename": file.filename,
        "file_type": file_type,
        "file_size": len(content),
        "file_data": base64.b64encode(content).decode("utf-8"),
        "description": description,
        "uploaded_by": current_user["email"],
        "uploaded_by_name": current_user["name"],
        "uploaded_at": now,
        "organization_id": current_user.get("organization_id", ""),
    }
    await db.evidence.insert_one(evidence_doc)

    return EvidenceResponse(
        id=evidence_id,
        task_id=task_id,
        filename=file.filename,
        file_type=file_type,
        content_type=file_type,
        file_size=len(content),
        uploaded_by=current_user["email"],
        uploaded_by_name=current_user["name"],
        uploaded_at=now
    )

@router.get("/evidence/{evidence_id}/download")
async def download_evidence(evidence_id: str, current_user: dict = Depends(get_current_user)):
    """Download an evidence file"""
    evidence = await db.evidence.find_one({"id": evidence_id}, {"_id": 0})
    if not evidence:
        raise HTTPException(status_code=404, detail="Nachweis nicht gefunden")
    
    file_data = base64.b64decode(evidence["file_data"])
    return StreamingResponse(
        io.BytesIO(file_data),
        media_type=evidence["file_type"],
        headers={"Content-Disposition": f"attachment; filename=\"{evidence['filename']}\""}
    )

@router.delete("/evidence/{evidence_id}")
async def delete_evidence(evidence_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an evidence file"""
    evidence = await db.evidence.find_one({"id": evidence_id}, {"_id": 0})
    if not evidence:
        raise HTTPException(status_code=404, detail="Nachweis nicht gefunden")
    
    # Only allow uploader or content managers (admin/superior) to delete
    if evidence["uploaded_by"] != current_user["email"] and not can_manage_content(current_user):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    await db.evidence.delete_one({"id": evidence_id})
    logger.info(f"Evidence deleted: {evidence_id} by {current_user['email']}")
    return {"message": "Nachweis gelöscht"}

@router.patch("/evidence/{evidence_id}/approve")
async def approve_evidence(evidence_id: str, admin: dict = Depends(require_manager_or_admin)):
    """Approve a pending evidence file - Admin only"""
    evidence = await db.evidence.find_one({"id": evidence_id}, {"_id": 0})
    if not evidence:
        raise HTTPException(status_code=404, detail="Nachweis nicht gefunden")
    
    await db.evidence.update_one(
        {"id": evidence_id},
        {"$set": {"status": "approved", "approved_by": admin["email"], "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Nachweis genehmigt"}

@router.patch("/evidence/{evidence_id}/reject")
async def reject_evidence(evidence_id: str, reason: str = "", admin: dict = Depends(require_manager_or_admin)):
    """Reject a pending evidence file - Admin only"""
    evidence = await db.evidence.find_one({"id": evidence_id}, {"_id": 0})
    if not evidence:
        raise HTTPException(status_code=404, detail="Nachweis nicht gefunden")
    
    await db.evidence.update_one(
        {"id": evidence_id},
        {"$set": {
            "status": "rejected", 
            "rejected_by": admin["email"], 
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": reason
        }}
    )
    
    return {"message": "Nachweis abgelehnt", "reason": reason}

# ============ TASK COMMENTS ROUTES ============

@router.get("/tasks/{task_id}/comments", response_model=List[TaskCommentResponse])
async def get_task_comments(task_id: str, current_user: dict = Depends(get_current_user)):
    """Get all comments for a task"""
    comments = await db.task_comments.find({"task_id": task_id}, {"_id": 0}).to_list(100)
    return [TaskCommentResponse(
        id=c["id"],
        task_id=c["task_id"],
        user_id=c.get("user_id"),
        user_email=c.get("user_email", c.get("user_id", "")),
        user_name=c.get("user_name", "Unknown"),
        body=c.get("body", c.get("content", "")),
        content=c.get("content", c.get("body", "")),
        created_at=c["created_at"]
    ) for c in comments]

@router.post("/tasks/{task_id}/comments", response_model=TaskCommentResponse)
async def create_task_comment(task_id: str, data: TaskCommentCreate, current_user: dict = Depends(get_current_user)):
    """Add a comment to a task"""
    comment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": comment_id,
        "task_id": task_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "user_email": current_user["email"],
        "content": data.body,
        "body": data.body,
        "created_at": now
    }
    await db.task_comments.insert_one(doc)
    
    return TaskCommentResponse(
        id=comment_id,
        task_id=task_id,
        user_id=current_user["id"],
        user_email=current_user["email"],
        user_name=current_user["name"],
        body=data.body,
        content=data.body,
        created_at=now
    )
