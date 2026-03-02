#!/bin/bash

# ===================================================================
# DeedFlow — Full Pi Deployment Script
# ===================================================================
# Run this ON the Pi after SSH'ing in:
#   ssh nek0@nek0
#   # paste this entire script, or:
#   # save as deploy.sh, chmod +x deploy.sh, ./deploy.sh
# ===================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DEPLOY_DIR="$HOME/DeedFlow"
REPO_URL="https://github.com/SAA2007/DeedFlow.git"
DB_NAME="deedflow"
DB_USER="deedflow_user"
APP_PORT=3001

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  DeedFlow — Pi Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# ---------------------------------------------------------------
# 0. Check Node.js
# ---------------------------------------------------------------
if ! command -v node &> /dev/null; then
  echo -e "${RED}Node.js not found. Install it first:${NC}"
  echo "  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -"
  echo "  sudo apt install -y nodejs"
  exit 1
fi

NODE_VER=$(node -v)
echo -e "${GREEN}✓${NC} Node.js: $NODE_VER"

# ---------------------------------------------------------------
# 1. Clone or pull the repo
# ---------------------------------------------------------------
if [ -d "$DEPLOY_DIR/.git" ]; then
  echo -e "${YELLOW}Pulling latest from GitHub...${NC}"
  cd "$DEPLOY_DIR"
  git pull origin main
else
  echo -e "${YELLOW}Cloning repository...${NC}"
  git clone "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi
echo -e "${GREEN}✓${NC} Repository ready at $DEPLOY_DIR"

# ---------------------------------------------------------------
# 2. Install PostgreSQL
# ---------------------------------------------------------------
if command -v psql &> /dev/null; then
  echo -e "${GREEN}✓${NC} PostgreSQL already installed: $(psql --version)"
else
  echo -e "${YELLOW}Installing PostgreSQL...${NC}"
  sudo apt update
  sudo apt install -y postgresql postgresql-contrib
  sudo systemctl enable postgresql
  sudo systemctl start postgresql
  echo -e "${GREEN}✓${NC} PostgreSQL installed and started"
fi

# Make sure postgres is running
sudo systemctl start postgresql

# ---------------------------------------------------------------
# 3. Create database and user
# ---------------------------------------------------------------
DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

echo -e "${YELLOW}Setting up database...${NC}"

sudo -u postgres psql <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')
\gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOSQL

echo -e "${GREEN}✓${NC} Database '${DB_NAME}' and user '${DB_USER}' ready"

# ---------------------------------------------------------------
# 4. Write server/.env
# ---------------------------------------------------------------
JWT_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)
JWT_REFRESH=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)

cat > "$DEPLOY_DIR/server/.env" <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH}
PORT=${APP_PORT}
NODE_ENV=production
ALLOWED_ORIGIN=https://myramadan.duckdns.org
EOF

echo -e "${GREEN}✓${NC} server/.env created"

# ---------------------------------------------------------------
# 5. Install dependencies
# ---------------------------------------------------------------
echo -e "${YELLOW}Installing frontend dependencies...${NC}"
cd "$DEPLOY_DIR"
npm install

echo -e "${YELLOW}Installing server dependencies...${NC}"
cd "$DEPLOY_DIR/server"
npm install

echo -e "${GREEN}✓${NC} Dependencies installed"

# ---------------------------------------------------------------
# 6. Build frontend
# ---------------------------------------------------------------
echo -e "${YELLOW}Building React frontend...${NC}"
cd "$DEPLOY_DIR"
npm run build
echo -e "${GREEN}✓${NC} Frontend built to dist/"

# ---------------------------------------------------------------
# 7. Run schema migration
# ---------------------------------------------------------------
echo -e "${YELLOW}Running database migration...${NC}"
cd "$DEPLOY_DIR/server"
node db/migrate.js
echo -e "${GREEN}✓${NC} Database schema ready"

# ---------------------------------------------------------------
# 8. Setup PM2
# ---------------------------------------------------------------
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}Installing PM2...${NC}"
  sudo npm install -g pm2
fi

# Create ecosystem config
cat > "$DEPLOY_DIR/ecosystem.config.js" <<'EOPM2'
module.exports = {
  apps: [{
    name: 'deedflow',
    script: 'server/index.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
    },
    max_memory_restart: '200M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
  }]
}
EOPM2

mkdir -p "$DEPLOY_DIR/logs"

# Stop existing deedflow instance if running
pm2 delete deedflow 2>/dev/null || true

cd "$DEPLOY_DIR"
pm2 start ecosystem.config.js
pm2 save

echo -e "${GREEN}✓${NC} DeedFlow running via PM2 on port ${APP_PORT}"

# ---------------------------------------------------------------
# 9. Verify
# ---------------------------------------------------------------
sleep 2
echo ""
echo -e "${YELLOW}Testing health endpoint...${NC}"

if curl -s "http://localhost:${APP_PORT}/api/health" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✓ Health check passed!${NC}"
else
  echo -e "${RED}✗ Health check failed — check logs: pm2 logs deedflow${NC}"
fi

# ---------------------------------------------------------------
# 10. Summary
# ---------------------------------------------------------------
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  App:       DeedFlow v4.0.0-dev"
echo -e "  Port:      ${APP_PORT} (does NOT conflict with 80/443/8080/3000)"
echo -e "  DB:        PostgreSQL — ${DB_NAME}"
echo -e "  PM2:       pm2 status / pm2 logs deedflow"
echo -e "  Health:    curl http://localhost:${APP_PORT}/api/health"
echo -e ""
echo -e "  ${YELLOW}To migrate v3 data:${NC}"
echo -e "  cd $DEPLOY_DIR/scripts && npm install"
echo -e "  node migrate-v3.js --sqlite ~/RamadanFlow/v3/data/ramadanflow.db"
echo ""
