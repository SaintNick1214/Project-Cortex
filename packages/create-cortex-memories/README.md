# create-cortex-memories

Interactive CLI to scaffold projects with Cortex Memory SDK and Convex backend.

## Usage

### Create a New Project

```bash
npm create cortex-memories@latest my-ai-agent
```

### Add to Existing Project

```bash
cd your-existing-project
npm create cortex-memories@latest .
```

## What It Does

The wizard will guide you through:

1. **Project Setup** - Name and location
2. **Convex Configuration** - Choose between:
   - Set up new Convex database (cloud)
   - Use existing Convex database
   - Use local Convex for development
3. **Graph Database (Optional)** - Enable Neo4j/Memgraph integration
4. **Installation** - Automatically installs dependencies
5. **Backend Deployment** - Copies and deploys Cortex backend functions
6. **Environment Configuration** - Creates .env files with proper settings

## After Setup

```bash
cd my-ai-agent
npm run dev
```

Your AI agent now has persistent memory powered by Cortex!

## Learn More

- [Cortex Documentation](https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation)
- [Examples](https://github.com/SaintNick1214/Project-Cortex/tree/main/Examples)
- [API Reference](https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation/03-api-reference)

## License

Apache-2.0

