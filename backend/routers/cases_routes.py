"""Cases, Tasks, and Dashboard routes."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import csv
import io
import uuid

try:
    from ..auth import (
        get_current_user, get_org_filter, require_superior_or_admin,
        task_scope_query, visible_case_ids, can_modify_task, can_manage_content,
    )
    from ..config import db, logger
    from ..models import (
        OnboardingCaseCreate, OnboardingCaseResponse,
        TaskResponse, RescheduleRequest, DashboardStats,
    )
    from ..helpers import log_audit, resolve_owner_email
    from ..routers.billing import check_limit
    from ..routers.webhooks import dispatch_webhook
    from ..routers.notifications import notify_case_created, notify_case_completed
except ImportError:  # pragma: no cover
    from auth import (  # type: ignore
        get_current_user, get_org_filter, require_superior_or_admin,
        task_scope_query, visible_case_ids, can_modify_task, can_manage_content,
    )
    from config import db, logger  # type: ignore
    from models import (  # type: ignore
        OnboardingCaseCreate, OnboardingCaseResponse,
        TaskResponse, RescheduleRequest, DashboardStats,
    )
    from helpers import log_audit, resolve_owner_email  # type: ignore
    from routers.billing import check_limit  # type: ignore
    from routers.webhooks import dispatch_webhook  # type: ignore
    from routers.notifications import notify_case_created, notify_case_completed  # type: ignore

router = APIRouter(tags=["Cases"])


# ===== CASES =====

@router.get("/cases/export")
async def export_cases_csv(
    case_status: Optional[str] = None,
    case_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    query = get_org_filter(current_user)
    if case_status:
        query["status"] = case_status
    if case_type:
        query["case_type"] = case_type
    scope_ids = await visible_case_ids(current_user)
    if scope_ids is not None:
        query["id"] = {"$in": scope_ids}
    cases = await db.cases.find(query, {"_id": 0}).to_list(5000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Mitarbeiter", "E-Mail", "Typ", "Template", "Startdatum", "Status", "Standort", "Manager", "Erstellt am"])
    for c in cases:
        writer.writerow([
            c.get("id", ""),
            c.get("employee_name", ""),
            c.get("employee_email", ""),
            c.get("case_type", "onboarding"),
            c.get("template_name_snapshot", ""),
            c.get("start_date", "")[:10],
            c.get("status", ""),
            c.get("location", ""),
            c.get("manager_email", ""),
            c.get("created_at", "")[:10],
        ])

    output.seek(0)
    filename = f"vorgaenge_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/cases", response_model=List[OnboardingCaseResponse])
async def get_cases(
    case_status: Optional[str] = None,
    case_type: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    query = get_org_filter(current_user)
    if case_status:
        query["status"] = case_status
    if case_type:
        query["case_type"] = case_type
    if search:
        query["$or"] = [
            {"employee_name": {"$regex": search, "$options": "i"}},
            {"employee_email": {"$regex": search, "$options": "i"}},
        ]

    # Role-based case visibility: admin/superior see all, manager sees cases with
    # tasks in their department, user sees cases where they have their own tasks.
    scope_ids = await visible_case_ids(current_user)
    if scope_ids is not None:
        query["id"] = {"$in": scope_ids}

    cases = await db.cases.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    if not cases:
        return []

    case_ids = [c["id"] for c in cases]
    # Only attach tasks the user is allowed to see (managers: department, users: own)
    task_query = await task_scope_query(current_user)
    all_tasks = await db.tasks.find({**task_query, "case_id": {"$in": case_ids}}, {"_id": 0}).to_list(10000)

    task_ids = [t["id"] for t in all_tasks]
    if task_ids:
        evidence_pipeline = [
            {"$match": {"task_id": {"$in": task_ids}}},
            {"$group": {"_id": "$task_id", "count": {"$sum": 1}}},
        ]
        evidence_counts = {
            doc["_id"]: doc["count"]
            for doc in await db.evidence.aggregate(evidence_pipeline).to_list(10000)
        }
    else:
        evidence_counts = {}

    tasks_by_case: dict = {}
    for task in all_tasks:
        cid = task["case_id"]
        if cid not in tasks_by_case:
            tasks_by_case[cid] = []
        task.setdefault("evidence_required", False)
        task["evidence_uploaded"] = evidence_counts.get(task["id"], 0) > 0
        tasks_by_case[cid].append(task)

    result = []
    for c in cases:
        c.setdefault("case_type", "onboarding")
        c.setdefault("linked_case_id", None)
        c.setdefault("new_role", None)
        c.setdefault("old_role", None)
        c["tasks"] = tasks_by_case.get(c["id"], [])
        result.append(OnboardingCaseResponse(**c))
    return result


@router.get("/cases/{case_id}", response_model=OnboardingCaseResponse)
async def get_case(case_id: str, current_user: dict = Depends(get_current_user)):
    query = {"id": case_id, **get_org_filter(current_user)}
    case = await db.cases.find_one(query, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case nicht gefunden")

    case.setdefault("case_type", "onboarding")
    case.setdefault("linked_case_id", None)
    case.setdefault("new_role", None)
    case.setdefault("old_role", None)

    # Tasks the current user may see within this case
    task_query = await task_scope_query(current_user)
    tasks = await db.tasks.find({**task_query, "case_id": case_id}, {"_id": 0}).to_list(100)

    # Users/managers may only open cases in which they have visible tasks
    if not can_manage_content(current_user) and not tasks:
        raise HTTPException(status_code=403, detail="Kein Zugriff auf diesen Vorgang")

    if tasks:
        task_ids = [t["id"] for t in tasks]
        evidence_pipeline = [
            {"$match": {"task_id": {"$in": task_ids}}},
            {"$group": {"_id": "$task_id", "count": {"$sum": 1}}},
        ]
        evidence_counts = {
            doc["_id"]: doc["count"]
            for doc in await db.evidence.aggregate(evidence_pipeline).to_list(100)
        }
        task_status_map = {t["id"]: t.get("status", "open") for t in tasks}

        for t in tasks:
            t.setdefault("evidence_required", False)
            t["evidence_uploaded"] = evidence_counts.get(t["id"], 0) > 0
            depends_on = t.get("depends_on")
            t["is_blocked"] = depends_on is not None and task_status_map.get(depends_on, "open") != "done"

    case["tasks"] = tasks
    return OnboardingCaseResponse(**case)


@router.post("/cases", response_model=OnboardingCaseResponse)
async def create_case(data: OnboardingCaseCreate, current_user: dict = Depends(require_superior_or_admin)):
    org_id = current_user.get("organization_id")
    if org_id:
        allowed, message = await check_limit(org_id, "cases", 1)
        if not allowed:
            raise HTTPException(status_code=403, detail=message)

    query = {"id": data.template_id, **get_org_filter(current_user)}
    template = await db.templates.find_one(query, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template nicht gefunden")

    case_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    start_date = datetime.fromisoformat(data.start_date.replace("Z", "+00:00"))

    case_doc = {
        "id": case_id,
        "employee_name": data.employee_name,
        "employee_email": data.employee_email,
        "template_id": data.template_id,
        "template_name_snapshot": template["name"],
        "case_type": data.case_type,
        "start_date": data.start_date,
        "location": data.location,
        "manager_email": data.manager_email,
        "status": "active",
        "linked_case_id": data.linked_case_id,
        "organization_id": current_user["organization_id"],
        "created_by": current_user["id"],
        "created_at": now,
    }
    if data.case_type == "rolechange":
        case_doc["new_role"] = data.new_role
        case_doc["old_role"] = data.old_role

    await db.cases.insert_one(case_doc)

    template_to_case_task_id: dict = {}
    tasks_temp = []
    for t in template.get("tasks", []):
        owner_email = await resolve_owner_email(t["owner_role"], current_user["organization_id"])
        due_date = start_date - timedelta(days=t["offset_days"])
        new_task_id = str(uuid.uuid4())
        template_task_id = t.get("id")
        if template_task_id:
            template_to_case_task_id[template_task_id] = new_task_id

        task_doc = {
            "id": new_task_id,
            "case_id": case_id,
            "organization_id": current_user["organization_id"],
            "title": t["title"],
            "description": t.get("description", ""),
            "category": t["category"],
            "owner_email": owner_email,
            "owner_role_snapshot": t["owner_role"],
            "offset_days": t["offset_days"],
            "due_date": due_date.isoformat(),
            "status": "open",
            "evidence_required": t.get("evidence_required", False),
            "depends_on": None,
            "completed_at": None,
            "completed_by": None,
            "created_at": now,
        }
        tasks_temp.append((t, task_doc))

    final_tasks = []
    for t, task_doc in tasks_temp:
        template_depends_on = t.get("depends_on")
        if template_depends_on and template_depends_on in template_to_case_task_id:
            task_doc["depends_on"] = template_to_case_task_id[template_depends_on]
        await db.tasks.insert_one(task_doc)
        task_doc["evidence_uploaded"] = False
        task_doc["is_blocked"] = task_doc.get("depends_on") is not None
        final_tasks.append(task_doc)

    case_doc["tasks"] = final_tasks

    # Fire notifications + webhooks in background
    import asyncio
    asyncio.create_task(notify_case_created(case_doc, final_tasks))
    asyncio.create_task(dispatch_webhook(
        current_user.get("organization_id", ""),
        "case.created",
        {"case_id": case_id, "employee_name": data.employee_name, "case_type": data.case_type},
    ))

    return OnboardingCaseResponse(**case_doc)


@router.get("/employees/for-offboarding")
async def get_employees_for_offboarding(current_user: dict = Depends(require_superior_or_admin)):
    query = {"case_type": {"$in": ["onboarding", None]}, **get_org_filter(current_user)}
    cases = await db.cases.find(
        query,
        {"_id": 0, "id": 1, "employee_name": 1, "employee_email": 1, "location": 1, "manager_email": 1, "status": 1},
    ).to_list(1000)

    offboarding_query = {"case_type": "offboarding", "status": "active", **get_org_filter(current_user)}
    active_offboardings = await db.cases.distinct("employee_email", offboarding_query)

    return [
        {
            "onboarding_case_id": c["id"],
            "employee_name": c["employee_name"],
            "employee_email": c["employee_email"],
            "location": c.get("location", ""),
            "manager_email": c["manager_email"],
            "status": c["status"],
        }
        for c in cases
        if c["employee_email"] not in active_offboardings
    ]


@router.patch("/cases/{case_id}/reschedule")
async def reschedule_case(case_id: str, data: RescheduleRequest, current_user: dict = Depends(require_superior_or_admin)):
    query = {"id": case_id, **get_org_filter(current_user)}
    case = await db.cases.find_one(query, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case nicht gefunden")

    new_start = datetime.fromisoformat(data.new_start_date.replace("Z", "+00:00"))
    await db.cases.update_one({"id": case_id}, {"$set": {"start_date": data.new_start_date}})

    open_tasks = await db.tasks.find({"case_id": case_id, "status": "open"}, {"_id": 0}).to_list(100)
    for task in open_tasks:
        new_due = new_start - timedelta(days=task["offset_days"])
        await db.tasks.update_one({"id": task["id"]}, {"$set": {"due_date": new_due.isoformat()}})

    return {"message": "Startdatum aktualisiert", "tasks_updated": len(open_tasks)}


@router.patch("/cases/{case_id}/status")
async def update_case_status(case_id: str, new_status: str, current_user: dict = Depends(require_superior_or_admin)):
    if new_status not in ["active", "completed"]:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    query = {"id": case_id, **get_org_filter(current_user)}
    case = await db.cases.find_one(query, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case nicht gefunden")
    await db.cases.update_one({"id": case_id}, {"$set": {"status": new_status}})

    if new_status == "completed":
        import asyncio
        asyncio.create_task(notify_case_completed(case))
        asyncio.create_task(dispatch_webhook(
            current_user.get("organization_id", ""),
            "case.completed",
            {"case_id": case_id, "employee_name": case.get("employee_name", ""), "case_type": case.get("case_type", "onboarding")},
        ))
    return {"message": "Status aktualisiert"}


# ===== TASKS =====

@router.get("/tasks/my-tasks", response_model=List[TaskResponse])
async def get_my_tasks(current_user: dict = Depends(get_current_user)):
    # admin/superior: all org tasks · manager: own department · user: own tasks
    query = await task_scope_query(current_user)

    tasks = await db.tasks.find(query, {"_id": 0}).to_list(1000)

    if tasks:
        task_ids = [t["id"] for t in tasks]
        evidence_pipeline = [
            {"$match": {"task_id": {"$in": task_ids}}},
            {"$group": {"_id": "$task_id", "count": {"$sum": 1}}},
        ]
        evidence_counts = {
            doc["_id"]: doc["count"]
            for doc in await db.evidence.aggregate(evidence_pipeline).to_list(1000)
        }
        task_status_map = {t["id"]: t.get("status", "open") for t in tasks}

        depends_on_ids = [t.get("depends_on") for t in tasks if t.get("depends_on")]
        missing_ids = [d for d in depends_on_ids if d not in task_status_map]
        if missing_ids:
            dep_tasks = await db.tasks.find(
                {"id": {"$in": missing_ids}}, {"_id": 0, "id": 1, "status": 1}
            ).to_list(100)
            for dt in dep_tasks:
                task_status_map[dt["id"]] = dt.get("status", "open")

        for t in tasks:
            t.setdefault("evidence_required", False)
            t["evidence_uploaded"] = evidence_counts.get(t["id"], 0) > 0
            depends_on = t.get("depends_on")
            t["is_blocked"] = depends_on is not None and task_status_map.get(depends_on, "open") != "done"

    return [TaskResponse(**t) for t in tasks]


@router.patch("/tasks/{task_id}/status")
async def update_task_status(task_id: str, new_status: str, current_user: dict = Depends(get_current_user)):
    if new_status not in ["open", "done"]:
        raise HTTPException(status_code=400, detail="Ungültiger Status")

    query = {"id": task_id, **get_org_filter(current_user)}
    task = await db.tasks.find_one(query, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task nicht gefunden")

    if not await can_modify_task(current_user, task):
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diese Aufgabe")

    if new_status == "done" and task.get("depends_on"):
        dep_task = await db.tasks.find_one({"id": task["depends_on"]}, {"_id": 0, "status": 1, "title": 1})
        if dep_task and dep_task.get("status") != "done":
            raise HTTPException(
                status_code=400,
                detail=f"Diese Aufgabe ist blockiert. Bitte zuerst '{dep_task.get('title', 'Vorgänger-Aufgabe')}' abschließen.",
            )

    if task.get("evidence_required") and new_status == "done":
        evidence_count = await db.evidence.count_documents({"task_id": task_id})
        if evidence_count == 0:
            raise HTTPException(
                status_code=400, detail="Nachweis erforderlich bevor der Task abgeschlossen werden kann"
            )

    update_data: dict = {"status": new_status}
    if new_status == "done":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        update_data["completed_by"] = current_user["email"]
    else:
        update_data["completed_at"] = None
        update_data["completed_by"] = None

    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    return {"message": "Task-Status aktualisiert"}


# ===== DASHBOARD =====

@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    seven_days = now + timedelta(days=7)
    org_filter = get_org_filter(current_user)

    # Tasks scoped to what the user may see
    query = await task_scope_query(current_user)

    all_tasks = await db.tasks.find(query, {"_id": 0}).to_list(10000)

    overdue = 0
    due_soon = 0
    for t in all_tasks:
        if t["status"] == "open":
            due_str = t["due_date"]
            if due_str.endswith("Z"):
                due_str = due_str.replace("Z", "+00:00")
            elif "+" not in due_str and "T" in due_str:
                due_str = due_str + "+00:00"
            try:
                due = datetime.fromisoformat(due_str)
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                if due < now:
                    overdue += 1
                elif due <= seven_days:
                    due_soon += 1
            except Exception as e:
                logger.warning(f"Failed to parse due_date {t['due_date']}: {e}")

    case_query = {**org_filter}
    scope_ids = await visible_case_ids(current_user)
    if scope_ids is not None:
        case_query["id"] = {"$in": scope_ids}

    active = await db.cases.count_documents({**case_query, "status": "active", "case_type": {"$in": ["onboarding", None]}})
    completed = await db.cases.count_documents({**case_query, "status": "completed", "case_type": {"$in": ["onboarding", None]}})
    active_off = await db.cases.count_documents({**case_query, "status": "active", "case_type": "offboarding"})
    completed_off = await db.cases.count_documents({**case_query, "status": "completed", "case_type": "offboarding"})
    active_rc = await db.cases.count_documents({**case_query, "status": "active", "case_type": "rolechange"})
    completed_rc = await db.cases.count_documents({**case_query, "status": "completed", "case_type": "rolechange"})

    return DashboardStats(
        overdue_tasks=overdue,
        due_in_7_days=due_soon,
        active_cases=active,
        completed_cases=completed,
        active_offboardings=active_off,
        completed_offboardings=completed_off,
        active_rolechanges=active_rc,
        completed_rolechanges=completed_rc,
    )


# ===== PDF REPORT =====

@router.get("/cases/{case_id}/report")
async def get_case_report(case_id: str, current_user: dict = Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id, **get_org_filter(current_user)}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case nicht gefunden")

    # Only content managers or users with visible tasks in this case may export it
    if not can_manage_content(current_user):
        scope = await task_scope_query(current_user)
        if await db.tasks.count_documents({**scope, "case_id": case_id}) == 0:
            raise HTTPException(status_code=403, detail="Kein Zugriff auf diesen Vorgang")

    tasks = await db.tasks.find({"case_id": case_id}, {"_id": 0}).to_list(100)
    settings = await db.settings.find_one({}, {"_id": 0}) or {"org_name": "Meine Firma"}

    completed_tasks = [t for t in tasks if t["status"] == "done"]
    open_tasks = [t for t in tasks if t["status"] == "open"]

    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Onboarding Report - {case['employee_name']}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Helvetica', 'Arial', sans-serif; color: #1e293b; line-height: 1.6; padding: 40px; }}
        .header {{ background: #1e40af; color: white; padding: 30px; margin: -40px -40px 30px; }}
        .header h1 {{ font-size: 24px; margin-bottom: 5px; }}
        .meta {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }}
        .meta-item {{ background: #f8fafc; padding: 15px; border-radius: 8px; }}
        .meta-item label {{ font-size: 11px; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 5px; }}
        .stats {{ display: flex; gap: 20px; margin-bottom: 30px; }}
        .stat {{ background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px 20px; border-radius: 8px; text-align: center; }}
        .stat.warning {{ background: #fef3c7; border-color: #fcd34d; }}
        .stat-value {{ font-size: 28px; font-weight: 700; color: #166534; }}
        .stat.warning .stat-value {{ color: #92400e; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
        th, td {{ padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }}
        th {{ background: #f8fafc; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #64748b; }}
        .status {{ padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }}
        .status.done {{ background: #dcfce7; color: #166534; }}
        .status.open {{ background: #fee2e2; color: #991b1b; }}
        .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Onboarding Abschlussreport</h1>
        <p>{settings.get('org_name', 'Meine Firma')}</p>
    </div>
    <div class="meta">
        <div class="meta-item"><label>Mitarbeiter</label><span>{case['employee_name']}</span></div>
        <div class="meta-item"><label>E-Mail</label><span>{case['employee_email']}</span></div>
        <div class="meta-item"><label>Startdatum</label><span>{case['start_date'][:10]}</span></div>
        <div class="meta-item"><label>Template</label><span>{case['template_name_snapshot']}</span></div>
        <div class="meta-item"><label>Standort</label><span>{case.get('location', '-')}</span></div>
        <div class="meta-item"><label>Manager</label><span>{case['manager_email']}</span></div>
    </div>
    <div class="stats">
        <div class="stat"><div class="stat-value">{len(completed_tasks)}</div><div class="stat-label">Erledigt</div></div>
        <div class="stat warning"><div class="stat-value">{len(open_tasks)}</div><div class="stat-label">Offen</div></div>
        <div class="stat"><div class="stat-value">{len(tasks)}</div><div class="stat-label">Gesamt</div></div>
    </div>
    <h2 style="font-size:16px;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin-bottom:15px;">Aufgabenübersicht</h2>
    <table>
        <thead><tr><th>Aufgabe</th><th>Kategorie</th><th>Verantwortlich</th><th>Fällig</th><th>Status</th><th>Erledigt am</th></tr></thead>
        <tbody>
            {''.join([f"<tr><td>{t['title']}</td><td>{t['category']}</td><td>{t['owner_role_snapshot']}</td><td>{t['due_date'][:10]}</td><td><span class='status {t['status']}'>{'Erledigt' if t['status']=='done' else 'Offen'}</span></td><td>{(t.get('completed_at','')[:10] if t.get('completed_at') else '-')}</td></tr>" for t in tasks])}
        </tbody>
    </table>
    <div class="footer"><p>Erstellt am {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC • Welkora</p></div>
</body>
</html>"""

    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_content).write_pdf()
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=onboarding_report_{case['employee_name'].replace(' ', '_')}.pdf"},
        )
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        return StreamingResponse(
            io.BytesIO(html_content.encode()),
            media_type="text/html",
            headers={"Content-Disposition": f"attachment; filename=onboarding_report_{case['employee_name'].replace(' ', '_')}.html"},
        )
