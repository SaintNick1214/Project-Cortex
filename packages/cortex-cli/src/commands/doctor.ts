import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import type { CLIConfig } from "../types.js";
import {
  findInstalledSdk,
  getFunctionsDirectory,
  validateSdkPackage,
} from "../utils/schema-sync.js";
import {
  resolveNativeTarget,
  targetOptions,
  type ManagementOptions,
} from "../utils/management.js";
import { formatCSV } from "../utils/formatting.js";
import {
  isSupportedNodeVersion,
  unsupportedNodeDiagnostic,
} from "../utils/node-runtime.js";

export interface DoctorReport {
  formatVersion: 1;
  ok: boolean;
  node: { version: string; supported: boolean };
  target: {
    alias: string;
    url: string;
    kind: string;
    projectPath: string;
    credentialConfigured: boolean;
  } | null;
  dependencies: {
    convex: string | null;
    sdk: string | null;
    functions: string | null;
  };
  backend: {
    reachable: boolean | null;
    identityVerified: boolean | null;
    version: string | null;
    compatibility: "unknown";
  };
  graph: {
    status: "not-requested" | "external-prerequisites";
    guidance?: string;
  };
  diagnostics: string[];
}
export async function diagnose(
  config: CLIConfig,
  options: ManagementOptions & { check?: boolean; graph?: boolean } = {},
): Promise<DoctorReport> {
  const report: DoctorReport = {
    formatVersion: 1,
    ok: true,
    node: {
      version: process.version,
      supported: isSupportedNodeVersion(process.versions.node),
    },
    target: null,
    dependencies: { convex: null, sdk: null, functions: null },
    backend: {
      reachable: null,
      identityVerified: null,
      version: null,
      compatibility: "unknown",
    },
    graph: {
      status: options.graph ? "external-prerequisites" : "not-requested",
    },
    diagnostics: [],
  };
  if (!report.node.supported)
    report.diagnostics.push(unsupportedNodeDiagnostic(process.version));
  if (options.graph)
    report.graph.guidance =
      "Graph is optional; configure exactly one provider's URI, username and password and use project-owned graph setup/status. Existing credentials and data must be preserved; Docker is needed only for local provisioning.";
  try {
    const target = resolveNativeTarget(config, options);
    report.target = {
      alias: target.alias,
      url: target.url,
      kind: target.kind,
      projectPath: target.project,
      credentialConfigured: Boolean(target.key),
    };
    report.backend.version = target.backendVersion ?? null;
    report.dependencies.convex = JSON.parse(
      fs.readFileSync(
        path.join(target.project, "node_modules/convex/package.json"),
        "utf8",
      ),
    ).version;
    report.dependencies.functions = getFunctionsDirectory(target.project);
    try {
      report.dependencies.sdk = validateSdkPackage(
        findInstalledSdk(target.project),
      ).version;
    } catch {
      report.diagnostics.push(
        "Installed matching SDK backend capability is unavailable; install a fixed candidate",
      );
    }
    if (options.check) {
      try {
        const response = await fetch(`${target.url}/instance_name`, {
          redirect: "error",
          signal: AbortSignal.timeout(3000),
        });
        report.backend.reachable = response.ok;
        const identity = response.ok
          ? (await response.text()).trim().replace(/^"|"$/g, "")
          : null;
        report.backend.identityVerified =
          target.kind === "local"
            ? identity === target.deployment.replace(/^local:/, "")
            : null;
        if (!response.ok || report.backend.identityVerified === false)
          report.diagnostics.push("Backend reachability/identity check failed");
      } catch {
        report.backend.reachable = false;
        report.diagnostics.push(
          "Backend unreachable; verify selected URL and start native dev",
        );
      }
      // This HTTP liveness check deliberately does not certify SDK/schema compatibility.
    }
  } catch (error) {
    report.diagnostics.push(
      error instanceof Error ? error.message : "Invalid native target",
    );
  }
  report.ok = report.diagnostics.length === 0;
  return report;
}
export function printDiagnosis(
  report: DoctorReport,
  options: { json?: boolean; format?: string },
): void {
  if (options.json || options.format === "json")
    console.log(JSON.stringify(report));
  else if (options.format === "csv") console.log(formatCSV(report));
  else {
    console.log(
      `Cortex diagnostics: ${report.ok ? "ok" : "needs attention"}; Node ${report.node.version}`,
    );
    if (report.target)
      console.log(
        `${report.target.alias}: ${report.target.kind} ${report.target.url}; project ${report.target.projectPath}`,
      );
    console.log(
      `Convex ${report.dependencies.convex ?? "unknown"}; SDK ${report.dependencies.sdk ?? "unknown"}; backend compatibility unknown`,
    );
    report.diagnostics.forEach((message) => console.log(`- ${message}`));
    if (report.graph.guidance) console.log(report.graph.guidance);
  }
  if (!report.ok) process.exitCode = 1;
}
export function registerDoctorCommands(
  program: Command,
  config: CLIConfig,
): void {
  targetOptions(
    program
      .command("doctor")
      .description(
        "Read-only native configuration, prerequisites and backend diagnostics",
      ),
  )
    .option("--json", "Stable diagnostics JSON")
    .option("--check", "Bounded backend liveness/identity check")
    .option("--graph", "Report optional graph prerequisites")
    .action(
      async (
        options: ManagementOptions & {
          json?: boolean;
          check?: boolean;
          graph?: boolean;
        },
      ) => printDiagnosis(await diagnose(config, options), options),
    );
}
