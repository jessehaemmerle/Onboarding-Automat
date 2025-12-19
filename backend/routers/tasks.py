"""Tasks Routes - Aufgaben Management"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List
import uuid

router = APIRouter(prefix="/tasks", tags=["Tasks"])

# TODO: Migriere folgende Endpoints aus server.py:
# - GET /tasks/my-tasks
# - PATCH /tasks/{task_id}/status
# - GET /tasks/{task_id}/evidence
# - POST /tasks/{task_id}/evidence
# - GET /tasks/{task_id}/comments
# - POST /tasks/{task_id}/comments
