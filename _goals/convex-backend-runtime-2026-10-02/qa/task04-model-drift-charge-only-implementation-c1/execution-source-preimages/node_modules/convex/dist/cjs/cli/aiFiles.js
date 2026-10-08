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
  aiFiles: () => aiFiles
});
module.exports = __toCommonJS(aiFiles_exports);
var import_path = __toESM(require("path"), 1);
var import_extra_typings = require("@commander-js/extra-typings");
var import_chalk = require("chalk");
var import_log = require("../bundler/log.js");
var import_context = require("../bundler/context.js");
var import_config = require("./lib/config.js");
var import_utils = require("./lib/utils/utils.js");
var import_aiFiles = require("./lib/aiFiles/index.js");
var import_status = require("./lib/aiFiles/status.js");
var import_config2 = require("./lib/config.js");
async function resolveProjectPaths() {
  const ctx = await (0, import_context.oneoffContext)({});
  const { configPath, projectConfig } = await (0, import_config.readProjectConfig)(ctx);
  const convexDir = import_path.default.resolve((0, import_utils.functionsDir)(configPath, projectConfig));
  const projectDir = import_path.default.resolve(import_path.default.dirname(configPath));
  const aiFilesConfig = projectConfig.aiFiles;
  return { ctx, projectDir, convexDir, aiFilesConfig, projectConfig };
}
const aiInstall = new import_extra_typings.Command("install").summary("Install or refresh Convex AI files").description(
  "Installs the following (or refreshes them if already present):\n  - convex/_generated/ai/guidelines.md\n  - AGENTS.md (Convex section only)\n  - CLAUDE.md (Convex section only)\n  - Agent skills (installed to each coding agent's native path, configured via convex.json)"
).allowExcessArguments(false).action(async () => {
  const { projectDir, convexDir, aiFilesConfig } = await resolveProjectPaths();
  await (0, import_aiFiles.installAiFiles)({ projectDir, convexDir, aiFilesConfig });
  (0, import_log.logMessage)(`${import_chalk.chalkStderr.green("\u2714")} Convex AI files installed.`);
});
const aiEnable = new import_extra_typings.Command("enable").summary("Enable Convex AI files").description(
  "Re-enables Convex AI files by writing `aiFiles.enabled: true` to\n`convex.json`, then installs or refreshes the managed AI files."
).allowExcessArguments(false).action(async () => {
  const { projectDir, convexDir, aiFilesConfig } = await resolveProjectPaths();
  const newAiFilesConfig = await (0, import_aiFiles.enableAiFiles)({
    projectDir,
    convexDir,
    aiFilesConfig
  });
  await (0, import_config2.writeAiFilesConfig)({ projectDir, aiFiles: newAiFilesConfig });
});
const aiUpdate = new import_extra_typings.Command("update").summary("Update Convex AI files to the latest version").description(
  "Updates the following to their latest versions:\n  - convex/_generated/ai/guidelines.md\n  - AGENTS.md (Convex section only)\n  - CLAUDE.md (Convex section only)\n  - Agent skills (installed to each coding agent's native path, configured via convex.json)"
).allowExcessArguments(false).action(async () => {
  const { projectDir, convexDir, aiFilesConfig } = await resolveProjectPaths();
  await (0, import_aiFiles.installAiFiles)({ projectDir, convexDir, aiFilesConfig });
  (0, import_log.logMessage)(`${import_chalk.chalkStderr.green("\u2714")} Convex AI files updated.`);
});
const aiDisable = new import_extra_typings.Command("disable").summary("Disable Convex AI files without removing them").description(
  "Writes `aiFiles.enabled: false` to `convex.json` so `npx convex dev`\nstops prompting to install AI files and suppresses staleness messages.\n\nFiles already installed are left untouched - use `npx convex ai-files remove`\nif you also want to delete them.\n\nRun `npx convex ai-files enable` to re-enable at any time."
).allowExcessArguments(false).action(async () => {
  const { projectDir, aiFilesConfig } = await resolveProjectPaths();
  const newAiFilesConfig = (0, import_aiFiles.disableAiFiles)(aiFilesConfig);
  await (0, import_config2.writeAiFilesConfig)({
    projectDir,
    aiFiles: newAiFilesConfig
  });
  (0, import_log.logMessage)(
    `${import_chalk.chalkStderr.green(`\u2714`)} Convex AI files disabled. Run ${import_chalk.chalkStderr.bold(`npx convex ai-files enable`)} to re-enable.`
  );
});
const aiStatus = new import_extra_typings.Command("status").summary("Show the current status of Convex AI files").description(
  "Prints whether Convex AI files are enabled, and for each component:\n  - convex/_generated/ai/guidelines.md\n  - AGENTS.md (Convex section)\n  - CLAUDE.md (if installed by Convex)\n  - Agent skills\n\nFetches the latest hashes from version.convex.dev to report whether\neach file is up to date. If the network is unavailable the staleness\ncheck is skipped silently."
).allowExcessArguments(false).action(async () => {
  const { projectDir, convexDir, aiFilesConfig } = await resolveProjectPaths();
  await (0, import_status.statusAiFiles)({ projectDir, convexDir, aiFilesConfig });
});
const aiRemove = new import_extra_typings.Command("remove").summary("Remove all Convex AI files from the project").description(
  "Removes the following:\n  - convex/_generated/ai/ directory (guidelines.md, ai-files.state.json)\n  - Convex sections from AGENTS.md and CLAUDE.md\n  - Agent skills installed by `npx convex ai-files install`\n\nIf removing the managed section leaves AGENTS.md or CLAUDE.md empty, the\nempty file is deleted. Otherwise the rest of the file is kept.\n\nSkills installed from other sources are not affected.\n\nNote: after `remove`, `npx convex dev` will suggest reinstalling AI files.\nUse `npx convex ai-files disable` to opt out entirely without deleting files."
).allowExcessArguments(false).action(async () => {
  const { ctx, projectDir, convexDir } = await resolveProjectPaths();
  const result = await (0, import_aiFiles.removeAiFiles)({ projectDir, convexDir });
  if (result.kind === "error") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: result.message
    });
  }
});
const aiFiles = new import_extra_typings.Command("ai-files").summary("Manage Convex AI files").description(
  "Convex AI files help AI coding assistants (Cursor, Claude Code, etc.) understand\nConvex patterns and APIs. They are set up during your first `npx convex dev`\nand can be managed at any time with the commands below."
).addCommand(aiStatus).addCommand(aiInstall).addCommand(aiEnable).addCommand(aiUpdate).addCommand(aiDisable).addCommand(aiRemove).addHelpCommand(false);
//# sourceMappingURL=aiFiles.js.map
