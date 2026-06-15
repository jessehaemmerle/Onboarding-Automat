"""Email notification system using Resend."""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

try:
    from ..config import db, logger, RESEND_API_KEY, SENDER_EMAIL
except ImportError:  # pragma: no cover
    from config import db, logger, RESEND_API_KEY, SENDER_EMAIL  # type: ignore

import resend


def _resend_client() -> bool:
    if not RESEND_API_KEY:
        return False
    resend.api_key = RESEND_API_KEY
    return True


async def send_email(to: str, subject: str, html: str) -> bool:
    if not _resend_client():
        logger.warning("RESEND_API_KEY not set – skipping email")
        return False
    try:
        resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": to,
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as e:
        logger.error(f"Email send failed to {to}: {e}")
        return False


def _case_color(case_type: str) -> str:
    return {"offboarding": "#8b5cf6", "rolechange": "#f59e0b"}.get(case_type, "#3b82f6")


async def notify_case_created(case: dict, tasks: list):
    """Send welcome email to employee and notification to manager."""
    case_type_label = {"offboarding": "Offboarding", "rolechange": "Rollenwechsel"}.get(
        case.get("case_type", "onboarding"), "Onboarding"
    )
    color = _case_color(case.get("case_type", "onboarding"))
    task_rows = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #e5e7eb'>{t['title']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280'>{t.get('category','')}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #e5e7eb'>{t.get('due_date','')[:10]}</td></tr>"
        for t in tasks[:10]
    )

    # Manager notification
    manager_html = f"""
    <div style='font-family:sans-serif;max-width:600px;margin:auto'>
      <div style='background:{color};padding:24px;border-radius:12px 12px 0 0'>
        <h1 style='color:white;margin:0;font-size:22px'>Neues {case_type_label} gestartet</h1>
      </div>
      <div style='background:#f9fafb;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb'>
        <p style='color:#374151'>Ein neuer Vorgang wurde für <strong>{case['employee_name']}</strong> angelegt.</p>
        <table style='width:100%;border-collapse:collapse;margin:16px 0;background:white;border-radius:8px;overflow:hidden'>
          <thead><tr style='background:{color};color:white'>
            <th style='padding:10px;text-align:left'>Task</th>
            <th style='padding:10px;text-align:left'>Kategorie</th>
            <th style='padding:10px;text-align:left'>Fällig</th>
          </tr></thead>
          <tbody>{task_rows}</tbody>
        </table>
        <p style='color:#6b7280;font-size:13px'>Welkora – HR-Automatisierung</p>
      </div>
    </div>"""
    await send_email(
        case["manager_email"],
        f"[Welkora] Neues {case_type_label}: {case['employee_name']}",
        manager_html,
    )


async def notify_case_completed(case: dict):
    color = _case_color(case.get("case_type", "onboarding"))
    case_type_label = {"offboarding": "Offboarding", "rolechange": "Rollenwechsel"}.get(
        case.get("case_type", "onboarding"), "Onboarding"
    )
    html = f"""
    <div style='font-family:sans-serif;max-width:600px;margin:auto'>
      <div style='background:#10b981;padding:24px;border-radius:12px 12px 0 0'>
        <h1 style='color:white;margin:0'>✅ {case_type_label} abgeschlossen</h1>
      </div>
      <div style='background:#f0fdf4;padding:24px;border-radius:0 0 12px 12px;border:1px solid #d1fae5'>
        <p>Das {case_type_label} von <strong>{case['employee_name']}</strong> wurde erfolgreich abgeschlossen.</p>
        <p style='color:#6b7280;font-size:13px'>Welkora – HR-Automatisierung</p>
      </div>
    </div>"""
    await send_email(
        case["manager_email"],
        f"[Welkora] {case_type_label} abgeschlossen: {case['employee_name']}",
        html,
    )


