# Build-Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Abhängigkeiten installieren
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Build-Argument für Backend-URL
ARG REACT_APP_BACKEND_URL=http://localhost:8001
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Quellcode kopieren und bauen
COPY . .
RUN yarn build

# Production-Stage
FROM nginx:alpine

# Nginx-Konfiguration kopieren
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build-Artefakte kopieren
COPY --from=builder /app/build /usr/share/nginx/html

# Port freigeben
EXPOSE 80 443

# Nginx starten
CMD ["nginx", "-g", "daemon off;"]
