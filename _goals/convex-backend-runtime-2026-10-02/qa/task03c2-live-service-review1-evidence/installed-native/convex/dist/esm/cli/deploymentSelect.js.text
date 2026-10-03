"use strict";
import { Command } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import { loadSelectedDeploymentCredentials } from "./lib/api.js";
import { logFinishedStep } from "../bundler/log.js";
import { announceDeploymentTarget } from "./lib/announceDeploymentTarget.js";
import {
  getDeploymentSelection,
  deploymentNameFromSelection
} from "./lib/deploymentSelection.js";
import {
  parseDeploymentSelector
} from "./lib/deploymentSelector.js";
import { updateEnvAndConfigForDeploymentSelection } from "./configure.js";
import { fetchDeploymentCanonicalUrls } from "./lib/deploy2.js";
import {
  loadProjectLocalConfig,
  saveDeploymentConfig
} from "./lib/localDeployment/filePaths.js";
import {
  checkLocalConfigMatchesProject,
  getCloudProjectSlugsBestEffort,
  pauseLocalDeploymentBestEffort,
  targetProjectForLocalSelector
} from "./lib/localDeployment/projectMismatch.js";
import { bigBrainStart } from "./lib/localDeployment/bigBrain.js";
import { promptYesNo } from "./lib/utils/prompts.js";
import { createLocalDeployment } from "./deploymentCreate.js";
import { chalkStderr } from "chalk";
import { logWarning } from "../bundler/log.js";
export const deploymentSelect = new Command("select").summary("Select the deployment to use when running commands").description(
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
  const ctx = await oneoffContext({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  const currentSelection = await getDeploymentSelection(ctx, {});
  const parsed = parseDeploymentSelector(selector);
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
  const newSelection = await getDeploymentSelection(ctx, {
    url: void 0,
    adminKey: void 0,
    envFile: void 0,
    deployment: selector
  });
  const deployment = await saveSelectedDeployment(
    ctx,
    selector,
    newSelection,
    deploymentNameFromSelection(currentSelection)
  );
  logFinishedStep("Selected deployment:");
  announceDeploymentTarget(null, deployment);
});
function isLocalDeploymentSelector(parsed) {
  return (parsed.kind === "inCurrentProject" || parsed.kind === "inProject" || parsed.kind === "inTeamProject") && parsed.selector.kind === "local";
}
async function handleLocalSelect(ctx, selector, parsed, currentSelection) {
  const existing = loadProjectLocalConfig(ctx);
  if (existing === null) {
    if (!process.stdin.isTTY) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No local deployment found. Run ${chalkStderr.bold("npx convex deployment create local")} to create one.`
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
        printedMessage: `No local deployment found. To create one in ${chalkStderr.bold(parsed.projectSlug)}, run ${chalkStderr.bold(`npx convex deployment create local --project ${parsed.projectSlug}`)}, or use a fully qualified selector like ${chalkStderr.bold(`my-team:${parsed.projectSlug}:local`)}.`
      });
    }
    const wantsToCreate = await promptYesNo(ctx, {
      message: "No local deployment found. Create one now?",
      default: true
    });
    if (!wantsToCreate) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No local deployment found. Run ${chalkStderr.bold("npx convex deployment create local")} to create one.`
      });
    }
    const teamAndProject = teamAndProjectFromParsed(parsed);
    await createLocalDeployment(ctx, currentSelection, true, teamAndProject);
    return;
  }
  const target = await targetProjectForLocalSelector(
    ctx,
    parsed,
    currentSelection
  );
  let resolvedDeploymentName = existing.deploymentName;
  if (target !== null) {
    const match = checkLocalConfigMatchesProject(ctx, existing.config, target);
    if (match === "mismatch") {
      const oldProjectId = existing.config.cloudProjectId;
      const oldProject = await getCloudProjectSlugsBestEffort(
        ctx,
        oldProjectId
      );
      const oldProjectLabel = oldProject !== null ? `project ${chalkStderr.bold(`${oldProject.teamSlug}:${oldProject.slug}`)}` : `an unknown cloud project (ID ${oldProjectId})`;
      logWarning(
        chalkStderr.yellow(
          `\u26A0\uFE0F This local deployment was previously in ${oldProjectLabel}. Moving it to project ${chalkStderr.bold(`${target.teamSlug}:${target.slug}`)}.`
        )
      );
      await pauseLocalDeploymentBestEffort(ctx, oldProject);
      const { deploymentName: newDeploymentName } = await bigBrainStart(ctx, {
        port: existing.config.ports.cloud,
        teamSlug: target.teamSlug,
        projectSlug: target.slug,
        instanceName: null
      });
      saveDeploymentConfig(ctx, "local", newDeploymentName, {
        ...existing.config,
        cloudProjectId: target.id
      });
      resolvedDeploymentName = newDeploymentName;
    } else if (match === "skip") {
      saveDeploymentConfig(ctx, "local", existing.deploymentName, {
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
    deploymentNameFromSelection(currentSelection)
  );
}
function teamAndProjectFromParsed(parsed) {
  if (parsed.kind === "inTeamProject") {
    return { teamSlug: parsed.teamSlug, projectSlug: parsed.projectSlug };
  }
  return null;
}
export async function saveSelectedDeployment(ctx, selector, selection, previousDeploymentName) {
  const deployment = await loadSelectedDeploymentCredentials(ctx, selection, {
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
      printedMessage: `Selecting a production deployment is unsupported. To run commands on a production deployment, pass the ${chalkStderr.bold(`--deployment ${selector}`)} flag to each command.`
    });
  }
  const { convexSiteUrl: siteUrl } = deployment.deploymentFields.deploymentType === "local" ? { convexSiteUrl: null } : await fetchDeploymentCanonicalUrls(ctx, {
    adminKey: deployment.adminKey,
    deploymentUrl: deployment.url
  });
  await updateEnvAndConfigForDeploymentSelection(
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
