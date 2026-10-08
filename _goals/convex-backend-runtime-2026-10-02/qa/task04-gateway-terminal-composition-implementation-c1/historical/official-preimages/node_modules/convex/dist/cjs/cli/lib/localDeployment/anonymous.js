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
var anonymous_exports = {};
__export(anonymous_exports, {
  handleAnonymousDeployment: () => handleAnonymousDeployment,
  handleLinkToProject: () => handleLinkToProject,
  listExistingAnonymousDeployments: () => listExistingAnonymousDeployments,
  listLegacyAnonymousDeployments: () => listLegacyAnonymousDeployments,
  loadAnonymousDeployment: () => loadAnonymousDeployment,
  moveDeployment: () => moveDeployment
});
module.exports = __toCommonJS(anonymous_exports);
var import_path = __toESM(require("path"), 1);
var import_log = require("../../../bundler/log.js");
var import_prompts = require("../utils/prompts.js");
var import_bigBrain = require("./bigBrain.js");
var import_errors = require("./errors.js");
var import_filePaths = require("./filePaths.js");
var import_filePaths2 = require("./filePaths.js");
var import_run = require("./run.js");
var import_upgrade = require("./upgrade.js");
var import_utils = require("./utils.js");
var import_fsUtils = require("../fsUtils.js");
var import_download = require("./download.js");
var import_deployment = require("../deployment.js");
var import_api = require("../api.js");
var import_deployment2 = require("../deployment.js");
var import_fs = require("../../../bundler/fs.js");
var import_codegen = require("../codegen.js");
var import_config = require("../config.js");
var import_utils2 = require("../utils/utils.js");
var import_aiFiles = require("../aiFiles/index.js");
var import_secrets = require("./secrets.js");
async function handleAnonymousDeployment(ctx, options) {
  const deployment = await chooseDeployment(ctx, {
    deploymentName: options.deploymentName,
    chosenConfiguration: options.chosenConfiguration
  });
  if (deployment.kind === "first" && process.env.CONVEX_AGENT_MODE !== "anonymous" && process.stdin.isTTY) {
    (0, import_log.logMessage)(
      "This command, `npx convex dev`, will run your Convex backend locally and update it with the function you write in the `convex/` directory."
    );
    (0, import_log.logMessage)(
      "Use `npx convex dashboard` to view and interact with your project from a web UI."
    );
    (0, import_log.logMessage)(
      "Use `npx convex docs` to read the docs and `npx convex help` to see other commands."
    );
    (0, import_filePaths.ensureUuidForAnonymousUser)(ctx);
    if (process.stdin.isTTY) {
      const result = await (0, import_prompts.promptYesNo)(ctx, {
        message: "Continue?",
        default: true
      });
      if (!result) {
        return ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "Exiting"
        });
      }
    }
  }
  ctx.registerCleanup(async (_exitCode, err) => {
    if (err instanceof import_errors.LocalDeploymentError) {
      (0, import_errors.printLocalDeploymentOnError)();
    }
  });
  const { binaryPath, version } = await (0, import_download.ensureBackendBinaryDownloaded)(
    ctx,
    options.backendVersion === void 0 ? {
      kind: "latest"
    } : { kind: "version", version: options.backendVersion }
  );
  const existingCredentials = deployment.kind === "existing" ? {
    adminKey: deployment.config.adminKey,
    instanceSecret: deployment.config.instanceSecret ?? import_secrets.LEGACY_LOCAL_BACKEND_INSTANCE_SECRET
  } : null;
  if (deployment.kind === "existing") {
    await (0, import_run.ensureBackendStopped)(ctx, {
      ports: {
        cloud: deployment.config.ports.cloud
      },
      maxTimeSecs: 5,
      deploymentName: deployment.deploymentName,
      allowOtherDeployments: true
    });
  }
  const { cloudPort, sitePort } = await (0, import_utils.chooseLocalBackendPorts)(ctx, {
    requestedPorts: options.ports,
    suggestedPorts: deployment.kind === "existing" ? deployment.config.ports : void 0
  });
  const { cleanupHandle, adminKey } = await (0, import_upgrade.handlePotentialUpgradeAndStart)(
    ctx,
    {
      deploymentName: deployment.deploymentName,
      deploymentKind: "anonymous",
      oldVersion: deployment.kind === "existing" ? deployment.config.backendVersion : null,
      newBinaryPath: binaryPath,
      newVersion: version,
      ports: { cloud: cloudPort, site: sitePort },
      existingCredentials,
      forceUpgrade: options.forceUpgrade,
      // Anonymous deployments aren't registered against a cloud project.
      cloudProjectId: void 0
    }
  );
  const cleanupFunc = ctx.removeCleanup(cleanupHandle);
  ctx.registerCleanup(async (exitCode, err) => {
    if (cleanupFunc !== null) {
      await cleanupFunc(exitCode, err);
    }
  });
  if (deployment.kind === "new") {
    await (0, import_codegen.doInitConvexFolder)(ctx);
    const { configPath, projectConfig } = await (0, import_config.readProjectConfig)(ctx);
    const convexDir = import_path.default.resolve((0, import_utils2.functionsDir)(configPath, projectConfig));
    const projectDir = import_path.default.resolve(import_path.default.dirname(configPath));
    await (0, import_aiFiles.attemptSetupAiFiles)({
      ctx,
      aiFilesConfig: projectConfig.aiFiles,
      convexDir,
      projectDir
    });
  }
  return {
    adminKey,
    deploymentName: deployment.deploymentName,
    deploymentUrl: (0, import_run.localDeploymentUrl)(cloudPort),
    reference: null,
    isDefault: false
  };
}
async function loadAnonymousDeployment(ctx, deploymentName) {
  const config = (0, import_filePaths.loadDeploymentConfig)(ctx, "anonymous", deploymentName);
  if (config === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Could not find deployment with name ${deploymentName}!`
    });
  }
  return config;
}
function listLegacyAnonymousDeployments(ctx) {
  const deployments = [];
  const dir = (0, import_filePaths2.rootDeploymentStateDir)("anonymous");
  if (ctx.fs.exists(dir)) {
    const deploymentNames = ctx.fs.listDir(dir).map((d) => d.name).filter((d) => (0, import_deployment.isAnonymousDeployment)(d));
    for (const deploymentName of deploymentNames) {
      const legacyDir = (0, import_filePaths.legacyDeploymentStateDir)("anonymous", deploymentName);
      const config = (0, import_filePaths.loadDeploymentConfigFromDir)(ctx, legacyDir);
      if (config !== null) {
        deployments.push({ deploymentName, config });
      }
    }
  }
  return deployments;
}
async function listExistingAnonymousDeployments(ctx) {
  const deployments = [];
  const projectLocal = (0, import_filePaths.loadProjectLocalConfig)(ctx);
  if (projectLocal !== null && (0, import_deployment.isAnonymousDeployment)(projectLocal.deploymentName)) {
    deployments.push(projectLocal);
  }
  for (const legacy of listLegacyAnonymousDeployments(ctx)) {
    if (!deployments.some((d) => d.deploymentName === legacy.deploymentName)) {
      deployments.push(legacy);
    }
  }
  return deployments;
}
async function chooseDeployment(ctx, options) {
  const projectLocal = (0, import_filePaths.loadProjectLocalConfig)(ctx);
  if (projectLocal !== null) {
    if ((0, import_deployment.isAnonymousDeployment)(projectLocal.deploymentName)) {
      return {
        kind: "existing",
        deploymentName: projectLocal.deploymentName,
        config: projectLocal.config
      };
    }
    (0, import_log.logVerbose)(
      `Project-local has ${projectLocal.deploymentName}, switching to anonymous`
    );
    return { deploymentName: generateDeploymentName(), kind: "new" };
  }
  if (options.deploymentName !== null && options.chosenConfiguration === null) {
    const deployments = await listExistingAnonymousDeployments(ctx);
    const existing = deployments.find(
      (d) => d.deploymentName === options.deploymentName
    );
    if (existing === void 0) {
      (0, import_log.logWarning)(`Could not find project with name ${options.deploymentName}!`);
    } else {
      return {
        kind: "existing",
        deploymentName: existing.deploymentName,
        config: existing.config
      };
    }
  }
  if (process.env.CONVEX_AGENT_MODE === "anonymous") {
    const deploymentName = "anonymous-agent";
    (0, import_log.logVerbose)(`Deployment name: ${deploymentName}`);
    return {
      kind: "new",
      deploymentName
    };
  }
  const legacyDeployments = listLegacyAnonymousDeployments(ctx);
  if (legacyDeployments.length === 0) {
    (0, import_log.logMessage)("Setting up a new project...");
    return { deploymentName: generateDeploymentName(), kind: "first" };
  }
  if (options.chosenConfiguration === "new") {
    return { deploymentName: generateDeploymentName(), kind: "new" };
  }
  if (!process.stdin.isTTY) {
    return { deploymentName: generateDeploymentName(), kind: "new" };
  }
  const newOrExisting = await (0, import_prompts.promptSearch)(ctx, {
    message: "Which project would you like to use?",
    choices: [
      ...options.chosenConfiguration === "existing" ? [] : [
        {
          name: "Create a new one",
          value: "new"
        }
      ],
      ...legacyDeployments.map((d) => ({
        name: d.deploymentName,
        value: d.deploymentName
      }))
    ]
  });
  if (newOrExisting !== "new") {
    const existingDeployment = legacyDeployments.find(
      (d) => d.deploymentName === newOrExisting
    );
    if (existingDeployment === void 0) {
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Could not find project with name ${newOrExisting}!`
      });
    }
    return {
      kind: "existing",
      deploymentName: existingDeployment.deploymentName,
      config: existingDeployment.config
    };
  }
  return { deploymentName: generateDeploymentName(), kind: "new" };
}
function generateDeploymentName() {
  const baseName = import_path.default.basename(process.cwd());
  const deploymentName = `anonymous-${baseName}`;
  (0, import_log.logVerbose)(`Deployment name: ${deploymentName}`);
  return deploymentName;
}
async function handleLinkToProject(ctx, args) {
  (0, import_log.logVerbose)(
    `Linking ${args.deploymentName} to a project in team ${args.teamSlug}`
  );
  const config = (0, import_filePaths.loadDeploymentConfig)(ctx, "anonymous", args.deploymentName);
  if (config === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Failed to load deployment config - try running `npx convex dev --configure`"
    });
  }
  await (0, import_run.ensureBackendStopped)(ctx, {
    ports: {
      cloud: config.ports.cloud
    },
    deploymentName: args.deploymentName,
    allowOtherDeployments: true,
    maxTimeSecs: 5
  });
  const projectName = (0, import_deployment2.removeAnonymousPrefix)(args.deploymentName);
  let projectSlug;
  if (args.projectSlug !== null) {
    projectSlug = args.projectSlug;
  } else {
    const { projectSlug: newProjectSlug } = await (0, import_api.createProject)(ctx, {
      teamId: args.teamId,
      projectName,
      deploymentToProvision: null
    });
    projectSlug = newProjectSlug;
  }
  (0, import_log.logVerbose)(`Creating local deployment in project ${projectSlug}`);
  const { deploymentName: localDeploymentName, projectId } = await (0, import_bigBrain.bigBrainStart)(ctx, {
    port: config.ports.cloud,
    projectSlug,
    teamSlug: args.teamSlug,
    instanceName: null
  });
  const { instanceSecret, adminKey } = await (0, import_secrets.generateLocalDevSecretsWithLatestBinary)(ctx, {
    deploymentName: localDeploymentName
  });
  const localConfig = (0, import_filePaths.loadDeploymentConfig)(ctx, "local", localDeploymentName);
  if (localConfig !== null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Project ${projectSlug} already has a local deployment, so we cannot link this anonymous local deployment to it.`
    });
  }
  (0, import_log.logVerbose)(`Moving ${args.deploymentName} to ${localDeploymentName}`);
  await moveDeployment(
    ctx,
    {
      deploymentKind: "anonymous",
      deploymentName: args.deploymentName
    },
    {
      deploymentKind: "local",
      deploymentName: localDeploymentName
    }
  );
  (0, import_log.logVerbose)(`Saving deployment config for ${localDeploymentName}`);
  (0, import_filePaths.saveDeploymentConfig)(ctx, "local", localDeploymentName, {
    instanceSecret,
    adminKey,
    backendVersion: config.backendVersion,
    ports: config.ports,
    cloudProjectId: projectId
  });
  await (0, import_bigBrain.bigBrainPause)(ctx, {
    projectSlug,
    teamSlug: args.teamSlug
  });
  (0, import_log.logFinishedStep)(`Linked ${args.deploymentName} to project ${projectSlug}`);
  return {
    projectSlug,
    deploymentName: localDeploymentName,
    deploymentUrl: (0, import_run.localDeploymentUrl)(config.ports.cloud)
  };
}
async function moveDeployment(ctx, oldDeployment, newDeployment) {
  const oldPath = (0, import_filePaths.deploymentStateDir)(
    ctx,
    oldDeployment.deploymentKind,
    oldDeployment.deploymentName
  );
  const newPath = (0, import_filePaths.deploymentStateDir)(
    ctx,
    newDeployment.deploymentKind,
    newDeployment.deploymentName
  );
  if (oldPath === newPath) {
    (0, import_log.logVerbose)(
      `Source and destination are the same (${oldPath}), skipping file copy`
    );
    return;
  }
  await (0, import_fsUtils.recursivelyCopy)(ctx, import_fs.nodeFs, oldPath, newPath);
  (0, import_fsUtils.recursivelyDelete)(ctx, oldPath);
}
//# sourceMappingURL=anonymous.js.map
