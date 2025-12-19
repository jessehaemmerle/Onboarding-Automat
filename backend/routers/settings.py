"""Settings Routes - Kategorien, Abteilungen, Owner-Rollen, Templates"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List
import uuid

router = APIRouter(tags=["Settings"])

# TODO: Migriere folgende Endpoints aus server.py:
# - GET/POST/PUT/DELETE /categories
# - GET/POST/PUT/DELETE /departments
# - GET/POST/PUT/DELETE /owner-roles
# - GET/POST/PUT/DELETE /templates
# - GET/PUT /settings
