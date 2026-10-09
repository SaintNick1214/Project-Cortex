/** Compatibility routing for the retired wizard; all live work uses the shared service. */
import { resolveInteractiveGraph } from "../graph/interactive.js";
import type { GraphConfig } from "./types.js";
import {
  setupGraph,
  graphLifecycle,
  readSelectedGraphConfiguration,
} from "../graph/service.js";

export async function getGraphConfig(): Promise<GraphConfig | null> {
  const selected = await resolveInteractiveGraph({});
  if (!selected.graph || selected.graph === "none") return null;
  const credentials = selected.credentials;
  if (!credentials) throw new Error("GRAPH_PROMPT_CANCELLED");
  return {
    type: selected.graph,
    mode: selected.graphMode,
    uri: selected.graphUri ?? `bolt://127.0.0.1:${selected.boltPort ?? 7687}`,
    ...credentials,
  };
}
export async function setupGraphFiles(
  projectPath: string,
  config: GraphConfig,
): Promise<void> {
  await setupGraph(projectPath, {
    graph: config.type,
    graphMode: config.mode ?? "local",
    graphUri: config.uri,
    credentials: { username: config.username, password: config.password },
  });
}
export async function startGraphContainers(
  projectPath: string,
  _graphType: "neo4j" | "memgraph",
): Promise<boolean> {
  return (await graphLifecycle(projectPath, "start")).status === "ready";
}
export async function stopGraphContainers(
  projectPath: string,
): Promise<boolean> {
  return (await graphLifecycle(projectPath, "stop")).status === "stopped";
}
export async function isGraphRunning(
  _graphType: "neo4j" | "memgraph",
  projectPath?: string,
): Promise<boolean> {
  if (!projectPath)
    throw new Error(
      "GRAPH_PROJECT_REQUIRED: use cortex graph status <directory>",
    );
  return (await graphLifecycle(projectPath, "status")).status === "ready";
}
export async function addGraphDependencies(projectPath: string): Promise<void> {
  // The declared SDK/CLI dependency already owns the driver. No second package installer.
  await readSelectedGraphConfiguration(projectPath);
}
export async function createGraphExample(_projectPath: string): Promise<void> {
  throw new Error(
    "GRAPH_EXAMPLE_RETIRED: use the selected-project graph configuration reader and managed SDK helpers",
  );
}
