#!/bin/bash

# ===========================================
# OnboardIQ - Automatisches Deployment-Skript
# ===========================================
# Dieses Skript installiert und startet die komplette
# OnboardIQ-Anwendung mit einem einzigen Befehl.
#
# Verwendung:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Optionen:
#   ./deploy.sh --production    # Production-Modus mit SSL
#   ./deploy.sh --stop          # Container stoppen
#   ./deploy.sh --restart       # Container neustarten
#   ./deploy.sh --logs          # Logs anzeigen
#   ./deploy.sh --cleanup       # Alles entfernen
# ===========================================

set -e

# Farben für Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║     ⚡ OnboardIQ - HR Automatisierung                     ║"
    echo "║                                                           ║"
    echo "║     Deployment Script v1.0                                ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Logging-Funktionen
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Prüfe Voraussetzungen
check_requirements() {
    log_info "Prüfe Systemvoraussetzungen..."
    
    # Docker prüfen
    if ! command -v docker &> /dev/null; then
        log_error "Docker ist nicht installiert!"
        echo ""
        echo "Installieren Sie Docker mit:"
        echo "  curl -fsSL https://get.docker.com | sh"
        echo "  sudo usermod -aG docker \$USER"
        exit 1
    fi
    log_success "Docker gefunden: $(docker --version)"
    
    # Docker Compose prüfen
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose ist nicht installiert!"
        exit 1
    fi
    log_success "Docker Compose gefunden"
    
    # Prüfe ob Docker läuft
    if ! docker info &> /dev/null; then
        log_error "Docker daemon läuft nicht!"
        echo "Starten Sie Docker mit: sudo systemctl start docker"
        exit 1
    fi
    log_success "Docker daemon läuft"
}

