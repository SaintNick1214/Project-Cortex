# Quick Start Guide - Open WebUI + Cortex Integration

> **Get the Cortex Bridge running in under 5 minutes**

## Prerequisites

- ✅ Node.js 18+ installed
- ✅ Docker and Docker Compose installed
- ✅ Convex account ([sign up free](https://convex.dev))
- ✅ OpenAI API key ([get one here](https://platform.openai.com/api-keys))

## Step 1: Setup Environment (2 minutes)

```bash
# Navigate to integration directory
cd "Examples and Proofs/Open-WebUI-Integration"

# Copy environment template
cp env.example .env

# Edit .env and set these required variables:
# - CONVEX_URL (from step 2)
# - OPENAI_API_KEY (your OpenAI key)
```

## Step 2: Deploy Cortex Schema (2 minutes)

```bash
# Navigate to Convex schema directory
cd ../../convex-dev

# Install Convex CLI if not already installed
npm install -g convex

# Deploy schema to Convex
npx convex deploy --prod

# Copy the deployment URL that appears
# It looks like: https://your-deployment.convex.cloud

# Add it to your .env file:
# CONVEX_URL=https://your-deployment.convex.cloud

# Return to integration directory
cd "../Examples and Proofs/Open-WebUI-Integration"
```

## Step 3: Start Cortex Bridge (1 minute)

```bash
# Start the Cortex Bridge service
docker-compose up -d cortex-bridge

# Check if it's running
docker-compose ps

# View logs
docker-compose logs -f cortex-bridge

# Wait for: "🚀 Cortex Bridge ready at http://localhost:3000"
```

## Step 4: Test the Integration (30 seconds)

```bash
# Test health endpoint
curl http://localhost:3000/health

# Should return: {"status":"healthy","cortex":"connected",...}

# Run integration tests
cd src/cortex-bridge
npm install
node ../examples/integration-test.js
```

## Step 5: Run Examples (Optional)

```bash
# Basic chat example (Category A features)
node src/examples/basic-chat.js

# Multi-agent collaboration (Category C features)
node src/examples/multi-agent.js

# Context chains (Category B features)
node src/examples/context-chains.js

# Facts extraction (Category B features)
node src/examples/facts-extraction.js

# GDPR compliance (Category B features)
node src/examples/gdpr-compliance.js
```

## That's It! 🎉

The Cortex Bridge is now running and ready to integrate with Open WebUI or any other application.

## Next Steps

### For Development:
- Read [04-INTEGRATION-GUIDE.md](./Documentation/04-INTEGRATION-GUIDE.md) for full integration details
- Explore the [Python middleware](./src/openwebui-middleware/) for Open WebUI integration patterns
- Review [05-API-INTEGRATION.md](./Documentation/05-API-INTEGRATION.md) for complete API reference

### For Production:
- Follow [06-DEPLOYMENT.md](./Documentation/06-DEPLOYMENT.md) for production deployment
- Configure SSL/TLS with the nginx setup
- Set up monitoring and logging

### To Integrate with Open WebUI:
1. Use the Python middleware in `src/openwebui-middleware/`
2. Import `cortex_client` in your Open WebUI backend
3. Override chat endpoints to use Cortex memory
4. See `chat_integration.py` for reference implementation

## Troubleshooting

**Can't connect to Convex?**
```bash
# Verify deployment
cd ../../convex-dev
npx convex status

# Redeploy if needed
npx convex deploy --prod
```

**Port 3000 already in use?**
```bash
# Change port in docker-compose.yml:
# ports:
#   - "3001:3000"
```

**See logs for errors:**
```bash
docker-compose logs -f cortex-bridge
```

For more help, see [09-TROUBLESHOOTING.md](./Documentation/09-TROUBLESHOOTING.md)

## API Endpoints

Once running, these endpoints are available:

**Memory:**
- `POST /api/memory/remember` - Store conversation
- `POST /api/memory/recall` - Semantic search
- `POST /api/memory/update-response` - Update with LLM response
- `DELETE /api/memory/forget` - Delete memory

**Users:**
- `POST /api/users/create` - Create user profile
- `GET /api/users/:userId` - Get profile
- `PUT /api/users/:userId` - Update profile
- `DELETE /api/users/:userId` - GDPR deletion

**Contexts:**
- `POST /api/contexts/create` - Create context
- `GET /api/contexts/:memorySpaceId` - List contexts
- `GET /api/contexts/:contextId/chain` - Get hierarchy

**Facts:**
- `GET /api/facts/:memorySpaceId` - Query facts
- `POST /api/facts/extract` - Extract facts
- `POST /api/facts/query` - Query with filters

**Agents:**
- `POST /api/agents/register` - Register agent
- `GET /api/agents` - List agents
- `GET /api/agents/:agentId` - Get agent
- `DELETE /api/agents/:agentId` - Unregister agent

## Support

- **Documentation**: [./Documentation/](./Documentation/)
- **GitHub Issues**: [Report issues](https://github.com/SaintNick1214/Project-Cortex/issues)
- **Discussions**: [Ask questions](https://github.com/SaintNick1214/Project-Cortex/discussions)

---

**Ready for the full experience?** Check out the [complete documentation](./Documentation/00-PROJECT-OVERVIEW.md)!

