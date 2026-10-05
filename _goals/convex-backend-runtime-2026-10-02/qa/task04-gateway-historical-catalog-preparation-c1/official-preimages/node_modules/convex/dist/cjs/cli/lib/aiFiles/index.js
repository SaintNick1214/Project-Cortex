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
var aiFiles_exports = {};
__export(aiFiles_exports, {
  attemptSetupAiFiles: () => attemptSetupAiFiles,
  checkAiFilesStalenessAndLog: () => checkAiFilesStalenessAndLog,
  disableAiFiles: () => disableAiFiles,
  enableAiFiles: () => enableAiFiles,
  installAiFiles: () => installAiFiles,
  isAiFilesDisabled: () => isAiFilesDisabled,
  removeAiFiles: () => removeAiFiles
});
module.exports = __toCommonJS(aiFiles_exports);
var Sentry = __toESM(require("@sentry/node"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = require("fs");
var import_chalk = require("chalk");
var import_log = require("../../../bundler/log.js");
var import_prompts = require("../utils/prompts.js");
var import_versionApi = require("../versionApi.js");
var import_paths = require("./paths.js");
var import_guidelinesmd = require("./guidelinesmd.js");
var import_state = require("./state.js");
var import_utils = require("./utils.js");
var import_agentsmd = require("./agentsmd.js");
var import_claudemd = require("./claudemd.js");
var import_skills = require("./skills.js");
var import_cursorrules = require("./cursorrules.js");
async function hasExistingAiFilesArtifacts({
  projectDir,
  convexDir
}) {
  return await (0, import_guidelinesmd.hasGuidelinesInstalled)(convexDir) || await (0, import_agentsmd.hasAgentsMdInstalled)(projectDir) || await (0, import_claudemd.hasClaudeMdInstalled)(projectDir);
}
async function installAiFiles({
  projectDir,
  convexDir,
  aiFilesConfig
}) {
  const convexDirName = import_path.default.relative(projectDir, convexDir);
  const state = await (0, import_state.readAiStateOrDefault)(convexDir);
  await (0, import_guidelinesmd.installGuidelinesFile)({ convexDir, state });
  await (0, import_agentsmd.applyAgentsMdSection)({ projectDir, state, convexDirName });
  await (0, import_claudemd.applyClaudeMdSection)({ projectDir, state, convexDirName });
  await (0, import_skills.installSkills)({ projectDir, state, aiFilesConfig });
  await (0, import_cursorrules.removeLegacyCursorRulesFile)(projectDir);
  await (0, import_state.writeAiState)({ state, convexDir });
}
async function attemptToInstallAiFiles(opts) {
  try {
    await installAiFiles(opts);
  } catch (error) {
    Sentry.captureException(error);
  }
}
function isAiFilesDisabled(aiFilesConfig) {
  if (aiFilesConfig?.enabled !== void 0)
    return aiFilesConfig.enabled === false;
  return aiFilesConfig?.disableStalenessMessage === true;
}
async function determineAiFilesStaleness({
  canonicalGuidelinesHash,
  canonicalAgentSkillsSha,
  aiFilesConfig,
  projectDir,
  convexDir
}) {
  if (isAiFilesDisabled(aiFilesConfig)) return "silent";
  const result = await (0, import_state.attemptReadAiState)(convexDir);
  if (result.kind === "no-file" || result.kind === "parse-error") {
    const hasArtifacts = await hasExistingAiFilesArtifacts({
      projectDir,
      convexDir
    });
    return hasArtifacts ? "silent" : "not-installed";
  }
  if (result.kind === "ok") {
    const { state } = result;
    if (canonicalGuidelinesHash === null && canonicalAgentSkillsSha === null)
      return "silent";
    const guidelinesStale = canonicalGuidelinesHash !== null && state.guidelinesHash !== null && state.guidelinesHash !== canonicalGuidelinesHash;
    const skillsStale = canonicalAgentSkillsSha !== null && state.agentSkillsSha !== null && state.agentSkillsSha !== canonicalAgentSkillsSha;
    return guidelinesStale || skillsStale ? "stale" : "silent";
  }
  return (0, import_utils.exhaustiveCheck)(result);
}
async function checkAiFilesStalenessAndLog(opts) {
  const status = await determineAiFilesStaleness(opts);
  if (status === "not-installed") {
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(
        `Convex AI files are not installed. Run ${import_chalk.chalkStderr.bold(`npx convex ai-files install`)} to get started or ${import_chalk.chalkStderr.bold(`npx convex ai-files disable`)} to hide this message.`
      )
    );
    return;
  }
  if (status === "stale") {
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(
        `Your Convex AI files are out of date. Run ${import_chalk.chalkStderr.bold(`npx convex ai-files update`)} to get the latest.`
      )
    );
    return;
  }
  if (status === "silent") return;
  (0, import_utils.exhaustiveCheck)(status);
}
async function enableAiFiles({
  projectDir,
  convexDir,
  aiFilesConfig
}) {
  await installAiFiles({ projectDir, convexDir, aiFilesConfig });
  const { disableStalenessMessage: _, ...rest } = aiFilesConfig ?? {};
  return { ...rest, enabled: true };
}
function disableAiFiles(aiFilesConfig) {
  const { disableStalenessMessage: _, ...rest } = aiFilesConfig ?? {};
  return { ...rest, enabled: false };
}
async function removeAiFiles({
  projectDir,
  convexDir
}) {
  const agentSkillsCatalog = await (0, import_versionApi.fetchAgentSkillsCatalog)();
  if (agentSkillsCatalog.kind === "error") {
    return {
      kind: "error",
      message: "Could not fetch canonical agent skills from version.convex.dev. Aborting `convex ai-files remove`."
    };
  }
  const removals = [
    await (0, import_agentsmd.attemptToRemoveAgentsMdSection)(projectDir),
    await (0, import_claudemd.attemptToRemoveClaudeMdSection)(projectDir),
    await (0, import_skills.removeInstalledSkills)({
      projectDir,
      skillNames: agentSkillsCatalog.data.skills.map(
        ({ skillName }) => skillName
      )
    }) === "removed",
    await (0, import_cursorrules.removeLegacyCursorRulesFile)(projectDir),
    await attemptToDeleteAiDir({ projectDir, convexDir })
  ];
  if (removals.some(Boolean)) (0, import_log.logMessage)("Convex AI files removed.");
  else (0, import_log.logMessage)("No Convex AI files found \u2014 nothing to remove.");
  return { kind: "success" };
}
async function attemptToDeleteAiDir({
  projectDir,
  convexDir
}) {
  const aiDir = (0, import_paths.aiDirForConvexDir)(convexDir);
  const relPath = import_path.default.relative(projectDir, aiDir);
  try {
    await import_fs.promises.rm(aiDir, { recursive: true });
    (0, import_log.logMessage)(`${import_chalk.chalkStderr.green("\u2714")} Deleted ${relPath}/`);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    Sentry.captureException(error);
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(`Could not delete ${relPath}/. Remove it manually.`)
    );
    return false;
  }
}
async function hasAiFilesBeenInstalledBefore({
  projectDir,
  convexDir,
  aiFilesConfig
}) {
  if (isAiFilesDisabled(aiFilesConfig)) return false;
  return await (0, import_state.hasAiState)(convexDir) || await hasExistingAiFilesArtifacts({ projectDir, convexDir });
}
async function attemptSetupAiFiles({
  ctx,
  convexDir,
  projectDir,
  aiFilesConfig
}) {
  if (!(0, import_utils.isInInteractiveTerminal)()) return;
  if (isAiFilesDisabled(aiFilesConfig)) return;
  if (await hasAiFilesBeenInstalledBefore({
    projectDir,
    convexDir,
    aiFilesConfig
  })) {
    await attemptToInstallAiFiles({ projectDir, convexDir, aiFilesConfig });
    return;
  }
  const shouldInstall = await (0, import_prompts.promptYesNo)(ctx, {
    message: "Set up Convex AI files? (guidelines, AGENTS.md, agent skills)",
    default: true
  });
  if (shouldInstall)
    await attemptToInstallAiFiles({ projectDir, convexDir, aiFilesConfig });
}
//# sourceMappingURL=index.js.map
