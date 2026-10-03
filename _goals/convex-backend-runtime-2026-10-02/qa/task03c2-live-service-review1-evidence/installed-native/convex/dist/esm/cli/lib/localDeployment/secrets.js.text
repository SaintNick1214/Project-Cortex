"use strict";
import { logVerbose } from "../../../bundler/log.js";
import { ensureBackendBinaryDownloaded } from "./download.js";
import { LocalDeploymentError } from "./errors.js";
import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
export const LEGACY_LOCAL_BACKEND_INSTANCE_SECRET = "4361726e697461732c206c69746572616c6c79206d65616e696e6720226c6974";
export async function generateLocalDevSecrets(ctx, {
  deploymentName,
  latestBinaryPath
}) {
  logVerbose("Generating local dev secrets");
  const instanceSecret = generateInstanceSecret();
  let stdout;
  try {
    ({ stdout } = await promisify(execFile)(latestBinaryPath, [
      "keygen",
      "admin-key",
      "--instance-name",
      deploymentName,
      "--instance-secret",
      instanceSecret
    ]));
  } catch (e) {
    const err = e;
    const detail = err.stderr ? err.stderr : err.message;
    const message = `Failed to generate admin key:
${detail}`;
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: message,
      errForSentry: new LocalDeploymentError(message)
    });
  }
  const adminKey = stdout.trim();
  return {
    instanceSecret,
    adminKey
  };
}
function generateInstanceSecret() {
  return crypto.randomBytes(32).toString("hex");
}
export async function generateLocalDevSecretsWithLatestBinary(ctx, {
  deploymentName
}) {
  const { binaryPath: latestBinaryPath } = await ensureBackendBinaryDownloaded(
    ctx,
    {
      kind: "latest"
    }
  );
  return generateLocalDevSecrets(ctx, { deploymentName, latestBinaryPath });
}
//# sourceMappingURL=secrets.js.map
