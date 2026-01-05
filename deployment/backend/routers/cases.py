"""Cases Routes - Onboarding/Offboarding Fälle"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List, Optional
import uuid

router = APIRouter(prefix="/cases", tags=["Cases"])

# TODO: Migriere folgende Endpoints aus server.py:
# - GET /cases
# - GET /cases/{case_id}
# - POST /cases
# - PATCH /cases/{case_id}/reschedule
# - PATCH /cases/{case_id}/status
# - GET /cases/{case_id}/report
