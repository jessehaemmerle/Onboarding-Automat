# Onboarding-Automat

Dieses Repository ist auf eine einzige lauffaehige Docker-Struktur reduziert.

## Starten

```bash
docker compose up --build
```

Danach ist die Anwendung unter `http://localhost` erreichbar.

- Frontend: `http://localhost`
- Backend: `http://localhost:8001`
- Healthcheck: `http://localhost:8001/health`

## Wichtige Umgebungsvariablen

Alle Werte sind optional, weil `docker-compose.yml` sinnvolle Defaults setzt.

- `MONGO_ROOT_USER`
- `MONGO_ROOT_PASSWORD`
- `JWT_SECRET`
- `MASTER_ADMIN_KEY`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `SUPER_ADMIN_NAME`
- `RESEND_API_KEY`
- `SENDER_EMAIL`
- `BACKEND_URL`

`BACKEND_URL` ist standardmaessig leer. Dadurch baut das Frontend gegen `/api`, und Nginx leitet diese Requests intern an das FastAPI-Backend weiter.

## Stoppen

```bash
docker compose down
```

Mit Datenbank-Reset:

```bash
docker compose down -v
```

## Tests

```bash
python -m compileall backend tests
python -m unittest discover -s tests -v
```

Zusätzlich laeuft dieselbe Strukturpruefung in GitHub Actions ueber [.github/workflows/ci.yml](c:/Users/jesse/Documents/GitHub/Onboarding-Automat/.github/workflows/ci.yml).
