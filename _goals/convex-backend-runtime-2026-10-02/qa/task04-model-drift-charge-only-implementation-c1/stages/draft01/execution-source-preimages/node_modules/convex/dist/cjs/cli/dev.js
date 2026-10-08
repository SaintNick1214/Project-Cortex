"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var dev_exports = {};
__export(dev_exports, {
  dev: () => dev
});
module.exports = __toCommonJS(dev_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_chalk = require("chalk");
var import_context = require("../bundler/context.js");
var import_configure = require("./configure.js");
var import_announceDeploymentTarget = require("./lib/announceDeploymentTarget.js");
var import_usage = require("./lib/usage.js");
var import_command = require("./lib/command.js");
var import_dev = require("./lib/dev.js");
var import_utils = require("./lib/utils/utils.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_updates = require("./lib/updates.js");
const dev = new import_extra_typings.Command("dev").summary("Develop against a dev deployment, watching for changes").description(
  "Develop against a dev deployment, watching for changes\n\n  1. Configures a new or existing project (if needed)\n  2. Updates generated types and pushes code to the configured dev deployment\n  3. Runs the provided command (if `--start` or `--run` is used)\n  4. Watches for file changes, and repeats step 2\n"
).allowExcessArguments(false).option("-v, --verbose", "Show full listing of changes").addOption(
  new import_extra_typings.Option(
    "--typecheck <mode>",
    `Check TypeScript files with \`tsc --noEmit\`.`
  ).choices(["enable", "try", "disable"]).default("try")
).option(
  "--typecheck-components",
  "Check TypeScript files within component implementations with `tsc --noEmit`.",
  false
).addOption(
  new import_extra_typings.Option("--codegen <mode>", "Regenerate code in `convex/_generated/`").choices(["enable", "disable"]).default("enable")
).addOption(
  new import_extra_typings.Option(
    "--push-all-modules",
    "Push all modules without checking for unchanged module hashes from the server"
  ).default(false).hideHelp()
).option(
  "--once",
  "Execute only the first 3 steps, stop on any failure",
  false
).option(
  "--until-success",
  "Execute only the first 3 steps, on failure watch for local and remote changes and retry steps 2 and 3",
  false
).addOption(
  new import_extra_typings.Option(
    "--start <command>",
    "Start a long-running command alongside `npx convex dev`, like a frontend dev server. The command inherits stdin/stdout so you can interact with it directly. Example: npx convex dev --start 'vite --open'"
  ).conflicts(["--run", "--run-sh"])
).addOption(
  new import_extra_typings.Option("--run-sh <command>", "Deprecated: use --start instead.").conflicts(["--start", "--run"]).hideHelp()
).addOption(
  new import_extra_typings.Option(
    "--run <functionName>",
    "The identifier of the function to run in step 3, like `api.init.createData` or `myDir/myFile:myFunction`"
  ).conflicts(["--start"])
).option(
  "--run-component <functionName>",
  'If --run is used and the function is in a component, the path to the component (e.g. "workflow" or "workflow/workpool"). Components are a beta feature. This flag is unstable and may change in subsequent releases.'
).addOption(
  new import_extra_typings.Option(
    "--tail-logs [mode]",
    [
      "Choose whether to tail Convex function logs in this terminal: ",
      "\u2022 `always` shows logs continuously",
      "\u2022 `pause-on-deploy` (the default) pauses logs during deploys so you can spot sync issues",
      "\u2022 `disable` hides logs while developing."
    ].join("\n")
  ).choices(["always", "pause-on-deploy", "disable"]).default("pause-on-deploy")
).addOption(new import_extra_typings.Option("--trace-events").default(false).hideHelp()).addOption(new import_extra_typings.Option("--debug-bundle-path <path>").hideHelp()).addOption(new import_extra_typings.Option("--debug-node-apis").hideHelp()).addOption(new import_extra_typings.Option("--live-component-sources").hideHelp()).addOption(
  new import_extra_typings.Option(
    "--configure [choice]",
    "Ignore existing configuration and configure new or existing project, interactively or set by --team <team_slug>, --project <project_slug>, and --dev-deployment local|cloud"
  ).choices(["new", "existing"]).conflicts(["--url", "--admin-key", "--env-file"])
).addOption(
  new import_extra_typings.Option(
    "--team <team_slug>",
    "The team you'd like to use for this project"
  ).hideHelp()
).addOption(
  new import_extra_typings.Option(
    "--project <project_slug>",
    "The name of the project you'd like to configure"
  ).hideHelp()
).addOption(
  new import_extra_typings.Option(
    "--dev-deployment <mode>",
    "Use a local or cloud deployment for dev for this project"
  ).choices(["cloud", "local"]).conflicts(["--prod"]).hideHelp()
).addOption(
  new import_extra_typings.Option(
    "--prod",
    "Develop live against this project's production deployment."
  ).default(false).hideHelp()
).addOption(
  new import_extra_typings.Option(
    "--env-file <envFile>",
    `Path to a custom file of environment variables, for choosing the deployment, e.g. ${import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME} or ${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME}. Same format as .env.local or .env files, and overrides them.`
  )
).addOption(new import_extra_typings.Option("--skip-push").default(false).hideHelp()).addOption(new import_extra_typings.Option("--admin-key <adminKey>").hideHelp()).addOption(new import_extra_typings.Option("--url <url>").hideHelp()).addOption(new import_extra_typings.Option("--override-auth-url <url>").hideHelp()).addOption(new import_extra_typings.Option("--override-auth-client <id>").hideHelp()).addOption(new import_extra_typings.Option("--override-auth-username <username>").hideHelp()).addOption(new import_extra_typings.Option("--override-auth-password <password>").hideHelp()).addOption(new import_extra_typings.Option("--local-cloud-port <port>").hideHelp()).addOption(new import_extra_typings.Option("--local-site-port <port>").hideHelp()).addOption(new import_extra_typings.Option("--local-backend-version <version>").hideHelp()).addOption(new import_extra_typings.Option("--local-force-upgrade").default(false).hideHelp()).addOption(new import_extra_typings.Option("--deployment <deployment>").hideHelp()).addOption(new import_extra_typings.Option("--local").default(false).hideHelp()).addOption(new import_extra_typings.Option("--cloud").default(false).hideHelp()).showHelpAfterError().action(async (cmdOptions) => {
  const ctx = await (0, import_context.oneoffContext)(cmdOptions);
  (0, import_context.installSigintHandler)(ctx);
  if (cmdOptions.deployment !== void 0) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--deployment` can\u2019t be used with `npx convex dev`. \n\n  To select this deployment for development, run: \n" + import_chalk.chalkStderr.bold(
        `      npx convex deployment select ${cmdOptions.deployment}
`
      ) + "  Then, run `npx convex dev` again."
    });
  }
  if (cmdOptions.local) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--local` is deprecated. \n\n  To select your local deployment, run: \n" + import_chalk.chalkStderr.bold("      npx convex deployment select local\n") + "  Then, run `npx convex dev` again."
    });
  }
  if (cmdOptions.cloud) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--cloud` is deprecated. \n\n  To select your personal cloud dev deployment, run: \n" + import_chalk.chalkStderr.bold("      npx convex deployment select dev\n") + "  Then, run `npx convex dev` again."
    });
  }
  const devOptions = await (0, import_command.normalizeDevOptions)(ctx, cmdOptions);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "run `npx convex dev`");
  if (cmdOptions.configure === void 0) {
    if (cmdOptions.team || cmdOptions.project || cmdOptions.devDeployment)
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "`--team, --project, and --dev-deployment can can only be used with `--configure`."
      });
  }
  const localOptions = {
    ports: {
      cloud: cmdOptions.localCloudPort !== void 0 ? parseInt(cmdOptions.localCloudPort) : void 0,
      site: cmdOptions.localSitePort !== void 0 ? parseInt(cmdOptions.localSitePort) : void 0
    },
    backendVersion: cmdOptions.localBackendVersion,
    forceUpgrade: cmdOptions.localForceUpgrade
  };
  const configure = cmdOptions.configure === true ? "ask" : cmdOptions.configure ?? null;
  const deploymentSelection = configure !== null ? {
    kind: "chooseProject",
    selectionWithinProject: {
      // For backwards compatibility, allow `--configure --prod`
      kind: cmdOptions.prod ? "prod" : "unspecified"
    }
  } : await (0, import_deploymentSelection.getDeploymentSelection)(ctx, cmdOptions);
  const credentials = await (0, import_configure.deploymentCredentialsOrConfigure)(
    ctx,
    deploymentSelection,
    configure,
    {
      ...cmdOptions,
      localOptions
    }
  );
  (0, import_announceDeploymentTarget.announceDeploymentTarget)("Developing against deployment:", credentials);
  await Promise.all([
    ...!cmdOptions.skipPush ? [
      (0, import_dev.devAgainstDeployment)(
        ctx,
        {
          url: credentials.url,
          adminKey: credentials.adminKey,
          deploymentName: credentials.deploymentFields?.deploymentName ?? null,
          ...credentials.deploymentFields?.deploymentType !== void 0 ? {
            deploymentType: credentials.deploymentFields.deploymentType
          } : {},
          backendVersion: localOptions.backendVersion
        },
        devOptions
      )
    ] : [],
    ...credentials.deploymentFields !== null ? [
      (0, import_usage.usageStateWarning)(ctx, credentials.deploymentFields.deploymentName),
      (0, import_updates.checkVersionAndAiFilesStaleness)(ctx)
    ] : []
  ]);
});
//# sourceMappingURL=dev.js.map
