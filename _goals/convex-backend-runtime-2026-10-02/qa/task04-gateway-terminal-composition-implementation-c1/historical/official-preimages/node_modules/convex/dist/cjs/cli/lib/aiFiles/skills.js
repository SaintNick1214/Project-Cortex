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
var skills_exports = {};
__export(skills_exports, {
  installSkills: () => installSkills,
  removeInstalledSkills: () => removeInstalledSkills
});
module.exports = __toCommonJS(skills_exports);
var import_child_process = __toESM(require("child_process"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = require("fs");
var import_chalk = require("chalk");
var import_log = require("../../../bundler/log.js");
var import_versionApi = require("../versionApi.js");
var import_utils = require("./utils.js");
function configuredSkillAgents(aiFilesConfig) {
  const defaultAgents = ["claude-code", "codex"];
  return aiFilesConfig?.skills?.agents ?? defaultAgents;
}
function runSkillsAdd(cwd, agents) {
  const args = ["add", "get-convex/agent-skills", "--yes", "--copy"];
  for (const agent of agents) {
    args.push("--agent", agent);
  }
  return runSkillsCommand(cwd, args).then(({ ok }) => ok);
}
function runSkillsRemove({
  cwd,
  skillNames
}) {
  return runSkillsCommand(cwd, ["remove", ...skillNames, "--yes"]).then(
    ({ ok }) => ok
  );
}
async function shouldRunSkillsCli() {
  const versionData = await (0, import_versionApi.getVersion)();
  if (versionData.kind === "error") return true;
  if (versionData.kind === "ok") {
    if (versionData.data.disableSkillsCli) {
      const message = versionData.data.disableSkillsCliMessage ?? "Agent skills are temporarily disabled.";
      (0, import_log.logMessage)(import_chalk.chalkStderr.yellow(message));
      return false;
    }
    return true;
  }
  return (0, import_utils.exhaustiveCheck)(versionData);
}
async function removeSkillsLockIfEmpty({
  projectDir,
  removedSkillNames
}) {
  const lockPath = import_path.default.join(projectDir, "skills-lock.json");
  try {
    const content = await import_fs.promises.readFile(lockPath, "utf8");
    const lock = JSON.parse(content);
    if (!lock || typeof lock !== "object" || !lock.skills || typeof lock.skills !== "object") {
      return false;
    }
    const remainingSkills = Object.keys(lock.skills).filter(
      (name) => !removedSkillNames.includes(name)
    );
    if (remainingSkills.length === 0) {
      await import_fs.promises.unlink(lockPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
async function installSkills({
  projectDir,
  state,
  aiFilesConfig
}) {
  const agents = configuredSkillAgents(aiFilesConfig);
  if (agents.length === 0) return;
  if (!await shouldRunSkillsCli()) return;
  (0, import_log.logMessage)("Installing Convex agent skills...");
  const skillsOk = await runSkillsAdd(projectDir, agents);
  if (!skillsOk) {
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(
        "Could not install agent skills. You can retry manually with: npx skills add get-convex/agent-skills --copy"
      )
    );
    return;
  }
  const sha = await (0, import_versionApi.fetchAgentSkillsSha)();
  if (sha) state.agentSkillsSha = sha;
  (0, import_log.logMessage)(`${import_chalk.chalkStderr.green("\u2714")} Skills installed`);
}
async function removeInstalledSkills({
  projectDir,
  skillNames
}) {
  if (skillNames.length === 0) return "unchanged";
  if (!await shouldRunSkillsCli()) return "unchanged";
  (0, import_log.logMessage)(`Removing Convex agent skills: ${skillNames.join(", ")}`);
  const skillsOk = await runSkillsRemove({ cwd: projectDir, skillNames });
  if (!skillsOk) {
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(
        "Could not remove agent skills automatically. Remove them manually with: npx skills remove"
      )
    );
    return "failed";
  }
  const lockRemoved = await removeSkillsLockIfEmpty({
    projectDir,
    removedSkillNames: skillNames
  });
  if (lockRemoved)
    (0, import_log.logMessage)(`${import_chalk.chalkStderr.green("\u2714")} Deleted skills-lock.json.`);
  return "removed";
}
function runSkillsCommand(cwd, args) {
  return new Promise((resolve) => {
    const proc = import_child_process.default.spawn(
      "npx",
      ["--yes", "skills@latest", ...args],
      {
        cwd,
        stdio: "pipe",
        // .cmd files on Windows require shell execution.
        shell: process.platform === "win32"
      }
    );
    let capturedOutput = "";
    proc.stdout?.on("data", (chunk) => {
      capturedOutput += chunk.toString();
    });
    proc.stderr?.on("data", (chunk) => {
      capturedOutput += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0 && capturedOutput.trim().length > 0) {
        const lines = capturedOutput.trim().split(/\r?\n/);
        const tail = lines.slice(-10).join("\n");
        (0, import_log.logMessage)(import_chalk.chalkStderr.gray(`skills output (tail):
${tail}`));
      }
      resolve({ ok: code === 0, output: capturedOutput });
    });
    proc.on("error", () => resolve({ ok: false, output: capturedOutput }));
  });
}
//# sourceMappingURL=skills.js.map
