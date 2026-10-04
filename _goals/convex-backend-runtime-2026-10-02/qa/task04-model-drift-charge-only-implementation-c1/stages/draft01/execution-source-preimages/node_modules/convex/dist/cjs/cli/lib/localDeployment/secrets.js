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
var secrets_exports = {};
__export(secrets_exports, {
  LEGACY_LOCAL_BACKEND_INSTANCE_SECRET: () => LEGACY_LOCAL_BACKEND_INSTANCE_SECRET,
  generateLocalDevSecrets: () => generateLocalDevSecrets,
  generateLocalDevSecretsWithLatestBinary: () => generateLocalDevSecretsWithLatestBinary
});
module.exports = __toCommonJS(secrets_exports);
var import_log = require("../../../bundler/log.js");
var import_download = require("./download.js");
var import_errors = require("./errors.js");
var import_child_process = require("child_process");
var import_util = require("util");
var import_crypto = __toESM(require("crypto"), 1);
const LEGACY_LOCAL_BACKEND_INSTANCE_SECRET = "4361726e697461732c206c69746572616c6c79206d65616e696e6720226c6974";
async function generateLocalDevSecrets(ctx, {
  deploymentName,
  latestBinaryPath
}) {
  (0, import_log.logVerbose)("Generating local dev secrets");
  const instanceSecret = generateInstanceSecret();
  let stdout;
  try {
    ({ stdout } = await (0, import_util.promisify)(import_child_process.execFile)(latestBinaryPath, [
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
      errForSentry: new import_errors.LocalDeploymentError(message)
    });
  }
  const adminKey = stdout.trim();
  return {
    instanceSecret,
    adminKey
  };
}
function generateInstanceSecret() {
  return import_crypto.default.randomBytes(32).toString("hex");
}
async function generateLocalDevSecretsWithLatestBinary(ctx, {
  deploymentName
}) {
  const { binaryPath: latestBinaryPath } = await (0, import_download.ensureBackendBinaryDownloaded)(
    ctx,
    {
      kind: "latest"
    }
  );
  return generateLocalDevSecrets(ctx, { deploymentName, latestBinaryPath });
}
//# sourceMappingURL=secrets.js.map