# Erstelle .env Datei falls nicht vorhanden
setup_env() {
    if [ ! -f .env ]; then
        log_info "Erstelle .env Datei..."
        
        # Generiere sichere Zufallswerte
        JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
        MASTER_KEY=$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
        MONGO_PASS=$(openssl rand -base64 24 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 24 | head -n 1)
        ADMIN_PASS=$(openssl rand -base64 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9!@#' | fold -w 16 | head -n 1)
        
        cat > .env << EOF
# OnboardIQ Konfiguration - Automatisch generiert am $(date)

# MongoDB
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=${MONGO_PASS}

# Sicherheit
JWT_SECRET=${JWT_SECRET}
MASTER_ADMIN_KEY=${MASTER_KEY}

# Super-Admin Account
SUPER_ADMIN_EMAIL=admin@onboardiq.local
SUPER_ADMIN_PASSWORD=${ADMIN_PASS}
SUPER_ADMIN_NAME=Administrator

# Backend URL (anpassen für Production)
BACKEND_URL=http://localhost:8001

# E-Mail (optional)
RESEND_API_KEY=
SENDER_EMAIL=onboarding@resend.dev
EOF
        
        log_success ".env Datei erstellt"
        echo ""
        log_warning "WICHTIG: Ihre Zugangsdaten wurden automatisch generiert!"
        echo ""
        echo -e "  ${GREEN}Super-Admin Login:${NC}"
        echo -e "    E-Mail:    ${YELLOW}admin@onboardiq.local${NC}"
        echo -e "    Passwort:  ${YELLOW}${ADMIN_PASS}${NC}"
        echo ""
        echo -e "  ${GREEN}Master-Admin-Key (für Lizenz-Generierung):${NC}"
        echo -e "    ${YELLOW}${MASTER_KEY}${NC}"
        echo ""
        log_warning "Speichern Sie diese Daten sicher! Sie werden nur einmal angezeigt."
        echo ""
        read -p "Drücken Sie ENTER um fortzufahren..."
    else
        log_success ".env Datei existiert bereits"
    fi
}

# Kopiere Backend-Dateien
setup_backend() {
    log_info "Kopiere Backend-Dateien..."
    
    # Erstelle Backend-Verzeichnis falls nicht vorhanden
    mkdir -p backend
    
    # Kopiere alle Python-Dateien
    if [ -d "../backend" ]; then
        cp -r ../backend/* backend/ 2>/dev/null || true
    fi
    
    # Stelle sicher, dass Dockerfile existiert
    if [ ! -f "backend/Dockerfile" ]; then
        cp backend/Dockerfile backend/Dockerfile 2>/dev/null || true
    fi
    
    log_success "Backend-Dateien kopiert"
}

# Kopiere Frontend-Dateien
setup_frontend() {
    log_info "Kopiere Frontend-Dateien..."
    
    # Erstelle Frontend-Verzeichnis falls nicht vorhanden
    mkdir -p frontend
    
    # Kopiere alle Frontend-Dateien
    if [ -d "../frontend" ]; then
        cp -r ../frontend/* frontend/ 2>/dev/null || true
    fi
    
    # Stelle sicher, dass nginx.conf existiert
    if [ ! -f "frontend/nginx.conf" ]; then
        cp frontend/nginx.conf frontend/nginx.conf 2>/dev/null || true
    fi
    
    log_success "Frontend-Dateien kopiert"
}

# Starte die Container
start_containers() {
    log_info "Starte OnboardIQ Container..."
    
    # Docker Compose verwenden (v1 oder v2)
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    # Container bauen und starten
    $COMPOSE_CMD up -d --build
    
    log_success "Container gestartet"
}

# Warte auf Services
wait_for_services() {
    log_info "Warte auf Services..."
    
    # Warte auf MongoDB
    echo -n "  MongoDB: "
    for i in {1..30}; do
        if docker exec onboardiq-db mongosh --eval "db.runCommand('ping')" &> /dev/null; then
            echo -e "${GREEN}bereit${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done
    
    # Warte auf Backend
    echo -n "  Backend: "
    for i in {1..30}; do
        if curl -s http://localhost:8001/health &> /dev/null; then
            echo -e "${GREEN}bereit${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done
    
    # Warte auf Frontend
    echo -n "  Frontend: "
    for i in {1..30}; do
        if curl -s http://localhost &> /dev/null; then
            echo -e "${GREEN}bereit${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done
}

# Zeige Abschlussinformationen
show_info() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           OnboardIQ wurde erfolgreich gestartet!          ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BLUE}Anwendung:${NC}"
    echo -e "    Frontend:     ${YELLOW}http://localhost${NC}"
    echo -e "    Backend API:  ${YELLOW}http://localhost:8001/api${NC}"
    echo ""
    echo -e "  ${BLUE}Anmeldung:${NC}"
    echo -e "    Super-Admin:  ${YELLOW}http://localhost/admin/login${NC}"
    echo -e "    Organisation: ${YELLOW}http://localhost/login${NC}"
    echo ""
    echo -e "  ${BLUE}Verwaltung:${NC}"
    echo -e "    Logs:         ${YELLOW}./deploy.sh --logs${NC}"
    echo -e "    Neustart:     ${YELLOW}./deploy.sh --restart${NC}"
    echo -e "    Stoppen:      ${YELLOW}./deploy.sh --stop${NC}"
    echo ""
    echo -e "  ${BLUE}Dokumentation:${NC}"
    echo -e "    Lesen Sie die README.md für weitere Informationen."
    echo ""
}

# Stoppe Container
stop_containers() {
    log_info "Stoppe OnboardIQ Container..."
    
    if docker compose version &> /dev/null; then
        docker compose down
    else
        docker-compose down
    fi
    
    log_success "Container gestoppt"
}

# Zeige Logs
show_logs() {
    if docker compose version &> /dev/null; then
        docker compose logs -f
    else
        docker-compose logs -f
    fi
}

# Cleanup
cleanup() {
    log_warning "ACHTUNG: Dies löscht alle Daten!"
    read -p "Sind Sie sicher? (ja/nein): " confirm
    
    if [ "$confirm" = "ja" ]; then
        log_info "Räume auf..."
        
        if docker compose version &> /dev/null; then
            docker compose down -v --rmi all
        else
            docker-compose down -v --rmi all
        fi
        
        rm -rf backend frontend .env
        
        log_success "Aufräumen abgeschlossen"
    else
        log_info "Abgebrochen"
    fi
}

# Hauptfunktion
main() {
    print_banner
    
    case "${1:-}" in
        --stop)
            stop_containers
            ;;
        --restart)
            stop_containers
            start_containers
            wait_for_services
            show_info
            ;;
        --logs)
            show_logs
            ;;
        --cleanup)
            cleanup
            ;;
        --help|-h)
            echo "Verwendung: ./deploy.sh [OPTION]"
            echo ""
            echo "Optionen:"
            echo "  (keine)      Installiert und startet OnboardIQ"
            echo "  --stop       Stoppt alle Container"
            echo "  --restart    Startet Container neu"
            echo "  --logs       Zeigt Logs an"
            echo "  --cleanup    Entfernt alles (inkl. Daten!)"
            echo "  --help       Zeigt diese Hilfe"
            ;;
        *)
            check_requirements
            setup_env
            setup_backend
            setup_frontend
            start_containers
            wait_for_services
            show_info
            ;;
    esac
}

# Skript ausführen
main "$@"
