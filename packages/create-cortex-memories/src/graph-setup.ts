/**
 * Graph database setup
 */

import fs from "fs-extra";
import path from "path";
import prompts from "prompts";
import type { GraphConfig } from "./types.js";
import pc from "picocolors";
import ora from "ora";
import { createGraphDockerCompose } from "./env-generator.js";
import { execCommand } from "./utils.js";

/**
 * Check if Docker is installed
 */
async function checkDockerInstalled(): Promise<boolean> {
  try {
    const result = await execCommand("docker", ["--version"], {});
    return result.code === 0;
  } catch {
    return false;
  }
}

/**
 * Show Docker installation instructions
 */
function showDockerInstructions(): void {
  console.log(pc.yellow("\n⚠️  Docker Desktop is not installed\n"));
  console.log(
    pc.bold("To use local graph database, please install Docker Desktop:\n"),
  );

  const platform = process.platform;
  if (platform === "darwin") {
    console.log(pc.cyan("macOS:"));
    console.log(
      pc.dim(
        "  1. Download Docker Desktop: https://www.docker.com/products/docker-desktop",
      ),
    );
    console.log(pc.dim("  2. Install and start Docker Desktop"));
    console.log(pc.dim("  3. Run the wizard again\n"));
  } else if (platform === "win32") {
    console.log(pc.cyan("Windows:"));
    console.log(
      pc.dim(
        "  1. Download Docker Desktop: https://www.docker.com/products/docker-desktop",
      ),
    );
    console.log(pc.dim("  2. Install and start Docker Desktop"));
    console.log(pc.dim("  3. Run the wizard again\n"));
  } else {
    console.log(pc.cyan("Linux:"));
    console.log(
      pc.dim(
        "  1. Install Docker Engine: https://docs.docker.com/engine/install/",
      ),
    );
    console.log(
      pc.dim(
        "  2. Install Docker Compose: https://docs.docker.com/compose/install/",
      ),
    );
    console.log(pc.dim("  3. Run the wizard again\n"));
  }

  console.log(
    pc.dim(
      'Or choose "Cloud/Existing instance" to use a remote graph database.\n',
    ),
  );
}

/**
 * Get graph database configuration (prompts only, no file creation)
 */
export async function getGraphConfig(): Promise<GraphConfig | null> {
  console.log(pc.cyan("\n🕸️  Graph Database Setup (Optional)"));
  console.log(
    pc.dim("   Graph databases enable advanced relationship queries"),
  );
  console.log(pc.dim("   This is optional and can be configured later\n"));

  const { enableGraph } = await prompts({
    type: "confirm",
    name: "enableGraph",
    message: "Enable graph database integration?",
    initial: false,
  });

  if (!enableGraph) {
    console.log(pc.dim("   Skipping graph database setup"));
    return null;
  }

  const { graphType } = await prompts({
    type: "select",
    name: "graphType",
    message: "Which graph database would you like to use?",
    choices: [
      { title: "Neo4j (Most popular, enterprise-ready)", value: "neo4j" },
      {
        title: "Memgraph (High-performance, analytics-focused)",
        value: "memgraph",
      },
      { title: "Skip for now", value: "skip" },
    ],
    initial: 0,
  });

  if (!graphType || graphType === "skip") {
    return null;
  }

  // Check for Docker if user wants local deployment
  const hasDocker = await checkDockerInstalled();

  const deploymentChoices = [
    { title: "Local (Docker Compose)", value: "local", disabled: !hasDocker },
    { title: "Cloud/Existing instance", value: "cloud" },
  ];

  if (!hasDocker) {
    console.log(
      pc.yellow("   ⚠️  Docker not detected - local deployment unavailable"),
    );
  }

  const { deploymentType } = await prompts({
    type: "select",
    name: "deploymentType",
    message: `How would you like to run ${graphType === "neo4j" ? "Neo4j" : "Memgraph"}?`,
    choices: deploymentChoices,
    initial: hasDocker ? 0 : 1,
  });

  if (!deploymentType) {
    return null;
  }

  // If local was selected but Docker isn't installed, show instructions
  if (deploymentType === "local" && !hasDocker) {
    showDockerInstructions();
    return null;
  }

  let config: GraphConfig;

  if (deploymentType === "local") {
    config = await getLocalGraphConfig(graphType);
  } else {
    config = await getCloudGraphConfig(graphType);
  }

  console.log(pc.green("\n   ✓ Graph database configured"));
  console.log(pc.dim(`   Type: ${config.type}`));
  console.log(pc.dim(`   URI: ${config.uri}`));

  return config;
}

/**
 * Create graph database files (docker-compose, etc.)
 */
export async function setupGraphFiles(
  projectPath: string,
  config: GraphConfig,
): Promise<void> {
  // Only create docker-compose for local deployments
  if (config.uri.includes("localhost") || config.uri.includes("127.0.0.1")) {
    await createGraphDockerCompose(projectPath, config.type);
  }
}

