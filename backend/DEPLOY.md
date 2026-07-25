# Despliegue ERP Daytona — VPS Ubuntu 22.04

## Requisitos del Servidor

- Ubuntu 22.04 LTS (mínimo 2 vCPU, 4 GB RAM, 40 GB SSD)
- Node.js 20 LTS
- PostgreSQL 16
- Redis 7
- PM2 (global)
- Nginx (reverse proxy)

---

## 1. Preparar el Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar herramientas base
sudo apt install -y curl git build-essential unzip

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # debe ser 20.x

# PM2
sudo npm install -g pm2

# PostgreSQL 16
sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
sudo apt update && sudo apt install -y postgresql-16
sudo systemctl enable --now postgresql

# Redis 7
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list
sudo apt update && sudo apt install -y redis
sudo systemctl enable --now redis-server

# Nginx
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

---

## 2. Configurar PostgreSQL

```bash
# Crear usuario y base de datos
sudo -u postgres psql <<EOF
CREATE USER erp_user WITH PASSWORD 'CAMBIA_ESTA_PASSWORD';
CREATE DATABASE erp_daytona OWNER erp_user;
GRANT ALL PRIVILEGES ON DATABASE erp_daytona TO erp_user;
ALTER USER erp_user CREATEDB;
EOF

# Verificar conexión
psql -h localhost -U erp_user -d erp_daytona -c "SELECT version();"
```

---

## 3. Configurar Redis

```bash
# Editar configuración Redis para producción
sudo nano /etc/redis/redis.conf

# Cambios recomendados:
# requirepass TU_PASSWORD_REDIS
# maxmemory 512mb
# maxmemory-policy allkeys-lru
# bind 127.0.0.1

sudo systemctl restart redis-server

# Verificar
redis-cli ping  # debe responder PONG
```

---

## 4. Subir el Código

```bash
# Crear directorio de la aplicación
sudo mkdir -p /var/www/erp-daytona
sudo chown $USER:$USER /var/www/erp-daytona

# Opción A: Git clone
git clone https://github.com/tu-org/erp-daytona.git /var/www/erp-daytona

# Opción B: SCP desde tu máquina local
# scp -r ./backend usuario@servidor:/var/www/erp-daytona/
# scp -r ./frontend usuario@servidor:/var/www/erp-daytona/
```

---

## 5. Configurar Variables de Entorno

```bash
cd /var/www/erp-daytona/backend

# Crear archivo .env desde el ejemplo
cp .env.example .env
nano .env
```

**Variables críticas a configurar:**

```env
NODE_ENV=production
PORT=3000

# Base de datos
DATABASE_URL="postgresql://erp_user:TU_PASSWORD@localhost:5432/erp_daytona"

# JWT - GENERAR SECRETS SEGUROS
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=TU_PASSWORD_REDIS

# SUNAT
SUNAT_MODE=mock   # cambiar a 'real' cuando tengas certificado
SUNAT_CERT_PATH=/var/www/erp-daytona/backend/storage/certs/certificado.pfx
SUNAT_CERT_PASSWORD=password_del_certificado
SUNAT_RUC_EMPRESA=20123456789

# CORS - dominio del frontend
CORS_ORIGINS=https://tu-dominio.com

# Storage
STORAGE_PATH=/var/www/erp-daytona/backend/storage
```

**Generar JWT secrets seguros:**

```bash
# Ejecutar en el servidor para generar secrets únicos
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

---

## 6. Instalar Dependencias y Construir

```bash
cd /var/www/erp-daytona/backend

# Instalar dependencias de producción
npm ci --omit=dev

# Compilar TypeScript
npm run build

# Verificar build
ls -la dist/
```

---

## 7. Migraciones y Seed Inicial

```bash
cd /var/www/erp-daytona/backend

# Aplicar migraciones (NO usar migrate dev en producción)
npx prisma migrate deploy

# Verificar migraciones aplicadas
npx prisma migrate status

# Ejecutar seed inicial (SOLO la primera vez)
npx ts-node -r tsconfig-paths/register prisma/seed.ts

# Verificar datos
npx prisma studio  # abrir en navegador para inspeccionar (usar con SSH tunnel)
```

---

## 8. Iniciar con PM2

```bash
cd /var/www/erp-daytona/backend

# Iniciar en producción
pm2 start ecosystem.config.js --env production

