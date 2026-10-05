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
var localDeployment_exports = {};
__export(localDeployment_exports, {
  handleLocalDeployment: () => handleLocalDeployment,
  importDefaultEnvVars: () => importDefaultEnvVars,
  loadLocalDeploymentCredentials: () => loadLocalDeploymentCredentials
});
module.exports = __toCommonJS(localDeployment_exports);
var import_log = require("../../../bundler/log.js");
var import_utils = require("../utils/utils.js");
var import_bigBrain = require("./bigBrain.js");
var import_filePaths = require("./filePaths.js");
var import_run = require("./run.js");
var import_upgrade = require("./upgrade.js");
var import_errors = require("./errors.js");
var import_utils2 = require("./utils.js");
var import_download = require("./download.js");
var import_defaultEnv = require("../defaultEnv.js");
var import_env = require("../env.js");
var import_deploymentSelection = require("../deploymentSelection.js");
var import_secrets = require("./secrets.js");
async function handleLocalDeployment(ctx, options) {
  const existingDeploymentForProject = await getExistingDeployment(ctx, {
    projectSlug: options.projectSlug,
    teamSlug: options.teamSlug
  });
  const isFirstTime = existingDeploymentForProject === null;
  if (isFirstTime) {
    (0, import_utils2.printLocalDeploymentWelcomeMessage)();
  }
  ctx.registerCleanup(async (_exitCode, err) => {
    if (err instanceof import_errors.LocalDeploymentError) {
      (0, import_errors.printLocalDeploymentOnError)();
    }
  });
  if (existingDeploymentForProject !== null) {
    (0, import_log.logVerbose)(`Found existing deployment for project ${options.projectSlug}`);
    await (0, import_run.ensureBackendStopped)(ctx, {
      ports: {
        cloud: existingDeploymentForProject.config.ports.cloud
      },
      maxTimeSecs: 5,
      deploymentName: existingDeploymentForProject.deploymentName,
      allowOtherDeployments: true
    });
  }
  const { binaryPath, version } = await (0, import_download.ensureBackendBinaryDownloaded)(
    ctx,
    options.backendVersion === void 0 ? {
      kind: "latest",
      allowedVersion: existingDeploymentForProject?.config.backendVersion
    } : { kind: "version", version: options.backendVersion }
  );
  const { cloudPort, sitePort } = await (0, import_utils2.chooseLocalBackendPorts)(ctx, {
    requestedPorts: options.ports,
    suggestedPorts: existingDeploymentForProject?.config.ports
  });
  const { deploymentName, projectId } = await (0, import_bigBrain.bigBrainStart)(ctx, {
    port: cloudPort,
    projectSlug: options.projectSlug,
    teamSlug: options.teamSlug,
    instanceName: existingDeploymentForProject?.deploymentName ?? null
  });
  const { cleanupHandle, adminKey } = await (0, import_upgrade.handlePotentialUpgradeAndStart)(
    ctx,
    {
      deploymentKind: "local",
      deploymentName,
      oldVersion: existingDeploymentForProject?.config.backendVersion ?? null,
      newBinaryPath: binaryPath,
      newVersion: version,
      ports: { cloud: cloudPort, site: sitePort },
      existingCredentials: existingDeploymentForProject?.config ? {
        adminKey: existingDeploymentForProject?.config.adminKey,
        instanceSecret: existingDeploymentForProject?.config.instanceSecret ?? import_secrets.LEGACY_LOCAL_BACKEND_INSTANCE_SECRET
      } : null,
      forceUpgrade: options.forceUpgrade,
      cloudProjectId: projectId
    }
  );
  if (isFirstTime) {
    await importDefaultEnvVars(ctx, {
      teamSlug: options.teamSlug,
      projectSlug: options.projectSlug,
      deploymentName,
      deploymentUrl: (0, import_run.localDeploymentUrl)(cloudPort),
      adminKey
    });
  }
  let activityTimeout = null;
  let activityPingStopped = false;
  async function activityPing() {
    if (activityPingStopped) {
      return;
    }
    try {
      await (0, import_bigBrain.bigBrainRecordActivity)(ctx, {
        instanceName: deploymentName,
        adminKey
      });
    } catch {
    }
    if (activityPingStopped) {
      return;
    }
    activityTimeout = setTimeout(async () => {
      void activityPing();
    }, 6e4);
  }
  void activityPing();
  const cleanupFunc = ctx.removeCleanup(cleanupHandle);
  ctx.registerCleanup(async (exitCode, err) => {
    activityPingStopped = true;
    if (activityTimeout !== null) {
      clearTimeout(activityTimeout);
    }
    if (cleanupFunc !== null) {
      await cleanupFunc(exitCode, err);
    }
    await (0, import_bigBrain.bigBrainPause)(ctx, {
      projectSlug: options.projectSlug,
      teamSlug: options.teamSlug
    });
  });
  return {
    adminKey,
    deploymentName,
    deploymentUrl: (0, import_run.localDeploymentUrl)(cloudPort),
    reference: null,
    isDefault: false
  };
}
async function loadLocalDeploymentCredentials(ctx, deploymentName) {
  const config = (0, import_filePaths.loadDeploymentConfig)(ctx, "local", deploymentName);
  if (config === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Failed to load deployment config - try running `npx convex dev --configure`"
    });
  }
  return {
    deploymentName,
    deploymentUrl: (0, import_run.localDeploymentUrl)(config.ports.cloud),
    adminKey: config.adminKey
  };
}
async function getExistingDeployment(ctx, options) {
  const { projectSlug, teamSlug } = options;
  const projectLocal = (0, import_filePaths.loadProjectLocalConfig)(ctx);
  if (projectLocal !== null) {
    const expectedPrefix = `local-${teamSlug.replace(/-/g, "_")}-${projectSlug.replace(/-/g, "_")}`;
    if (projectLocal.deploymentName.startsWith(expectedPrefix)) {
      return projectLocal;
    }
    (0, import_log.logVerbose)(
      `Project-local deployment ${projectLocal.deploymentName} doesn't match expected prefix ${expectedPrefix}`
    );
  }
  const prefix = `local-${teamSlug.replace(/-/g, "_")}-${projectSlug.replace(/-/g, "_")}`;
  const legacyDeployments = await getLegacyLocalDeployments(ctx);
  const existingDeploymentForProject = legacyDeployments.find(
    (d) => d.deploymentName.startsWith(prefix)
  );
  if (existingDeploymentForProject === void 0) {
    return null;
  }
  return {
    deploymentName: existingDeploymentForProject.deploymentName,
    config: existingDeploymentForProject.config
  };
}
async function getLegacyLocalDeployments(ctx) {
  const dir = (0, import_filePaths.rootDeploymentStateDir)("local");
  if (!ctx.fs.exists(dir)) {
    return [];
  }
  const deploymentNames = ctx.fs.listDir(dir).map((d) => d.name).filter((d) => d.startsWith("local-"));
  return deploymentNames.flatMap((deploymentName) => {
    const legacyDir = (0, import_filePaths.legacyDeploymentStateDir)("local", deploymentName);
    const config = (0, import_filePaths.loadDeploymentConfigFromDir)(ctx, legacyDir);
    if (config !== null) {
      return [{ deploymentName, config }];
    }
    return [];
  });
}
async function importDefaultEnvVars(ctx, {
  teamSlug,
  projectSlug,
  deploymentName,
  deploymentUrl,
  adminKey
}) {
  (0, import_log.showSpinner)("Importing default env vars...");
  const project = await (0, import_deploymentSelection.getProjectDetails)(ctx, {
    kind: "teamAndProjectSlugs",
    teamSlug,
    projectSlug
  });
  let defaults;
  try {
    defaults = await (0, import_defaultEnv.defaultEnvBackend)(ctx, project.id, "dev").list();
  } catch (err) {
    if (err instanceof import_utils.ThrowingFetchError && err.response.status === 403) {
      (0, import_log.stopSpinner)();
      (0, import_log.logWarning)(
        `Skipping default env var import: ${err.serverErrorData?.message ?? err.message}`
      );
      return;
    }
    return await (0, import_utils.logAndHandleFetchError)(ctx, err);
  }
  if (defaults.length === 0) {
    (0, import_log.logFinishedStep)("No default env vars to import.");
    return;
  }
  const deployment = {
    deploymentUrl,
    deploymentFields: {
      deploymentName,
      deploymentType: "local",
      projectSlug,
      teamSlug,
      reference: null,
      isDefault: false
    }
  };
  await (0, import_run.withRunningBackend)({
    ctx,
    deployment,
    action: async () => {
      await (0, import_env.deploymentEnvBackend)(ctx, { deploymentUrl, adminKey }).update(
        defaults.map((v) => ({ name: v.name, value: v.value }))
      );
      (0, import_log.logFinishedStep)(
        `Imported ${defaults.length} environment ${defaults.length === 1 ? "variable" : "variables"} from default environment variables: ${defaults.map((v) => v.name).join(", ")}`
      );
    }
  });
}
//# sourceMappingURL=localDeployment.js.map