async def notify_task_assigned(task: dict, employee_name: str):
    """Notify the task owner that a task was assigned."""
    if not task.get("owner_email"):
        return
    html = f"""
    <div style='font-family:sans-serif;max-width:600px;margin:auto'>
      <div style='background:#3b82f6;padding:24px;border-radius:12px 12px 0 0'>
        <h1 style='color:white;margin:0;font-size:20px'>Neue Aufgabe zugewiesen</h1>
      </div>
      <div style='background:#eff6ff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #bfdbfe'>
        <p>Ihnen wurde eine Aufgabe im Rahmen des Onboardings von <strong>{employee_name}</strong> zugewiesen.</p>
        <div style='background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb'>
          <p style='font-weight:bold;margin:0 0 8px'>{task['title']}</p>
          <p style='color:#6b7280;margin:0;font-size:14px'>Fällig: {task.get('due_date','')[:10]} · {task.get('category','')}</p>
        </div>
        <p style='color:#6b7280;font-size:13px'>Welkora – HR-Automatisierung</p>
      </div>
    </div>"""
    await send_email(
        task["owner_email"],
        f"[Welkora] Neue Aufgabe: {task['title']}",
        html,
    )


async def daily_reminder_job():
    """Background cron: daily reminders for overdue and upcoming tasks."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            next_run = now.replace(hour=8, minute=0, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)
            await asyncio.sleep((next_run - now).total_seconds())

            logger.info("Running daily reminder job...")
            settings_docs = await db.settings.find({}, {"_id": 0}).to_list(1000)
            settings_map = {s["organization_id"]: s for s in settings_docs if "organization_id" in s}

            now_iso = datetime.now(timezone.utc).isoformat()
            seven_days = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

            # Find tasks due within 7 days or overdue, still open
            upcoming_tasks = await db.tasks.find(
                {"status": "open", "due_date": {"$lte": seven_days}},
                {"_id": 0},
            ).to_list(5000)

            # Group by owner_email
            by_owner: dict = {}
            for t in upcoming_tasks:
                email = t.get("owner_email")
                if email:
                    by_owner.setdefault(email, []).append(t)

            sent = 0
            for owner_email, tasks in by_owner.items():
                overdue = [t for t in tasks if t["due_date"] < now_iso]
                upcoming = [t for t in tasks if now_iso <= t["due_date"] <= seven_days]
                if not overdue and not upcoming:
                    continue

                overdue_rows = "".join(
                    f"<tr><td style='padding:8px;border-bottom:1px solid #fee2e2;color:#dc2626'>{t['title']}</td>"
                    f"<td style='padding:8px;border-bottom:1px solid #fee2e2;color:#6b7280'>{t['due_date'][:10]}</td></tr>"
                    for t in overdue[:5]
                )
                upcoming_rows = "".join(
                    f"<tr><td style='padding:8px;border-bottom:1px solid #e5e7eb'>{t['title']}</td>"
                    f"<td style='padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280'>{t['due_date'][:10]}</td></tr>"
                    for t in upcoming[:5]
                )

                overdue_section = f"""
                <h3 style='color:#dc2626;margin:16px 0 8px'>⚠️ Überfällig ({len(overdue)})</h3>
                <table style='width:100%;border-collapse:collapse'>
                  <tbody>{overdue_rows}</tbody>
                </table>""" if overdue else ""

                upcoming_section = f"""
                <h3 style='color:#d97706;margin:16px 0 8px'>🕐 Fällig in 7 Tagen ({len(upcoming)})</h3>
                <table style='width:100%;border-collapse:collapse'>
                  <tbody>{upcoming_rows}</tbody>
                </table>""" if upcoming else ""

                html = f"""
                <div style='font-family:sans-serif;max-width:600px;margin:auto'>
                  <div style='background:#1e293b;padding:24px;border-radius:12px 12px 0 0'>
                    <h1 style='color:white;margin:0;font-size:20px'>Tägliche Aufgaben-Übersicht</h1>
                  </div>
                  <div style='background:#f9fafb;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb'>
                    {overdue_section}
                    {upcoming_section}
                    <p style='color:#6b7280;font-size:13px;margin-top:24px'>Welkora – HR-Automatisierung</p>
                  </div>
                </div>"""

                await send_email(owner_email, f"[Welkora] Ihre Aufgaben-Übersicht ({len(overdue)} überfällig)", html)
                sent += 1

            logger.info(f"Daily reminders sent to {sent} recipients")
        except Exception as e:
            logger.error(f"Daily reminder job error: {e}")
            await asyncio.sleep(3600)
