# Deployment Guide - Open WebUI + Cortex

> **Production-Ready Deployment**

Complete guide for deploying the integrated Open WebUI + Cortex stack.

## Quick Deploy (3 Commands)

```bash
# 1. Configure environment
cp env.example .env.local
# Edit .env.local with your Convex URL and API keys

# 2. Build Cortex SDK
cd ../.. && npm run build && cd -

# 3. Deploy entire stack
docker-compose -f docker-compose.full.yml up -d

# Access at: http://localhost:8080
```

---

## Complete Docker Compose

**File**: `docker-compose.full.yml`

```yaml
version: "3.8"

services:
  # ===========================================
  # Cortex Bridge (Node.js)
  # ===========================================
  cortex-bridge:
    build:
      context: ./src/cortex-bridge
      dockerfile: Dockerfile
    container_name: cortex-bridge
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # Convex
      - CONVEX_URL=${CONVEX_URL}

      # OpenAI for embeddings
      - OPENAI_API_KEY=${OPENAI_API_KEY}

      # Server config
      - PORT=3000
      - NODE_ENV=production
      - LOG_LEVEL=info

      # Feature flags
      - ENABLE_FACTS_EXTRACTION=true
      - ENABLE_CONTEXT_CHAINS=true
    volumes:
      - cortex-logs:/app/logs
    networks:
      - cortex-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # ===========================================
  # Open WebUI (Modified with Cortex)
  # ===========================================
  open-webui:
    build:
      context: ./open-webui-fork
      dockerfile: Dockerfile
    container_name: open-webui
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      # Cortex Integration
      - CORTEX_BRIDGE_URL=http://cortex-bridge:3000
      - ENABLE_CORTEX_MEMORY=true
      - CORTEX_TIMEOUT=30
      - CORTEX_MAX_RETRIES=3

      # Database
      - DATABASE_URL=postgresql://openwebui:${DB_PASSWORD}@postgres:5432/openwebui

      # Security
      - WEBUI_SECRET_KEY=${WEBUI_SECRET_KEY}
      - WEBUI_JWT_SECRET_KEY=${WEBUI_JWT_SECRET_KEY}

      # LLM Providers (configure at least one)
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-}
    volumes:
      - open-webui-data:/app/backend/data
    networks:
      - cortex-network
    depends_on:
      cortex-bridge:
        condition: service_healthy
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

  # ===========================================
  # PostgreSQL (Open WebUI Database)
  # ===========================================
  postgres:
    image: postgres:15-alpine
    container_name: postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=openwebui
      - POSTGRES_USER=openwebui
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - cortex-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openwebui"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ===========================================
  # Redis (Caching)
  # ===========================================
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - cortex-network

  # ===========================================
  # Nginx (Optional - Reverse Proxy)
  # ===========================================
  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    networks:
      - cortex-network
    depends_on:
      - open-webui
    profiles:
      - production

volumes:
  cortex-logs:
  open-webui-data:
  postgres-data:
  redis-data:

networks:
  cortex-network:
    driver: bridge
```

---

## Environment Configuration

**File**: `.env.local` (create from env.example)

```bash
# ============================================
# CONVEX (Required)
# ============================================
CONVEX_URL=https://your-deployment.convex.cloud

# ============================================
# OPENAI (Required for embeddings)
# ============================================
OPENAI_API_KEY=sk-your-key-here

# ============================================
# LLM PROVIDER (At least one required)
# ============================================

# Option 1: OpenAI
OPENAI_API_KEY=sk-your-key-here

# Option 2: Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Option 3: Local Ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434

# ============================================
# DATABASE
# ============================================
DB_PASSWORD=change-this-secure-password

# ============================================
# OPEN WEBUI SECURITY
# ============================================
WEBUI_SECRET_KEY=generate-long-random-string-here
WEBUI_JWT_SECRET_KEY=generate-another-long-random-string

# ============================================
# CORTEX SETTINGS
# ============================================
CORTEX_TIMEOUT=30
CORTEX_MAX_RETRIES=3
CORTEX_MIN_SIMILARITY=0.7

# ============================================
# OPTIONAL FEATURES
# ============================================
ENABLE_FACTS_EXTRACTION=true
ENABLE_CONTEXT_CHAINS=true
ENABLE_MULTI_AGENT=true

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info
NODE_ENV=production
```

---

## Deployment Steps

### 1. Prerequisites

