# Technology Stack - Open WebUI + Cortex Integration

> **Complete breakdown of technologies, frameworks, and tools used in this integration**

## Table of Contents
- [Frontend Stack](#frontend-stack)
- [Backend Stack](#backend-stack)
- [Memory System Stack](#memory-system-stack)
- [Deployment Stack](#deployment-stack)
- [Development Tools](#development-tools)
- [Optional Components](#optional-components)

---

## Frontend Stack

### Open WebUI Frontend (Svelte)

**Core Framework:**
- **Svelte 4.x** - Reactive JavaScript framework with compiler-based approach
- **SvelteKit** - Full-stack framework for Svelte applications
- **TypeScript** - Type-safe JavaScript for better developer experience

**UI Components:**
- **Tailwind CSS 3.x** - Utility-first CSS framework
- **DaisyUI** - Tailwind CSS component library
- **Heroicons** - Beautiful hand-crafted SVG icons

**Build Tools:**
- **Vite 5.x** - Next-generation frontend build tool
- **PostCSS** - CSS transformations
- **Autoprefixer** - Automatic vendor prefixes

**State Management:**
- **Svelte Stores** - Built-in reactive state management
- **Context API** - Component-level state sharing

**HTTP Client:**
- **Fetch API** - Native browser HTTP client
- **WebSocket API** - Real-time bidirectional communication

### Frontend Modifications for Cortex

**Minimal Changes Required:**
- Optional context chain selector component
- Optional facts viewer sidebar
- Optional multi-agent switcher dropdown
- Performance metrics display (optional)

**Why Minimal?**
The beauty of this integration is that **Open WebUI's frontend requires little to no modification**. All Cortex functionality is accessible through the existing chat interface, with optional UI enhancements for advanced features.

---

## Backend Stack

### Open WebUI Backend (Python/FastAPI)

**Web Framework:**
- **FastAPI 0.110+** - Modern, fast web framework for building APIs
- **Pydantic 2.x** - Data validation using Python type annotations
- **Uvicorn** - Lightning-fast ASGI server

**Database (UI State Only):**
- **SQLite** (default) - Embedded SQL database for development
- **PostgreSQL 15+** (production) - Enterprise-grade relational database
- **SQLAlchemy 2.x** - Python SQL toolkit and ORM

**Authentication:**
- **Python-Jose** - JWT token handling
- **Passlib** - Password hashing
- **BCrypt** - Secure password hashing algorithm

**LLM Integration:**
- **OpenAI Python SDK** - OpenAI API client
- **Anthropic SDK** - Claude API client
- **LiteLLM** - Universal LLM API wrapper (supports 100+ providers)

**HTTP Client:**
- **HTTPX** - Modern HTTP client for Python
- **Requests** - Fallback HTTP library

**Utilities:**
- **Python-dotenv** - Environment variable management
- **APScheduler** - Background task scheduling (optional)

### Cortex Bridge Service (Node.js)

**Runtime:**
- **Node.js 18+ LTS** - JavaScript runtime
- **TypeScript 5.x** - Type-safe development

**Web Framework:**
- **Express 4.x** - Minimal web framework for API endpoints
- **Cors** - Cross-origin resource sharing middleware
- **Body-parser** - Request body parsing

**Cortex Integration:**
- **@cortexmemory/sdk 0.8.0** - Official Cortex SDK
- **Convex 1.28.0+** - Peer dependency for Cortex

**Communication:**
- **HTTP/REST** - Primary communication protocol
- **gRPC** (optional) - High-performance RPC for production

**Utilities:**
- **Dotenv** - Environment configuration
- **Winston** - Structured logging
- **Axios** - HTTP client for external APIs

---

## Memory System Stack

### Cortex SDK (@cortexmemory/sdk)

**Version:** 0.8.0  
**License:** Apache 2.0  
**Language:** TypeScript

**Core Dependencies:**
```json
{
  "convex": "^1.28.0",         // Backend platform
  "neo4j-driver": "^6.0.0"     // Optional graph database
}
```

**Key Features Used:**
- Layer 1 (Conversations) - ACID transaction layer
- Layer 2 (Vector Memory) - Semantic search
- Layer 3 (Facts) - Structured knowledge extraction
- Layer 4 (Memory API) - Convenience wrapper
- User Management - Profile and GDPR compliance
- Context Chains - Hierarchical workflows
- Agent Registry - Multi-agent coordination
- Memory Spaces - Isolation boundaries

### Convex Backend

**Platform:** Convex Cloud or Self-Hosted  
**Version:** Latest stable  
**Language:** TypeScript

**Features Used:**
- ACID transactions
- Real-time subscriptions
- Automatic indexing
- Vector search (via Convex indexes)
- WebSocket connections
- Reactive queries

**Deployment Options:**
1. **Convex Cloud** (Recommended)
   - Managed hosting
   - Automatic scaling
   - Built-in CDN
   - Free tier available

2. **Self-Hosted**
   - Docker container
   - Full control
   - Custom infrastructure
   - No vendor lock-in

### Vector Embeddings

**Embedding Providers (Pick One):**

1. **OpenAI Embeddings** (Recommended)
   - Model: `text-embedding-3-small` (1536 dimensions)
   - Model: `text-embedding-3-large` (3072 dimensions)
   - Cost: $0.02 per 1M tokens
   - Quality: Excellent

2. **Cohere Embeddings**
   - Model: `embed-english-v3.0`
   - Dimensions: 1024
   - Quality: Excellent
   - Good for multi-language

3. **Local Models** (Self-Hosted)
   - Sentence Transformers (HuggingFace)
   - Models: `all-MiniLM-L6-v2` (384 dim)
   - Cost: Free (compute only)
   - Privacy: Complete control

**Embedding Generation:**
```typescript
// Handled by Cortex Bridge
import OpenAI from 'openai';

async function generateEmbedding(text: string): Promise<number[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}
```

---

## Deployment Stack

### Containerization

**Docker:**
- **Engine:** Docker 24.x+
- **Compose:** Docker Compose v2.x

**Containers:**
1. **open-webui** - Open WebUI frontend + backend
2. **cortex-bridge** - Node.js Cortex service
3. **postgres** (optional) - Production database for UI state

**Docker Compose Structure:**
```yaml
version: '3.8'
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:latest
    depends_on:
      - cortex-bridge
    environment:
      - CORTEX_BRIDGE_URL=http://cortex-bridge:3000
    volumes:
      - ./middleware:/app/custom
    
  cortex-bridge:
    build: ./cortex-bridge
    environment:
      - CONVEX_URL=${CONVEX_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=openwebui
```

### Networking

**Internal Network:**
- Docker bridge network
- Service discovery via container names
- No external exposure for bridge service

**External Ports:**
- `8080` - Open WebUI web interface
- `5432` - PostgreSQL (optional, for external tools)

### Reverse Proxy (Production)

**Options:**
1. **Nginx** - Lightweight, high-performance
2. **Traefik** - Docker-native with automatic SSL
3. **Caddy** - Automatic HTTPS

**Configuration Example (Nginx):**
```nginx
server {
    listen 443 ssl http2;
    server_name chat.example.com;
    
    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Development Tools

### Code Quality

**Linting:**
- **ESLint** - JavaScript/TypeScript linter
- **Pylint** - Python linter
- **Prettier** - Code formatter

**Type Checking:**
- **TypeScript Compiler** - Static type checking
- **Mypy** - Python type checker

### Testing

**Backend Testing:**
- **Pytest** - Python test framework
- **Jest** - JavaScript test framework
- **Supertest** - HTTP API testing

**Integration Testing:**
- **Playwright** - End-to-end browser testing
- **Docker Compose** - Integration test environments

### Monitoring

**Logging:**
- **Winston** (Node.js) - Structured logging
- **Loguru** (Python) - Beautiful logging
- **JSON logs** - Machine-parseable format

**Metrics:**
- **Prometheus** (optional) - Time-series metrics
- **Grafana** (optional) - Metrics visualization

**Tracing:**
- **OpenTelemetry** (optional) - Distributed tracing
- **Jaeger** (optional) - Trace visualization

### Development Environment

**Required:**
- Node.js 18+ LTS
- Python 3.11+
- Docker Desktop
- Git

**Recommended:**
- VS Code with extensions:
  - ESLint
  - Prettier
  - Python
  - Docker
  - Svelte for VS Code

---

## Optional Components

### Graph Database (Future - Feature D)

**Neo4j:**
- Version: 5.x Community or Enterprise
- Purpose: Advanced relationship queries
- Deployment: Docker container
- Connection: Bolt protocol (port 7687)

**Memgraph:**
- Version: 2.x
- Purpose: High-performance alternative to Neo4j
- Deployment: Docker container
- Connection: Bolt protocol compatible

**Usage:**
```typescript
import { CypherGraphAdapter } from '@cortexmemory/sdk/graph';

const graph = new CypherGraphAdapter();
await graph.connect({
  uri: 'bolt://localhost:7687',
  username: 'neo4j',
  password: 'password'
});

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  graph: { adapter: graph }
});
```

### Message Queue (High Scale)

**For enterprise deployments:**

**Redis:**
- Version: 7.x
- Purpose: Job queue, caching, rate limiting
- Deployment: Docker or managed service

**RabbitMQ:**
- Version: 3.12+
- Purpose: Message broker for async tasks
- Use case: Background fact extraction

### Load Balancer (Production)

**HAProxy:**
- Layer 4/7 load balancing
- Health checks
- SSL termination

**AWS ALB / GCP Load Balancer:**
- Managed load balancing
- Auto-scaling integration
- Built-in SSL/TLS

---

## Technology Decision Rationale

### Why Svelte? (Open WebUI's Choice)
- ✅ Smaller bundle sizes than React/Vue
- ✅ True reactivity without virtual DOM
- ✅ Excellent performance
- ✅ Growing ecosystem

### Why FastAPI? (Open WebUI's Choice)
- ✅ Modern Python async support
- ✅ Automatic OpenAPI documentation
- ✅ Great performance (comparable to Node.js)
- ✅ Type hints with Pydantic

### Why Node.js for Cortex Bridge?
- ✅ Cortex SDK is TypeScript-first
- ✅ Excellent async/await support
- ✅ Large ecosystem for HTTP servers
- ✅ Easy deployment

### Why Convex for Cortex?
- ✅ ACID transactions out of the box
- ✅ Real-time subscriptions built-in
- ✅ Automatic scaling
- ✅ TypeScript-first platform
- ✅ No infrastructure management
- ✅ Excellent developer experience

### Why Docker Compose?
- ✅ Single-command deployment
- ✅ Reproducible environments
- ✅ Easy local development
- ✅ Production-ready
- ✅ No complex orchestration needed

---

## Version Requirements

### Minimum Versions

| Component | Version | Reason |
|-----------|---------|--------|
| Node.js | 18.0.0+ | ES modules, native fetch |
| Python | 3.11+ | Modern async, type hints |
| Docker | 24.0+ | Compose v2 features |
| Convex | 1.28.0+ | Required by Cortex SDK |
| TypeScript | 5.0+ | Latest type system features |

### Recommended Versions

| Component | Version | Reason |
|-----------|---------|--------|
| Node.js | 20.x LTS | Latest stable LTS |
| Python | 3.11 | Performance improvements |
| Docker | Latest stable | Security patches |
| PostgreSQL | 15.x | Performance, JSON support |

---

## Package Size Overview

### Production Bundle Sizes

**Open WebUI Frontend:**
- Initial JS: ~500 KB (gzipped)
- CSS: ~50 KB (gzipped)
- Fonts/Icons: ~100 KB

**Cortex Bridge:**
- Node.js runtime: ~50 MB
- Dependencies: ~100 MB
- Total container: ~150 MB

**Docker Images:**
- Open WebUI: ~2 GB
- Cortex Bridge: ~200 MB
- PostgreSQL: ~200 MB
- Total: ~2.4 GB

---

## Environment Variables Reference

### Required

```bash
# Convex
CONVEX_URL=https://your-deployment.convex.cloud

# OpenAI (for embeddings)
OPENAI_API_KEY=sk-...

# Open WebUI
OPENWEBUI_SECRET_KEY=random-secret-key

# LLM Provider (pick one)
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
# OR
OLLAMA_BASE_URL=http://localhost:11434
```

### Optional

```bash
# PostgreSQL (production)
DATABASE_URL=postgresql://user:pass@localhost:5432/openwebui

# Redis (caching)
REDIS_URL=redis://localhost:6379

# Monitoring
SENTRY_DSN=https://...

# Feature flags
ENABLE_FACTS_EXTRACTION=true
ENABLE_GRAPH_DATABASE=false
```

---

## Development vs Production

### Development Stack

**Optimized for:**
- Fast iteration
- Easy debugging
- Local testing

**Components:**
- SQLite for UI state
- Local Convex deployment
- Docker Compose
- Hot reloading
- Debug logging

### Production Stack

**Optimized for:**
- Performance
- Reliability
- Scalability

**Components:**
- PostgreSQL for UI state
- Convex Cloud
- Kubernetes (optional)
- Load balancer
- Monitoring stack
- SSL/TLS
- Log aggregation

---

## Summary

This integration uses a **modern, production-ready stack** that combines:

1. **Open WebUI** - Proven chat interface with 30K+ stars
2. **Cortex SDK** - Enterprise memory system built on Convex
3. **Node.js Bridge** - TypeScript-first integration layer
4. **Docker Compose** - Simple, reproducible deployment

The result is a **complete solution** that's:
- ✅ Easy to deploy (one command)
- ✅ Production-ready (ACID, scaling, monitoring)
- ✅ Developer-friendly (TypeScript, OpenAPI, hot reload)
- ✅ Enterprise-grade (GDPR, versioning, analytics)

Next: [03-FEATURES-DEMONSTRATED.md](./03-FEATURES-DEMONSTRATED.md) - Deep dive into Cortex features