/**
 * Get local graph database configuration
 */
async function getLocalGraphConfig(
  graphType: "neo4j" | "memgraph",
): Promise<GraphConfig> {
  const defaultPort = 7687;
  const defaultPassword = "cortex-password";

  console.log(
    pc.cyan(`\n   Local ${graphType} will be configured with Docker Compose`),
  );
  console.log(
    pc.dim(`   To start: docker-compose -f docker-compose.graph.yml up -d\n`),
  );

  if (graphType === "neo4j") {
    console.log(pc.dim("   Neo4j Browser: http://localhost:7474"));
    console.log(pc.dim("   Bolt: bolt://localhost:7687\n"));
  } else {
    console.log(pc.dim("   Memgraph Lab: http://localhost:3000"));
    console.log(pc.dim("   Bolt: bolt://localhost:7687\n"));
  }

  return {
    type: graphType,
    uri: `bolt://localhost:${defaultPort}`,
    username: graphType === "neo4j" ? "neo4j" : "memgraph",
    password: defaultPassword,
  };
}

/**
 * Get cloud/existing graph database configuration
 */
async function getCloudGraphConfig(
  graphType: "neo4j" | "memgraph",
): Promise<GraphConfig> {
  console.log(pc.cyan("\n   Enter your graph database connection details:"));

  const response = await prompts([
    {
      type: "text",
      name: "uri",
      message: "Database URI (e.g., bolt://localhost:7687):",
      initial: "bolt://localhost:7687",
      validate: (value) => {
        if (!value) return "URI is required";
        if (!value.startsWith("bolt://") && !value.startsWith("neo4j://")) {
          return "URI must start with bolt:// or neo4j://";
        }
        return true;
      },
    },
    {
      type: "text",
      name: "username",
      message: "Username:",
      initial: graphType === "neo4j" ? "neo4j" : "memgraph",
    },
    {
      type: "password",
      name: "password",
      message: "Password:",
    },
  ]);

  if (!response.uri || !response.username || !response.password) {
    throw new Error("All connection details are required");
  }

  console.log(pc.green("   ✓ Connection details saved"));
  console.log(pc.dim("   Connection will be tested when you start your app"));

  return {
    type: graphType,
    uri: response.uri,
    username: response.username,
    password: response.password,
  };
}

/**
 * Add graph database dependencies to package.json
 */
export async function addGraphDependencies(projectPath: string): Promise<void> {
  const packageJsonPath = path.join(projectPath, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error("package.json not found");
  }

  const packageJson = await fs.readJson(packageJsonPath);

  // Add neo4j-driver if not present
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }

  if (!packageJson.dependencies["neo4j-driver"]) {
    packageJson.dependencies["neo4j-driver"] = "^6.0.0";
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    console.log(pc.dim("   Added neo4j-driver to dependencies"));
  }
}

/**
 * Create example graph initialization file
 */
export async function createGraphExample(projectPath: string): Promise<void> {
  const examplePath = path.join(projectPath, "src", "graph-init.example.ts");

  const exampleCode = `/**
 * Graph Database Initialization Example
 * 
 * This file shows how to initialize and use the graph database
 * with Cortex Memory SDK.
 */

import { Cortex } from '@cortexmemory/sdk';
import { CypherGraphAdapter, initializeGraphSchema } from '@cortexmemory/sdk/graph';

async function initializeGraph() {
  // 1. Create graph adapter
  const graphAdapter = new CypherGraphAdapter();
  
  // 2. Connect to graph database
  await graphAdapter.connect({
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'cortex-password',
  });

  // 3. Initialize schema (constraints and indexes)
  await initializeGraphSchema(graphAdapter);

  // 4. Initialize Cortex with graph integration
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL!,
    graph: {
      adapter: graphAdapter,
      orphanCleanup: true,
    },
  });

  return { cortex, graphAdapter };
}

// Example usage
async function main() {
  const { cortex, graphAdapter } = await initializeGraph();

  try {
    // Use Cortex normally - graph sync happens automatically!
    await cortex.memory.remember({
      memorySpaceId: 'my-agent',
      conversationId: 'conv-1',
      userMessage: 'Hello, Cortex with graph!',
      agentResponse: 'Ready to remember with enhanced graph capabilities!',
      userId: 'user-1',
      userName: 'User',
    });

    console.log('Memory stored with graph enrichment!');
  } finally {
    // Cleanup
    cortex.close();
    await graphAdapter.disconnect();
  }
}

// Uncomment to run:
// main().catch(console.error);
`;

  await fs.ensureDir(path.dirname(examplePath));
  await fs.writeFile(examplePath, exampleCode);
  console.log(
    pc.dim(`   Created example: ${path.relative(projectPath, examplePath)}`),
  );
}
