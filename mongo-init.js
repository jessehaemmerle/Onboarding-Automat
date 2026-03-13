db = db.getSiblingDB("onboardiq");

db.createCollection("users");
db.createCollection("organizations");
db.createCollection("license_keys");
db.createCollection("cases");
db.createCollection("tasks");
db.createCollection("templates");
db.createCollection("owner_roles");
db.createCollection("categories");
db.createCollection("departments");
db.createCollection("evidence");
db.createCollection("task_comments");
db.createCollection("audit_logs");
db.createCollection("subscriptions");
db.createCollection("org_settings");
db.createCollection("consents");
db.createCollection("deletion_requests");
db.createCollection("contact_requests");
db.createCollection("evidence_policies");
db.createCollection("upgrade_requests");

db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ id: 1 }, { unique: true });
db.users.createIndex({ organization_id: 1 });
db.organizations.createIndex({ id: 1 }, { unique: true });
db.license_keys.createIndex({ id: 1 }, { unique: true });
db.license_keys.createIndex({ key: 1 }, { unique: true });
db.cases.createIndex({ id: 1 }, { unique: true });
db.cases.createIndex({ organization_id: 1 });
db.tasks.createIndex({ id: 1 }, { unique: true });
db.tasks.createIndex({ case_id: 1 });
db.templates.createIndex({ id: 1 }, { unique: true });
db.audit_logs.createIndex({ timestamp: -1 });
db.audit_logs.createIndex({ organization_id: 1 });

print("Onboarding-Automat database initialized.");
