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

## Implemented Features (MVP)

### Backend (FastAPI + MongoDB)
- ✅ JWT Authentication (Register/Login)
- ✅ Role-based Access Control (Admin, Manager, Owner, Readonly)
- ✅ Template Management (CRUD, Duplicate)
- ✅ Onboarding Cases (Create, Reschedule, Complete)
- ✅ Task Management (Status Toggle, Comments)
- ✅ Owner Role Mapping
- ✅ Organization Settings
- ✅ Dashboard Statistics
- ✅ PDF/HTML Report Generation
- ✅ Seed Data (6 Templates, 5 Owner Roles)

### Frontend (React + Shadcn UI)
- ✅ Login/Register Page
- ✅ Dashboard mit KPI-Kacheln
- ✅ Case Liste (Suche, Filter, Sortierung)
- ✅ Case Detail (Tasks, Kommentare, Status)
- ✅ Neues Onboarding Wizard (2-Step)
- ✅ Template Verwaltung (Admin)
- ✅ Template Editor (Admin)
- ✅ Settings (Owner-Rollen, Org-Einstellungen)
- ✅ Deutsche UI

### Data Model
- Users (email, name, role, password_hash)
- Templates (name, description, tasks[])
- TemplateTasks (title, category, owner_role, offset_days)
- OnboardingCases (employee info, template snapshot, start_date, status)
- Tasks (due_date calculated from offset, status, owner_email)
- TaskComments (body, user info, timestamps)
- OwnerRoles (name, emails[])
- OrgSettings (org_name, timezone, reminder config)

## API Endpoints
- POST /api/auth/register, /api/auth/login, GET /api/auth/me
- GET/POST/PUT/DELETE /api/templates, POST /api/templates/{id}/duplicate
- GET/POST /api/cases, PATCH /api/cases/{id}/reschedule, /status
- PATCH /api/tasks/{id}/status, GET/POST /api/tasks/{id}/comments
- GET /api/tasks/my-tasks
- GET /api/dashboard/stats
- GET/PUT /api/settings
- GET/POST/PUT/DELETE /api/owner-roles
- GET /api/cases/{id}/report (PDF)
- POST /api/seed

## Next Action Items (Phase 2)

### High Priority
1. **Offboarding-Modul** - Zugänge schließen, Assets einfordern, Übergaben
2. **Evidence Upload** - Dokumente/Screenshots an Tasks anhängen
3. **E-Mail Notifications** - SMTP Integration für Reminder
4. **Role Change Flow** - Abteilungswechsel mit neuen Tasks

### Medium Priority
5. **Audit Log** - Änderungshistorie für Compliance
6. **Slack/Teams Integration** - Benachrichtigungen
7. **Multi-Tenant/MSP** - Mandantenfähigkeit
8. **SSO Integration** - OAuth/SAML

### Low Priority
9. **M365/Google Provisioning** - Account-Erstellung
10. **Jira/Asana Sync** - Task-Synchronisation
11. **Mobile-optimierte Ansicht**
12. **White-Label Option**

## Test Credentials
- Email: admin@test.de
- Password: test123
