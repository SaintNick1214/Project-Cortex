/**
 * Cortex Bridge Server
 * Express server providing HTTP API for Cortex SDK
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from integration directory
dotenv.config({ path: join(__dirname, "../../.env.local") });
dotenv.config({ path: join(__dirname, "../../.env") });
dotenv.config(); // Fallback to local .env

console.log("Environment loaded:");
console.log(`  CONVEX_URL: ${process.env.CONVEX_URL ? "✓ Set" : "✗ Missing"}`);
console.log(
  `  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "✓ Set" : "✗ Missing"}`,
);

// Import Cortex SDK from local build or node_modules
let Cortex;
try {
  // Try Docker volume mount first
  const localSdk = await import("/app/cortex-sdk/index.js");
  Cortex = localSdk.Cortex;
  console.log("✓ Loaded Cortex SDK from local build (Docker volume)");
} catch (error) {
  try {
    // Try local relative path (for local development)
    const localSdk = await import("../../../../dist/index.js");
    Cortex = localSdk.Cortex;
    console.log("✓ Loaded Cortex SDK from local build (relative path)");
  } catch (error2) {
    // Fall back to npm package
    const npmSdk = await import("@cortexmemory/sdk");
    Cortex = npmSdk.Cortex;
    console.log("✓ Loaded Cortex SDK from npm package");
  }
}

import logger from "./utils/logger.js";
import { createMemoryRoutes } from "./routes/memory.js";
import { createUserRoutes } from "./routes/users.js";
import { createContextRoutes } from "./routes/contexts.js";
import { createFactsRoutes } from "./routes/facts.js";
import { createAgentRoutes } from "./routes/agents.js";

// Load environment variables
dotenv.config();

// Validate required environment variables
if (!process.env.CONVEX_URL) {
  console.error("ERROR: CONVEX_URL environment variable is required");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

// Initialize Cortex SDK
logger.info("Initializing Cortex SDK", {
  convexUrl: process.env.CONVEX_URL,
});

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
});

logger.info("Cortex SDK initialized successfully");

// Initialize Express app
const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
});

// Routes
app.use("/api/memory", createMemoryRoutes(cortex));
app.use("/api/users", createUserRoutes(cortex));
app.use("/api/contexts", createContextRoutes(cortex));
app.use("/api/facts", createFactsRoutes(cortex));
app.use("/api/agents", createAgentRoutes(cortex));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    cortex: cortex ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// Serve dashboard
import { readFileSync } from "fs";
const dashboardPath = join(__dirname, "../dashboard/index.html");
app.get("/dashboard", (req, res) => {
  try {
    const html = readFileSync(dashboardPath, "utf8");
    res.send(html);
  } catch (error) {
    res.status(404).send("Dashboard not found");
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Cortex Bridge",
    version: "1.0.0",
    description: "HTTP API bridge for Cortex SDK",
    dashboard: "/dashboard",
    health: "/health",
    endpoints: {
      memory: "/api/memory/*",
      users: "/api/users/*",
      contexts: "/api/contexts/*",
      facts: "/api/facts/*",
      agents: "/api/agents/*",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.path,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// Start server
const PORT = process.env.PORT || process.env.CORTEX_BRIDGE_PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  logger.info(`Cortex Bridge started`, {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || "development",
    convexUrl: process.env.CONVEX_URL,
  });

  console.log(`\n🚀 Cortex Bridge ready at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}\n`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  cortex.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  cortex.close();
  process.exit(0);
});

export { app, cortex };
