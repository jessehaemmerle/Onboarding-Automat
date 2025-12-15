# 🔑 Lizenzschlüssel-Verwaltung - Anleitung für System-Owner

## Lizenzschlüssel Generieren

### Via curl (Terminal/Kommandozeile)

**Basis-Befehl:**
```bash
curl -X POST "https://ihre-domain.com/api/admin/generate-license-keys" \
  -H "Content-Type: application/json" \
  -H "X-Master-Key: s#Uj[Hr<KPrs_5UtT.$y(WSWDVi^D$jBRd$tpM5;3rYL(L7V]kx_f@!x,BEvWnre" \
  -d '{
    "count": 1,
    "user_limit": 10,
    "notes": "Kunde Name - Datum"
  }'
```

**Für Localhost/Development:**
```bash
curl -X POST "http://localhost:8001/api/admin/generate-license-keys" \
  -H "Content-Type: application/json" \
  -H "X-Master-Key: s#Uj[Hr<KPrs_5UtT.$y(WSWDVi^D$jBRd$tpM5;3rYL(L7V]kx_f@!x,BEvWnre" \
  -d '{
    "count": 5,
    "user_limit": 20,
    "notes": "Test-Lizenzen Januar 2025"
  }'
```

### Parameter erklärt:

- **count**: Anzahl der zu generierenden Schlüssel (z.B. 1, 5, 10)
- **user_limit**: Maximale Anzahl Benutzer pro Lizenz (z.B. 5, 10, 20, 50)
- **notes**: Notiz für Ihre Verwaltung (z.B. Kundenname, Datum, Zweck)

### Beispiele:

**1 Lizenz für kleines Team (5 Benutzer):**
```bash
curl -X POST "http://localhost:8001/api/admin/generate-license-keys" \
  -H "Content-Type: application/json" \
  -H "X-Master-Key: s#Uj[Hr<KPrs_5UtT.$y(WSWDVi^D$jBRd$tpM5;3rYL(L7V]kx_f@!x,BEvWnre" \
  -d '{"count": 1, "user_limit": 5, "notes": "Startup ABC GmbH"}'
```

**10 Lizenzen für mittlere Unternehmen (20 Benutzer):**
```bash
curl -X POST "http://localhost:8001/api/admin/generate-license-keys" \
  -H "Content-Type: application/json" \
  -H "X-Master-Key: s#Uj[Hr<KPrs_5UtT.$y(WSWDVi^D$jBRd$tpM5;3rYL(L7V]kx_f@!x,BEvWnre" \
  -d '{"count": 10, "user_limit": 20, "notes": "Partner Paket - Q1 2025"}'
```

**1 Lizenz für großes Unternehmen (100 Benutzer):**
```bash
curl -X POST "http://localhost:8001/api/admin/generate-license-keys" \
  -H "Content-Type: application/json" \
  -H "X-Master-Key: s#Uj[Hr<KPrs_5UtT.$y(WSWDVi^D$jBRd$tpM5;3rYL(L7V]kx_f@!x,BEvWnre" \
  -d '{"count": 1, "user_limit": 100, "notes": "Enterprise Kunde XYZ AG"}'
```

### Response Beispiel:
```json
[
  {
    "id": "abc-123-def",
    "key": "OA-X7K9-M2P4-N8Q1",
    "status": "unused",
    "user_limit": 10,
    "notes": "Kunde ABC",
    "created_at": "2025-12-15T10:30:00+00:00",
    "activated_at": null,
    "organization_id": null
  }
]
```

---

## 🛠️ Was Sie als System-Owner tun können

### 1. **Lizenz-Verwaltung**
- ✅ Neue Lizenzschlüssel generieren (unbegrenzt)
- ✅ User-Limits festlegen (5, 10, 20, 50, 100, unbegrenzt)
- ✅ Notizen zu Lizenzen hinzufügen
- ✅ Lizenzen mit Ablaufdatum (zukünftige Erweiterung)

### 2. **Super-Admin-Zugang**
Als Super-Admin können Sie:
- ✅ **Alle Organizations sehen** (über alle Firmen hinweg)
- ✅ **Alle Cases einsehen** (firmenübergreifend)
- ✅ **In jede Organization wechseln**
- ✅ **System-weite Reports erstellen**
- ✅ **Probleme bei Kunden debuggen**

### 3. **User-Limit Management**
Sie können das User-Limit einer Organization nachträglich erhöhen:
```javascript
// Direkt in der MongoDB:
db.organizations.updateOne(
  {"id": "organization-id"},
  {"$set": {"user_limit": 50}}
)

// Oder via Python-Script:
await db.organizations.update_one(
  {"id": "organization_id"},
  {"$set": {"user_limit": 50}}
)
```

