import { Cortex } from "@cortexmemory/sdk";

/**
 * Health check endpoint to verify all backend services
 */
export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
  
  // Check 1: Environment variables
  const hasConvexUrl = !!process.env.CONVEX_URL;
  const hasPublicConvexUrl = !!process.env.NEXT_PUBLIC_CONVEX_URL;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasNeo4jUri = !!process.env.NEO4J_URI;
  const hasMemgraphUri = !!process.env.MEMGRAPH_URI;
  
  checks.environment = {
    status: hasConvexUrl && hasOpenAIKey ? "ok" : "warning",
    error: !hasConvexUrl 
      ? "CONVEX_URL not set" 
      : !hasOpenAIKey 
        ? "OPENAI_API_KEY not set" 
        : undefined,
  };

  // Check 2: Cortex SDK initialization
  try {
    const startTime = Date.now();
    const cortex = new Cortex({ 
      convexUrl: process.env.CONVEX_URL! 
    });
    
    // Quick test - just initialize, don't actually query
    checks.cortexSdk = {
      status: "ok",
      latencyMs: Date.now() - startTime,
    };
    
    cortex.close();
  } catch (error) {
    checks.cortexSdk = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Check 3: Convex backend connectivity (via HTTP)
  if (process.env.CONVEX_URL) {
    try {
      const startTime = Date.now();
      // Convex URLs are like "https://xxx.convex.cloud"
      // We can ping the HTTP endpoint
      const convexUrl = new URL(process.env.CONVEX_URL);
      const response = await fetch(`${convexUrl.origin}/version`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      
      checks.convexBackend = {
        status: response.ok ? "ok" : "error",
        latencyMs: Date.now() - startTime,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      checks.convexBackend = {
        status: "error",
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  } else {
    checks.convexBackend = {
      status: "error",
      error: "CONVEX_URL not configured",
    };
  }

  // Overall status
  const hasErrors = Object.values(checks).some((c) => c.status === "error");
  const hasWarnings = Object.values(checks).some((c) => c.status === "warning");

  return Response.json({
    status: hasErrors ? "unhealthy" : hasWarnings ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    checks,
    config: {
      convexUrl: hasConvexUrl ? "configured" : "missing",
      publicConvexUrl: hasPublicConvexUrl ? "configured" : "missing",
      openaiKey: hasOpenAIKey ? "configured" : "missing",
      graphSync: hasNeo4jUri || hasMemgraphUri ? "enabled" : "disabled",
      graphBackend: hasNeo4jUri ? "neo4j" : hasMemgraphUri ? "memgraph" : "none",
    },
  });
}
