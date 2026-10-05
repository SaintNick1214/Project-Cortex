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
var guidelinesmd_exports = {};
__export(guidelinesmd_exports, {
  hasGuidelinesInstalled: () => hasGuidelinesInstalled,
  installGuidelinesFile: () => installGuidelinesFile
});
module.exports = __toCommonJS(guidelinesmd_exports);
var import_fs = require("fs");
var import_chalk = require("chalk");
var import_log = require("../../../bundler/log.js");
var import_versionApi = require("../versionApi.js");
var import_hash = require("../utils/hash.js");
var import_paths = require("./paths.js");
var import_utils = require("./utils.js");
async function hasGuidelinesInstalled(convexDir) {
  const result = await (0, import_utils.attemptReadFile)((0, import_paths.guidelinesPathForConvexDir)(convexDir));
  if (result.kind === "content") return true;
  if (result.kind === "empty" || result.kind === "not-found") return false;
  return (0, import_utils.exhaustiveCheck)(result);
}
async function installGuidelinesFile({
  convexDir,
  state
}) {
  const guidelines = await (0, import_versionApi.downloadGuidelines)();
  if (guidelines === null) {
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(
        "Could not download Convex AI guidelines right now. You can retry with: npx convex ai-files install"
      )
    );
    return;
  }
  await import_fs.promises.mkdir((0, import_paths.aiDirForConvexDir)(convexDir), { recursive: true });
  await import_fs.promises.writeFile((0, import_paths.guidelinesPathForConvexDir)(convexDir), guidelines, "utf8");
  state.guidelinesHash = (0, import_hash.hashSha256)(guidelines);
  (0, import_log.logMessage)(
    `${import_chalk.chalkStderr.green("\u2714")} ${(0, import_paths.guidelinesPathForConvexDir)(convexDir)} written`
  );
}
//# sourceMappingURL=guidelinesmd.js.map
