"use strict";
import { logVerbose, logWarning } from "../../bundler/log.js";
import { getTeamAndProjectFromPreviewAdminKey } from "./deployment.js";
import {
  assertLocalBackendRunning,
  localDeploymentUrl
} from "./localDeployment/run.js";
import {
  ThrowingFetchError,
  bigBrainAPI,
  bigBrainAPIMaybeThrows,
  logAndHandleFetchError,
  typedPlatformClient
} from "./utils/utils.js";
import { z } from "zod";
import { loadLocalDeploymentCredentials } from "./localDeployment/localDeployment.js";
import { loadAnonymousDeployment } from "./localDeployment/anonymous.js";
import {
  parseDeploymentSelector
} from "./deploymentSelector.js";
import { loadProjectLocalConfig } from "./localDeployment/filePaths.js";
import { chalkStderr } from "chalk";
export async function createProject(ctx, {
  teamId,
  projectName,
  deploymentToProvision
}) {
  const response = await typedPlatformClient(ctx).POST(
    "/teams/{team_id}/create_project",
    {
      params: { path: { team_id: teamId } },
      body: {
        projectName,
        deploymentType: deploymentToProvision?.deploymentType ?? null,
        deploymentRegion: deploymentToProvision?.region ?? null
      }
    }
  );
  const projectSlug = response.data?.slug;
  if (projectSlug === void 0) {
    const error = "Unexpected response during provisioning: " + JSON.stringify(response);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: error,
      printedMessage: error
    });
  }
  return {
    projectSlug
  };
}
export const deploymentSelectionWithinProjectSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("previewName"), previewName: z.string() }),
    z.object({ kind: z.literal("deploymentName"), deploymentName: z.string() }),
    z.object({ kind: z.literal("prod") }),
    z.object({ kind: z.literal("implicitProd") }),
    z.object({ kind: z.literal("unspecified") }),
    z.object({
      kind: z.literal("deploymentSelector"),
      selector: z.string()
    })
  ]
);
export function deploymentSelectionWithinProjectFromOptions(options) {
  if (options.deployment !== void 0) {
    return { kind: "deploymentSelector", selector: options.deployment };
  }
  if (options.previewName !== void 0) {
    return { kind: "previewName", previewName: options.previewName };
  }
  if (options.deploymentName !== void 0) {
    return { kind: "deploymentName", deploymentName: options.deploymentName };
  }
  if (options.prod) {
    return { kind: "prod" };
  }
  if (options.implicitProd) {
    return { kind: "implicitProd" };
  }
  return { kind: "unspecified" };
}
export async function validateDeploymentSelectionForExistingDeployment(ctx, deploymentSelection, source) {
  if (deploymentSelection.kind === "unspecified" || deploymentSelection.kind === "implicitProd") {
    return;
  }
  if (deploymentSelection.kind === "deploymentSelector") {
    switch (source) {
      case "selfHosted":
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "The `--deployment` flag cannot be used with a self-hosted deployment."
        });
      case "deployKey":
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "The `--deployment` flag cannot be used with CONVEX_DEPLOY_KEY."
        });
      case "cliArgs":
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "The `--deployment` flag cannot be used with --url and --admin-key."
        });
    }
  }
  switch (source) {
    case "selfHosted":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "The `--prod`, `--preview-name`, and `--deployment-name` flags cannot be used with a self-hosted deployment."
      });
    case "deployKey":
      logWarning(
        "Ignoring `--prod`, `--preview-name`, or `--deployment-name` flags and using deployment from CONVEX_DEPLOY_KEY"
      );
      break;
    case "cliArgs":
      logWarning(
        "Ignoring `--prod`, `--preview-name`, or `--deployment-name` flags since this command was run with --url and --admin-key"
      );
      break;
  }
}
async function hasAccessToProject(ctx, selector) {
  try {
    await typedPlatformClient(ctx, { throw: true }).GET(
      "/teams/{team_id_or_slug}/projects/{project_slug}",
      {
        params: {
          path: {
            team_id_or_slug: selector.teamSlug,
            project_slug: selector.projectSlug
          }
        }
      }
    );
    return true;
  } catch (err) {
    if (err instanceof ThrowingFetchError && (err.serverErrorData?.code === "TeamNotFound" || err.serverErrorData?.code === "ProjectNotFound")) {
      return false;
    }
    return logAndHandleFetchError(ctx, err);
  }
}
export async function checkAccessToSelectedProject(ctx, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName": {
      const result = await getTeamAndProjectSlugForDeployment(ctx, {
        deploymentName: projectSelection.deploymentName
      });
      if (result === null) {
        return { kind: "noAccess" };
      }
      return {
        kind: "hasAccess",
        teamSlug: result.teamSlug,
        projectSlug: result.projectSlug
      };
    }
    case "teamAndProjectSlugs": {
      const hasAccess = await hasAccessToProject(ctx, {
        teamSlug: projectSelection.teamSlug,
        projectSlug: projectSelection.projectSlug
      });
      if (!hasAccess) {
        return { kind: "noAccess" };
      }
      return {
        kind: "hasAccess",
        teamSlug: projectSelection.teamSlug,
        projectSlug: projectSelection.projectSlug
      };
    }
    case "projectDeployKey":
      return { kind: "unknown" };
    default: {
      projectSelection;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Invalid project selection: ${projectSelection.kind}`
      });
    }
  }
}
export async function getTeamAndProjectSlugForDeployment(ctx, selector) {
  try {
    const body = await bigBrainAPIMaybeThrows({
      ctx,
      path: `deployment/${selector.deploymentName}/team_and_project`,
      method: "GET"
    });
    return { teamSlug: body.team, projectSlug: body.project };
  } catch (err) {
    if (err instanceof ThrowingFetchError && (err.serverErrorData?.code === "DeploymentNotFound" || err.serverErrorData?.code === "ProjectNotFound")) {
      return null;
    }
    return logAndHandleFetchError(ctx, err);
  }
}
export async function fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(ctx, projectSelection, deploymentType) {
  if (projectSelection.kind === "projectDeployKey") {
    const auth = ctx.bigBrainAuth();
    const doesAuthMatch = auth !== null && auth.kind === "projectKey" && auth.projectKey === projectSelection.projectDeployKey;
    if (!doesAuthMatch) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        errForSentry: new Error(
          "Expected project deploy key to match the big brain auth header"
        ),
        printedMessage: "Unexpected error when loading the Convex deployment"
      });
    }
  }
  let data;
  try {
    data = await bigBrainAPIMaybeThrows({
      ctx,
      method: "POST",
      path: "deployment/provision_and_authorize",
      data: {
        teamSlug: projectSelection.kind === "teamAndProjectSlugs" ? projectSelection.teamSlug : null,
        projectSlug: projectSelection.kind === "teamAndProjectSlugs" ? projectSelection.projectSlug : null,
        deploymentType: deploymentType === "prod" ? "prod" : "dev"
      }
    });
  } catch (error) {
    const msg = "Unknown error during authorization: " + error;
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg
    });
  }
  const { adminKey, url, deploymentName, reference, isDefault } = data;
  if (adminKey === void 0 || url === void 0) {
    const msg = "Unknown error during authorization: " + JSON.stringify(data);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg
    });
  }
  return { adminKey, deploymentUrl: url, deploymentName, reference, isDefault };
}
async function fetchExistingDevDeploymentCredentialsOrCrash(ctx, deploymentName) {
  const slugs = await fetchTeamAndProject(ctx, deploymentName);
  const credentials = await fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(
    ctx,
    {
      kind: "teamAndProjectSlugs",
      teamSlug: slugs.team,
      projectSlug: slugs.project
    },
    "dev"
  );
  return {
    deploymentName: credentials.deploymentName,
    adminKey: credentials.adminKey,
    url: credentials.deploymentUrl,
    deploymentType: "dev",
    reference: credentials.reference,
    isDefault: credentials.isDefault
  };
}
async function handleOwnDev(ctx, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName": {
      if (projectSelection.deploymentType === "local") {
        const credentials = await loadLocalDeploymentCredentials(
          ctx,
          projectSelection.deploymentName
        );
        return {
          deploymentName: projectSelection.deploymentName,
          adminKey: credentials.adminKey,
          url: credentials.deploymentUrl,
          deploymentType: "local",
          reference: null,
          isDefault: false
        };
      }
      return await fetchExistingDevDeploymentCredentialsOrCrash(
        ctx,
        projectSelection.deploymentName
      );
    }
    case "teamAndProjectSlugs":
    case "projectDeployKey": {
      const credentials = await fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(
        ctx,
        projectSelection,
        "dev"
      );
      return {
        url: credentials.deploymentUrl,
        adminKey: credentials.adminKey,
        deploymentName: credentials.deploymentName,
        deploymentType: "dev",
        reference: credentials.reference,
        isDefault: credentials.isDefault
      };
    }
    default: {
      projectSelection;
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        // This should be unreachable, so don't bother with a printed message.
        printedMessage: null,
        errForSentry: `Unexpected project selection: ${projectSelection.kind}`
      });
    }
  }
}
async function handleProd(ctx, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName": {
      const credentials = await bigBrainAPI({
        ctx,
        method: "POST",
        path: "deployment/authorize_prod",
        data: {
          deploymentName: projectSelection.deploymentName
        }
      });
      return credentials;
    }
    case "teamAndProjectSlugs":
    case "projectDeployKey": {
      const credentials = await fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(
        ctx,
        projectSelection,
        "prod"
      );
      return {
        url: credentials.deploymentUrl,
        adminKey: credentials.adminKey,
        deploymentName: credentials.deploymentName,
        deploymentType: "prod",
        reference: credentials.reference,
        isDefault: credentials.isDefault
      };
    }
  }
}
async function handlePreview(ctx, previewName, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName":
    case "teamAndProjectSlugs": {
      const credentials = await bigBrainAPI({
        ctx,
        method: "POST",
        path: "deployment/authorize_preview",
        data: {
          previewName,
          projectSelection
        }
      });
      return credentials;
    }
    case "projectDeployKey":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Project deploy keys are not supported for preview deployments"
      });
  }
}
async function handleDeploymentName(ctx, deploymentName, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName":
    case "teamAndProjectSlugs": {
      const credentials = await bigBrainAPI({
        ctx,
        method: "POST",
        path: "deployment/authorize_within_current_project",
        data: {
          selectedDeploymentName: deploymentName,
          projectSelection
        }
      });
      return credentials;
    }
    case "projectDeployKey":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Project deploy keys are not supported with the --deployment-name flag"
      });
  }
}
async function fetchDeploymentCredentialsWithinCurrentProject(ctx, projectSelection, deploymentSelection) {
  switch (deploymentSelection.kind) {
    case "unspecified": {
      return await handleOwnDev(ctx, projectSelection);
    }
    case "implicitProd":
    case "prod": {
      return await handleProd(ctx, projectSelection);
    }
    case "previewName":
      return await handlePreview(
        ctx,
        deploymentSelection.previewName,
        projectSelection
      );
    case "deploymentName":
      return await handleDeploymentName(
        ctx,
        deploymentSelection.deploymentName,
        projectSelection
      );
    case "deploymentSelector":
      return await handleDeploymentSelector(
        ctx,
        deploymentSelection.selector,
        projectSelection
      );
    default: {
      deploymentSelection;
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        // This should be unreachable, so don't bother with a printed message.
        printedMessage: null,
        errForSentry: `Unexpected deployment selection: ${deploymentSelection}`
      });
    }
  }
}
async function resolveDeploymentNameByReference(ctx, teamSlug, projectSlug, reference) {
  try {
    const result = await typedPlatformClient(ctx, { throw: true }).GET(
      "/teams/{team_id_or_slug}/projects/{project_slug}/deployment",
      {
        params: {
          path: { team_id_or_slug: teamSlug, project_slug: projectSlug },
          query: { reference }
        }
      }
    );
    return result.data.name;
  } catch (err) {
    if (err instanceof ThrowingFetchError && err.serverErrorData?.code === "DeploymentNotFound") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Deployment \u201C${reference}\u201D not found. To create a new deployment, use ${chalkStderr.bold(`npx convex deployment create ${teamSlug}:${projectSlug}:${reference} --select`)}`,
        errForSentry: err
      });
    }
    return await logAndHandleFetchError(ctx, err);
  }
}
async function handleRefInProject(ctx, selector, projectSelection) {
  switch (selector.kind) {
    case "local": {
      const localConfig = loadProjectLocalConfig(ctx);
      if (localConfig === null) {
        return ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `No local deployment found. Run ${chalkStderr.bold("npx convex deployment create local")} to create one.`
        });
      }
      const credentials = await loadLocalDeploymentCredentials(
        ctx,
        localConfig.deploymentName
      );
      return {
        deploymentName: localConfig.deploymentName,
        adminKey: credentials.adminKey,
        url: credentials.deploymentUrl,
        deploymentType: "local",
        reference: null,
        isDefault: false
      };
    }
    case "dev": {
      const access = await checkAccessToSelectedProject(ctx, projectSelection);
      if (access.kind !== "hasAccess") {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "You don't have access to the selected project. Run `npx convex dev` to select a different project."
        });
      }
      const deploymentName = await resolveDefaultCloudDevDeploymentName(
        ctx,
        access.teamSlug,
        access.projectSlug
      );
      return await handleDeploymentName(ctx, deploymentName, {
        kind: "teamAndProjectSlugs",
        teamSlug: access.teamSlug,
        projectSlug: access.projectSlug
      });
    }
    case "prod":
      return await handleProd(ctx, projectSelection);
    case "reference": {
      const access = await checkAccessToSelectedProject(ctx, projectSelection);
      if (access.kind !== "hasAccess") {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "You don't have access to the selected project. Run `npx convex dev` to select a different project."
        });
      }
      const deploymentName = await resolveDeploymentNameByReference(
        ctx,
        access.teamSlug,
        access.projectSlug,
        selector.reference
      );
      return await handleDeploymentName(ctx, deploymentName, projectSelection);
    }
  }
}
async function handleDeploymentSelector(ctx, selector, projectSelection) {
  const parsed = parseDeploymentSelector(selector);
  switch (parsed.kind) {
    case "deploymentName":
      return await handleDeploymentName(
        ctx,
        parsed.deploymentName,
        projectSelection
      );
    case "inCurrentProject":
      return await handleRefInProject(ctx, parsed.selector, projectSelection);
    case "inProject": {
      const access = await checkAccessToSelectedProject(ctx, projectSelection);
      if (access.kind !== "hasAccess") {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "You don't have access to the selected project. Run `npx convex dev` to select a different project."
        });
      }
      return await handleRefInProject(ctx, parsed.selector, {
        kind: "teamAndProjectSlugs",
        teamSlug: access.teamSlug,
        projectSlug: parsed.projectSlug
      });
    }
    case "inTeamProject":
      return await handleRefInProject(ctx, parsed.selector, {
        kind: "teamAndProjectSlugs",
        teamSlug: parsed.teamSlug,
        projectSlug: parsed.projectSlug
      });
  }
}
async function _loadExistingDeploymentCredentialsForProject(ctx, targetProject, deploymentSelection, { ensureLocalRunning } = { ensureLocalRunning: true }) {
  const accessResult = await checkAccessToSelectedProject(ctx, targetProject);
  if (accessResult.kind === "noAccess") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "You don't have access to the selected project. Run `npx convex dev` to select a different project."
    });
  }
  const result = await fetchDeploymentCredentialsWithinCurrentProject(
    ctx,
    targetProject,
    deploymentSelection
  );
  logVerbose(
    `Deployment URL: ${result.url}, Deployment Name: ${result.deploymentName}, Deployment Type: ${result.deploymentType}`
  );
  if (ensureLocalRunning && result.deploymentType === "local") {
    await assertLocalBackendRunning(ctx, {
      url: result.url,
      deploymentName: result.deploymentName
    });
  }
  return {
    ...result,
    deploymentFields: {
      deploymentName: result.deploymentName,
      deploymentType: result.deploymentType,
      reference: result.reference,
      isDefault: result.isDefault,
      projectSlug: accessResult.kind === "hasAccess" ? accessResult.projectSlug : null,
      teamSlug: accessResult.kind === "hasAccess" ? accessResult.teamSlug : null
    }
  };
}
export async function loadSelectedDeploymentCredentials(ctx, deploymentSelection, { ensureLocalRunning } = { ensureLocalRunning: true }) {
  switch (deploymentSelection.kind) {
    case "existingDeployment":
      logVerbose(
        `Deployment URL: ${deploymentSelection.deploymentToActOn.url}, Deployment Name: ${deploymentSelection.deploymentToActOn.deploymentFields?.deploymentName ?? "unknown"}, Deployment Type: ${deploymentSelection.deploymentToActOn.deploymentFields?.deploymentType ?? "unknown"}`
      );
      return {
        adminKey: deploymentSelection.deploymentToActOn.adminKey,
        url: deploymentSelection.deploymentToActOn.url,
        deploymentFields: deploymentSelection.deploymentToActOn.deploymentFields
      };
    case "chooseProject":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "No CONVEX_DEPLOYMENT set, run `npx convex dev` to configure a Convex project"
      });
    case "preview": {
      const slugs = await getTeamAndProjectFromPreviewAdminKey(
        ctx,
        deploymentSelection.previewDeployKey
      );
      return await _loadExistingDeploymentCredentialsForProject(
        ctx,
        {
          kind: "teamAndProjectSlugs",
          teamSlug: slugs.teamSlug,
          projectSlug: slugs.projectSlug
        },
        // Note that the user could select a non-preview deployment here, and it would succeed if the user is logged in locally because getBigBrainAuth prefers the user's access token over the preview deploy key.
        deploymentSelection.selectionWithinProject,
        { ensureLocalRunning }
      );
    }
    case "deploymentWithinProject": {
      return await _loadExistingDeploymentCredentialsForProject(
        ctx,
        deploymentSelection.targetProject,
        deploymentSelection.selectionWithinProject,
        { ensureLocalRunning }
      );
    }
    case "anonymous": {
      if (deploymentSelection.deploymentName === null) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "No CONVEX_DEPLOYMENT set, run `npx convex dev` to configure a Convex project"
        });
      }
      const config = await loadAnonymousDeployment(
        ctx,
        deploymentSelection.deploymentName
      );
      const url = localDeploymentUrl(config.ports.cloud);
      if (ensureLocalRunning) {
        await assertLocalBackendRunning(ctx, {
          url,
          deploymentName: deploymentSelection.deploymentName
        });
      }
      return {
        adminKey: config.adminKey,
        url,
        deploymentFields: {
          deploymentName: deploymentSelection.deploymentName,
          deploymentType: "anonymous",
          projectSlug: null,
          teamSlug: null,
          reference: null,
          isDefault: false
        }
      };
    }
    default: {
      deploymentSelection;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Unknown deployment type"
      });
    }
  }
}
export async function fetchTeamAndProject(ctx, deploymentName) {
  const data = await bigBrainAPI({
    ctx,
    method: "GET",
    path: `deployment/${deploymentName}/team_and_project`
  });
  const { team, project } = data;
  if (team === void 0 || project === void 0) {
    const msg = "Unknown error when fetching team and project: " + JSON.stringify(data);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg
    });
  }
  return data;
}
export async function fetchTeamAndProjectForKey(ctx, deployKey) {
  const data = await bigBrainAPI({
    ctx,
    method: "POST",
    path: `deployment/team_and_project_for_key`,
    data: {
      deployKey
    }
  });
  const { team, project } = data;
  if (team === void 0 || project === void 0) {
    const msg = "Unknown error when fetching team and project: " + JSON.stringify(data);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg
    });
  }
  return data;
}
export async function getTeamsForUser(ctx) {
  const teams = await bigBrainAPI(
    {
      ctx,
      method: "GET",
      path: "teams"
    }
  );
  return teams;
}
async function resolveDefaultCloudDevDeploymentName(ctx, teamSlug, projectSlug) {
  try {
    const result = await typedPlatformClient(ctx, { throw: true }).GET(
      "/teams/{team_id_or_slug}/projects/{project_slug}/deployment",
      {
        params: {
          path: { team_id_or_slug: teamSlug, project_slug: projectSlug },
          query: { defaultDev: true }
        }
      }
    );
    return result.data.name;
  } catch (err) {
    if (err instanceof ThrowingFetchError && err.serverErrorData?.code === "DeploymentNotFound") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `You don\u2019t have a personal cloud dev deployment in this project. Run ${chalkStderr.bold("npx convex deployment create --type dev --default")} to create one.`,
        errForSentry: err
      });
    }
    return await logAndHandleFetchError(ctx, err);
  }
}
//# sourceMappingURL=api.js.map
