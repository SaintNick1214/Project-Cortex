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
var updates_exports = {};
__export(updates_exports, {
  checkVersionAndAiFilesStaleness: () => checkVersionAndAiFilesStaleness
});
module.exports = __toCommonJS(updates_exports);
var import_path = __toESM(require("path"), 1);
var import_log = require("../../bundler/log.js");
var import_config = require("./config.js");
var import_utils = require("./utils/utils.js");
var import_aiFiles = require("./aiFiles/index.js");
var import_versionApi = require("./versionApi.js");
async function checkVersionAndAiFilesStaleness(ctx) {
  const version = await (0, import_versionApi.getVersion)();
  if (version.kind === "error") return;
  if (version.data.message) (0, import_log.logMessage)(version.data.message);
  try {
    const { configPath, projectConfig } = await (0, import_config.readProjectConfig)(ctx);
    const aiFilesConfig = projectConfig.aiFiles;
    if ((0, import_aiFiles.isAiFilesDisabled)(aiFilesConfig)) return;
    const convexDir = import_path.default.resolve((0, import_utils.functionsDir)(configPath, projectConfig));
    const projectDir = import_path.default.resolve(import_path.default.dirname(configPath));
    await (0, import_aiFiles.checkAiFilesStalenessAndLog)({
      canonicalGuidelinesHash: version.data.guidelinesHash,
      canonicalAgentSkillsSha: version.data.agentSkillsSha,
      aiFilesConfig,
      projectDir,
      convexDir
    });
  } catch {
  }
}
//# sourceMappingURL=updates.js.map
