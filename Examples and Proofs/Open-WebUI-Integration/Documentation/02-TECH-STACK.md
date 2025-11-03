# Technology Stack - Open WebUI + Cortex Integration

> **Complete breakdown of every technology in the integrated system**

## Table of Contents

- [Overview](#overview)
- [Open WebUI Stack](#open-webui-stack)
- [Cortex Stack](#cortex-stack)
- [Integration Layer](#integration-layer)
- [Development Tools](#development-tools)
- [Production Stack](#production-stack)

---

## Overview

This integration combines three major technology stacks:

```
┌──────────────────────────────────────────────────────────────┐
│                    COMPLETE TECH STACK                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Open WebUI    │  │  Integration│  │  Cortex Stack   │  │
│  │                │  │  Layer      │  │                 │  │
│  │  Svelte        │◄─┤  HTTP API   ├─►│  Node.js        │  │
│  │  Python        │  │  Bridge     │  │  TypeScript     │  │
│  │  FastAPI       │  │  Express    │  │  Convex         │  │
│  └────────────────┘  └─────────────┘  └─────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Open WebUI Stack

### Frontend Technologies

#### Core Framework

**Svelte 4.x**

- Compiler-based reactive framework
- No virtual DOM (compiles to vanilla JavaScript)
- Reactive assignments (`$:`)
- Component-scoped styling
- **Why**: Lightweight, fast, simple component model

**SvelteKit**

- Full-stack framework built on Svelte
- File-based routing (`src/routes/`)
- Server-side rendering (SSR)
- API endpoints in `+server.js`
- **Version**: Latest (1.x)

**TypeScript 5.x**

- Type-safe JavaScript
- Interface definitions
- Auto-completion in IDEs
- **Usage**: Frontend code, API clients

#### UI & Styling

**Tailwind CSS 3.x**

- Utility-first CSS framework
- JIT (Just-In-Time) compiler
- Custom configuration for Open WebUI theme
- **File**: `tailwind.config.js`

**DaisyUI**

- Component library built on Tailwind
- Pre-styled components (buttons, cards, modals)
- Theme system
- **Usage**: Base UI components

**Iconify**

- Unified icon framework
- Multiple icon sets (Material Icons, FontAwesome, etc.)
- **Usage**: UI icons throughout app

#### Build Tools

**Vite 5.x**

- Next-generation frontend tooling
- Fast hot module replacement (HMR)
- Optimized production builds
- Plugin ecosystem
- **Config**: `vite.config.js`

**PostCSS**

- CSS transformation tool
- Plugins: Autoprefixer, TailwindCSS
- **Config**: `postcss.config.js`

### Backend Technologies

#### Core Framework

**Python 3.11+**

- Modern Python with latest features
- Type hints support
- Async/await native support
- **Min Version**: 3.11

**FastAPI 0.110.0+**

- Modern Python web framework
- Automatic OpenAPI docs generation
- Native async support
- Pydantic validation
- **Why**: High performance, async, easy integration

**Uvicorn**

- ASGI server for FastAPI
- High-performance async server
- **Usage**: Runs FastAPI application

#### Database

**SQLAlchemy 2.x**

- Python ORM (Object-Relational Mapping)
- Supports multiple databases
- Async support via `asyncio`
- Migration system

**PostgreSQL 15** (Production)

- Relational database
- ACID compliant
- JSON support for metadata
- **Usage**: User data, chat history, settings

**SQLite** (Development)

- File-based database
- Zero configuration
- **Usage**: Local development only

**Alembic**

- Database migration tool for SQLAlchemy
- Version control for database schema
- **Usage**: Schema changes over time

#### API Communication

**httpx 0.25.0+**

- Modern async HTTP client for Python
- HTTP/2 support
- Connection pooling
- **Usage**: Calls to Cortex Bridge

**Pydantic 2.x**

- Data validation using Python type hints
- JSON schema generation
- **Usage**: Request/response models

#### Authentication & Security

**python-jose**

- JavaScript Object Signing and Encryption for Python
- JWT token handling
- **Usage**: User authentication tokens

**passlib**

- Password hashing library
- bcrypt algorithm support
- **Usage**: Secure password storage

**python-multipart**

- Multipart form data parsing
- File upload handling
- **Usage**: File attachments in chat

---

## Cortex Stack

### Cortex Bridge (Node.js Service)

#### Runtime & Framework

**Node.js 18+**

- LTS version for stability
- ESM (ES Modules) support
- Native fetch API
- **Min Version**: 18.0.0

**Express 4.18+**

- Minimalist web framework
- Middleware support
- Route handling
- **Usage**: HTTP API server

#### HTTP & CORS

**cors 2.8+**

- Cross-Origin Resource Sharing middleware
- Configurable origins
- **Usage**: Allow Open WebUI to call bridge

**dotenv 16.3+**

- Environment variable loading
- `.env` file support
- **Usage**: Configuration management

#### Logging

**winston 3.11+**

- Flexible logging library
- Multiple transports (console, file)
- Log levels (error, warn, info, debug)
- **Usage**: Bridge activity logging

### Cortex SDK

#### Core

**Cortex SDK (TypeScript)**

- Location: `../../dist/index.js` (local build)
- Language: TypeScript compiled to JavaScript
- **Provides**: Memory, Contexts, Facts, Agents APIs

**Convex 1.28+**

- Backend-as-a-Service
- Real-time database
- Serverless functions
- **Usage**: Cortex data storage

#### Embeddings

**OpenAI API 4.20+**

- Text embedding generation
- Model: `text-embedding-3-small` or `text-embedding-3-large`
- **Usage**: Semantic search vectors

**Node.js OpenAI Client**

- Official OpenAI SDK for Node.js
- Streaming support
- **Package**: `openai`

---

## Integration Layer

### Cortex Bridge API

**Port**: 3000 (configurable)

**Endpoints**:

- `POST /api/memory/remember` - Store conversation
- `POST /api/memory/recall` - Search memories
- `GET /api/users/:userId` - Get user profile
- `POST /api/contexts/create` - Create context
- `GET /api/facts/:memorySpaceId` - Query facts
- `POST /api/agents/register` - Register agent

**Protocol**: HTTP/HTTPS  
**Format**: JSON  
**Auth**: Optional (can add API key middleware)

### Python Client Module

**File**: `backend/apps/cortex/client.py`

```python
import httpx
from typing import List, Optional
from pydantic import BaseModel

class Memory(BaseModel):
    text: str
    similarity: float
    timestamp: str

class CortexClient:
    def __init__(self, bridge_url: str):
        self.bridge_url = bridge_url
        self.client = httpx.AsyncClient(timeout=30.0)

    async def recall_memories(
        self, user_id: str, query: str, limit: int = 5
    ) -> List[Memory]:
        """Retrieve relevant memories"""
        response = await self.client.post(
            f"{self.bridge_url}/api/memory/recall",
            json={"userId": user_id, "query": query, "limit": limit}
        )
        return [Memory(**m) for m in response.json()["memories"]]
```

**Dependencies**:

- `httpx` - Async HTTP client
- `pydantic` - Data validation

---

## Development Tools

### Version Control

**Git**

- Source control
- Branch management
- **Branch**: `cortex-integration` (feature branch)

**GitHub**

- Remote repository
- Issue tracking
- Pull requests

### Code Quality

**ESLint** (JavaScript/TypeScript)

- Linting for JavaScript/TypeScript code
- Config: `.eslintrc.js`

**Prettier**

- Code formatter
- Consistent code style
- Auto-format on save

**Black** (Python)

- Python code formatter
- PEP 8 compliant
- **Usage**: Format backend code

**mypy** (Python)

- Static type checker for Python
- Type hint validation
- **Usage**: Catch type errors

### Testing

**Pytest** (Python)

- Testing framework for Python
- Fixtures support
- **Usage**: Backend tests

**Playwright** (JavaScript)

- End-to-end testing
- Browser automation
- **Usage**: Frontend E2E tests

### Development Environment

**VS Code** (Recommended)

- Extensions:
  - Svelte for VS Code
  - Python
  - Prettier
  - ESLint
  - Tailwind CSS IntelliSense

**Cursor** (Alternative)

- AI-powered IDE
- Same extensions as VS Code

---

## Production Stack

### Container Orchestration

#### Docker

**Docker 24.0+**

- Container platform
- Image building
- **Why**: Consistent environments

**Docker Compose**

- Multi-container orchestration
- Service definition
- **File**: `docker-compose.full.yml`

```yaml
version: "3.8"

services:
  cortex-bridge:
    build: ./src/cortex-bridge
    image: cortex-bridge:latest
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - CONVEX_URL=${CONVEX_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}

  open-webui:
    image: ghcr.io/open-webui/open-webui:latest
    # Modified to include Cortex integration
    build: ./open-webui-fork
    restart: unless-stopped
    depends_on:
      - cortex-bridge
      - postgresql

  postgresql:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=openwebui
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Infrastructure

#### Reverse Proxy

**Nginx** (Optional)

- HTTP reverse proxy
- Load balancing
- SSL termination
- **Usage**: Production deployment

#### Monitoring

**Prometheus** (Optional)

- Metrics collection
- Time-series database
- **Usage**: Performance monitoring

**Grafana** (Optional)

- Metrics visualization
- Dashboards
- **Usage**: Monitoring UI

---

## Environment Configuration

### Development Environment

**File**: `.env.local`

```bash
# Convex (local development)
CONVEX_URL=http://127.0.0.1:3210

# OpenAI
OPENAI_API_KEY=sk-your-dev-key

# Cortex Bridge
CORTEX_BRIDGE_URL=http://localhost:3000
ENABLE_CORTEX_MEMORY=true

# Open WebUI Database (development)
DATABASE_URL=sqlite:///./data/webui.db

# Open WebUI Settings
WEBUI_SECRET_KEY=dev-secret-key
WEBUI_JWT_SECRET_KEY=dev-jwt-secret
```

### Production Environment

**File**: `.env.production`

```bash
# Convex (production deployment)
CONVEX_URL=https://your-project.convex.cloud

# OpenAI
OPENAI_API_KEY=sk-your-production-key

# Cortex Bridge
CORTEX_BRIDGE_URL=http://cortex-bridge:3000
ENABLE_CORTEX_MEMORY=true

# Open WebUI Database (production)
DATABASE_URL=postgresql://user:pass@postgresql:5432/openwebui

# Security
WEBUI_SECRET_KEY=<long-random-string>
WEBUI_JWT_SECRET_KEY=<long-random-string>

# Performance
NODE_ENV=production
WORKERS=4
```

---

## Dependency Management

### JavaScript/TypeScript (Cortex Bridge)

**File**: `src/cortex-bridge/package.json`

```json
{
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "openai": "^4.20.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "typescript": "^5.3.0"
  }
}
```

### Python (Open WebUI Backend)

**File**: `backend/requirements.txt`

```
fastapi==0.110.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
alembic==1.13.1
httpx==0.25.2
pydantic==2.5.3
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
psycopg2-binary==2.9.9  # PostgreSQL driver
redis==5.0.1
```

**Additional for Cortex Integration**:

```
# Add to requirements.txt
python-dotenv==1.0.0
```

### Svelte (Open WebUI Frontend)

**File**: `package.json`

```json
{
  "devDependencies": {
    "@sveltejs/adapter-node": "^2.0.0",
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "svelte": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16"
  },
  "dependencies": {
    "daisyui": "^4.4.0",
    "@iconify/svelte": "^3.1.0"
  }
}
```

---

## Version Compatibility Matrix

| Component  | Minimum Version | Recommended | Notes                 |
| ---------- | --------------- | ----------- | --------------------- |
| Node.js    | 18.0.0          | 20.x LTS    | ESM support required  |
| Python     | 3.11            | 3.12        | Type hints, async     |
| Docker     | 24.0            | Latest      | BuildKit support      |
| PostgreSQL | 13              | 15          | JSON support          |
| Redis      | 6               | 7           | Optional, for caching |

---

## Installation Commands

### Complete Setup (All Components)

```bash
# 1. Clone Open WebUI
cd "Examples and Proofs/Open-WebUI-Integration"
git clone https://github.com/open-webui/open-webui.git open-webui-fork
cd open-webui-fork
git checkout -b cortex-integration

# 2. Install Python dependencies (Backend)
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Install Node dependencies (Frontend)
cd ../
npm install

# 4. Install Cortex Bridge dependencies
cd ../src/cortex-bridge
npm install

# 5. Setup environment
cd ../../
cp env.example .env.local
# Edit .env.local with your configuration

# 6. Build Cortex SDK (if not already built)
cd ../../..  # Back to project root
npm run build
```

---

## Next Steps

- **Features Documentation** → [03-FEATURES-DEMONSTRATED.md](03-FEATURES-DEMONSTRATED.md)
- **Integration Steps** → [04-INTEGRATION-GUIDE.md](04-INTEGRATION-GUIDE.md)
- **Visual Components** → [06-VISUAL-COMPONENTS.md](06-VISUAL-COMPONENTS.md)
- **Deployment** → [09-DEPLOYMENT.md](09-DEPLOYMENT.md)
