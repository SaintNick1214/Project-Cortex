/**
 * Graph database setup
 *
 * Handles setting up Neo4j or Memgraph for the init wizard.
 */

import fs from "fs-extra";
import path from "path";
import prompts from "prompts";
import ora from "ora";
import crypto from "crypto";
import type { GraphConfig } from "./types.js";
import pc from "picocolors";
import { createGraphDockerCompose } from "./env-generator.js";
import { execCommand } from "../shell.js";

/**
 * Generate a cryptographically secure random password
 * Neo4j has no restrictions on password characters, min 8 chars by default
 *
 * Uses rejection sampling to avoid modulo bias when mapping random bytes
 * to charset indices. This ensures uniform distribution across all characters.
 */
function generateSecurePassword(length: number = 20): string {
  // Use a charset that works well with shell/env files (avoid problematic chars like $, `, \)
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#%^&*()-_=+[]{}|;:,.<>?";
  const charsetLength = charset.length;

  // Calculate the largest multiple of charsetLength <= 256 to avoid modulo bias
  // Any byte value >= maxUnbiased would create bias when using modulo
  const maxUnbiased = Math.floor(256 / charsetLength) * charsetLength;

  let password = "";
  while (password.length < length) {
    const byte = crypto.randomBytes(1)[0];
    // Reject values that would introduce bias
    if (byte >= maxUnbiased) {
      continue;
    }
    password += charset[byte % charsetLength];
  }
  return password;
}

/**
 * Check if Docker is installed
 */
async function checkDockerInstalled(): Promise<boolean> {
  try {
    const result = await execCommand("docker", ["--version"], { quiet: true });
    return result.code === 0;
  } catch {
    return false;
  }
}

/**
 * Show Docker installation instructions
 */
