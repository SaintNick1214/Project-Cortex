"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target2, all) => {
  for (var name in all)
    __defProp(target2, name, { get: all[name], enumerable: true });
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
var agentsmd_exports = {};
__export(agentsmd_exports, {
  applyAgentsMdSection: () => applyAgentsMdSection,
  attemptToRemoveAgentsMdSection: () => attemptToRemoveAgentsMdSection,
  attemptToStripAgentsMdSection: () => attemptToStripAgentsMdSection,
  hasAgentsMdInstalled: () => hasAgentsMdInstalled,
  injectAgentsMdSection: () => injectAgentsMdSection
});
module.exports = __toCommonJS(agentsmd_exports);
var import_agentsmd = require("../../codegen_templates/agentsmd.js");
var import_paths = require("./paths.js");
var import_utils = require("./utils.js");
var import_log = require("../../../bundler/log.js");
var import_chalk = require("chalk");
function target(projectDir) {
  return {
    filePath: (0, import_paths.agentsMdPath)(projectDir),
    startMarker: import_agentsmd.AGENTS_MD_START_MARKER,
    endMarker: import_agentsmd.AGENTS_MD_END_MARKER
  };
}
async function injectAgentsMdSection({
  section,
  projectDir
}) {
  return (0, import_utils.injectManagedSection)({ ...target(projectDir), section });
}
async function attemptToStripAgentsMdSection(projectDir) {
  return (0, import_utils.attemptToStripManagedSection)(target(projectDir));
}
async function attemptToRemoveAgentsMdSection(projectDir) {
  return (0, import_utils.attemptToRemoveMarkdownSection)({
    projectDir,
    strip: attemptToStripAgentsMdSection,
    fileName: "AGENTS.md"
  });
}
async function hasAgentsMdInstalled(projectDir) {
  return (0, import_utils.hasManagedSection)(target(projectDir));
}
async function applyAgentsMdSection({
  projectDir,
  state,
  convexDirName
}) {
  const result = await injectAgentsMdSection({
    section: (0, import_agentsmd.agentsMdConvexSection)(convexDirName),
    projectDir
  });
  if (result.didWrite)
    (0, import_log.logMessage)(`${import_chalk.chalkStderr.green("\u2714")} AGENTS.md written`);
  state.agentsMdSectionHash = result.sectionHash;
  return result.didWrite;
}
//# sourceMappingURL=agentsmd.js.map
