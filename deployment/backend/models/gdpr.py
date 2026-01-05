from pydantic import BaseModel
from typing import Optional

class AuditLogEntry(BaseModel):
    id: str
    timestamp: str
    user_id: str
    user_email: str
    user_name: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    resource_name: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    organization_id: Optional[str] = None

class AuditLogResponse(BaseModel):
    logs: list
    total: int
    page: int
    page_size: int

class SalesContactRequest(BaseModel):
    company: str
    name: str
    email: str
    phone: Optional[str] = None
    employees: Optional[str] = None
    message: Optional[str] = None

class ConsentRecord(BaseModel):
    consent_type: str
    granted: bool
    timestamp: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    version: str = "1.0"

class DataExportRequest(BaseModel):
    format: str = "json"

class DataDeletionRequest(BaseModel):
    reason: Optional[str] = None
    confirm: bool = False
