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
var env_exports = {};
__export(env_exports, {
  env: () => env,
  selectEnvDeployment: () => selectEnvDeployment
});
module.exports = __toCommonJS(env_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_chalk = require("chalk");
var import_context = require("../bundler/context.js");
var import_api = require("./lib/api.js");
var import_command = require("./lib/command.js");
var import_utils = require("./lib/utils/utils.js");
var import_env = require("./lib/env.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_run = require("./lib/localDeployment/run.js");
var import_envDefault = require("./envDefault.js");
const envSetCmd = new import_extra_typings.Command("set").usage("[options] <name> <value>").argument("[name]", "The name of the environment variable to set.").argument(
  "[value]",
  "The value to set the variable to. Omit to set it interactively."
).summary("Set a variable").description(
  [
    "Set environment variables on your deployment.",
    "",
    "\u2022 `npx convex env set NAME 'value'`",
    "\u2022 `npx convex env set NAME # omit a value to set one interactively`",
    "\u2022 `npx convex env set NAME --from-file value.txt`",
    "\u2022 `npx convex env set --from-file .env.defaults`",
    "",
    "When setting multiple values, it will refuse all changes if any variables are already set to different values by default. Pass --force to overwrite the provided values.",
    "",
    "To keep secrets out of your shell history, omit the value to pipe it in via stdin, for instance:",
    "\u2022 `pbpaste | npx convex env set API_KEY` (macOS)",
    "\u2022 `Get-Clipboard | npx convex env set API_KEY` (Windows PowerShell)",
    "",
    "To update many variables at once, save them with `npx convex env list > .env.convex`, edit the file, then reapply the changes with `npx convex env set --force < .env.convex`."
  ].join("\n")
).option(
  "--from-file <file>",
  "Read environment variables from a .env file. Without --force, fails if any existing variable has a different value."
).option(
  "--force",
  "When setting multiple variables, overwrite existing environment variable values instead of failing on mismatch."
).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (name, value, cmdOptions, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env set");
  await (0, import_run.withRunningBackend)({
    ctx,
    deployment,
    action: async () => {
      const backend = (0, import_env.deploymentEnvBackend)(ctx, deployment);
      const didAnything = await (0, import_env.envSet)(ctx, backend, name, value, cmdOptions);
      if (didAnything === false) {
        cmd.outputHelp({ error: true });
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "error: No environment variables specified to be set."
        });
      }
    }
  });
});
async function selectEnvDeployment(options) {
  const ctx = await (0, import_context.oneoffContext)(options);
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const {
    adminKey,
    url: deploymentUrl,
    deploymentFields
  } = await (0, import_api.loadSelectedDeploymentCredentials)(ctx, deploymentSelection, {
    ensureLocalRunning: false
  });
  const deploymentNotice = deploymentFields !== null ? ` (on ${import_chalk.chalkStderr.bold(deploymentFields.deploymentType)} deployment ${import_chalk.chalkStderr.bold(deploymentFields.deploymentName)})` : "";
  const result = {
    ctx,
    deployment: {
      deploymentUrl,
      adminKey,
      deploymentNotice,
      deploymentFields
    }
  };
  return result;
}
const envGetCmd = new import_extra_typings.Command("get").argument("<name>", "The name of the environment variable to print.").summary("Print a variable's value").description("Print a variable's value: `npx convex env get NAME`").configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (envVarName, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env get");
  await (0, import_run.withRunningBackend)({
    ctx,
    deployment,
    action: async () => {
      const backend = (0, import_env.deploymentEnvBackend)(ctx, deployment);
      await (0, import_env.envGet)(ctx, backend, envVarName);
    }
  });
});
const envRemoveCmd = new import_extra_typings.Command("remove").alias("rm").alias("unset").argument("<name>", "The name of the environment variable to unset.").summary("Unset a variable").description(
  "Unset a variable: `npx convex env remove NAME`\nIf the variable doesn't exist, the command doesn't do anything and succeeds."
).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (name, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env remove");
  await (0, import_run.withRunningBackend)({
    ctx,
    deployment,
    action: async () => {
      const backend = (0, import_env.deploymentEnvBackend)(ctx, deployment);
      await (0, import_env.envRemove)(ctx, backend, name);
    }
  });
});
const envListCmd = new import_extra_typings.Command("list").summary("List all environment variables and their values").description(
  [
    "\u2022 List all variables and their values: `npx convex env list`",
    "\u2022 List only variable names (no values): `npx convex env list --names-only`",
    "\u2022 Save all variables to a file: `npx convex env list > .env.convex`",
    "\u2022 Append to a file: `npx convex env list >> .env.convex`"
  ].join("\n")
).option(
  "--names-only",
  "List only the names of environment variables, without their values"
).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (cmdOptions, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env list");
  await (0, import_run.withRunningBackend)({
    ctx,
    deployment,
    action: async () => {
      const backend = (0, import_env.deploymentEnvBackend)(ctx, deployment);
      await (0, import_env.envList)(ctx, backend, {
        namesOnly: cmdOptions.namesOnly ?? false
      });
    }
  });
});
const env = new import_extra_typings.Command("env").summary("Set and view environment variables").description(
  [
    "Set and view environment variables on your deployment",
    "",
    "\u2022 Set a variable: `npx convex env set NAME 'value'`",
    "\u2022 Set interactively: `npx convex env set NAME`",
    "\u2022 Set multiple from file: `npx convex env set --from-file .env`",
    "\u2022 Unset a variable: `npx convex env remove NAME`",
    "\u2022 List all variables and their values: `npx convex env list`",
    "\u2022 List only variable names (no values): `npx convex env list --names-only`",
    "\u2022 Print a variable's value: `npx convex env get NAME`",
    "",
    "By default, this sets and views variables on your dev deployment.",
    "",
    "See the environment variables guide (https://docs.convex.dev/production/environment-variables) to learn more."
  ].join("\n")
).addCommand(envSetCmd).addCommand(envGetCmd).addCommand(envRemoveCmd).addCommand(envListCmd).addCommand(import_envDefault.envDefault).helpCommand(false).addDeploymentSelectionOptions(
  (0, import_command.actionDescription)("Set and view environment variables on")
);
//# sourceMappingURL=env.js.map
