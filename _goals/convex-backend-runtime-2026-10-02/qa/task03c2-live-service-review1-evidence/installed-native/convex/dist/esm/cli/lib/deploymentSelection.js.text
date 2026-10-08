"use strict";
import { logVerbose } from "../../bundler/log.js";
import {
  deploymentSelectionWithinProjectFromOptions,
  fetchTeamAndProjectForKey,
  getTeamAndProjectSlugForDeployment,
  validateDeploymentSelectionForExistingDeployment
} from "./api.js";
import {
  deploymentNameFromAdminKeyOrCrash,
  deploymentTypeFromAdminKey,
  getDeploymentTypeFromConfiguredDeployment,
  isAnonymousDeployment,
  isDeploymentKey,
  isPreviewDeployKey,
  isProjectKey,
  stripDeploymentTypePrefix
} from "./deployment.js";
import {
  parseDeploymentSelector
} from "./deploymentSelector.js";
import { loadProjectLocalConfig } from "./localDeployment/filePaths.js";
import {
  checkLocalConfigMatchesProject,
  targetProjectForLocalSelector
} from "./localDeployment/projectMismatch.js";
import { chalkStderr } from "chalk";
import { getBuildEnvironment } from "./envvars.js";
import { readGlobalConfig } from "./utils/globalConfig.js";
import {
  CONVEX_DEPLOYMENT_ENV_VAR_NAME,
  CONVEX_DEPLOYMENT_TOKEN_ENV_VAR_NAME,
  CONVEX_DEPLOY_KEY_ENV_VAR_NAME,
  CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME,
  CONVEX_SELF_HOSTED_URL_VAR_NAME,
  ENV_VAR_FILE_PATH,
  bigBrainAPI,
  processDeployKeyValue,
  readDeployKeyFromEnv,
  typedPlatformClient
} from "./utils/utils.js";
import * as dotenv from "dotenv";
export async function initializeBigBrainAuth(ctx, initialArgs) {
  if (initialArgs.url !== void 0 && initialArgs.adminKey !== void 0) {
    ctx._updateBigBrainAuth(
      getBigBrainAuth(ctx, {
        previewDeployKey: null,
        projectKey: null,
        deploymentKey: null
      })
    );
    return;
  }
  if (initialArgs.envFile !== void 0) {
    const existingFile = ctx.fs.exists(initialArgs.envFile) ? ctx.fs.readUtf8File(initialArgs.envFile) : null;
    if (existingFile === null) {
      return ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: "env file does not exist"
      });
    }
    const config = dotenv.parse(existingFile);
    const rawDeployKey2 = readDeployKeyFromEnv((name) => config[name]);
    const deployKey2 = await processDeployKeyValue(ctx, rawDeployKey2);
    if (deployKey2 !== void 0) {
      const bigBrainAuth = getBigBrainAuth(ctx, {
        previewDeployKey: isPreviewDeployKey(deployKey2) ? deployKey2 : null,
        projectKey: isProjectKey(deployKey2) ? deployKey2 : null,
        deploymentKey: isDeploymentKey(deployKey2) ? deployKey2 : null
      });
      ctx._updateBigBrainAuth(bigBrainAuth);
      return;
    }
    ctx._updateBigBrainAuth(
      getBigBrainAuth(ctx, {
        previewDeployKey: null,
        projectKey: null,
        deploymentKey: null
      })
    );
    return;
  }
  dotenv.config({ path: ENV_VAR_FILE_PATH });
  dotenv.config();
  const rawDeployKey = readDeployKeyFromEnv((name) => process.env[name]);
  const deployKey = await processDeployKeyValue(ctx, rawDeployKey);
  if (deployKey !== void 0) {
    const bigBrainAuth = getBigBrainAuth(ctx, {
      previewDeployKey: isPreviewDeployKey(deployKey) ? deployKey : null,
      projectKey: isProjectKey(deployKey) ? deployKey : null,
      deploymentKey: isDeploymentKey(deployKey) ? deployKey : null
    });
    ctx._updateBigBrainAuth(bigBrainAuth);
    return;
  }
  ctx._updateBigBrainAuth(
    getBigBrainAuth(ctx, {
      previewDeployKey: null,
      projectKey: null,
      deploymentKey: null
    })
  );
  return;
}
export async function updateBigBrainAuthAfterLogin(ctx, accessToken) {
  const existingAuth = ctx.bigBrainAuth();
  if (existingAuth !== null && existingAuth.kind === "projectKey") {
    logVerbose(
      `Ignoring update to big brain auth since project key takes precedence`
    );
    return;
  }
  ctx._updateBigBrainAuth({
    accessToken,
    kind: "accessToken",
    header: `Bearer ${accessToken}`
  });
}
export async function clearBigBrainAuth(ctx) {
  ctx._updateBigBrainAuth(null);
}
function getBigBrainAuth(ctx, opts) {
  if (process.env.CONVEX_OVERRIDE_ACCESS_TOKEN) {
    return {
      accessToken: process.env.CONVEX_OVERRIDE_ACCESS_TOKEN,
      kind: "accessToken",
      header: `Bearer ${process.env.CONVEX_OVERRIDE_ACCESS_TOKEN}`
    };
  }
  if (opts.projectKey !== null) {
    return {
      header: `Bearer ${opts.projectKey}`,
      kind: "projectKey",
      projectKey: opts.projectKey
    };
  }
  if (opts.deploymentKey !== null) {
    return {
      header: `Bearer ${opts.deploymentKey}`,
      kind: "deploymentKey",
      deploymentKey: opts.deploymentKey
    };
  }
  const globalConfig = readGlobalConfig(ctx);
  if (globalConfig) {
    return {
      kind: "accessToken",
      header: `Bearer ${globalConfig.accessToken}`,
      accessToken: globalConfig.accessToken
    };
  }
  if (opts.previewDeployKey !== null) {
    return {
      header: `Bearer ${opts.previewDeployKey}`,
      kind: "previewDeployKey",
      previewDeployKey: opts.previewDeployKey
    };
  }
  return null;
}
export async function ensureLoggedInWithAccessToken(ctx, action) {
  const auth = ctx.bigBrainAuth();
  if (auth !== null && auth.kind === "accessToken") {
    return;
  }
  const prefix = auth === null ? "Run " : process.env[CONVEX_DEPLOYMENT_TOKEN_ENV_VAR_NAME] && !process.env[CONVEX_DEPLOY_KEY_ENV_VAR_NAME] ? `Unset ${CONVEX_DEPLOYMENT_TOKEN_ENV_VAR_NAME} and run ` : `Unset ${CONVEX_DEPLOY_KEY_ENV_VAR_NAME} and run `;
  return await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: `${action} requires being logged in with a personal access token. ${prefix}${chalkStderr.bold(
      "npx convex login"
    )} and try again.`
  });
}
export async function ensureAuthCanCreateDeployment(ctx) {
  const auth = ctx.bigBrainAuth();
  if (auth !== null && (auth.kind === "accessToken" || auth.kind === "projectKey")) {
    return;
  }
  if (auth === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Creating a deployment requires logging in. Run ${chalkStderr.bold(
        "npx convex login"
      )} and try again.`
    });
  }
  const envVar = process.env[CONVEX_DEPLOY_KEY_ENV_VAR_NAME] ? CONVEX_DEPLOY_KEY_ENV_VAR_NAME : CONVEX_DEPLOYMENT_TOKEN_ENV_VAR_NAME;
  return await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: `Creating a deployment isn't supported with a deploy key (${envVar}). Run ${chalkStderr.bold(
      "npx convex login"
    )} (or use a project key) and try again.`
  });
}
export async function getDeploymentSelection(ctx, cliArgs) {
  const metadata = await _getDeploymentSelection(ctx, cliArgs);
  if (metadata.kind === "existingDeployment") {
    const selectionWithinProject = deploymentSelectionWithinProjectFromOptions(cliArgs);
    await validateDeploymentSelectionForExistingDeployment(
      ctx,
      selectionWithinProject,
      metadata.deploymentToActOn.source
    );
  }
  logDeploymentSelection(ctx, metadata);
  return metadata;
}
function logDeploymentSelection(_ctx, selection) {
  switch (selection.kind) {
    case "existingDeployment": {
      logVerbose(
        `Existing deployment: ${selection.deploymentToActOn.url} ${selection.deploymentToActOn.source}`
      );
      break;
    }
    case "deploymentWithinProject": {
      logVerbose(
        `Deployment within project: ${prettyProjectSelection(selection.targetProject)}`
      );
      break;
    }
    case "preview": {
      logVerbose(`Preview deploy key`);
      break;
    }
    case "chooseProject": {
      logVerbose(`Choose project`);
      break;
    }
    case "anonymous": {
      logVerbose(
        `Anonymous, has selected deployment?: ${selection.deploymentName !== null}`
      );
      break;
    }
    default: {
      selection;
      logVerbose(`Unknown deployment selection`);
    }
  }
  return null;
}
function prettyProjectSelection(selection) {
  switch (selection.kind) {
    case "teamAndProjectSlugs": {
      return `Team and project slugs: ${selection.teamSlug} ${selection.projectSlug}`;
    }
    case "deploymentName": {
      return `Deployment name: ${selection.deploymentName}`;
    }
    case "projectDeployKey": {
      return `Project deploy key`;
    }
    default: {
      selection;
      return `Unknown`;
    }
  }
}
async function _getDeploymentSelection(ctx, cliArgs) {
  const selectionWithinProject = deploymentSelectionWithinProjectFromOptions(cliArgs);
  if (cliArgs.url !== void 0 && cliArgs.adminKey !== void 0) {
    return {
      kind: "existingDeployment",
      deploymentToActOn: {
        url: cliArgs.url,
        adminKey: cliArgs.adminKey,
        deploymentFields: null,
        source: "cliArgs"
      }
    };
  }
  if (cliArgs.deployment !== void 0) {
    const parsed = parseDeploymentSelector(cliArgs.deployment);
    if (parsed.kind === "inTeamProject" && parsed.selector.kind !== "local") {
      return {
        kind: "deploymentWithinProject",
        targetProject: {
          kind: "teamAndProjectSlugs",
          teamSlug: parsed.teamSlug,
          projectSlug: parsed.projectSlug
        },
        selectionWithinProject: {
          kind: "deploymentSelector",
          selector: cliArgs.deployment
        }
      };
    }
    if (parsed.kind === "deploymentName") {
      return {
        kind: "deploymentWithinProject",
        targetProject: {
          kind: "deploymentName",
          deploymentName: parsed.deploymentName,
          deploymentType: null
        },
        selectionWithinProject: {
          kind: "deploymentSelector",
          selector: cliArgs.deployment
        }
      };
    }
    if (parsed.kind === "inTeamProject" && parsed.selector.kind === "local") {
      return await resolveLocalDeploymentSelection(
        ctx,
        parsed,
        selectionWithinProject,
        null
      );
    }
  }
  const baseSelection = await resolveBaseDeploymentSelection(
    ctx,
    cliArgs,
    selectionWithinProject
  );
  if (cliArgs.deployment !== void 0) {
    const parsed = parseDeploymentSelector(cliArgs.deployment);
    if ((parsed.kind === "inCurrentProject" || parsed.kind === "inProject") && parsed.selector.kind === "local") {
      return await resolveLocalDeploymentSelection(
        ctx,
        parsed,
        selectionWithinProject,
        baseSelection
      );
    }
  }
  return baseSelection;
}
async function resolveBaseDeploymentSelection(ctx, cliArgs, selectionWithinProject) {
  if (cliArgs.envFile !== void 0) {
    logVerbose(`Checking env file: ${cliArgs.envFile}`);
    const existingFile = ctx.fs.exists(cliArgs.envFile) ? ctx.fs.readUtf8File(cliArgs.envFile) : null;
    if (existingFile === null) {
      return ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: "env file does not exist"
      });
    }
    const config = dotenv.parse(existingFile);
    const result2 = await getDeploymentSelectionFromEnv(
      ctx,
      selectionWithinProject,
      (name) => config[name] === void 0 || config[name] === "" ? null : config[name]
    );
    if (result2.kind === "unknown") {
      return ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: `env file \`${cliArgs.envFile}\` did not contain environment variables for a Convex deployment. Expected \`${CONVEX_DEPLOY_KEY_ENV_VAR_NAME}\`, \`${CONVEX_DEPLOYMENT_ENV_VAR_NAME}\`, or both \`${CONVEX_SELF_HOSTED_URL_VAR_NAME}\` and \`${CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME}\` to be set.`
      });
    }
    return result2.metadata;
  }
  dotenv.config({ path: ENV_VAR_FILE_PATH });
  dotenv.config();
  const result = await getDeploymentSelectionFromEnv(
    ctx,
    selectionWithinProject,
    (name) => {
      const value = process.env[name];
      if (value === void 0 || value === "") {
        return null;
      }
      return value;
    }
  );
  if (result.kind !== "unknown") {
    return result.metadata;
  }
  const isLoggedIn = ctx.bigBrainAuth() !== null;
  if ((!isLoggedIn || process.env.CONVEX_AGENT_MODE === "anonymous" || !process.stdin.isTTY) && !cliArgs.implicitProd && shouldAllowAnonymousDevelopment()) {
    return {
      kind: "anonymous",
      deploymentName: null,
      selectionWithinProject
    };
  }
  return {
    kind: "chooseProject",
    selectionWithinProject
  };
}
async function resolveLocalDeploymentSelection(ctx, parsed, selectionWithinProject, currentSelection) {
  const localConfig = loadProjectLocalConfig(ctx);
  if (localConfig === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No local deployment found. Run ${chalkStderr.bold("npx convex deployment create local")} to create one.`
    });
  }
  if (localConfig.config.cloudProjectId !== void 0) {
    const target = await targetProjectForLocalSelector(
      ctx,
      parsed,
      currentSelection ?? { kind: "chooseProject", selectionWithinProject }
    );
    if (target !== null) {
      const match = checkLocalConfigMatchesProject(
        ctx,
        localConfig.config,
        target
      );
      if (match === "mismatch") {
        const newSelector = `${target.teamSlug}:${target.slug}:local`;
        return ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `The local deployment in this directory is in a different project than \`${target.teamSlug}:${target.slug}\`. 
${chalkStderr.dim(`${chalkStderr.bold("Hint")}: If you want to move the local deployment to this project, run ${chalkStderr.bold(`npx convex deployment select ${newSelector}`)}`)}`
        });
      }
    }
  }
  return {
    kind: "deploymentWithinProject",
    targetProject: {
      kind: "deploymentName",
      deploymentName: localConfig.deploymentName,
      deploymentType: "local"
    },
    selectionWithinProject
  };
}
async function getDeploymentSelectionFromEnv(ctx, selectionWithinProject, getEnv) {
  const rawDeployKey = readDeployKeyFromEnv(getEnv);
  const deployKey = await processDeployKeyValue(ctx, rawDeployKey);
  if (deployKey !== void 0) {
    const deployKeyType = isPreviewDeployKey(deployKey) ? "preview" : isProjectKey(deployKey) ? "project" : "deployment";
    switch (deployKeyType) {
      case "preview": {
        return {
          kind: "success",
          metadata: {
            kind: "preview",
            previewDeployKey: deployKey,
            selectionWithinProject
          }
        };
      }
      case "project": {
        return {
          kind: "success",
          metadata: {
            kind: "deploymentWithinProject",
            targetProject: {
              kind: "projectDeployKey",
              projectDeployKey: deployKey
            },
            selectionWithinProject
          }
        };
      }
      case "deployment": {
        const deploymentName = await deploymentNameFromAdminKeyOrCrash(
          ctx,
          deployKey
        );
        const deploymentType = deploymentTypeFromAdminKey(deployKey);
        const url = await bigBrainAPI({
          ctx,
          method: "POST",
          path: "deployment/url_for_key",
          data: {
            deployKey
          }
        });
        const slugs = await fetchTeamAndProjectForKey(ctx, deployKey);
        return {
          kind: "success",
          metadata: {
            kind: "existingDeployment",
            deploymentToActOn: {
              url,
              adminKey: deployKey,
              deploymentFields: {
                deploymentName,
                deploymentType,
                teamSlug: slugs.team,
                projectSlug: slugs.project,
                reference: slugs.reference,
                isDefault: slugs.isDefault
              },
              source: "deployKey"
            }
          }
        };
      }
      default: {
        deployKeyType;
        return ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Unexpected deploy key type: ${deployKeyType}`
        });
      }
    }
  }
  const convexDeployment = getEnv(CONVEX_DEPLOYMENT_ENV_VAR_NAME);
  const selfHostedUrl = getEnv(CONVEX_SELF_HOSTED_URL_VAR_NAME);
  const selfHostedAdminKey = getEnv(CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME);
  if (selfHostedUrl !== null && selfHostedAdminKey !== null) {
    if (convexDeployment !== null) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: `${CONVEX_DEPLOYMENT_ENV_VAR_NAME} must not be set when ${CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} are set`
      });
    }
    return {
      kind: "success",
      metadata: {
        kind: "existingDeployment",
        deploymentToActOn: {
          url: selfHostedUrl,
          adminKey: selfHostedAdminKey,
          deploymentFields: null,
          source: "selfHosted"
        }
      }
    };
  }
  if (selectionWithinProject.kind === "deploymentName") {
    return {
      kind: "success",
      metadata: {
        kind: "deploymentWithinProject",
        targetProject: {
          kind: "deploymentName",
          deploymentName: selectionWithinProject.deploymentName,
          deploymentType: null
        },
        selectionWithinProject
      }
    };
  }
  if (convexDeployment !== null) {
    if (selfHostedUrl !== null || selfHostedAdminKey !== null) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: `${CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} must not be set when ${CONVEX_DEPLOYMENT_ENV_VAR_NAME} is set`
      });
    }
    const targetDeploymentType = getDeploymentTypeFromConfiguredDeployment(convexDeployment);
    const targetDeploymentName = stripDeploymentTypePrefix(convexDeployment);
    const isAnonymous = isAnonymousDeployment(targetDeploymentName);
    if (isAnonymous) {
      if (!shouldAllowAnonymousDevelopment()) {
        return {
          kind: "unknown"
        };
      }
      return {
        kind: "success",
        metadata: {
          kind: "anonymous",
          deploymentName: targetDeploymentName,
          selectionWithinProject
        }
      };
    }
    const newSelectionWithinProject = selectionWithinProject.kind === "unspecified" && // Fetching local deployment credentials uses the "unspecified" code path
    targetDeploymentType !== "local" ? {
      kind: "deploymentName",
      deploymentName: targetDeploymentName
    } : selectionWithinProject;
    return {
      kind: "success",
      metadata: {
        kind: "deploymentWithinProject",
        targetProject: {
          kind: "deploymentName",
          deploymentName: targetDeploymentName,
          deploymentType: targetDeploymentType
        },
        selectionWithinProject: newSelectionWithinProject
      }
    };
  }
  await checkIfBuildEnvironmentRequiresDeploymentConfig(ctx);
  return { kind: "unknown" };
}
async function checkIfBuildEnvironmentRequiresDeploymentConfig(ctx) {
  const buildEnvironment = getBuildEnvironment();
  if (buildEnvironment) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `${buildEnvironment} build environment detected but no Convex deployment configuration found.
Set one of:
  \u2022 ${CONVEX_DEPLOY_KEY_ENV_VAR_NAME} for Convex Cloud deployments
  \u2022 ${CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} for self-hosted deployments
See https://docs.convex.dev/production/hosting or https://docs.convex.dev/self-hosting`
    });
  }
}
export const deploymentNameFromSelection = (selection) => {
  return deploymentNameAndTypeFromSelection(selection)?.name ?? null;
};
export const deploymentNameAndTypeFromSelection = (selection) => {
  switch (selection.kind) {
    case "existingDeployment": {
      return {
        name: selection.deploymentToActOn.deploymentFields?.deploymentName ?? null,
        type: selection.deploymentToActOn.deploymentFields?.deploymentType ?? null
      };
    }
    case "deploymentWithinProject": {
      return selection.targetProject.kind === "deploymentName" ? {
        name: selection.targetProject.deploymentName,
        type: selection.targetProject.deploymentType
      } : null;
    }
    case "preview": {
      return null;
    }
    case "chooseProject": {
      return null;
    }
    case "anonymous": {
      return null;
    }
    default: {
      selection;
    }
  }
  return null;
};
export const shouldAllowAnonymousDevelopment = () => {
  if (process.env.CONVEX_ALLOW_ANONYMOUS === "false") {
    return false;
  }
  return true;
};
export async function getProjectDetails(ctx, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName": {
      if (projectSelection.deploymentType === "local") {
        const result = await getTeamAndProjectSlugForDeployment(ctx, {
          deploymentName: projectSelection.deploymentName
        });
        if (result === null) {
          return ctx.crash({
            exitCode: 1,
            errorType: "fatal",
            printedMessage: "You don't have access to the selected project. Run `npx convex dev` to select a different project."
          });
        }
        return await getProjectDetails(ctx, {
          kind: "teamAndProjectSlugs",
          teamSlug: result.teamSlug,
          projectSlug: result.projectSlug
        });
      }
      const deployment = (await typedPlatformClient(ctx).GET("/deployments/{deployment_name}", {
        params: {
          path: { deployment_name: projectSelection.deploymentName }
        }
      })).data;
      return (await typedPlatformClient(ctx).GET("/projects/{project_id}", {
        params: { path: { project_id: deployment.projectId } }
      })).data;
    }
    case "teamAndProjectSlugs": {
      return (await typedPlatformClient(ctx).GET(
        "/teams/{team_id_or_slug}/projects/{project_slug}",
        {
          params: {
            path: {
              team_id_or_slug: projectSelection.teamSlug,
              project_slug: projectSelection.projectSlug
            }
          }
        }
      )).data;
    }
    case "projectDeployKey": {
      const result = await fetchTeamAndProjectForKey(
        ctx,
        projectSelection.projectDeployKey
      );
      return (await typedPlatformClient(ctx).GET("/projects/{project_id}", {
        params: { path: { project_id: result.projectId } }
      })).data;
    }
  }
}
//# sourceMappingURL=deploymentSelection.js.map