function showDockerInstructions(): void {
  console.log(pc.yellow("\n   Docker Desktop is not installed\n"));
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
  console.log(pc.cyan("\n   Graph Database Setup"));
  console.log(
    pc.dim("   Graph databases enable advanced relationship queries"),
  );
  console.log(pc.dim("   Recommended for production use\n"));

  const { enableGraph } = await prompts({
    type: "confirm",
    name: "enableGraph",
    message: "Enable graph database integration?",
    initial: true,
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
      pc.yellow("   Docker not detected - local deployment unavailable"),
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

  console.log(pc.green("\n   Graph database configured"));
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
    await createGraphDockerCompose(projectPath, config.type, config.password);
  }
}

/**
 * Get local graph database configuration
 */
async function getLocalGraphConfig(
  graphType: "neo4j" | "memgraph",
): Promise<GraphConfig> {
  const defaultPort = 7687;
  const username = graphType === "neo4j" ? "neo4j" : "memgraph";

  console.log(
    pc.cyan(`\n   Local ${graphType} will be configured with Docker Compose`),
  );

  if (graphType === "neo4j") {
    console.log(pc.dim("   Neo4j Browser: http://localhost:7474"));
    console.log(pc.dim("   Bolt: bolt://localhost:7687\n"));
  } else {
    console.log(pc.dim("   Memgraph Lab: http://localhost:3000"));
    console.log(pc.dim("   Bolt: bolt://localhost:7687\n"));
  }

  // Prompt for password configuration
  const { passwordChoice } = await prompts({
    type: "select",
    name: "passwordChoice",
    message: `${graphType === "neo4j" ? "Neo4j" : "Memgraph"} password:`,
    choices: [
      { title: "Generate secure password (recommended)", value: "generate" },
      { title: "Enter custom password", value: "custom" },
    ],
    initial: 0,
  });

  let password: string;

  if (passwordChoice === "custom") {
    const { customPassword } = await prompts({
      type: "password",
      name: "customPassword",
      message: "Enter password (min 8 characters):",
      validate: (value) => {
        if (!value || value.length < 8) {
          return "Password must be at least 8 characters";
        }
        return true;
      },
    });
    password = customPassword;
  } else {
    password = generateSecurePassword(20);
    console.log(pc.green("   ✓ Generated secure 20-character password"));
    console.log(pc.dim(`   Password will be saved to .env.local`));
  }

  return {
    type: graphType,
    uri: `bolt://localhost:${defaultPort}`,
    username,
    password,
  };
}

/**
 * Start graph database containers
 */
export async function startGraphContainers(
  projectPath: string,
  graphType: "neo4j" | "memgraph",
): Promise<boolean> {
  const dockerComposePath = path.join(projectPath, "docker-compose.graph.yml");

  if (!fs.existsSync(dockerComposePath)) {
    console.log(pc.yellow("   docker-compose.graph.yml not found"));
    return false;
  }

  const spinner = ora(`Starting ${graphType} containers...`).start();
  const containerName = `cortex-${graphType}`;

  try {
    // Check if containers are already running
    const checkResult = await execCommand(
      "docker",
      ["ps", "--filter", `name=${containerName}`, "--format", "{{.Status}}"],
      { cwd: projectPath, quiet: true },
    );

    if (checkResult.stdout.includes("Up")) {
      spinner.succeed(`${graphType} is already running`);
      showGraphConnectionInfo(graphType);
      return true;
    }

    // Check if container exists but is stopped (from a previous run)
    const existsResult = await execCommand(
      "docker",
      [
        "ps",
        "-a",
        "--filter",
        `name=${containerName}`,
        "--format",
        "{{.Names}}",
      ],
      { cwd: projectPath, quiet: true },
    );

    if (existsResult.stdout.includes(containerName)) {
      // Container exists, try to start it first
      spinner.text = `Starting existing ${graphType} container...`;
      const startResult = await execCommand(
        "docker",
        ["start", containerName],
        { cwd: projectPath, quiet: true },
      );

      if (startResult.code === 0) {
        await waitForGraphReady(spinner, graphType);
        spinner.succeed(`${graphType} is running`);
        showGraphConnectionInfo(graphType);
        return true;
      }

      // If start failed, remove the old container and recreate
      spinner.text = `Removing old ${graphType} container...`;
      await execCommand("docker", ["rm", "-f", containerName], {
        cwd: projectPath,
        quiet: true,
      });
    }

    // Pull images first (may take time on first run)
    spinner.text = `Pulling ${graphType} image (this may take a few minutes on first run)...`;
    await execCommand(
      "docker",
      ["compose", "-f", "docker-compose.graph.yml", "pull"],
      { cwd: projectPath, quiet: true },
    );

    // Start containers
    spinner.text = `Starting ${graphType} containers...`;
    const result = await execCommand(
      "docker",
      ["compose", "-f", "docker-compose.graph.yml", "up", "-d"],
      { cwd: projectPath, quiet: true },
    );

    if (result.code !== 0) {
      spinner.fail(`Failed to start ${graphType}`);
      console.log(pc.dim(`   Error: ${result.stderr}`));
      return false;
    }

    // Wait for container to be healthy
    await waitForGraphReady(spinner, graphType);
    spinner.succeed(`${graphType} is running`);
    showGraphConnectionInfo(graphType);
    return true;
  } catch (error) {
    spinner.fail(`Failed to start ${graphType}`);
    console.log(pc.dim(`   Error: ${error}`));
    return false;
  }
}

/**
 * Wait for graph database to be ready
 */
async function waitForGraphReady(
  spinner: ReturnType<typeof ora>,
  graphType: "neo4j" | "memgraph",
): Promise<void> {
  spinner.text = `Waiting for ${graphType} to be ready...`;
  const maxWait = 60; // seconds
  const startTime = Date.now();

  while ((Date.now() - startTime) / 1000 < maxWait) {
    const healthCheck = await execCommand(
      "docker",
      ["ps", "--filter", `name=cortex-${graphType}`, "--format", "{{.Status}}"],
      { quiet: true },
    );

    if (healthCheck.stdout.includes("Up")) {
      // Give it a moment to fully initialize
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * Show graph database connection info
 */
function showGraphConnectionInfo(graphType: "neo4j" | "memgraph"): void {
  if (graphType === "neo4j") {
    console.log(pc.dim("     Browser: http://localhost:7474"));
    console.log(pc.dim("     Bolt: bolt://localhost:7687"));
    console.log(
      pc.dim(
        "     Credentials: See .env.local (NEO4J_USERNAME, NEO4J_PASSWORD)",
      ),
    );
  } else {
    console.log(pc.dim("     Memgraph Lab: http://localhost:3000"));
    console.log(pc.dim("     Bolt: bolt://localhost:7687"));
    console.log(
      pc.dim(
        "     Credentials: See .env.local (NEO4J_USERNAME, NEO4J_PASSWORD)",
      ),
    );
  }
}

/**
 * Stop graph database containers
 */
export async function stopGraphContainers(
  projectPath: string,
): Promise<boolean> {
  const dockerComposePath = path.join(projectPath, "docker-compose.graph.yml");

  if (!fs.existsSync(dockerComposePath)) {
    return false;
  }

  // First check if any containers are actually running
  try {
    const psResult = await execCommand(
      "docker",
      ["compose", "-f", "docker-compose.graph.yml", "ps", "-q"],
      { cwd: projectPath, quiet: true },
    );

    // If no output, no containers are running
    if (!psResult.stdout?.trim()) {
      return false;
    }
  } catch {
    // Docker not available or compose file issue
    return false;
  }

  const spinner = ora("Stopping graph database containers...").start();

  try {
    const result = await execCommand(
      "docker",
      ["compose", "-f", "docker-compose.graph.yml", "down"],
      { cwd: projectPath, quiet: true },
    );

    if (result.code === 0) {
      spinner.succeed("Graph database containers stopped");
      return true;
    } else {
      spinner.fail("Failed to stop containers");
      return false;
    }
  } catch {
    spinner.fail("Failed to stop containers");
    return false;
  }
}

/**
 * Check if graph containers are running
 */
export async function isGraphRunning(
  graphType: "neo4j" | "memgraph",
): Promise<boolean> {
  try {
    const result = await execCommand(
      "docker",
      ["ps", "--filter", `name=cortex-${graphType}`, "--format", "{{.Status}}"],
      { quiet: true },
    );
    return result.stdout.includes("Up");
  } catch {
    return false;
  }
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
        // Supported schemes per neo4j-driver:
        // bolt://, bolt+s://, bolt+ssc:// (direct connection)
        // neo4j://, neo4j+s://, neo4j+ssc:// (routing/cluster)
        const validSchemes = [
          "bolt://",
          "bolt+s://",
          "bolt+ssc://",
          "neo4j://",
          "neo4j+s://",
          "neo4j+ssc://",
        ];
        if (!validSchemes.some((scheme) => value.startsWith(scheme))) {
          return "URI must start with bolt://, bolt+s://, neo4j://, or neo4j+s:// (use +ssc for self-signed certs)";
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

  console.log(pc.green("   Connection details saved"));
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
