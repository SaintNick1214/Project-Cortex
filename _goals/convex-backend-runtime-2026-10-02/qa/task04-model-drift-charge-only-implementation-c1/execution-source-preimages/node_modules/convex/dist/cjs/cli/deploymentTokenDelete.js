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
var deploymentTokenDelete_exports = {};
__export(deploymentTokenDelete_exports, {
  deploymentTokenDelete: () => deploymentTokenDelete
});
module.exports = __toCommonJS(deploymentTokenDelete_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_chalk = require("chalk");
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_api = require("./lib/api.js");
var import_command = require("./lib/command.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_utils = require("./lib/utils/utils.js");
const deploymentTokenDelete = new import_extra_typings.Command("delete").summary("Delete an access token").description(
  [
    "Delete an access token. Currently only deploy keys (deployment-scoped access tokens) are supported.",
    "",
    "The positional `<nameOrToken>` can be the unique name of the deploy key (as passed to `token create`) or the deploy key value itself. The target deployment defaults to the currently-selected one; pass `--deployment` to target a different deployment.",
    "",
    "\u2022 Delete by name: `npx convex deployment token delete my-token`",
    "\u2022 Delete by value: `npx convex deployment token delete 'dev:happy-animal-123|ey...'`",
    "\u2022 Target prod: `npx convex deployment token delete ci-token --deployment prod`"
  ].join("\n")
).argument(
  "<nameOrToken>",
  "The unique name of the deploy key, or the deploy key value itself."
).allowExcessArguments(false).addDeploymentSelectionOptions((0, import_command.actionDescription)("Delete a deploy key for")).showHelpAfterError().action(async (nameOrToken, options) => {
  const ctx = await (0, import_context.oneoffContext)(options);
  await (0, import_deploymentSelection.ensureLoggedInWithAccessToken)(ctx, "Deleting a deploy key");
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const deployment = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    { ensureLocalRunning: false }
  );
  if (deployment.deploymentFields === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Cannot delete a deploy key for a self-hosted deployment."
    });
  }
  const { deploymentName, deploymentType } = deployment.deploymentFields;
  if (deploymentType === "local" || deploymentType === "anonymous") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Cannot delete a deploy key for a ${deploymentType} deployment.`
    });
  }
  if (/^(dev|prod|preview|local):[^|]*$/.test(nameOrToken)) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `"${nameOrToken}" looks like a partial deploy key \u2014 your shell likely consumed the \`|\` and everything after it. Wrap the value in single quotes (e.g. ${import_chalk.chalkStderr.bold(`npx convex deployment token delete '${nameOrToken}|...'`)}) and try again.`
    });
  }
  const pipeIdx = nameOrToken.indexOf("|");
  const id = pipeIdx >= 0 ? nameOrToken.slice(pipeIdx + 1) : nameOrToken;
  (0, import_log.showSpinner)(`Deleting deploy key for ${deploymentName}...`);
  await (0, import_utils.typedPlatformClient)(ctx).POST(
    "/deployments/{deployment_name}/delete_deploy_key",
    {
      params: { path: { deployment_name: deploymentName } },
      body: { id }
    }
  );
  (0, import_log.logFinishedStep)(`Deleted deploy key for ${deploymentName}.`);
});
//# sourceMappingURL=deploymentTokenDelete.js.map
