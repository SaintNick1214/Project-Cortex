"use strict";
import {
  logFinishedStep,
  logVerbose,
  logWarning
} from "../../../bundler/log.js";
import {
  saveDeploymentConfig
} from "./filePaths.js";
import { runLocalBackend } from "./run.js";
import { releaseDate } from "./utils.js";
import { promptYesNo } from "../utils/prompts.js";
import { ensureBackendBinaryDownloaded } from "./download.js";
import {
  generateLocalDevSecretsWithLatestBinary,
  LEGACY_LOCAL_BACKEND_INSTANCE_SECRET
} from "./secrets.js";
export async function handlePotentialUpgradeAndStart(ctx, args) {
  const { adminKey, instanceSecret } = args.existingCredentials === null || args.existingCredentials.instanceSecret === LEGACY_LOCAL_BACKEND_INSTANCE_SECRET ? (
    // Using `generateLocalDevSecretsFromLatestBinary` instead of `generateLocalDevSecrets`
    // here, because `newBinaryPath` can be a binary that doesn’t support
    // the `keygen admin-key` subcommand (when the --local-backend-version flag is provided to the CLI)
    //
    // In most cases (the user is not using the flag), we have already downloaded the latest binary
    // shortly before in handleLocalDeployment/handleAnonymousDeployment, so this doesn’t cause an
    // extra download (even if the user chooses later not to upgrade their deployment)
    await generateLocalDevSecretsWithLatestBinary(ctx, {
      deploymentName: args.deploymentName
    })
  ) : args.existingCredentials;
  const newConfig = {
    ports: args.ports,
    backendVersion: args.newVersion,
    adminKey,
    instanceSecret,
    cloudProjectId: args.cloudProjectId
  };
  if (args.oldVersion === null || args.oldVersion === args.newVersion) {
    saveDeploymentConfig(
      ctx,
      args.deploymentKind,
      args.deploymentName,
      newConfig
    );
    const { cleanupHandle: cleanupHandle2 } = await runLocalBackend(ctx, {
      binaryPath: args.newBinaryPath,
      backendVersion: args.newVersion,
      deploymentKind: args.deploymentKind,
      deploymentName: args.deploymentName,
      ports: args.ports,
      instanceSecret,
      isLatestVersion: true
    });
    return { cleanupHandle: cleanupHandle2, adminKey };
  }
  logVerbose(
    `Considering upgrade from ${args.oldVersion} to ${args.newVersion}`
  );
  const confirmed = args.forceUpgrade || !process.stdin.isTTY || await promptYesNo(ctx, {
    message: `This deployment is using an older version of the Convex backend. Upgrade now?`,
    default: true
  });
  if (!confirmed) {
    const { binaryPath: oldBinaryPath } = await ensureBackendBinaryDownloaded(
      ctx,
      {
        kind: "version",
        version: args.oldVersion
      }
    );
    saveDeploymentConfig(ctx, args.deploymentKind, args.deploymentName, {
      ...newConfig,
      backendVersion: args.oldVersion
    });
    const { cleanupHandle: cleanupHandle2 } = await runLocalBackend(ctx, {
      binaryPath: oldBinaryPath,
      backendVersion: args.oldVersion,
      ports: args.ports,
      deploymentKind: args.deploymentKind,
      deploymentName: args.deploymentName,
      instanceSecret,
      isLatestVersion: false
    });
    return { cleanupHandle: cleanupHandle2, adminKey };
  }
  const { cleanupHandle } = await handleUpgrade(ctx, {
    deploymentKind: args.deploymentKind,
    deploymentName: args.deploymentName,
    oldVersion: args.oldVersion,
    newBinaryPath: args.newBinaryPath,
    newVersion: args.newVersion,
    ports: args.ports,
    adminKey,
    instanceSecret,
    cloudProjectId: args.cloudProjectId
  });
  return { cleanupHandle, adminKey };
}
async function handleUpgrade(ctx, args) {
  const isDowngrade = _isDowngrade(args.oldVersion, args.newVersion);
  if (isDowngrade) {
    logWarning(
      `Moving a local deployment back to an older backend version (${args.oldVersion} \u2192 ${args.newVersion}) isn't supported: the older backend may not be able to read data written by the newer one. If it fails to start, delete the deployment's state directory to start fresh on this version.`
    );
  }
  logVerbose(`Running backend on new version ${args.newVersion}`);
  const { cleanupHandle } = await runLocalBackend(ctx, {
    binaryPath: args.newBinaryPath,
    backendVersion: args.newVersion,
    ports: args.ports,
    deploymentKind: args.deploymentKind,
    deploymentName: args.deploymentName,
    instanceSecret: args.instanceSecret,
    isLatestVersion: true
  });
  logFinishedStep(
    `Successfully ${isDowngrade ? "moved" : "upgraded"} to backend version ${args.newVersion}`
  );
  saveDeploymentConfig(ctx, args.deploymentKind, args.deploymentName, {
    ports: args.ports,
    backendVersion: args.newVersion,
    adminKey: args.adminKey,
    instanceSecret: args.instanceSecret,
    cloudProjectId: args.cloudProjectId
  });
  return { cleanupHandle };
}
export function _isDowngrade(oldVersion, newVersion) {
  const oldDate = releaseDate(oldVersion);
  const newDate = releaseDate(newVersion);
  return oldDate !== null && newDate !== null && newDate < oldDate;
}
//# sourceMappingURL=upgrade.js.map
