#!/bin/bash

# ===================================================================
# DeedFlow — Raspberry Pi PostgreSQL Setup Script
# ===================================================================
# Run this on your Pi via SSH:
#   chmod +x setup-postgres.sh
#   ./setup-postgres.sh
#
# What it does:
#   1. Installs PostgreSQL (if not already installed)
#   2. Creates the 'deedflow' database
#   3. Creates the 'deedflow_user' role with a generated password
#   4. Writes the server/.env file with the DATABASE_URL
#   5. Runs the schema migration
# ===================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
DB_NAME="deedflow"
DB_USER="deedflow_user"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  DeedFlow — Pi PostgreSQL Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# ---------------------------------------------------------------
# 1. Install PostgreSQL
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

# ---------------------------------------------------------------
# 2. Generate password
# ---------------------------------------------------------------
DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
echo -e "${GREEN}✓${NC} Generated database password"

# ---------------------------------------------------------------
# 3. Create database and user
# ---------------------------------------------------------------
echo -e "${YELLOW}Creating database and user...${NC}"

sudo -u postgres psql <<EOF
-- Create user if not exists
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')
\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to the database and grant schema privileges
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOF

echo -e "${GREEN}✓${NC} Database '${DB_NAME}' and user '${DB_USER}' ready"

# ---------------------------------------------------------------
# 4. Write .env file
# ---------------------------------------------------------------
JWT_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)
JWT_REFRESH=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)

ENV_FILE="$SERVER_DIR/.env"

cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH}
PORT=3001
NODE_ENV=production
ALLOWED_ORIGIN=https://myramadan.duckdns.org
EOF

echo -e "${GREEN}✓${NC} Created $ENV_FILE"

# ---------------------------------------------------------------
# 5. Install server dependencies + run migration
# ---------------------------------------------------------------
echo -e "${YELLOW}Installing server dependencies...${NC}"
cd "$SERVER_DIR"
npm install
echo -e "${GREEN}✓${NC} Dependencies installed"

echo -e "${YELLOW}Running schema migration...${NC}"
node db/migrate.js
echo -e "${GREEN}✓${NC} Database schema ready"

# ---------------------------------------------------------------
# 6. Summary
# ---------------------------------------------------------------
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Database:  ${DB_NAME}"
echo -e "  User:      ${DB_USER}"
echo -e "  Password:  ${YELLOW}(saved in server/.env)${NC}"
echo -e "  Env file:  ${ENV_FILE}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo -e "  1. Start the server:  cd server && node index.js"
echo -e "  2. Test health:       curl http://localhost:3001/api/health"
echo -e "  3. Migrate v3 data:   cd scripts && npm install && node migrate-v3.js --sqlite /path/to/ramadanflow.db"
echo ""
