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
var deploymentSelect_exports = {};
__export(deploymentSelect_exports, {
  deploymentSelect: () => deploymentSelect,
  saveSelectedDeployment: () => saveSelectedDeployment
});
module.exports = __toCommonJS(deploymentSelect_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_api = require("./lib/api.js");
var import_log = require("../bundler/log.js");
var import_announceDeploymentTarget = require("./lib/announceDeploymentTarget.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_deploymentSelector = require("./lib/deploymentSelector.js");
var import_configure = require("./configure.js");
var import_deploy2 = require("./lib/deploy2.js");
var import_filePaths = require("./lib/localDeployment/filePaths.js");
var import_projectMismatch = require("./lib/localDeployment/projectMismatch.js");
var import_bigBrain = require("./lib/localDeployment/bigBrain.js");
var import_prompts = require("./lib/utils/prompts.js");
var import_deploymentCreate = require("./deploymentCreate.js");
var import_chalk = require("chalk");
var import_log2 = require("../bundler/log.js");
const deploymentSelect = new import_extra_typings.Command("select").summary("Select the deployment to use when running commands").description(
  [
    "Select the deployment to use when running commands.",
    "",
    "The deployment will be used by all `npx convex` commands, except `npx convex deploy`. You can also run individual commands on another deployment by using the --deployment flag on that command.",
    "",
    "\u2022 Select your personal cloud dev deployment in the current project: `npx convex deployment select dev`",
    "\u2022 Select your local deployment: `npx convex deployment select local`",
    "\u2022 Select a deployment in the same project by its reference: `npx convex deployment select dev/james`",
    "\u2022 Select a deployment in another project in the same team: `npx convex deployment select some-project:dev/james`",
    "\u2022 Select a deployment in a particular team/project: `npx convex deployment select some-team:some-project:dev/james`"
  ].join("\n")
).argument("<deployment>", "The deployment to use").allowExcessArguments(false).action(async (selector) => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  const currentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {});
  const parsed = (0, import_deploymentSelector.parseDeploymentSelector)(selector);
  const isLocalSelector = isLocalDeploymentSelector(parsed);
  if (currentSelection.kind === "chooseProject" && parsed.kind !== "inTeamProject" && parsed.kind !== "deploymentName" && !isLocalSelector) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No project configured. Run \`npx convex dev\` to set up a project first, or use a full selector like 'my-team:my-project:dev/james' or 'happy-capybara-123'.`
    });
  }
  if (isLocalSelector) {
    await handleLocalSelect(ctx, selector, parsed, currentSelection);
    return;
  }
  const newSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {
    url: void 0,
    adminKey: void 0,
    envFile: void 0,
    deployment: selector
  });
  const deployment = await saveSelectedDeployment(
    ctx,
    selector,
    newSelection,
    (0, import_deploymentSelection.deploymentNameFromSelection)(currentSelection)
  );
  (0, import_log.logFinishedStep)("Selected deployment:");
  (0, import_announceDeploymentTarget.announceDeploymentTarget)(null, deployment);
});
function isLocalDeploymentSelector(parsed) {
  return (parsed.kind === "inCurrentProject" || parsed.kind === "inProject" || parsed.kind === "inTeamProject") && parsed.selector.kind === "local";
}
async function handleLocalSelect(ctx, selector, parsed, currentSelection) {
  const existing = (0, import_filePaths.loadProjectLocalConfig)(ctx);
  if (existing === null) {
    if (!process.stdin.isTTY) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No local deployment found. Run ${import_chalk.chalkStderr.bold("npx convex deployment create local")} to create one.`
      });
    }
    if (currentSelection.kind === "chooseProject" && parsed.kind !== "inTeamProject") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No project configured. Run \`npx convex dev\` to set up a project first.`
      });
    }
    if (parsed.kind === "inProject") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No local deployment found. To create one in ${import_chalk.chalkStderr.bold(parsed.projectSlug)}, run ${import_chalk.chalkStderr.bold(`npx convex deployment create local --project ${parsed.projectSlug}`)}, or use a fully qualified selector like ${import_chalk.chalkStderr.bold(`my-team:${parsed.projectSlug}:local`)}.`
      });
    }
    const wantsToCreate = await (0, import_prompts.promptYesNo)(ctx, {
      message: "No local deployment found. Create one now?",
      default: true
    });
    if (!wantsToCreate) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No local deployment found. Run ${import_chalk.chalkStderr.bold("npx convex deployment create local")} to create one.`
      });
    }
    const teamAndProject = teamAndProjectFromParsed(parsed);
    await (0, import_deploymentCreate.createLocalDeployment)(ctx, currentSelection, true, teamAndProject);
    return;
  }
  const target = await (0, import_projectMismatch.targetProjectForLocalSelector)(
    ctx,
    parsed,
    currentSelection
  );
  let resolvedDeploymentName = existing.deploymentName;
  if (target !== null) {
    const match = (0, import_projectMismatch.checkLocalConfigMatchesProject)(ctx, existing.config, target);
    if (match === "mismatch") {
      const oldProjectId = existing.config.cloudProjectId;
      const oldProject = await (0, import_projectMismatch.getCloudProjectSlugsBestEffort)(
        ctx,
        oldProjectId
      );
      const oldProjectLabel = oldProject !== null ? `project ${import_chalk.chalkStderr.bold(`${oldProject.teamSlug}:${oldProject.slug}`)}` : `an unknown cloud project (ID ${oldProjectId})`;
      (0, import_log2.logWarning)(
        import_chalk.chalkStderr.yellow(
          `\u26A0\uFE0F This local deployment was previously in ${oldProjectLabel}. Moving it to project ${import_chalk.chalkStderr.bold(`${target.teamSlug}:${target.slug}`)}.`
        )
      );
      await (0, import_projectMismatch.pauseLocalDeploymentBestEffort)(ctx, oldProject);
      const { deploymentName: newDeploymentName } = await (0, import_bigBrain.bigBrainStart)(ctx, {
        port: existing.config.ports.cloud,
        teamSlug: target.teamSlug,
        projectSlug: target.slug,
        instanceName: null
      });
      (0, import_filePaths.saveDeploymentConfig)(ctx, "local", newDeploymentName, {
        ...existing.config,
        cloudProjectId: target.id
      });
      resolvedDeploymentName = newDeploymentName;
    } else if (match === "skip") {
      (0, import_filePaths.saveDeploymentConfig)(ctx, "local", existing.deploymentName, {
        ...existing.config,
        cloudProjectId: target.id
      });
    }
  }
  const newSelection = {
    kind: "deploymentWithinProject",
    targetProject: {
      kind: "deploymentName",
      deploymentName: resolvedDeploymentName,
      deploymentType: "local"
    },
    selectionWithinProject: {
      kind: "deploymentSelector",
      selector
    }
  };
  await saveSelectedDeployment(
    ctx,
    selector,
    newSelection,
    (0, import_deploymentSelection.deploymentNameFromSelection)(currentSelection)
  );
}
function teamAndProjectFromParsed(parsed) {
  if (parsed.kind === "inTeamProject") {
    return { teamSlug: parsed.teamSlug, projectSlug: parsed.projectSlug };
  }
  return null;
}
async function saveSelectedDeployment(ctx, selector, selection, previousDeploymentName) {
  const deployment = await (0, import_api.loadSelectedDeploymentCredentials)(ctx, selection, {
    ensureLocalRunning: false
  });
  if (deployment.deploymentFields === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: null,
      errForSentry: `Unexpected selection in select: ${JSON.stringify(deployment)}`
    });
  }
  if (deployment.deploymentFields.deploymentType === "prod") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Selecting a production deployment is unsupported. To run commands on a production deployment, pass the ${import_chalk.chalkStderr.bold(`--deployment ${selector}`)} flag to each command.`
    });
  }
  const { convexSiteUrl: siteUrl } = deployment.deploymentFields.deploymentType === "local" ? { convexSiteUrl: null } : await (0, import_deploy2.fetchDeploymentCanonicalUrls)(ctx, {
    adminKey: deployment.adminKey,
    deploymentUrl: deployment.url
  });
  await (0, import_configure.updateEnvAndConfigForDeploymentSelection)(
    ctx,
    {
      url: deployment.url,
      siteUrl,
      deploymentName: deployment.deploymentFields.deploymentName,
      teamSlug: deployment.deploymentFields.teamSlug,
      projectSlug: deployment.deploymentFields.projectSlug,
      deploymentType: deployment.deploymentFields.deploymentType
    },
    previousDeploymentName
  );
  return deployment;
}
//# sourceMappingURL=deploymentSelect.js.map
