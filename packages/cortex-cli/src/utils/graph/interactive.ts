import prompts from "prompts";
import { GraphPlanError, normalizeGraphOptions, renderPrivateGraphEnvironment } from "./contract.js";
import type { GraphServiceOptions } from "./service.js";

export interface GraphInteraction {
  graphExplicit?: boolean;
  stdinTTY?: boolean;
  stdoutTTY?: boolean;
}
/** Resolve private input before any installer or service effect. Shared with template entrypoints. */
export async function resolveInteractiveGraph(
  selected: GraphServiceOptions,
  output: { yes?: boolean; quiet?: boolean; format?: string } = {},
  interaction: GraphInteraction = {},
): Promise<GraphServiceOptions> {
  const interactive = (interaction.stdinTTY ?? process.stdin.isTTY) &&
    (interaction.stdoutTTY ?? process.stdout.isTTY) && !output.yes &&
    !output.quiet && (!output.format || output.format === "table");
  if (!interactive || selected.skipGraph ||
    (interaction.graphExplicit && selected.graph === "none")) return selected;
  const ask = async (question: prompts.PromptObject) => {
    const answer = await prompts(question, { onCancel: () => {
      throw new GraphPlanError("GRAPH_PROMPT_CANCELLED");
    } });
    if (answer.value === undefined || answer.value === "")
      throw new GraphPlanError("GRAPH_PROMPT_CANCELLED");
    return answer.value;
  };
  const result = { ...selected };
  if (!interaction.graphExplicit) result.graph = await ask({
    type: "select", name: "value", message: "Optional graph database",
    choices: [ { title: "None", value: "none" },
      { title: "Neo4j", value: "neo4j" }, { title: "Memgraph", value: "memgraph" } ],
  });
  if (!result.graph || result.graph === "none") return result;
  if (!result.graphMode) result.graphMode = await ask({
    type: "select", name: "value", message: "Graph mode",
    choices: [ { title: "Project-owned local", value: "local" },
      { title: "Existing service (read-only probe)", value: "existing" } ],
  });
  if (result.graphMode === "existing" && !result.graphUri)
    result.graphUri = await ask({ type: "text", name: "value",
      message: "Credential-free Bolt URI", initial: "bolt://127.0.0.1:7687" });
  const normalized = normalizeGraphOptions({ graph: result.graph, skipGraph: result.skipGraph,
    graphMode: result.graphMode, graphUri: result.graphUri,
    boltPort: result.boltPort, httpPort: result.httpPort });
  if (normalized.provider === "none") return result;
  if (!result.credentialsFile && !result.credentials) {
    result.credentials = {
      username: await ask({ type: "text", name: "value", message: "Username",
        initial: normalized.provider === "neo4j" ? "neo4j" : "cortexadmin" }),
      password: await ask({ type: "password", name: "value",
        message: "Password (private, never printed)" }),
    };
    renderPrivateGraphEnvironment(normalized.provider, normalized.uri,
      result.credentials, normalized.mode);
  }
  return result;
}