```bash
# Install Docker and Docker Compose
docker --version  # Should be 24.0+
docker-compose --version

# Ensure Cortex SDK is built
cd Project-Cortex
npm run build

# Verify dist/ directory exists
ls -la dist/
```

### 2. Initial Setup

```bash
# Navigate to integration directory
cd "Examples and Proofs/Open-WebUI-Integration"

# Create environment file
cp env.example .env.local

# Generate secure secrets
echo "WEBUI_SECRET_KEY=$(openssl rand -hex 32)" >> .env.local
echo "WEBUI_JWT_SECRET_KEY=$(openssl rand -hex 32)" >> .env.local
echo "DB_PASSWORD=$(openssl rand -hex 16)" >> .env.local

# Edit .env.local and add:
# - CONVEX_URL (from your Convex deployment)
# - OPENAI_API_KEY
# - LLM provider key
nano .env.local
```

### 3. Deploy Services

```bash
# Start all services
docker-compose -f docker-compose.full.yml up -d

# Check status
docker-compose -f docker-compose.full.yml ps

# View logs
docker-compose -f docker-compose.full.yml logs -f
```

### 4. Verify Deployment

```bash
# Check Cortex Bridge health
curl http://localhost:3000/health

# Should return:
# {"status":"healthy","cortex":"connected"}

# Access Open WebUI
open http://localhost:8080

# Create account and test chat
```

---

## Production Deployment

### With Nginx Reverse Proxy

**File**: `nginx/nginx.conf`

```nginx
events {
    worker_connections 1024;
}

http {
    upstream open-webui {
        server open-webui:8080;
    }

    upstream cortex-bridge {
        server cortex-bridge:3000;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS Server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Open WebUI
        location / {
            proxy_pass http://open-webui;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # Cortex Bridge (internal only - no external access)
        location /cortex-internal/ {
            deny all;
        }
    }
}
```

**Deploy with Nginx**:

```bash
# Enable production profile
docker-compose -f docker-compose.full.yml --profile production up -d
```

---

## Scaling

### Horizontal Scaling

**Multiple Cortex Bridge instances**:

```yaml
cortex-bridge:
  # ... existing config
  deploy:
    replicas: 3
    resources:
      limits:
        cpus: "1"
        memory: 512M
```

### Load Balancing

Add to docker-compose or use external load balancer (AWS ALB, nginx, Traefik).

---

## Monitoring

### Health Checks

```bash
# Cortex Bridge
curl http://localhost:3000/health

# Open WebUI
curl http://localhost:8080/health

# PostgreSQL
docker exec postgres pg_isready -U openwebui

# Redis
docker exec redis redis-cli ping
```

### Logs

```bash
# All services
docker-compose -f docker-compose.full.yml logs -f

# Specific service
docker-compose logs -f cortex-bridge
docker-compose logs -f open-webui

# Export logs
docker-compose logs > deployment.log
```

### Metrics

Add Prometheus + Grafana:

```yaml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus-data:/prometheus

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  volumes:
    - grafana-data:/var/lib/grafana
```

---

## Backup & Recovery

### Database Backup

```bash
# Backup PostgreSQL
docker exec postgres pg_dump -U openwebui openwebui > backup.sql

# Restore
cat backup.sql | docker exec -i postgres psql -U openwebui openwebui
```

### Volume Backup

```bash
# Backup all volumes
docker run --rm \
  -v open-webui_postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data
```

---

## Maintenance

### Updates

```bash
# Pull latest images
docker-compose pull

# Restart services
docker-compose -f docker-compose.full.yml up -d

# Clean old images
docker image prune -a
```

### Database Migrations

```bash
# Run Alembic migrations
docker exec open-webui alembic upgrade head
```

---

## Troubleshooting

See [11-TROUBLESHOOTING.md](11-TROUBLESHOOTING.md) for common issues.

**Quick Fixes**:

```bash
# Restart all services
docker-compose restart

# Rebuild specific service
docker-compose build cortex-bridge
docker-compose up -d cortex-bridge

# Check logs for errors
docker-compose logs --tail=100 cortex-bridge
```

---

## Next Steps

- **Usage Scenarios** → [10-USAGE-SCENARIOS.md](10-USAGE-SCENARIOS.md)
- **Troubleshooting** → [11-TROUBLESHOOTING.md](11-TROUBLESHOOTING.md)
- **Integration Guide** → [04-INTEGRATION-GUIDE.md](04-INTEGRATION-GUIDE.md)
