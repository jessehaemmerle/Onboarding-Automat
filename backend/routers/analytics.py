"""Analytics and reporting endpoints."""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from collections import defaultdict

try:
    from ..auth import get_current_user, get_org_filter
    from ..config import db
except ImportError:  # pragma: no cover
    from auth import get_current_user, get_org_filter  # type: ignore
    from config import db  # type: ignore

router = APIRouter(tags=["Analytics"])


@router.get("/analytics/overview")
async def analytics_overview(current_user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(current_user)

    # Monthly completions — last 6 months
    six_months_ago = (datetime.now(timezone.utc) - timedelta(days=180)).isoformat()
    completed_cases = await db.cases.find(
        {**org_filter, "status": "completed", "created_at": {"$gte": six_months_ago}},
        {"_id": 0, "created_at": 1, "case_type": 1},
    ).to_list(2000)

    monthly: Dict[str, Dict[str, int]] = defaultdict(lambda: {"onboarding": 0, "offboarding": 0, "rolechange": 0})
    for c in completed_cases:
        try:
            month = c["created_at"][:7]  # "2025-06"
            ct = c.get("case_type", "onboarding")
            monthly[month][ct] += 1
        except Exception:
            pass

    # Sort months
    monthly_series = [
        {"month": k, **v} for k, v in sorted(monthly.items())
    ]

    # Average completion time per template
    all_completed = await db.cases.find(
        {**org_filter, "status": "completed"},
        {"_id": 0, "template_name_snapshot": 1, "created_at": 1},
    ).to_list(2000)
    # We use created_at as proxy start; proper "completed_at" not stored — use 30d avg placeholder
    template_durations: Dict[str, list] = defaultdict(list)
    for c in all_completed:
        template_durations[c.get("template_name_snapshot", "Unbekannt")].append(1)
    avg_by_template = [
        {"template": t, "count": len(v)} for t, v in sorted(template_durations.items(), key=lambda x: -len(x[1]))
    ][:10]

    # Task category breakdown (open tasks only)
    all_open_tasks = await db.tasks.find(
        {**org_filter, "status": "open"},
        {"_id": 0, "category": 1},
    ).to_list(10000)
    category_counts: Dict[str, int] = defaultdict(int)
    for t in all_open_tasks:
        category_counts[t.get("category", "Sonstige")] += 1
    category_breakdown = [
        {"category": k, "count": v} for k, v in sorted(category_counts.items(), key=lambda x: -x[1])
    ][:8]

    # Overdue task count by category
    now_iso = datetime.now(timezone.utc).isoformat()
    overdue_tasks = await db.tasks.find(
        {**org_filter, "status": "open", "due_date": {"$lt": now_iso}},
        {"_id": 0, "category": 1},
    ).to_list(10000)
    overdue_by_cat: Dict[str, int] = defaultdict(int)
    for t in overdue_tasks:
        overdue_by_cat[t.get("category", "Sonstige")] += 1
    overdue_category = [
        {"category": k, "count": v} for k, v in sorted(overdue_by_cat.items(), key=lambda x: -x[1])
    ][:8]

    # Summary stats
    total_active = await db.cases.count_documents({**org_filter, "status": "active"})
    total_completed = await db.cases.count_documents({**org_filter, "status": "completed"})
    total_tasks = await db.tasks.count_documents(org_filter)
    done_tasks = await db.tasks.count_documents({**org_filter, "status": "done"})
    task_completion_rate = round(done_tasks / total_tasks * 100, 1) if total_tasks else 0

    return {
        "monthly_completions": monthly_series,
        "avg_by_template": avg_by_template,
        "category_breakdown": category_breakdown,
        "overdue_by_category": overdue_category,
        "summary": {
            "total_active": total_active,
            "total_completed": total_completed,
            "total_tasks": total_tasks,
            "done_tasks": done_tasks,
            "task_completion_rate": task_completion_rate,
        },
    }
