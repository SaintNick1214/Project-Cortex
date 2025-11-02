# Deployment Guide - Open WebUI + Cortex Integration

> **From local development to production deployment**

## Table of Contents
- [Quick Start (Development)](#quick-start-development)
- [Docker Compose Deployment](#docker-compose-deployment)
- [Production Deployment](#production-deployment)
- [Environment Configuration](#environment-configuration)
- [Scaling Considerations](#scaling-considerations)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)

---

## Quick Start (Development)

### Prerequisites Checklist

- [ ] Docker 24.0+ and Docker Compose installed
- [ ] Node.js 18+ installed
- [ ] Convex account created at [convex.dev](https://convex.dev)
- [ ] OpenAI API key (for embeddings)
- [ ] LLM provider API key (OpenAI/Anthropic) or Ollama running locally

### One-Command Setup

```bash
# Clone repository
git clone https://github.com/SaintNick1214/Project-Cortex.git
cd "Project-Cortex/Examples and Proofs/Open-WebUI-Integration"

# Copy environment template
cp .env.example .env

# Edit .env with your Convex URL and API keys
nano .env

# Deploy Cortex schema to Convex
cd ../../convex-dev
npx convex deploy --prod
# Copy the deployment URL to .env

# Return and start services
cd "../Examples and Proofs/Open-WebUI-Integration"
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

**Access the application:**
- Open WebUI: http://localhost:8080
- Cortex Bridge API: http://localhost:3000
- Health check: http://localhost:3000/health

---

## Docker Compose Deployment

### Complete Docker Compose Configuration

**Create `docker-compose.yml`:**
```yaml
version: '3.8'

services:
  # ============================================
  # Open WebUI (Frontend + Backend)
  # ============================================
  open-webui:
    image: ghcr.io/open-webui/open-webui:latest
    container_name: open-webui
    ports:
      - "8080:8080"
    environment:
      # Cortex Integration
      - CORTEX_BRIDGE_URL=http://cortex-bridge:3000
      - ENABLE_CORTEX_MEMORY=true
      
      # Database
      - DATABASE_URL=${DATABASE_URL:-sqlite:///app/backend/data/webui.db}
      
      # Security
      - WEBUI_SECRET_KEY=${WEBUI_SECRET_KEY}
      - WEBUI_JWT_SECRET_KEY=${WEBUI_JWT_SECRET_KEY}
      
      # LLM Providers
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
    volumes:
      # Persistent data
      - open-webui-data:/app/backend/data
      
      # Custom middleware
      - ./src/openwebui-middleware:/app/backend/custom
    depends_on:
      - cortex-bridge
    restart: unless-stopped
    networks:
      - cortex-network

  # ============================================
  # Cortex Bridge (Node.js Service)
  # ============================================
  cortex-bridge:
    build:
      context: ./src/cortex-bridge
      dockerfile: Dockerfile
    container_name: cortex-bridge
    ports:
      - "3000:3000"
    environment:
      # Convex
      - CONVEX_URL=${CONVEX_URL}
      
      # OpenAI (for embeddings)
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      
      # Server config
      - PORT=3000
      - NODE_ENV=production
      
      # Feature flags
      - ENABLE_FACTS_EXTRACTION=${ENABLE_FACTS_EXTRACTION:-true}
      - ENABLE_CONTEXT_CHAINS=${ENABLE_CONTEXT_CHAINS:-true}
      - ENABLE_MULTI_AGENT=${ENABLE_MULTI_AGENT:-true}
    volumes:
      # Logs
      - cortex-logs:/app/logs
    restart: unless-stopped
    networks:
      - cortex-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ============================================
  # PostgreSQL (Production Database)
  # Optional: Use for production instead of SQLite
  # ============================================
  postgres:
    image: postgres:15-alpine
    container_name: postgres
    environment:
      - POSTGRES_DB=openwebui
      - POSTGRES_USER=${POSTGRES_USER:-openwebui}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - cortex-network
    profiles:
      - production  # Only start with --profile production

  # ============================================
  # Redis (Optional: Caching & Rate Limiting)
  # ============================================
  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - cortex-network
    profiles:
      - production

  # ============================================
  # Nginx (Reverse Proxy for Production)
  # ============================================
  nginx:
    image: nginx:alpine
    container_name: nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - open-webui
      - cortex-bridge
    restart: unless-stopped
    networks:
      - cortex-network
    profiles:
      - production

volumes:
  open-webui-data:
  cortex-logs:
  postgres-data:
  redis-data:

networks:
  cortex-network:
    driver: bridge
```

### Cortex Bridge Dockerfile

**Create `src/cortex-bridge/Dockerfile`:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "server.js"]
```

### Commands

```bash
# Start all services (development)
docker-compose up -d

# Start with production profile
docker-compose --profile production up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f cortex-bridge

# Stop all services
docker-compose down

# Stop and remove volumes (DANGER: deletes data)
docker-compose down -v

# Restart specific service
docker-compose restart cortex-bridge

# Rebuild after code changes
docker-compose up -d --build cortex-bridge

# Scale Cortex Bridge (multiple instances)
docker-compose up -d --scale cortex-bridge=3
```

---

## Production Deployment

### Architecture Overview

```
Internet
   │
   ↓
┌────────────────────┐
│  Load Balancer     │  (AWS ALB / GCP LB / Nginx)
│  SSL Termination   │
└────────┬───────────┘
         │
         ↓
┌────────────────────┐
│  Nginx Reverse     │  (Optional internal reverse proxy)
│  Proxy             │
└────────┬───────────┘
         │
    ┌────┴────┐
    │         │
    ↓         ↓
┌─────────┐ ┌──────────────┐
│ Open    │ │ Cortex       │  (Scaled horizontally)
│ WebUI   │ │ Bridge x3    │
└────┬────┘ └──────┬───────┘
     │             │
     ↓             ↓
┌─────────┐ ┌──────────────┐
│ Redis   │ │ Convex Cloud │
│ Cache   │ │ (Managed)    │
└─────────┘ └──────────────┘
```

### Step-by-Step Production Setup

#### 1. Provision Infrastructure

**Option A: AWS**
```bash
# EC2 instance for Docker host
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name your-key \
  --security-groups docker-sg

# RDS for PostgreSQL
aws rds create-db-instance \
  --db-instance-identifier openwebui-db \
  --db-instance-class db.t3.small \
  --engine postgres \
  --master-username admin \
  --master-user-password your-password

# ElastiCache for Redis
aws elasticache create-cache-cluster \
  --cache-cluster-id openwebui-redis \
  --cache-node-type cache.t3.micro \
  --engine redis
```

**Option B: Google Cloud**
```bash
# Compute Engine VM
gcloud compute instances create openwebui-vm \
  --machine-type e2-medium \
  --image-family ubuntu-2204-lts \
  --image-project ubuntu-os-cloud

# Cloud SQL PostgreSQL
gcloud sql instances create openwebui-db \
  --database-version POSTGRES_15 \
  --tier db-f1-micro \
  --region us-central1

# Memorystore Redis
gcloud redis instances create openwebui-redis \
  --size 1 \
  --region us-central1
```

#### 2. Configure SSL/TLS

**Using Let's Encrypt (Certbot):**
```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d chat.yourdomain.com

# Auto-renewal (already configured)
sudo certbot renew --dry-run
```

**Manual Certificate:**
```bash
# Create SSL directory
mkdir -p nginx/ssl

# Copy your certificates
cp /path/to/fullchain.pem nginx/ssl/
cp /path/to/privkey.pem nginx/ssl/
```

#### 3. Nginx Configuration

**Create `nginx/nginx.conf`:**
```nginx
events {
    worker_connections 1024;
}

http {
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    
    # Upstream servers
    upstream open-webui {
        server open-webui:8080;
    }
    
    upstream cortex-bridge {
        least_conn;
        server cortex-bridge-1:3000;
        server cortex-bridge-2:3000;
        server cortex-bridge-3:3000;
    }
    
    # HTTP -> HTTPS redirect
    server {
        listen 80;
        server_name chat.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }
    
    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name chat.yourdomain.com;
        
        # SSL configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        
        # Security headers
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        
        # Main application
        location / {
            proxy_pass http://open-webui;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
        
        # Cortex Bridge API (internal only)
        location /cortex-api/ {
            internal;
            proxy_pass http://cortex-bridge/;
        }
        
        # WebSocket support
        location /ws {
            proxy_pass http://open-webui;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

#### 4. Production Environment Variables

**Create `.env.production`:**
```bash
# ============================================
# PRODUCTION CONFIGURATION
# ============================================

# Convex (Production)
CONVEX_URL=https://your-production.convex.cloud

# Database (PostgreSQL)
DATABASE_URL=postgresql://admin:password@postgres-host:5432/openwebui

# Redis (Caching)
REDIS_URL=redis://redis-host:6379

# Security (CHANGE THESE!)
WEBUI_SECRET_KEY=$(openssl rand -hex 32)
WEBUI_JWT_SECRET_KEY=$(openssl rand -hex 32)

# OpenAI
OPENAI_API_KEY=sk-prod-...

# LLM Providers
ANTHROPIC_API_KEY=sk-ant-prod-...

# Server
NODE_ENV=production
LOG_LEVEL=info

# Feature Flags
ENABLE_FACTS_EXTRACTION=true
ENABLE_CONTEXT_CHAINS=true
ENABLE_MULTI_AGENT=true

# Monitoring
SENTRY_DSN=https://your-sentry-dsn

# Performance
MAX_MEMORY=2048
WORKER_THREADS=4
```

#### 5. Deploy to Production

```bash
# Copy files to server
rsync -avz . user@your-server:/opt/openwebui-cortex/

# SSH to server
ssh user@your-server

# Navigate to directory
cd /opt/openwebui-cortex

# Load production environment
set -a && source .env.production && set +a

# Start services
docker-compose --profile production up -d

# Verify deployment
docker-compose ps
docker-compose logs -f

# Test endpoints
curl https://chat.yourdomain.com/health
```

---

## Environment Configuration

### Development vs Production

| Variable | Development | Production |
|----------|-------------|------------|
| `CONVEX_URL` | Local or dev deployment | Production deployment |
| `DATABASE_URL` | SQLite | PostgreSQL |
| `REDIS_URL` | Not required | Required |
| `LOG_LEVEL` | `debug` | `info` or `warn` |
| `NODE_ENV` | `development` | `production` |
| `SSL` | Not required | Required |

### Required Variables

```bash
# Minimal required for production
CONVEX_URL=https://...
OPENAI_API_KEY=sk-...
WEBUI_SECRET_KEY=...
DATABASE_URL=postgresql://...
```

### Optional Variables

```bash
# Performance tuning
MAX_MEMORY=2048
WORKER_THREADS=4
REQUEST_TIMEOUT=30000

# Feature flags
ENABLE_GRAPH_DATABASE=false
ENABLE_ANALYTICS=true

# Monitoring
SENTRY_DSN=https://...
DATADOG_API_KEY=...
```

---

## Scaling Considerations

### Horizontal Scaling

**Cortex Bridge can be scaled horizontally:**
```bash
# Scale to 5 instances
docker-compose up -d --scale cortex-bridge=5
```

**Load balancing is automatic via Nginx upstream.**

### Vertical Scaling

**Increase resources:**
```yaml
# In docker-compose.yml
cortex-bridge:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
      reservations:
        cpus: '1'
        memory: 2G
```

### Database Scaling

**Convex handles scaling automatically.**

**For PostgreSQL (UI state):**
```bash
# Increase connection pool
DATABASE_URL=postgresql://...?pool_size=20&max_overflow=10
```

---

## Monitoring and Logging

### Health Checks

```bash
# Application health
curl http://localhost:8080/health

# Cortex Bridge health
curl http://localhost:3000/health

# Response:
# {
#   "status": "healthy",
#   "cortex": "connected",
#   "timestamp": "2025-11-02T..."
# }
```

### Logging

**View logs:**
```bash
# All services
docker-compose logs -f

# Specific service with timestamps
docker-compose logs -f --timestamps cortex-bridge

# Last 100 lines
docker-compose logs --tail=100 cortex-bridge

# Export logs
docker-compose logs --no-color > logs.txt
```

**Log levels:**
- `debug` - Development
- `info` - Production (default)
- `warn` - Production (minimal)
- `error` - Critical only

### Metrics (Optional)

**Prometheus + Grafana:**
```yaml
# Add to docker-compose.yml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
```

---

## Backup and Recovery

### Data Backup

**SQLite (Development):**
```bash
# Backup database
docker cp open-webui:/app/backend/data/webui.db ./backup/webui-$(date +%Y%m%d).db
```

**PostgreSQL (Production):**
```bash
# Daily backup
docker-compose exec postgres pg_dump -U admin openwebui > backup/db-$(date +%Y%m%d).sql

# Automated backup (cron)
0 2 * * * /opt/openwebui-cortex/scripts/backup.sh
```

**Convex Data:**
```bash
# Convex handles backups automatically
# Point-in-time recovery available in dashboard
```

### Recovery

**Restore SQLite:**
```bash
docker cp ./backup/webui-20251102.db open-webui:/app/backend/data/webui.db
docker-compose restart open-webui
```

**Restore PostgreSQL:**
```bash
docker-compose exec -T postgres psql -U admin openwebui < backup/db-20251102.sql
```

---

## Summary

This deployment guide covers:
- ✅ One-command development setup
- ✅ Complete Docker Compose configuration
- ✅ Production deployment with SSL/TLS
- ✅ Horizontal and vertical scaling
- ✅ Monitoring and logging
- ✅ Backup and recovery procedures

**Next Steps:**
- [07-USAGE-EXAMPLES.md](./07-USAGE-EXAMPLES.md) - Real-world scenarios
- [09-TROUBLESHOOTING.md](./09-TROUBLESHOOTING.md) - Common issues

**Production Checklist:**
- [ ] SSL/TLS configured
- [ ] Database backed up automatically
- [ ] Monitoring in place
- [ ] Rate limiting configured
- [ ] Security headers set
- [ ] Logs aggregated
- [ ] Health checks passing

