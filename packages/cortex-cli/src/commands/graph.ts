import { Command } from "commander";
import { formatCSV } from "../utils/formatting.js";
import {
  graphLifecycle,
  setupGraph,
  type GraphServiceOptions,
  type GraphSetupReceipt,
} from "../utils/graph/service.js";
import { graphPort } from "../utils/graph/contract.js";
import { resolveInteractiveGraph } from "../utils/graph/interactive.js";

export function graphPortArgument(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error("GRAPH_PORT_INVALID");
  return graphPort(Number(value));
}
export function graphOptions(command: Command): Command {
  return command
    .option(
      "--graph <provider>",
      "Graph provider: none, neo4j, memgraph",
      "none",
    )
    .option("--skip-graph", "Skip optional graph setup")
    .option("--graph-mode <mode>", "Graph mode: local or existing")
    .option("--graph-uri <uri>", "Credential-free selected Bolt URI")
    .option(
      "--graph-bolt-port <port>",
      "Available loopback Bolt port",
      graphPortArgument,
    )
    .option(
      "--graph-http-port <port>",
      "Available loopback Neo4j HTTP port",
      graphPortArgument,
    )
    .option(
      "--graph-credentials <file>",
      "Explicit private0600 provider credential JSON; otherwise selected provider environment or generated local credentials",
    );
}
export function selectedGraphOptions(
  options: Record<string, unknown>,
): GraphServiceOptions {
  return {
    graph: options.graph as GraphServiceOptions["graph"],
    skipGraph: options.skipGraph as boolean | undefined,
    graphMode: options.graphMode as GraphServiceOptions["graphMode"],
    graphUri: options.graphUri as string | undefined,
    boltPort: options.graphBoltPort as number | undefined,
    httpPort: options.graphHttpPort as number | undefined,
    credentialsFile: options.graphCredentials as string | undefined,
    dryRun: options.dryRun as boolean | undefined,
  };
}
export function printGraphResult(
  result: GraphSetupReceipt,
  options: { format?: string; quiet?: boolean },
): void {
  if (options.format === "json") console.log(JSON.stringify(result));
  else if (options.format === "csv") console.log(formatCSV(result));
  else if (!options.quiet) {
    console.log(
      `${result.provider} graph ${result.status}${result.uri ? `; ${result.uri}` : ""}${result.mode === "local" ? "; owned data volume preserved" : ""}`,
    );
    if (result.sdkActivation) console.log(`SDK graph use: ${result.sdkActivation}`);
  }
}
export function registerGraphCommands(program: Command): void {
  const group = program
    .command("graph")
    .description("Set up and manage one selected project's optional graph");
  graphOptions(
    group
      .command("setup [directory]")
      .description(
        "Shared graph configuration, ownership preflight and authenticated readiness",
      )
      .option("--dry-run", "Plan without writes or service operations")
      .option("-y, --yes", "Use deterministic defaults"),
  ).action(
    async (directory: string | undefined, options: Record<string, unknown>, command: Command) =>
      printGraphResult(
        await setupGraph(
          directory ?? process.cwd(),
          await resolveInteractiveGraph(selectedGraphOptions(options), options,
            { graphExplicit: command.getOptionValueSource("graph") === "cli" }),
        ),
        options,
      ),
  );
  for (const action of ["start", "stop", "status"] as const)
    group
      .command(`${action} [directory]`)
      .description(
        `${action} the selected owned graph; external start/stop refused`,
      )
      .option(
        "--dry-run",
        "Read selected configuration without service operations",
      )
      .action(
        async (
          directory: string | undefined,
          options: { format?: string; quiet?: boolean; dryRun?: boolean },
        ) =>
          printGraphResult(
            await graphLifecycle(
              directory ?? process.cwd(),
              action,
              options.dryRun,
            ),
            options,
          ),
      );
}
