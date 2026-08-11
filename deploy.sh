#!/usr/bin/env bash
# Actualiza el ERP en el servidor: trae el codigo nuevo, aplica migraciones y
# seed de Prisma, recompila backend y frontend, reinicia PM2 y publica en Nginx.
#
# Uso: ./deploy.sh   (desde la raiz del repo, ej. ~/erp-daytona)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend-react"
WEB_ROOT="/var/www/erp-daytona"

step() { echo; echo "==> $1"; }

step "Actualizando codigo desde git..."
cd "$REPO_DIR"
git pull

step "Backend: instalando dependencias..."
cd "$BACKEND_DIR"
npm ci

step "Backend: aplicando migraciones de Prisma..."
npx prisma migrate deploy

step "Backend: generando cliente de Prisma..."
npx prisma generate

step "Backend: ejecutando seed (idempotente, seguro re-ejecutar)..."
npm run prisma:seed

step "Backend: compilando..."
npm run build

step "Backend: reiniciando PM2 (sin downtime)..."
pm2 startOrReload ecosystem.config.js --env production

step "Frontend: instalando dependencias..."
cd "$FRONTEND_DIR"
npm ci

if [ ! -f .env.production ]; then
  step "Frontend: creando .env.production (ruta relativa a la API, servida por Nginx)..."
  echo "VITE_API_URL=/api/v1" > .env.production
fi

step "Frontend: compilando..."
npm run build

step "Frontend: publicando en $WEB_ROOT..."
sudo mkdir -p "$WEB_ROOT"
sudo rm -rf "${WEB_ROOT:?}"/*
sudo cp -r dist/* "$WEB_ROOT"/

step "Recargando Nginx..."
sudo nginx -t
sudo systemctl reload nginx

step "Listo. Deploy completo."
pm2 status
