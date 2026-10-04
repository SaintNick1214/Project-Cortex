"use strict";
import child_process from "child_process";
import path from "path";
import { promises as fs } from "fs";
import { chalkStderr } from "chalk";
import { logMessage } from "../../../bundler/log.js";
import { getVersion, fetchAgentSkillsSha } from "../versionApi.js";
import { exhaustiveCheck } from "./utils.js";
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
  const versionData = await getVersion();
  if (versionData.kind === "error") return true;
  if (versionData.kind === "ok") {
    if (versionData.data.disableSkillsCli) {
      const message = versionData.data.disableSkillsCliMessage ?? "Agent skills are temporarily disabled.";
      logMessage(chalkStderr.yellow(message));
      return false;
    }
    return true;
  }
  return exhaustiveCheck(versionData);
}
async function removeSkillsLockIfEmpty({
  projectDir,
  removedSkillNames
}) {
  const lockPath = path.join(projectDir, "skills-lock.json");
  try {
    const content = await fs.readFile(lockPath, "utf8");
    const lock = JSON.parse(content);
    if (!lock || typeof lock !== "object" || !lock.skills || typeof lock.skills !== "object") {
      return false;
    }
    const remainingSkills = Object.keys(lock.skills).filter(
      (name) => !removedSkillNames.includes(name)
    );
    if (remainingSkills.length === 0) {
      await fs.unlink(lockPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
export async function installSkills({
  projectDir,
  state,
  aiFilesConfig
}) {
  const agents = configuredSkillAgents(aiFilesConfig);
  if (agents.length === 0) return;
  if (!await shouldRunSkillsCli()) return;
  logMessage("Installing Convex agent skills...");
  const skillsOk = await runSkillsAdd(projectDir, agents);
  if (!skillsOk) {
    logMessage(
      chalkStderr.yellow(
        "Could not install agent skills. You can retry manually with: npx skills add get-convex/agent-skills --copy"
      )
    );
    return;
  }
  const sha = await fetchAgentSkillsSha();
  if (sha) state.agentSkillsSha = sha;
  logMessage(`${chalkStderr.green("\u2714")} Skills installed`);
}
export async function removeInstalledSkills({
  projectDir,
  skillNames
}) {
  if (skillNames.length === 0) return "unchanged";
  if (!await shouldRunSkillsCli()) return "unchanged";
  logMessage(`Removing Convex agent skills: ${skillNames.join(", ")}`);
  const skillsOk = await runSkillsRemove({ cwd: projectDir, skillNames });
  if (!skillsOk) {
    logMessage(
      chalkStderr.yellow(
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
    logMessage(`${chalkStderr.green("\u2714")} Deleted skills-lock.json.`);
  return "removed";
}
function runSkillsCommand(cwd, args) {
  return new Promise((resolve) => {
    const proc = child_process.spawn(
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
        logMessage(chalkStderr.gray(`skills output (tail):
${tail}`));
      }
      resolve({ ok: code === 0, output: capturedOutput });
    });
    proc.on("error", () => resolve({ ok: false, output: capturedOutput }));
  });
}
//# sourceMappingURL=skills.js.map
