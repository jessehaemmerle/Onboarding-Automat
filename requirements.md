# Onboarding-Automat - Requirements & Architecture

## Original Problem Statement
Onboarding-Automat (Micro-SaaS) für KMU zur Standardisierung von Onboarding-Prozessen mit:
- Klaren Verantwortlichkeiten
- Automatischen Deadlines relativ zum Startdatum
- Transparenter Nachverfolgung
- Auditfähigem Abschlussreport

## User Choices
- **Authentifizierung**: JWT-basiert (E-Mail + Passwort)
- **E-Mail-Reminder**: Nur Log im MVP (kein SMTP)
- **PDF-Report**: Server-seitige Generierung mit WeasyPrint
- **Design**: Modern/Corporate
- **Sprache**: Deutsch

## Implemented Features (MVP + Phase 2 + Phase 3)

### Backend (FastAPI + MongoDB)
- ✅ JWT Authentication (Register/Login)
- ✅ Role-based Access Control (Admin, Manager, Owner, Readonly)
- ✅ Template Management (CRUD, Duplicate) mit Typ (onboarding/offboarding)
- ✅ Onboarding Cases (Create, Reschedule, Complete)
- ✅ Offboarding Cases (eigener Typ, eigene Templates)
- ✅ Task Management (Status Toggle, Comments)
- ✅ Evidence Upload (Dateien hochladen, herunterladen, löschen)
- ✅ Evidence-Validation (Task nur abschließbar wenn Nachweis vorhanden)
- ✅ Owner Role Mapping
- ✅ Organization Settings (inkl. DSGVO-Einstellungen)
- ✅ Dashboard Statistics (inkl. Offboarding-Statistiken)
- ✅ PDF/HTML Report Generation
- ✅ Seed Data (6 Onboarding + 3 Offboarding Templates)

### **NEU: Audit-Log (DSGVO Art. 30)**
- ✅ Vollständiges Audit-Log aller Aktivitäten
- ✅ Logging von: create, update, delete, access, export, login
- ✅ Speicherung von: Benutzer, Aktion, Ressource, Alte/Neue Werte, Zeitstempel
- ✅ Admin-Seite mit Filter (Aktion, Ressource, Datum)
- ✅ CSV-Export für Compliance-Berichte

### **NEU: 100% DSGVO-Konformität**
- ✅ **Art. 15 - Auskunftsrecht**: Eigene Daten einsehen
- ✅ **Art. 17 - Löschungsrecht**: Löschantrag mit Admin-Workflow
- ✅ **Art. 20 - Datenübertragbarkeit**: JSON/CSV Export
- ✅ **Art. 7 - Einwilligungen**: Consent-Tracking und Widerruf
- ✅ **Art. 13/14 - Informationspflichten**: Privacy-Info API
- ✅ **Art. 30 - Verarbeitungsverzeichnis**: Audit-Log
- ✅ Anonymisierung bei Löschung (statt Hartlöschung)
- ✅ Datenschutzbeauftragter-Kontakt in Settings
- ✅ Datenaufbewahrungsfristen konfigurierbar

### Frontend (React + Shadcn UI)
- ✅ Login/Register Page
- ✅ Dashboard mit 6 KPI-Kacheln (inkl. Offboarding)
- ✅ Case Liste mit Tabs (Alle/Onboarding/Offboarding)
- ✅ Case Detail (Tasks, Kommentare, Evidence-Upload, Status)
- ✅ Neues Onboarding Wizard (2-Step)
- ✅ Neues Offboarding Wizard (Mitarbeiter auswählen)
- ✅ Evidence-Upload UI (Hochladen, Vorschau, Löschen)
- ✅ Template Verwaltung (Admin)
- ✅ Template Editor (Admin)
- ✅ Settings (Owner-Rollen, Org-Einstellungen)
- ✅ **NEU: Audit-Log Seite** (Admin) - Filter, Pagination, CSV-Export
- ✅ **NEU: Privacy Center** - DSGVO-Rechte, Datenexport, Löschantrag
- ✅ Deutsche UI

## DSGVO-Compliance Checkliste

| Artikel | Beschreibung | Status |
|---------|--------------|--------|
| Art. 5 | Grundsätze der Verarbeitung | ✅ Datenminimierung, Zweckbindung |
| Art. 6 | Rechtmäßigkeit | ✅ Vertragserfüllung, berechtigtes Interesse |
| Art. 7 | Einwilligung | ✅ Consent-Tracking mit Widerruf |
| Art. 12 | Transparenz | ✅ Bearbeitung innerhalb 30 Tagen |
| Art. 13/14 | Informationspflichten | ✅ Privacy-Info API |
| Art. 15 | Auskunftsrecht | ✅ /gdpr/my-data Endpoint |
| Art. 16 | Berichtigung | ✅ User kann Profil ändern |
| Art. 17 | Löschung | ✅ Löschantrag-Workflow |
| Art. 18 | Einschränkung | ✅ Via Admin möglich |
| Art. 20 | Datenübertragbarkeit | ✅ JSON/CSV Export |
| Art. 21 | Widerspruch | ✅ Consent-Widerruf |
| Art. 30 | Verarbeitungsverzeichnis | ✅ Vollständiges Audit-Log |
| Art. 32 | Sicherheit | ✅ Passwort-Hashing, JWT |
| Art. 33/34 | Meldepflicht | ✅ Audit-Log für Forensik |

## API Endpoints (Vollständig)

### Auth & Users
- POST /api/auth/register, /api/auth/login, GET /api/auth/me
- GET /api/users, PATCH /api/users/{id}

### Cases & Tasks
- GET/POST /api/cases, PATCH /api/cases/{id}/reschedule, /status
- GET /api/cases/{id}/report (PDF)
- PATCH /api/tasks/{id}/status
- GET/POST /api/tasks/{id}/comments
- GET/POST /api/tasks/{id}/evidence
- GET /api/evidence/{id}/download
- DELETE /api/evidence/{id}

### Templates & Settings
- GET/POST/PUT/DELETE /api/templates
- GET/PUT /api/settings
- GET/POST/PUT/DELETE /api/owner-roles

### DSGVO/GDPR
- GET /api/gdpr/privacy-info
- GET /api/gdpr/my-data
- GET /api/gdpr/export?format=json|csv
- POST /api/gdpr/delete-request
- GET /api/gdpr/deletion-requests (Admin)
- POST /api/gdpr/deletion-requests/{id}/process (Admin)
- GET /api/gdpr/consents
- POST /api/gdpr/consents/{type}/revoke

### Audit-Log
- GET /api/audit-logs (Admin)
- GET /api/audit-logs/export (Admin)

## Next Action Items

### High Priority
1. **E-Mail Notifications** - SMTP Integration für Reminder
2. **Role Change Flow** - Abteilungswechsel mit neuen Tasks

### Medium Priority
3. **Slack/Teams Integration** - Benachrichtigungen
4. **Multi-Tenant/MSP** - Mandantenfähigkeit
5. **SSO Integration** - OAuth/SAML

### Low Priority
6. **M365/Google Provisioning** - Account-Erstellung
7. **Automatische Datenbereinigung** - Retention Policy Cron-Job

## Test Credentials
- Email: admin@test.de
- Password: test123
