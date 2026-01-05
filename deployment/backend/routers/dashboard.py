"""Dashboard Routes - Statistiken und Reports"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# TODO: Migriere folgende Endpoints aus server.py:
# - GET /dashboard/stats
