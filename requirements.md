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

## Implemented Features (MVP + Phase 2)

### Backend (FastAPI + MongoDB)
- ✅ JWT Authentication (Register/Login)
- ✅ Role-based Access Control (Admin, Manager, Owner, Readonly)
- ✅ Template Management (CRUD, Duplicate) mit Typ (onboarding/offboarding)
- ✅ Onboarding Cases (Create, Reschedule, Complete)
- ✅ **NEUN** Offboarding Cases (eigener Typ, eigene Templates)
- ✅ Task Management (Status Toggle, Comments)
- ✅ **NEU** Evidence Upload (Dateien hochladen, herunterladen, löschen)
- ✅ **NEU** Evidence-Validation (Task nur abschließbar wenn Nachweis vorhanden)
- ✅ Owner Role Mapping
- ✅ Organization Settings
- ✅ Dashboard Statistics (inkl. Offboarding-Statistiken)
- ✅ PDF/HTML Report Generation
- ✅ Seed Data (6 Onboarding + 3 Offboarding Templates)

### Frontend (React + Shadcn UI)
- ✅ Login/Register Page
- ✅ Dashboard mit 6 KPI-Kacheln (inkl. Offboarding)
- ✅ Case Liste mit Tabs (Alle/Onboarding/Offboarding)
- ✅ Case Detail (Tasks, Kommentare, Evidence-Upload, Status)
- ✅ Neues Onboarding Wizard (2-Step)
- ✅ **NEU** Neues Offboarding Wizard (Mitarbeiter auswählen)
- ✅ **NEU** Evidence-Upload UI (Hochladen, Vorschau, Löschen)
- ✅ Template Verwaltung (Admin)
- ✅ Template Editor (Admin)
- ✅ Settings (Owner-Rollen, Org-Einstellungen)
- ✅ Deutsche UI

### Offboarding-Modul
- Templates: Standard Offboarding, IT-Mitarbeiter Offboarding, Führungskraft Offboarding
- Tasks inkl.: Zugänge sperren, Assets einfordern, Wissenstransfer, Exit-Interview
- Mitarbeiter aus bestehendem Onboarding auswählbar
- Lila Farbkodierung zur Unterscheidung
- Eigene KPIs im Dashboard

### Evidence-Upload
- Dateien bis 10MB (Bilder, PDFs, Office-Dokumente)
- Anzeige im Task-Modal mit Download/Löschen
- Task-Validierung: Kann nur abgeschlossen werden wenn Nachweis hochgeladen
- Audit-Trail: Wer hat wann hochgeladen

## API Endpoints (Neu/Erweitert)
- GET /api/cases?case_type=offboarding - Filter nach Typ
- GET /api/templates?template_type=offboarding - Filter nach Typ
- GET /api/employees/for-offboarding - Mitarbeiter für Offboarding
- GET /api/tasks/{id}/evidence - Nachweise abrufen
- POST /api/tasks/{id}/evidence - Nachweis hochladen
- GET /api/evidence/{id}/download - Nachweis herunterladen
- DELETE /api/evidence/{id} - Nachweis löschen

## Next Action Items

### High Priority
1. **E-Mail Notifications** - SMTP Integration für Reminder
2. **Role Change Flow** - Abteilungswechsel mit neuen Tasks
3. **Audit Log** - Änderungshistorie für Compliance

### Medium Priority
4. **Slack/Teams Integration** - Benachrichtigungen
5. **Multi-Tenant/MSP** - Mandantenfähigkeit
6. **SSO Integration** - OAuth/SAML

### Low Priority
7. **M365/Google Provisioning** - Account-Erstellung
8. **Jira/Asana Sync** - Task-Synchronisation
9. **Mobile-optimierte Ansicht**

## Test Credentials
- Email: admin@test.de
- Password: test123
