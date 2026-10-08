import { formatCSV } from "../utils/formatting.js";
import { Command } from "commander";
import { installSdk, type InstallOptions } from "../utils/install.js";
import { graphOptions, selectedGraphOptions, printGraphResult } from "./graph.js";
import { normalizeGraphOptions } from "../utils/graph/contract.js";
import { setupGraph, type GraphSetupReceipt } from "../utils/graph/service.js";
import { resolveInteractiveGraph, type GraphInteraction } from "../utils/graph/interactive.js";

export function installerOptions(command: Command): Command {
  return graphOptions(command)
    .option("--local", "Select anonymous local setup for a new project")
    .option(
      "--cloud",
      "Stage a cloud project; configure the native target separately",
    )
    .option(
      "--no-install",
      "Stage files without npm installation (requires --no-deploy)",
    )
    .option(
      "--no-deploy",
      "Stage files without native setup/codegen/deployment",
    )
    .option(
      "--sdk-package <path>",
      "Fixed SDK 0.37.0 directory or tarball for candidate installation",
    )
    .option(
      "--dry-run",
      "Plan without writing project files or installing dependencies",
    )
    .option("--overwrite", "Back up and replace conflicting backend files only")
    .option("-y, --yes", "Use deterministic defaults");
}
/** Installer keeps its existing graph-off boundary; every graph entrypoint uses setupGraph. */
export async function installWithGraph(
  directory: string,
  options: InstallOptions & {
    graphBoltPort?: number;
    graphHttpPort?: number;
    graphCredentials?: string;
  },
  initialize = false,
  interaction: GraphInteraction = {},
): Promise<Record<string, unknown>> {
  const selected = await resolveInteractiveGraph(selectedGraphOptions({ ...options }), options, interaction);
  normalizeGraphOptions({
    graph: selected.graph,
    skipGraph: selected.skipGraph,
    graphMode: selected.graphMode,
    graphUri: selected.graphUri,
    boltPort: selected.boltPort,
    httpPort: selected.httpPort,
  });
  const result = await installSdk(
    directory,
    {
      ...options,
      graph: "none",
      skipGraph: true,
      graphMode: undefined,
      graphUri: undefined,
    },
    initialize,
  );
  try {
    const graph = await setupGraph(String(result.projectPath), selected);
    return { ...result, graph };
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message.split(":")[0]
        : "GRAPH_SETUP_FAILED";
    throw new GraphInstallPartialError(
      {
        ...result,
        graph: { provider: selected.graph, status: "failed", code },
      },
      code,
    );
  }
}
export class GraphInstallPartialError extends Error {
  constructor(
    readonly result: Record<string, unknown>,
    code: string,
  ) {
    super(
      `SDK_PROJECT_PREPARED_GRAPH_SETUP_FAILED: SDK project is prepared; graph failed (${code}). Inspect the selected project before retrying.`,
    );
  }
}
export function printInstallResult(
  result: Record<string, unknown>,
  options: { format?: string; quiet?: boolean },
): void {
  if (options.format === "json") console.log(JSON.stringify(result));
  else if (options.format === "csv") console.log(formatCSV(result));
  else if (!options.quiet) {
    console.log(
      `${result.dryRun ? "Planned" : "Installed"} SDK ${result.sdkVersion}, Convex ${result.convexVersion}; ${result.deployment}; ${result.projectPath}`,
    );
    const graph = result.graph as GraphSetupReceipt | undefined;
    if (graph?.status === "ready") printGraphResult(graph,options);
  }
}
export function registerInstallCommand(program: Command): void {
  installerOptions(
    program
      .command("install [directory]")
      .description(
        "Install Cortex SDK into an existing standalone npm project",
      ),
  ).action(
    async (
      directory: string | undefined,
      options: InstallOptions & { format?: string; quiet?: boolean },
      command: Command,
    ) => {
      try {
        printInstallResult(
          await installWithGraph(directory ?? process.cwd(), options, false,
            { graphExplicit: command.getOptionValueSource("graph") === "cli" }),
          options,
        );
      } catch (error) {
        if (error instanceof GraphInstallPartialError)
          printInstallResult(error.result, options);
        throw error;
      }
    },
  );
}