# Verificar estado
pm2 status
pm2 logs erp-daytona-api

# Guardar configuración PM2 para reinicio automático
pm2 save
pm2 startup  # ejecutar el comando que muestra
```

---

## 9. Construir y Desplegar Frontend

```bash
cd /var/www/erp-daytona/frontend

# Instalar dependencias
npm ci

# Configurar URL del API
echo "VITE_API_URL=https://tu-dominio.com/api/v1" > .env.production

# Build de producción
npm run build

# Los archivos estarán en frontend/dist/
ls -la dist/
```

---

## 10. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/erp-daytona
```

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com www.tu-dominio.com;

    # SSL (configurar con Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # Frontend (archivos estáticos)
    root /var/www/erp-daytona/frontend/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Backend (proxy)
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # Limitar subida de archivos
    client_max_body_size 10M;

    # Seguridad headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

```bash
# Activar sitio
sudo ln -s /etc/nginx/sites-available/erp-daytona /etc/nginx/sites-enabled/
sudo nginx -t  # verificar configuración
sudo systemctl reload nginx
```

---

## 11. SSL con Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Renovación automática
sudo crontab -e
# Agregar: 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 12. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 13. Monitoreo

```bash
# Estado general PM2
pm2 status
pm2 monit

# Logs en tiempo real
pm2 logs erp-daytona-api --lines 100

# Reiniciar sin downtime
pm2 reload erp-daytona-api

# Métricas PostgreSQL
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Métricas Redis
redis-cli info stats
```

---

## 14. Backups Automáticos

```bash
# Script de backup PostgreSQL
sudo nano /usr/local/bin/backup-erp.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/erp-daytona"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U erp_user -h localhost erp_daytona | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Mantener solo últimos 30 backups
ls -t $BACKUP_DIR/db_*.sql.gz | tail -n +31 | xargs -r rm
echo "Backup completado: $BACKUP_DIR/db_$DATE.sql.gz"
```

```bash
sudo chmod +x /usr/local/bin/backup-erp.sh
sudo crontab -e
# Agregar: 0 2 * * * /usr/local/bin/backup-erp.sh >> /var/log/erp-backup.log 2>&1
```

---

## 15. Actualizar la Aplicación

```bash
cd /var/www/erp-daytona

# Obtener cambios
git pull origin main

# Backend
cd backend
npm ci --omit=dev
npx prisma migrate deploy   # solo si hay nuevas migraciones
npm run build
pm2 reload erp-daytona-api  # reload sin downtime

# Frontend
cd ../frontend
npm ci
npm run build
# Nginx sirve automáticamente los archivos actualizados en dist/
```

---

## Verificación Final

```bash
# 1. API responde
curl https://tu-dominio.com/api/v1/auth/health

# 2. Login de prueba
curl -X POST https://tu-dominio.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@daytona.pe","password":"Admin123!"}'

# 3. Verificar PM2
pm2 status  # todos los procesos en "online"

# 4. Verificar Nginx
sudo nginx -t

# 5. Verificar SSL
curl -I https://tu-dominio.com  # debe mostrar HTTP/2 200
```

---

## Credenciales Iniciales

| Usuario | Email | Password | Rol |
|---------|-------|----------|-----|
| Administrador | admin@daytona.pe | Admin123! | Administrador (todos los permisos) |
| Vendedor | vendedor@daytona.pe | Vendedor123! | Vendedor |

**⚠️ IMPORTANTE: Cambiar las contraseñas en el primer login.**

---

## Soporte SUNAT Modo Real

Para habilitar facturación electrónica real:

1. Obtener certificado digital (.PFX) del proveedor autorizado
2. Copiar a `/var/www/erp-daytona/backend/storage/certs/certificado.pfx`
3. Registrar en el panel SUNAT/OSE
4. Actualizar `.env`:
   ```env
   SUNAT_MODE=real
   SUNAT_OSE_URL=https://ose.pe/api/...
   SUNAT_CERT_PATH=/var/www/erp-daytona/backend/storage/certs/certificado.pfx
   SUNAT_CERT_PASSWORD=tu_password
   SUNAT_RUC_EMPRESA=20XXXXXXXXX
   SUNAT_CLAVE_SOL_USUARIO=XXXXXXXX
   SUNAT_CLAVE_SOL_PASSWORD=xxxxxxxx
   ```
5. Reiniciar: `pm2 reload erp-daytona-api`
