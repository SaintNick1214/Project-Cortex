# create-cortex-memories

Interactive CLI to scaffold projects with Cortex Memory SDK and Convex backend.

## Usage

### Create a New Project

```bash
npm create cortex-memories
```

The wizard will prompt for your project name.

Or specify it directly:

```bash
npm create cortex-memories my-ai-agent
```

### Add to Existing Project

```bash
cd your-existing-project
npm create cortex-memories
# Choose current directory when prompted
```

## What It Does

The wizard will guide you through:

1. **Project Setup** - Name and location
2. **Smart Version Detection** - Automatically fetches the latest SDK and correct Convex version
3. **Convex Configuration** - Choose between:
   - Set up new Convex database (cloud)
   - Use existing Convex database
   - Use local Convex for development
4. **Graph Database (Optional)** - Enable Neo4j/Memgraph integration
5. **Installation** - Automatically installs dependencies with perfect version compatibility
6. **Backend Deployment** - Copies and deploys Cortex backend functions
7. **Environment Configuration** - Creates .env files with proper settings

### Always Up-to-Date

This CLI automatically installs the **latest** version of `@cortexmemory/sdk` and the **correct** version of Convex required by that SDK. No more version conflicts or outdated dependencies!

## After Setup

```bash
cd my-cortex-agent  # Or whatever name you chose
npm run dev         # Terminal 1: Start Convex
npm start           # Terminal 2: Run your agent
```

Your AI agent now has persistent memory powered by Cortex!

## Learn More

- [Cortex Documentation](https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation)
- [Examples](https://github.com/SaintNick1214/Project-Cortex/tree/main/Examples)
- [API Reference](https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation/03-api-reference)

## License

Apache-2.0
