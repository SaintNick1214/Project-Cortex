import { Command } from "commander";
import { appendRuntimeEnvironment, BACKEND_SETUP_GUIDANCE, parseDevelopmentPrincipal, parseDevelopmentTarget, parseJwtProvider, readSetupJson, runDevelopmentSetup, setupBackend } from "../utils/init/backend-setup.js";

/** Local installation/configuration and explicitly selected disposable operator work. */
export function registerBackendCommands(program: Command): void {
  const backend = program.command("backend").description("Additive backend runtime setup and verified development provisioning");
  backend.command("install [directory]").description("Install versioned backend sources; ambiguous host merges are refused")
    .option("--sdk-path <path>", "Explicit installed SDK distribution")
    .option("--jwt-provider <file>", "Reviewed customJwt issuer/JWKS configuration JSON")
    .option("--plan", "Print file/dependency summary without applying changes", false)
    .action(async (directory = ".", options) => {
      const jwtProvider = options.jwtProvider ? parseJwtProvider(await readSetupJson(options.jwtProvider)) : undefined;
      console.log(JSON.stringify(await setupBackend({ projectPath: directory, sdkPath: options.sdkPath, jwtProvider, planOnly: options.plan }), null, 2));
      console.log(BACKEND_SETUP_GUIDANCE);
    });
  for (const name of ["register", "provision"] as const) {
    const command = backend.command(`${name} [directory]`).description(name === "register" ? "Register installed functions on a verified disposable development target" : "Provision a trusted current grant on a verified disposable development target")
      .requiredOption("--target <file>", "Exact team/project/deployment identity JSON with disposable:true")
      .option("--management-token-env <name>", "Environment variable holding Convex management access", "CONVEX_ACCESS_TOKEN")
      .option("--deploy-key-env <name>", "Environment variable holding target-bound dev deploy key", "CONVEX_DEPLOY_KEY");
    if (name === "provision") command.requiredOption("--principal <file>", "Trusted operator identity/grant JSON (no JWT tokens)");
    command.action(async (directory = ".", options) => {
      for (const key of [options.managementTokenEnv, options.deployKeyEnv]) if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) throw new Error("Select credential environment variable names, not credential values.");
      const managementToken = process.env[options.managementTokenEnv]; const deployKey = process.env[options.deployKeyEnv];
      if (!managementToken || !deployKey) throw new Error("Required management access/target-bound dev key is absent. No command dispatched.");
      await runDevelopmentSetup({ projectPath: directory, target: parseDevelopmentTarget(await readSetupJson(options.target)), managementToken, deployKey,
        principal: name === "provision" ? parseDevelopmentPrincipal(await readSetupJson(options.principal)) : undefined });
      console.log(`${name} completed on the explicitly verified disposable development target.`);
    });
  }
  backend.command("configure [directory]").description("Append public runtime metadata, preserving existing environment values")
    .requiredOption("--url <url>", "Convex runtime URL")
    .option("--http-url <url>", "Owned HTTP action base URL")
    .option("--agent-id <id>", "Published Agent selector")
    .option("--agent-version <number>", "Published positive Agent version")
    .option("--space <id>", "Optional verified space selector")
    .action(async (directory = ".", options) => {
      await appendRuntimeEnvironment(directory, { NEXT_PUBLIC_CONVEX_URL: options.url,
        ...(options.httpUrl ? { NEXT_PUBLIC_CORTEX_HTTP_URL: options.httpUrl } : {}),
        ...(options.agentId ? { NEXT_PUBLIC_CORTEX_AGENT_ID: options.agentId } : {}),
        ...(options.agentVersion ? { NEXT_PUBLIC_CORTEX_AGENT_VERSION: options.agentVersion } : {}),
        ...(options.space ? { NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID: options.space } : {}) });
      console.log("Runtime metadata configured. Tokens and upstream keys were not stored.");
    });
  backend.command("guide").description("Show current setup prerequisites and explicit capability limits").action(() => { console.log(BACKEND_SETUP_GUIDANCE); });
}
