import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";
import { AdmissionComplete, createProgram } from "./program.js";
import { loadConfig } from "./utils/config.js";
import { closeClient, setupClientCleanup } from "./utils/client.js";
import { printError } from "./utils/formatting.js";
import { discoverAdmission, withAdmissionContext, type CommandIntent } from "./utils/bootstrap-admission.js";

export async function main(): Promise<void> {
  setupClientCleanup();
  try {
    const manifest = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
        "utf-8",
      ),
    );
    const argv = [...process.argv];
    const defaults = { deployments: {}, default: "", format: "table" as const, confirmDangerous: true };
    const admission = createProgram(defaults, { version: manifest.version, admissionOnly: true }).exitOverride();
    if (argv.length === 2) { admission.outputHelp(); return; }
    let intent: CommandIntent | undefined;
    try { await admission.parseAsync(argv); }
    catch (error) {
      if (error instanceof AdmissionComplete) intent = error.intent;
      else if (error && typeof error === "object" && "exitCode" in error && error.exitCode === 0) return;
      else throw error;
    }
    if (!intent) return;
    const context = await discoverAdmission(intent);
    await withAdmissionContext(context, async () => {
      let environmentPath: string | undefined;
      if (context.mode === "ordinary-trusted") {
        const envPath = join(process.cwd(), ".env.local");
        if (existsSync(envPath)) {
          const result = loadEnv({ path: envPath, quiet: true });
          if (result.error) throw new Error("Cannot read project .env.local");
          environmentPath = envPath;
        }
      }
      const config = await loadConfig();
      const program = createProgram(config, { version: manifest.version, environmentPath, expectedIntent: intent }).exitOverride();
      await program.parseAsync(argv);
    });
  } catch (error) {
    printError(error instanceof Error ? error.message : "Unexpected CLI error");
    if (process.exitCode !== 130 && process.exitCode !== 143) process.exitCode = 1;
  } finally {
    try { await closeClient(); }
    catch { printError("Required client/graph cleanup failed"); process.exitCode = 1; }
  }
}
