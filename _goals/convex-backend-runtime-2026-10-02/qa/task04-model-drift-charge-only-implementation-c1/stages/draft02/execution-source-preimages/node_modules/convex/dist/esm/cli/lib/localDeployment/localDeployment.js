"use strict";
import {
  logFinishedStep,
  logVerbose,
  logWarning,
  showSpinner,
  stopSpinner
} from "../../../bundler/log.js";
import { logAndHandleFetchError, ThrowingFetchError } from "../utils/utils.js";
import {
  bigBrainPause,
  bigBrainRecordActivity,
  bigBrainStart
} from "./bigBrain.js";
import {
  loadDeploymentConfig,
  loadDeploymentConfigFromDir,
  loadProjectLocalConfig,
  legacyDeploymentStateDir,
  rootDeploymentStateDir
} from "./filePaths.js";
import {
  ensureBackendStopped,
  localDeploymentUrl,
  withRunningBackend
} from "./run.js";
import { handlePotentialUpgradeAndStart } from "./upgrade.js";
import { LocalDeploymentError, printLocalDeploymentOnError } from "./errors.js";
import {
  chooseLocalBackendPorts,
  printLocalDeploymentWelcomeMessage
} from "./utils.js";
import { ensureBackendBinaryDownloaded } from "./download.js";
import { defaultEnvBackend } from "../defaultEnv.js";
import { deploymentEnvBackend } from "../env.js";
import { getProjectDetails } from "../deploymentSelection.js";
import { LEGACY_LOCAL_BACKEND_INSTANCE_SECRET } from "./secrets.js";
export async function handleLocalDeployment(ctx, options) {
  const existingDeploymentForProject = await getExistingDeployment(ctx, {
    projectSlug: options.projectSlug,
    teamSlug: options.teamSlug
  });
  const isFirstTime = existingDeploymentForProject === null;
  if (isFirstTime) {
    printLocalDeploymentWelcomeMessage();
  }
  ctx.registerCleanup(async (_exitCode, err) => {
    if (err instanceof LocalDeploymentError) {
      printLocalDeploymentOnError();
    }
  });
  if (existingDeploymentForProject !== null) {
    logVerbose(`Found existing deployment for project ${options.projectSlug}`);
    await ensureBackendStopped(ctx, {
      ports: {
        cloud: existingDeploymentForProject.config.ports.cloud
      },
      maxTimeSecs: 5,
      deploymentName: existingDeploymentForProject.deploymentName,
      allowOtherDeployments: true
    });
  }
  const { binaryPath, version } = await ensureBackendBinaryDownloaded(
    ctx,
    options.backendVersion === void 0 ? {
      kind: "latest",
      allowedVersion: existingDeploymentForProject?.config.backendVersion
    } : { kind: "version", version: options.backendVersion }
  );
  const { cloudPort, sitePort } = await chooseLocalBackendPorts(ctx, {
    requestedPorts: options.ports,
    suggestedPorts: existingDeploymentForProject?.config.ports
  });
  const { deploymentName, projectId } = await bigBrainStart(ctx, {
    port: cloudPort,
    projectSlug: options.projectSlug,
    teamSlug: options.teamSlug,
    instanceName: existingDeploymentForProject?.deploymentName ?? null
  });
  const { cleanupHandle, adminKey } = await handlePotentialUpgradeAndStart(
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
        instanceSecret: existingDeploymentForProject?.config.instanceSecret ?? LEGACY_LOCAL_BACKEND_INSTANCE_SECRET
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
      deploymentUrl: localDeploymentUrl(cloudPort),
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
      await bigBrainRecordActivity(ctx, {
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
    await bigBrainPause(ctx, {
      projectSlug: options.projectSlug,
      teamSlug: options.teamSlug
    });
  });
  return {
    adminKey,
    deploymentName,
    deploymentUrl: localDeploymentUrl(cloudPort),
    reference: null,
    isDefault: false
  };
}
export async function loadLocalDeploymentCredentials(ctx, deploymentName) {
  const config = loadDeploymentConfig(ctx, "local", deploymentName);
  if (config === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Failed to load deployment config - try running `npx convex dev --configure`"
    });
  }
  return {
    deploymentName,
    deploymentUrl: localDeploymentUrl(config.ports.cloud),
    adminKey: config.adminKey
  };
}
async function getExistingDeployment(ctx, options) {
  const { projectSlug, teamSlug } = options;
  const projectLocal = loadProjectLocalConfig(ctx);
  if (projectLocal !== null) {
    const expectedPrefix = `local-${teamSlug.replace(/-/g, "_")}-${projectSlug.replace(/-/g, "_")}`;
    if (projectLocal.deploymentName.startsWith(expectedPrefix)) {
      return projectLocal;
    }
    logVerbose(
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
  const dir = rootDeploymentStateDir("local");
  if (!ctx.fs.exists(dir)) {
    return [];
  }
  const deploymentNames = ctx.fs.listDir(dir).map((d) => d.name).filter((d) => d.startsWith("local-"));
  return deploymentNames.flatMap((deploymentName) => {
    const legacyDir = legacyDeploymentStateDir("local", deploymentName);
    const config = loadDeploymentConfigFromDir(ctx, legacyDir);
    if (config !== null) {
      return [{ deploymentName, config }];
    }
    return [];
  });
}
export async function importDefaultEnvVars(ctx, {
  teamSlug,
  projectSlug,
  deploymentName,
  deploymentUrl,
  adminKey
}) {
  showSpinner("Importing default env vars...");
  const project = await getProjectDetails(ctx, {
    kind: "teamAndProjectSlugs",
    teamSlug,
    projectSlug
  });
  let defaults;
  try {
    defaults = await defaultEnvBackend(ctx, project.id, "dev").list();
  } catch (err) {
    if (err instanceof ThrowingFetchError && err.response.status === 403) {
      stopSpinner();
      logWarning(
        `Skipping default env var import: ${err.serverErrorData?.message ?? err.message}`
      );
      return;
    }
    return await logAndHandleFetchError(ctx, err);
  }
  if (defaults.length === 0) {
    logFinishedStep("No default env vars to import.");
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
  await withRunningBackend({
    ctx,
    deployment,
    action: async () => {
      await deploymentEnvBackend(ctx, { deploymentUrl, adminKey }).update(
        defaults.map((v) => ({ name: v.name, value: v.value }))
      );
      logFinishedStep(
        `Imported ${defaults.length} environment ${defaults.length === 1 ? "variable" : "variables"} from default environment variables: ${defaults.map((v) => v.name).join(", ")}`
      );
    }
  });
}
//# sourceMappingURL=localDeployment.js.map
