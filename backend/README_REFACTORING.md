# OnboardIQ Backend - Refactoring Übersicht

## Aktuelle Struktur

Das Backend wurde für eine schrittweise Migration in eine modulare Struktur vorbereitet.

```
/app/backend/
├── server.py              # Haupt-API (aktuell ~3100 Zeilen) - NOCH AKTIV
├── server_backup.py       # Backup vor Refactoring
├── config.py              # Zentralisierte Konfiguration (DB, JWT, etc.)
├── models/                # Pydantic Models (vorbereitet)
│   ├── __init__.py
│   ├── user.py            # User, Token, Auth Models
│   ├── organization.py    # Organization, License Models
│   ├── case.py            # Case, Task, Evidence Models
│   ├── settings.py        # Settings, Category, Department, OwnerRole
│   └── gdpr.py            # GDPR/DSGVO Models
├── routers/               # API Routers (vorbereitet für Migration)
│   ├── __init__.py
│   ├── auth.py            # ✅ Voll implementiert
│   ├── admin.py           # ✅ Voll implementiert
│   ├── contact.py         # ✅ Voll implementiert
│   ├── org.py             # 📄 Vorbereitet (TODO)
│   ├── cases.py           # 📄 Vorbereitet (TODO)
│   ├── tasks.py           # 📄 Vorbereitet (TODO)
│   ├── settings.py        # 📄 Vorbereitet (TODO)
│   ├── dashboard.py       # 📄 Vorbereitet (TODO)
│   └── gdpr.py            # 📄 Vorbereitet (TODO)
├── services/              # Business Logic Services
│   ├── __init__.py
│   ├── auth.py            # ✅ JWT, Password Hashing, Dependencies
│   ├── audit.py           # ✅ Audit Logging
│   └── email.py           # ✅ Resend Email Service
└── utils/                 # Hilfsfunktionen
    ├── __init__.py
    └── helpers.py         # ✅ Gemeinsame Utilities
```

## Migrationsstrategie

Die Migration erfolgt schrittweise:

1. **Phase 1 (abgeschlossen)**: Extrahiere gemeinsame Komponenten
   - ✅ config.py - Zentrale Konfiguration
   - ✅ models/ - Pydantic Models
   - ✅ services/ - Business Logic (auth, audit, email)

2. **Phase 2 (in Vorbereitung)**: Router-Migration
   - ✅ routers/auth.py
   - ✅ routers/admin.py 
   - ✅ routers/contact.py
   - 📄 Weitere Router folgen

3. **Phase 3 (zukünftig)**: Integration
   - Importiere neue Router in server.py
   - Entferne migrierten Code aus server.py
   - Teste alle Endpoints

## Vorteile der neuen Struktur

- **Bessere Wartbarkeit**: Kleinere, fokussierte Dateien
- **Einfachere Tests**: Isolierte Module
- **Klare Verantwortlichkeiten**: Separation of Concerns
- **Wiederverwendbare Services**: Auth, Audit, Email als eigenständige Module

## Nächste Schritte

Um die Migration fortzusetzen:

1. Einen Router aus der TODO-Liste auswählen
2. Entsprechende Endpoints aus server.py in den Router kopieren
3. Imports anpassen (config, models, services)
4. Router in server.py importieren und registrieren
5. Alten Code aus server.py entfernen
6. Testen

## Beispiel: Router einbinden

```python
# In server.py hinzufügen:
from routers.auth import router as auth_router

# Vor dem CORS-Middleware:
api_router.include_router(auth_router)
```
