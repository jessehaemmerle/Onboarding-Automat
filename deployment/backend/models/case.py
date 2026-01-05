from pydantic import BaseModel, Field
from typing import List, Optional

class OnboardingCaseCreate(BaseModel):
    employee_name: str
    employee_email: str
    position: str
    department: str
    start_date: str
    template_id: str
    manager_email: str
    case_type: str = "onboarding"

class TaskResponse(BaseModel):
    id: str
    case_id: str
    title: str
    description: str = ""
    category: str = ""
    owner_role: str
    owner_email: str = ""
    due_date: str
    status: str = "open"
    completed_at: Optional[str] = None
    completed_by: Optional[str] = None
    evidence_required: bool = False
    evidence_count: int = 0
    sort_order: int = 0
    depends_on: Optional[str] = None
    is_blocked: bool = False
    blocking_task_title: Optional[str] = None

class EvidenceResponse(BaseModel):
    id: str
    task_id: str
    filename: str
    content_type: str
    uploaded_by: str
    uploaded_at: str
    file_size: int = 0

class TaskCommentCreate(BaseModel):
    content: str

class TaskCommentResponse(BaseModel):
    id: str
    task_id: str
    user_email: str
    user_name: str
    content: str
    created_at: str

class OnboardingCaseResponse(BaseModel):
    id: str
    employee_name: str
    employee_email: str
    position: str
    department: str
    start_date: str
    template_id: str
    template_name: str = ""
    manager_email: str
    status: str
    created_at: str
    created_by: str
    case_type: str = "onboarding"
    tasks: List[TaskResponse] = []
    progress: float = 0.0

class RescheduleRequest(BaseModel):
    new_start_date: str

class DashboardStats(BaseModel):
    total_cases: int
    active_cases: int
    completed_cases: int
    pending_tasks: int
    overdue_tasks: int
    completion_rate: float
    my_pending_tasks: int = 0
    my_overdue_tasks: int = 0
