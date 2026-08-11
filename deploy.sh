#!/bin/bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$DEPLOY_DIR/backend"
FRONTEND_DIR="$DEPLOY_DIR/frontend-react"

echo "🚀 Deploy ERP Daytona — $(date '+%Y-%m-%d %H:%M:%S')"
echo "📁 $DEPLOY_DIR"
echo ""

# ── 1. Código limpio desde GitHub ────────────────────────────────────────────
echo "📥 [1/4] Actualizando código..."
if [ -d "$DEPLOY_DIR/.git" ]; then
  git -C "$DEPLOY_DIR" fetch origin
  git -C "$DEPLOY_DIR" checkout main 2>/dev/null || git -C "$DEPLOY_DIR" checkout master
  git -C "$DEPLOY_DIR" reset --hard origin/main 2>/dev/null || git -C "$DEPLOY_DIR" reset --hard origin/master
else
  echo "❌ Este proyecto no es un repositorio git en $DEPLOY_DIR"
  exit 1
fi
chmod +x "$DEPLOY_DIR/deploy.sh" 2>/dev/null || true
echo "✅ Código actualizado"
echo ""

# ── 2. Backend: deps + schema + seed + compilación ───────────────────────────
echo "⚙️  [2/4] Configurando backend..."
cd "$BACKEND_DIR"
npm install
npx prisma migrate deploy
npx prisma generate
npm run prisma:seed
npm run build
echo "✅ Backend configurado y compilado"
echo ""

# ── 3. Reinicio suave del backend (zero-downtime) ────────────────────────────
echo "🔄 [3/4] Recargando servidor Node..."
if pm2 describe erp-daytona > /dev/null 2>&1; then
  pm2 reload erp-daytona
else
  pm2 start "$BACKEND_DIR/ecosystem.config.js" --env production
fi
pm2 save
echo "✅ Servidor recargado"
echo ""

# ── 4. Frontend: build atómico (el sitio sigue sirviendo durante el build) ──
echo "🏗️  [4/4] Construyendo frontend..."
cd "$FRONTEND_DIR"
npm install

rm -rf dist_new
npm run build -- --outDir dist_new

if [ ! -f "$FRONTEND_DIR/dist_new/index.html" ]; then
  echo "❌ ERROR: No se generó index.html en dist_new — se conserva el dist anterior"
  rm -rf dist_new
  exit 1
fi

rm -rf dist_old
if [ -d dist ]; then
  mv dist dist_old
fi
mv dist_new dist
rm -rf dist_old

echo "✅ Frontend actualizado"
echo ""
echo "═══════════════════════════════════"
echo "✅ Deploy completado — $(date '+%H:%M:%S')"
echo "═══════════════════════════════════"
echo "⚠️  Usuarios activos: cerrar sesión y volver a entrar"
