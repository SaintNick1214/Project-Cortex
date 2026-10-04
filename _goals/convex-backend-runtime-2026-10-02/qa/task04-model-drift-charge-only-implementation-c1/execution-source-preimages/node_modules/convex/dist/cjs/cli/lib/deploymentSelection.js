"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var deploymentSelection_exports = {};
__export(deploymentSelection_exports, {
  clearBigBrainAuth: () => clearBigBrainAuth,
  deploymentNameAndTypeFromSelection: () => deploymentNameAndTypeFromSelection,
  deploymentNameFromSelection: () => deploymentNameFromSelection,
  ensureAuthCanCreateDeployment: () => ensureAuthCanCreateDeployment,
  ensureLoggedInWithAccessToken: () => ensureLoggedInWithAccessToken,
  getDeploymentSelection: () => getDeploymentSelection,
  getProjectDetails: () => getProjectDetails,
  initializeBigBrainAuth: () => initializeBigBrainAuth,
  shouldAllowAnonymousDevelopment: () => shouldAllowAnonymousDevelopment,
  updateBigBrainAuthAfterLogin: () => updateBigBrainAuthAfterLogin
});
module.exports = __toCommonJS(deploymentSelection_exports);
var import_log = require("../../bundler/log.js");
var import_api = require("./api.js");
var import_deployment = require("./deployment.js");
var import_deploymentSelector = require("./deploymentSelector.js");
var import_filePaths = require("./localDeployment/filePaths.js");
var import_projectMismatch = require("./localDeployment/projectMismatch.js");
var import_chalk = require("chalk");
var import_envvars = require("./envvars.js");
var import_globalConfig = require("./utils/globalConfig.js");
var import_utils = require("./utils/utils.js");
var dotenv = __toESM(require("dotenv"), 1);
async function initializeBigBrainAuth(ctx, initialArgs) {
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
    const rawDeployKey2 = (0, import_utils.readDeployKeyFromEnv)((name) => config[name]);
    const deployKey2 = await (0, import_utils.processDeployKeyValue)(ctx, rawDeployKey2);
    if (deployKey2 !== void 0) {
      const bigBrainAuth = getBigBrainAuth(ctx, {
        previewDeployKey: (0, import_deployment.isPreviewDeployKey)(deployKey2) ? deployKey2 : null,
        projectKey: (0, import_deployment.isProjectKey)(deployKey2) ? deployKey2 : null,
        deploymentKey: (0, import_deployment.isDeploymentKey)(deployKey2) ? deployKey2 : null
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
  dotenv.config({ path: import_utils.ENV_VAR_FILE_PATH });
  dotenv.config();
  const rawDeployKey = (0, import_utils.readDeployKeyFromEnv)((name) => process.env[name]);
  const deployKey = await (0, import_utils.processDeployKeyValue)(ctx, rawDeployKey);
  if (deployKey !== void 0) {
    const bigBrainAuth = getBigBrainAuth(ctx, {
      previewDeployKey: (0, import_deployment.isPreviewDeployKey)(deployKey) ? deployKey : null,
      projectKey: (0, import_deployment.isProjectKey)(deployKey) ? deployKey : null,
      deploymentKey: (0, import_deployment.isDeploymentKey)(deployKey) ? deployKey : null
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
async function updateBigBrainAuthAfterLogin(ctx, accessToken) {
  const existingAuth = ctx.bigBrainAuth();
  if (existingAuth !== null && existingAuth.kind === "projectKey") {
    (0, import_log.logVerbose)(
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
async function clearBigBrainAuth(ctx) {
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
  const globalConfig = (0, import_globalConfig.readGlobalConfig)(ctx);
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
async function ensureLoggedInWithAccessToken(ctx, action) {
  const auth = ctx.bigBrainAuth();
  if (auth !== null && auth.kind === "accessToken") {
    return;
  }
  const prefix = auth === null ? "Run " : process.env[import_utils.CONVEX_DEPLOYMENT_TOKEN_ENV_VAR_NAME] && !process.env[import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME] ? `Unset ${import_utils.CONVEX_DEPLOYMENT_TOKEN_ENV_VAR_NAME} and run ` : `Unset ${import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME} and run `;
  return await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: `${action} requires being logged in with a personal access token. ${prefix}${import_chalk.chalkStderr.bold(
      "npx convex login"
    )} and try again.`
  });
}
async function ensureAuthCanCreateDeployment(ctx) {
  const auth = ctx.bigBrainAuth();
  if (auth !== null && (auth.kind === "accessToken" || auth.kind === "projectKey")) {
    return;
  }
  if (auth === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Creating a deployment requires logging in. Run ${import_chalk.chalkStderr.bold(
        "npx convex login"
      )} and try again.`
    });
  }
  const envVar = process.env[import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME] ? import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME : import_utils.CONVEX_DEPLOYMENT_TOKEN_ENV_VAR_NAME;
  return await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: `Creating a deployment isn't supported with a deploy key (${envVar}). Run ${import_chalk.chalkStderr.bold(
      "npx convex login"
    )} (or use a project key) and try again.`
  });
}
async function getDeploymentSelection(ctx, cliArgs) {
  const metadata = await _getDeploymentSelection(ctx, cliArgs);
  if (metadata.kind === "existingDeployment") {
    const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(cliArgs);
    await (0, import_api.validateDeploymentSelectionForExistingDeployment)(
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
      (0, import_log.logVerbose)(
        `Existing deployment: ${selection.deploymentToActOn.url} ${selection.deploymentToActOn.source}`
      );
      break;
    }
    case "deploymentWithinProject": {
      (0, import_log.logVerbose)(
        `Deployment within project: ${prettyProjectSelection(selection.targetProject)}`
      );
      break;
    }
    case "preview": {
      (0, import_log.logVerbose)(`Preview deploy key`);
      break;
    }
    case "chooseProject": {
      (0, import_log.logVerbose)(`Choose project`);
      break;
    }
    case "anonymous": {
      (0, import_log.logVerbose)(
        `Anonymous, has selected deployment?: ${selection.deploymentName !== null}`
      );
      break;
    }
    default: {
      selection;
      (0, import_log.logVerbose)(`Unknown deployment selection`);
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
  const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(cliArgs);
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
    const parsed = (0, import_deploymentSelector.parseDeploymentSelector)(cliArgs.deployment);
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
    const parsed = (0, import_deploymentSelector.parseDeploymentSelector)(cliArgs.deployment);
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
    (0, import_log.logVerbose)(`Checking env file: ${cliArgs.envFile}`);
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
        printedMessage: `env file \`${cliArgs.envFile}\` did not contain environment variables for a Convex deployment. Expected \`${import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME}\`, \`${import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME}\`, or both \`${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME}\` and \`${import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME}\` to be set.`
      });
    }
    return result2.metadata;
  }
  dotenv.config({ path: import_utils.ENV_VAR_FILE_PATH });
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
  const localConfig = (0, import_filePaths.loadProjectLocalConfig)(ctx);
  if (localConfig === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No local deployment found. Run ${import_chalk.chalkStderr.bold("npx convex deployment create local")} to create one.`
    });
  }
  if (localConfig.config.cloudProjectId !== void 0) {
    const target = await (0, import_projectMismatch.targetProjectForLocalSelector)(
      ctx,
      parsed,
      currentSelection ?? { kind: "chooseProject", selectionWithinProject }
    );
    if (target !== null) {
      const match = (0, import_projectMismatch.checkLocalConfigMatchesProject)(
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
${import_chalk.chalkStderr.dim(`${import_chalk.chalkStderr.bold("Hint")}: If you want to move the local deployment to this project, run ${import_chalk.chalkStderr.bold(`npx convex deployment select ${newSelector}`)}`)}`
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
  const rawDeployKey = (0, import_utils.readDeployKeyFromEnv)(getEnv);
  const deployKey = await (0, import_utils.processDeployKeyValue)(ctx, rawDeployKey);
  if (deployKey !== void 0) {
    const deployKeyType = (0, import_deployment.isPreviewDeployKey)(deployKey) ? "preview" : (0, import_deployment.isProjectKey)(deployKey) ? "project" : "deployment";
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
        const deploymentName = await (0, import_deployment.deploymentNameFromAdminKeyOrCrash)(
          ctx,
          deployKey
        );
        const deploymentType = (0, import_deployment.deploymentTypeFromAdminKey)(deployKey);
        const url = await (0, import_utils.bigBrainAPI)({
          ctx,
          method: "POST",
          path: "deployment/url_for_key",
          data: {
            deployKey
          }
        });
        const slugs = await (0, import_api.fetchTeamAndProjectForKey)(ctx, deployKey);
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
  const convexDeployment = getEnv(import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME);
  const selfHostedUrl = getEnv(import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME);
  const selfHostedAdminKey = getEnv(import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME);
  if (selfHostedUrl !== null && selfHostedAdminKey !== null) {
    if (convexDeployment !== null) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: `${import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME} must not be set when ${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} are set`
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
        printedMessage: `${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} must not be set when ${import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME} is set`
      });
    }
    const targetDeploymentType = (0, import_deployment.getDeploymentTypeFromConfiguredDeployment)(convexDeployment);
    const targetDeploymentName = (0, import_deployment.stripDeploymentTypePrefix)(convexDeployment);
    const isAnonymous = (0, import_deployment.isAnonymousDeployment)(targetDeploymentName);
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
  const buildEnvironment = (0, import_envvars.getBuildEnvironment)();
  if (buildEnvironment) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `${buildEnvironment} build environment detected but no Convex deployment configuration found.
Set one of:
  \u2022 ${import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME} for Convex Cloud deployments
  \u2022 ${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} for self-hosted deployments
See https://docs.convex.dev/production/hosting or https://docs.convex.dev/self-hosting`
    });
  }
}
const deploymentNameFromSelection = (selection) => {
  return deploymentNameAndTypeFromSelection(selection)?.name ?? null;
};
const deploymentNameAndTypeFromSelection = (selection) => {
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
const shouldAllowAnonymousDevelopment = () => {
  if (process.env.CONVEX_ALLOW_ANONYMOUS === "false") {
    return false;
  }
  return true;
};
async function getProjectDetails(ctx, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName": {
      if (projectSelection.deploymentType === "local") {
        const result = await (0, import_api.getTeamAndProjectSlugForDeployment)(ctx, {
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
      const deployment = (await (0, import_utils.typedPlatformClient)(ctx).GET("/deployments/{deployment_name}", {
        params: {
          path: { deployment_name: projectSelection.deploymentName }
        }
      })).data;
      return (await (0, import_utils.typedPlatformClient)(ctx).GET("/projects/{project_id}", {
        params: { path: { project_id: deployment.projectId } }
      })).data;
    }
    case "teamAndProjectSlugs": {
      return (await (0, import_utils.typedPlatformClient)(ctx).GET(
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
      const result = await (0, import_api.fetchTeamAndProjectForKey)(
        ctx,
        projectSelection.projectDeployKey
      );
      return (await (0, import_utils.typedPlatformClient)(ctx).GET("/projects/{project_id}", {
        params: { path: { project_id: result.projectId } }
      })).data;
    }
  }
}
//# sourceMappingURL=deploymentSelection.js.map