### 4. **Lizenz-Status Überprüfen**
Alle Lizenzen anzeigen:
```bash
# Alle Lizenzen abrufen (benötigt MongoDB-Zugriff)
mongo localhost:27017/test_database --eval "db.license_keys.find().pretty()"
```

### 5. **Organisation-Übersicht**
Alle Organisationen anzeigen:
```bash
mongo localhost:27017/test_database --eval "db.organizations.find({}, {name:1, license_key:1, user_limit:1, status:1}).pretty()"
```

---

## 📋 Workflow: Neuen Kunden onboarden

### Schritt 1: Lizenzschlüssel generieren
```bash
curl -X POST "http://localhost:8001/api/admin/generate-license-keys" \
  -H "Content-Type: application/json" \
  -H "X-Master-Key: s#Uj[Hr<KPrs_5UtT.$y(WSWDVi^D$jBRd$tpM5;3rYL(L7V]kx_f@!x,BEvWnre" \
  -d '{"count": 1, "user_limit": 10, "notes": "Neue Firma GmbH - Dezember 2025"}'
```

### Schritt 2: Lizenzschlüssel an Kunden senden
Per E-Mail oder Onboarding-Dokument:
```
Ihr Lizenzschlüssel: OA-X7K9-M2P4-N8Q1
User-Limit: 10 Benutzer
Registrierung: https://ihre-app.com/register-organization
```

### Schritt 3: Kunde registriert sich selbst
- Kunde geht auf `/register-organization`
- Gibt Firmendaten ein
- Gibt Lizenzschlüssel ein
- Erstellt Admin-Account
- Fertig! Kunde kann sofort loslegen

### Schritt 4: Support (falls nötig)
Als Super-Admin können Sie:
- In die Firma einloggen (mit Super-Admin-Rechten)
- Probleme debuggen
- User-Limit erhöhen
- Einstellungen anpassen

---

## 🔧 Erweiterte Funktionen

### Super-Admin Account erstellen
Fügen Sie ein Feld `is_super_admin: true` zu einem User hinzu:
```javascript
// In MongoDB:
db.users.updateOne(
  {"email": "ihre-email@domain.com"},
  {"$set": {"is_super_admin": true}}
)
```

Dann können Sie:
- Alle Organizations sehen
- Alle Daten einsehen
- Firmenübergreifend arbeiten

### Lizenz widerrufen
```javascript
// In MongoDB:
db.license_keys.updateOne(
  {"key": "OA-X7K9-M2P4-N8Q1"},
  {"$set": {"status": "revoked"}}
)
```

### Organisation deaktivieren
```javascript
// In MongoDB:
db.organizations.updateOne(
  {"id": "organization-id"},
  {"$set": {"status": "suspended"}}
)
```

---

## 📊 Monetarisierungs-Stufen (Beispiel)

### Starter (5 Users) - 29€/Monat
```bash
curl -X POST ... -d '{"count": 1, "user_limit": 5, "notes": "Starter Plan"}'
```

### Professional (20 Users) - 99€/Monat
```bash
curl -X POST ... -d '{"count": 1, "user_limit": 20, "notes": "Professional Plan"}'
```

### Enterprise (100+ Users) - 299€/Monat
```bash
curl -X POST ... -d '{"count": 1, "user_limit": 100, "notes": "Enterprise Plan"}'
```

---

## 🎯 Best Practices

1. **Lizenzschlüssel sicher aufbewahren**
   - Führen Sie eine Tabelle mit allen vergebenen Lizenzen
   - Notieren Sie Kunde, Datum, User-Limit

2. **User-Limits großzügig wählen**
   - Lieber 20 als 10 bei mittleren Unternehmen
   - Kunde kann später Upgrade bekommen

3. **Notizen nutzen**
   - Immer Kundenname + Datum in notes
   - Hilft bei späterer Verwaltung

4. **Testing**
   - Generieren Sie Test-Lizenzen für Demos
   - Markieren Sie diese klar als "DEMO"

5. **Support**
   - Erstellen Sie einen Super-Admin für Support
   - Können dann in Kunden-Organizations eingreifen

---

## ❓ Häufige Fragen

**Q: Kann ich eine Lizenz mehrfach verwenden?**
A: Nein, jeder Lizenzschlüssel kann nur einmal verwendet werden.

**Q: Was passiert, wenn User-Limit erreicht ist?**
A: Admin kann keine weiteren Benutzer hinzufügen. Sie müssen das Limit erhöhen.

**Q: Kann ich User-Limit nachträglich ändern?**
A: Ja, direkt in der MongoDB oder via Script.

**Q: Wie viele Lizenzen kann ich generieren?**
A: Unbegrenzt! Sie haben volle Kontrolle.

**Q: Kosten die Lizenzen etwas?**
A: Die App ist self-hosted. Sie entscheiden über Preise für Ihre Kunden.
