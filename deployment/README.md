# OnboardIQ - Selbst-gehostetes Deployment

## 🚀 Schnellstart

```bash
# 1. Repository klonen oder Dateien herunterladen
git clone <ihr-repo> onboardiq
cd onboardiq

# 2. Deployment-Skript ausführbar machen
chmod +x deploy.sh

# 3. OnboardIQ starten
./deploy.sh
```

Das war's! Die Anwendung ist unter `http://localhost` erreichbar.

---

## 📋 Systemvoraussetzungen

- **Betriebssystem:** Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+)
- **Docker:** Version 20.10+
- **Docker Compose:** Version 2.0+
- **RAM:** Mindestens 2 GB
- **Speicher:** Mindestens 10 GB frei
- **Ports:** 80, 443, 8001, 27017 (anpassbar)

### Docker installieren (falls nicht vorhanden)

```bash
# Docker installieren
curl -fsSL https://get.docker.com | sh

# Benutzer zur Docker-Gruppe hinzufügen
sudo usermod -aG docker $USER

# Neuanmeldung erforderlich
logout
# Dann wieder anmelden
```

---

## 🔧 Konfiguration

### Umgebungsvariablen (.env)

Die `.env` Datei wird beim ersten Start automatisch erstellt. Sie können sie vorher anpassen:

```bash
cp .env.example .env
nano .env
```

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `MONGO_ROOT_PASSWORD` | MongoDB Passwort | *automatisch generiert* |
| `JWT_SECRET` | Geheimer Schlüssel für Token | *automatisch generiert* |
| `MASTER_ADMIN_KEY` | Key für Lizenz-Generierung | *automatisch generiert* |
| `SUPER_ADMIN_EMAIL` | Super-Admin E-Mail | admin@onboardiq.local |
| `SUPER_ADMIN_PASSWORD` | Super-Admin Passwort | *automatisch generiert* |
| `BACKEND_URL` | Backend-URL für Frontend | http://localhost:8001 |
| `RESEND_API_KEY` | API-Key für E-Mail-Versand | *(optional)* |

---

## 🖥️ Verwaltung

### Container steuern

```bash
# Status anzeigen
docker ps

# Logs anzeigen (live)
./deploy.sh --logs

# Oder für einzelne Services:
docker logs -f onboardiq-backend
docker logs -f onboardiq-frontend
docker logs -f onboardiq-db

# Container neustarten
./deploy.sh --restart

# Container stoppen
./deploy.sh --stop

# Alles entfernen (ACHTUNG: Löscht auch Daten!)
./deploy.sh --cleanup
```

### Datenbank-Backup

```bash
# Backup erstellen
docker exec onboardiq-db mongodump --out /data/backup
docker cp onboardiq-db:/data/backup ./backup_$(date +%Y%m%d)

# Backup wiederherstellen
docker cp ./backup_DATUM onboardiq-db:/data/backup
docker exec onboardiq-db mongorestore /data/backup
```

---

## 🌐 Production-Deployment

### Mit eigenem Domain & SSL

1. **DNS konfigurieren:** A-Record auf Server-IP

2. **docker-compose.yml anpassen:**
```yaml
frontend:
  build:
    args:
      - REACT_APP_BACKEND_URL=https://api.ihredomain.de
```

3. **.env anpassen:**
```env
BACKEND_URL=https://api.ihredomain.de
```

4. **SSL mit Let's Encrypt (empfohlen):**
```bash
# Certbot installieren
sudo apt install certbot

# Zertifikat erstellen
sudo certbot certonly --standalone -d ihredomain.de -d api.ihredomain.de

# Zertifikate in nginx einbinden (siehe nginx/nginx-ssl.conf)
```

### Hinter Reverse Proxy (Nginx/Traefik)

Wenn Sie bereits einen Reverse Proxy haben:

```nginx
# /etc/nginx/sites-available/onboardiq
server {
    listen 80;
    server_name onboardiq.ihredomain.de;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name onboardiq.ihredomain.de;
    
    ssl_certificate /etc/letsencrypt/live/ihredomain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ihredomain.de/privkey.pem;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api/ {
        proxy_pass http://localhost:8001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 📊 Erste Schritte nach Installation

### 1. Super-Admin Login

1. Öffnen Sie `http://localhost/admin/login`
2. Melden Sie sich mit den generierten Zugangsdaten an
3. Notieren Sie sich den **Master-Admin-Key** aus der Konsole

### 2. Lizenzen generieren

1. Im Admin-Panel: Tab "Lizenzen Generieren"
2. Master-Admin-Key eingeben
3. Anzahl und Benutzer-Limit festlegen
4. Generierte Schlüssel an Kunden weitergeben

### 3. Organisation registrieren

1. Öffnen Sie `http://localhost/register`
2. Geben Sie den Lizenzschlüssel ein
3. Organisation und Admin-Account erstellen

### 4. Loslegen

- Templates erstellen
- Kategorien und Abteilungen einrichten
- Mitarbeiter onboarden!

---

## 🔒 Sicherheitshinweise

- [ ] Ändern Sie alle Standard-Passwörter
- [ ] Verwenden Sie starke, einzigartige Passwörter
- [ ] Aktivieren Sie SSL/TLS in Production
- [ ] Beschränken Sie Port-Zugriff per Firewall
- [ ] Erstellen Sie regelmäßige Backups
- [ ] Halten Sie Docker und das System aktuell

---

## 🐛 Fehlerbehebung

### Container startet nicht

```bash
# Logs prüfen
docker logs onboardiq-backend

# Container neustarten
docker restart onboardiq-backend
```

### Datenbank-Verbindungsfehler

```bash
# MongoDB-Status prüfen
docker exec onboardiq-db mongosh --eval "db.runCommand('ping')"

# MongoDB-Logs
docker logs onboardiq-db
```

### Port bereits belegt

```bash
# Prüfen welcher Prozess den Port nutzt
sudo lsof -i :80
sudo lsof -i :8001

# In docker-compose.yml andere Ports verwenden
ports:
  - "8080:80"   # Frontend auf Port 8080
```

### Speicherplatz voll

```bash
# Docker-Speicher aufräumen
docker system prune -a

# Ungenutzte Volumes entfernen
docker volume prune
```

---

## 📞 Support

Bei Fragen oder Problemen:

- **Dokumentation:** Diese README.md
- **Issues:** GitHub Issues (falls verfügbar)
- **E-Mail:** support@onboardiq.local

---

## 📜 Lizenz

OnboardIQ - HR Automatisierung
© 2024-2025 - Alle Rechte vorbehalten

---

**Viel Erfolg mit OnboardIQ! 🎉**
