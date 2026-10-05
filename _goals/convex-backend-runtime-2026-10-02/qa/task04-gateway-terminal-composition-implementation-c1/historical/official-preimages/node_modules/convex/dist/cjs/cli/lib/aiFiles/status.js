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
var status_exports = {};
__export(status_exports, {
  statusAiFiles: () => statusAiFiles
});
module.exports = __toCommonJS(status_exports);
var import_path = __toESM(require("path"), 1);
var import_chalk = require("chalk");
var import_log = require("../../../bundler/log.js");
var import_agentsmd = require("../../codegen_templates/agentsmd.js");
var import_claudemd = require("../../codegen_templates/claudemd.js");
var import_versionApi = require("../versionApi.js");
var import_hash = require("../utils/hash.js");
var import_paths = require("./paths.js");
var import_state = require("./state.js");
var import_index = require("./index.js");
var import_utils = require("./utils.js");
function logGuidelinesStatus({
  guidelinesFile,
  guidelinesRelPath,
  state,
  canonicalGuidelinesHash,
  networkAvailable
}) {
  if (guidelinesFile === null || guidelinesFile === "") {
    (0, import_log.logMessage)(
      `  ${import_chalk.chalkStderr.yellow("\u26A0")} ${guidelinesRelPath}: not on disk \u2014 run ${import_chalk.chalkStderr.bold("npx convex ai-files install")} to reinstall`
    );
    return;
  }
  const isLocallyModified = state.guidelinesHash !== null && (0, import_hash.hashSha256)(guidelinesFile) !== state.guidelinesHash;
  if (isLocallyModified) {
    (0, import_log.logMessage)(
      `  ${import_chalk.chalkStderr.yellow("\u26A0")} ${guidelinesRelPath}: installed, modified locally (changes will be overwritten on next update)`
    );
    return;
  }
  const isOutOfDate = networkAvailable && canonicalGuidelinesHash !== null && state.guidelinesHash !== null && state.guidelinesHash !== canonicalGuidelinesHash;
  if (isOutOfDate) {
    (0, import_log.logMessage)(
      `  ${import_chalk.chalkStderr.yellow("\u26A0")} ${guidelinesRelPath}: installed, out of date \u2014 run ${import_chalk.chalkStderr.bold("npx convex ai-files update")}`
    );
    return;
  }
  (0, import_log.logMessage)(
    `  ${import_chalk.chalkStderr.green("\u2714")} ${guidelinesRelPath}: installed${networkAvailable ? ", up to date" : ""}`
  );
}
function logAgentsMdStatus({
  agentsContent,
  state,
  convexDirName
}) {
  const hasSection = agentsContent !== null && agentsContent.includes(import_agentsmd.AGENTS_MD_START_MARKER) && agentsContent.includes(import_agentsmd.AGENTS_MD_END_MARKER);
  if (!hasSection) {
    (0, import_log.logMessage)(
      `  ${import_chalk.chalkStderr.yellow("\u26A0")} AGENTS.md: Convex section missing \u2014 run ${import_chalk.chalkStderr.bold("npx convex ai-files install")} to reinstall`
    );
    return;
  }
  const currentHash = (0, import_hash.hashSha256)((0, import_agentsmd.agentsMdConvexSection)(convexDirName));
  if (state.agentsMdSectionHash !== null && state.agentsMdSectionHash !== currentHash) {
    (0, import_log.logMessage)(
      `  ${import_chalk.chalkStderr.yellow("\u26A0")} AGENTS.md: Convex section out of date \u2014 run ${import_chalk.chalkStderr.bold("npx convex ai-files update")}`
    );
  } else {
    (0, import_log.logMessage)(
      `  ${import_chalk.chalkStderr.green("\u2714")} AGENTS.md: Convex section present, up to date`
    );
  }
}
function logClaudeMdStatus({
  claudeContent,
  state,
  convexDirName
}) {
  const hasSection = claudeContent !== null && claudeContent.includes(import_claudemd.CLAUDE_MD_START_MARKER) && claudeContent.includes(import_claudemd.CLAUDE_MD_END_MARKER);
  if (!hasSection) {
    if (claudeContent === null) {
      (0, import_log.logMessage)(
        `  ${import_chalk.chalkStderr.yellow("\u26A0")} CLAUDE.md: missing - run ${import_chalk.chalkStderr.bold("npx convex ai-files install")} to create it`
      );
    } else {
      (0, import_log.logMessage)(
        `  ${import_chalk.chalkStderr.yellow("\u26A0")} CLAUDE.md: no Convex section present - run ${import_chalk.chalkStderr.bold("npx convex ai-files update")} to add it`
      );
    }
    return;
  }
  const currentHash = (0, import_hash.hashSha256)((0, import_claudemd.claudeMdConvexSection)(convexDirName));
  if (state.claudeMdHash !== null && state.claudeMdHash !== currentHash) {
    (0, import_log.logMessage)(
      `  ${import_chalk.chalkStderr.yellow("\u26A0")} CLAUDE.md: Convex section out of date - run ${import_chalk.chalkStderr.bold("npx convex ai-files update")}`
    );
  } else {
    (0, import_log.logMessage)(
      `  ${import_chalk.chalkStderr.green("\u2714")} CLAUDE.md: Convex section present, up to date`
    );
  }
}
function logSkillsStatus({
  state,
  canonicalAgentSkillsSha,
  networkAvailable
}) {
  if (state.agentSkillsSha === null) {
    (0, import_log.logMessage)(
      `  ${import_chalk.chalkStderr.yellow("\u26A0")} Agent skills: not installed \u2014 run ${import_chalk.chalkStderr.bold("npx convex ai-files install")} to install`
    );
    return;
  }
  const isStale = networkAvailable && canonicalAgentSkillsSha !== null && state.agentSkillsSha !== null && state.agentSkillsSha !== canonicalAgentSkillsSha;
  if (isStale) {
    (0, import_log.logMessage)(
      `  ${import_chalk.chalkStderr.yellow("\u26A0")} Agent skills: installed, out of date \u2014 run ${import_chalk.chalkStderr.bold("npx convex ai-files update")}`
    );
  } else {
    (0, import_log.logMessage)(
      `  ${import_chalk.chalkStderr.green("\u2714")} Agent skills: installed${networkAvailable ? ", up to date" : ""}`
    );
  }
}
async function statusAiFiles({
  projectDir,
  convexDir,
  aiFilesConfig
}) {
  const convexDirName = import_path.default.relative(projectDir, convexDir);
  const guidelinesRelPath = import_path.default.relative(
    projectDir,
    (0, import_paths.guidelinesPathForConvexDir)(convexDir)
  );
  if ((0, import_index.isAiFilesDisabled)(aiFilesConfig)) {
    (0, import_log.logMessage)(`Convex AI files: ${import_chalk.chalkStderr.yellow("disabled")}`);
    (0, import_log.logMessage)(
      `  Run ${import_chalk.chalkStderr.bold("npx convex ai-files enable")} to re-enable.`
    );
    return;
  }
  const stateResult = await (0, import_state.attemptReadAiState)(convexDir);
  if (stateResult.kind !== "ok") {
    (0, import_log.logMessage)(`Convex AI files: ${import_chalk.chalkStderr.yellow("not installed")}`);
    (0, import_log.logMessage)(
      `Run ${import_chalk.chalkStderr.bold("npx convex ai-files install")} to get started.`
    );
    return;
  }
  const { state } = stateResult;
  (0, import_log.logMessage)(`Convex AI files: ${import_chalk.chalkStderr.green("enabled")}`);
  const [versionData, guidelinesFile, agentsContent, claudeContent] = await Promise.all([
    (0, import_versionApi.getVersion)(),
    (0, import_utils.readFileOrNull)((0, import_paths.guidelinesPathForConvexDir)(convexDir)),
    (0, import_utils.readFileOrNull)((0, import_paths.agentsMdPath)(projectDir)),
    (0, import_utils.readFileOrNull)((0, import_paths.claudeMdPath)(projectDir))
  ]);
  const networkAvailable = versionData.kind === "ok";
  const canonicalGuidelinesHash = networkAvailable ? versionData.data.guidelinesHash : null;
  const canonicalAgentSkillsSha = networkAvailable ? versionData.data.agentSkillsSha : null;
  logGuidelinesStatus({
    guidelinesFile,
    guidelinesRelPath,
    state,
    canonicalGuidelinesHash,
    networkAvailable
  });
  logAgentsMdStatus({ agentsContent, state, convexDirName });
  logClaudeMdStatus({ claudeContent, state, convexDirName });
  logSkillsStatus({ state, canonicalAgentSkillsSha, networkAvailable });
}
//# sourceMappingURL=status.js.map
