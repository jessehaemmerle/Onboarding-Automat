# 🔐 Production Security Keys - Onboarding-Automat

**WICHTIG:** Diese Datei enthält sensible Produktions-Keys. Niemals in Git committen!

## Generierte Production Keys

### JWT_SECRET
```
9.L(,xVQa]_WB2+n)seJ,5&pyNNaa9=Lm>HuAZ[a(?9R0Q[+&oNZTc6Hsf^yNCfM
```
- **Zweck:** Signierung der JSON Web Tokens für Benutzer-Authentifizierung
- **Länge:** 64 Zeichen
- **Status:** ✅ Aktiv in backend/.env
- **Getestet:** ✅ Login funktioniert

### MASTER_ADMIN_KEY
```
s#Uj[Hr<KPrs_5UtT.$y(WSWDVi^D$jBRd$tpM5;3rYL(L7V]kx_f@!x,BEvWnre
```
- **Zweck:** Generierung neuer Lizenzschlüssel (Admin-only Funktion)
- **Länge:** 64 Zeichen
- **Status:** ✅ Aktiv in backend/.env
- **Getestet:** ✅ Lizenzgenerierung funktioniert

## Verwendung

### Lizenzschlüssel generieren
```bash
curl -X POST "https://ihre-api.com/api/admin/generate-license-keys" \
  -H "Content-Type: application/json" \
  -H "X-Master-Key: s#Uj[Hr<KPrs_5UtT.$y(WSWDVi^D$jBRd$tpM5;3rYL(L7V]kx_f@!x,BEvWnre" \
  -d '{
    "count": 5,
    "user_limit": 10,
    "notes": "Kunde XYZ - Januar 2025"
  }'
```

## Bereits generierte Lizenzschlüssel

### Production Test Keys (verwendbar)
```
OA-9NNI-J6P7-SBRQ (10 Users, verfügbar)
OA-RFKV-SEB4-ZIOT (10 Users, verfügbar)
```

### Ältere Test Keys (verwendbar)
```
OA-IVDQ-L38U-EXQQ (5 Users, verfügbar)
OA-DD8W-V21B-LM67 (5 Users, verfügbar)
```

### Verwendete Keys
```
OA-LKMZ-9J17-KU0S (verwendet von "Test Firma GmbH")
```

## Sicherheitshinweise

1. **Niemals diese Keys öffentlich teilen**
2. **Niemals in Git Repository committen** (.gitignore ist bereits konfiguriert)
3. **Nur Sie sollten den MASTER_ADMIN_KEY kennen**
4. **Bei Kompromittierung sofort neue Keys generieren**
5. **Keys in Production-Umgebung über Environment Variables setzen, nicht über .env Dateien**

## Backup

Diese Keys wurden generiert am: **15. Dezember 2025**

Erstellen Sie ein Backup dieser Datei an einem sicheren Ort (z.B. verschlüsselter Password Manager).

## Key Rotation

Empfohlene Key-Rotation:
- **JWT_SECRET:** Alle 90 Tage
- **MASTER_ADMIN_KEY:** Bei Verdacht auf Kompromittierung

Bei Key-Rotation:
1. Neue Keys generieren
2. Backend neu starten
3. Alle Benutzer müssen sich neu einloggen (JWT_SECRET)
4. MASTER_ADMIN_KEY sofort aktualisieren
