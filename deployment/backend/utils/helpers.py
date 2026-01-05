"""Gemeinsame Hilfsfunktionen"""
from datetime import datetime, timezone

def get_current_timestamp() -> str:
    """Gibt aktuellen UTC Timestamp als ISO-String zurück"""
    return datetime.now(timezone.utc).isoformat()

def format_date_german(date_str: str) -> str:
    """Formatiert ISO-Datum in deutsches Format"""
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.strftime('%d.%m.%Y')
    except:
        return date_str
