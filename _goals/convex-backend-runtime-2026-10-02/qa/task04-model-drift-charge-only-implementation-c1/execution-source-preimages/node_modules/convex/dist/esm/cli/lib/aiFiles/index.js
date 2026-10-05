"use strict";
import * as Sentry from "@sentry/node";
import path from "path";
import { promises as fs } from "fs";
import { chalkStderr } from "chalk";
import { logMessage } from "../../../bundler/log.js";
import { promptYesNo } from "../utils/prompts.js";
import { fetchAgentSkillsCatalog } from "../versionApi.js";
import { aiDirForConvexDir } from "./paths.js";
import {
  installGuidelinesFile,
  hasGuidelinesInstalled
} from "./guidelinesmd.js";
import {
  attemptReadAiState,
  readAiStateOrDefault,
  writeAiState,
  hasAiState
} from "./state.js";
import { exhaustiveCheck, isInInteractiveTerminal } from "./utils.js";
import {
  hasAgentsMdInstalled,
  applyAgentsMdSection,
  attemptToRemoveAgentsMdSection
} from "./agentsmd.js";
import {
  hasClaudeMdInstalled,
  applyClaudeMdSection,
  attemptToRemoveClaudeMdSection
} from "./claudemd.js";
import { installSkills, removeInstalledSkills } from "./skills.js";
import { removeLegacyCursorRulesFile as removeLegacyCursorRules } from "./cursorrules.js";
async function hasExistingAiFilesArtifacts({
  projectDir,
  convexDir
}) {
  return await hasGuidelinesInstalled(convexDir) || await hasAgentsMdInstalled(projectDir) || await hasClaudeMdInstalled(projectDir);
}
export async function installAiFiles({
  projectDir,
  convexDir,
  aiFilesConfig
}) {
  const convexDirName = path.relative(projectDir, convexDir);
  const state = await readAiStateOrDefault(convexDir);
  await installGuidelinesFile({ convexDir, state });
  await applyAgentsMdSection({ projectDir, state, convexDirName });
  await applyClaudeMdSection({ projectDir, state, convexDirName });
  await installSkills({ projectDir, state, aiFilesConfig });
  await removeLegacyCursorRules(projectDir);
  await writeAiState({ state, convexDir });
}
async function attemptToInstallAiFiles(opts) {
  try {
    await installAiFiles(opts);
  } catch (error) {
    Sentry.captureException(error);
  }
}
export function isAiFilesDisabled(aiFilesConfig) {
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
  const result = await attemptReadAiState(convexDir);
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
  return exhaustiveCheck(result);
}
export async function checkAiFilesStalenessAndLog(opts) {
  const status = await determineAiFilesStaleness(opts);
  if (status === "not-installed") {
    logMessage(
      chalkStderr.yellow(
        `Convex AI files are not installed. Run ${chalkStderr.bold(`npx convex ai-files install`)} to get started or ${chalkStderr.bold(`npx convex ai-files disable`)} to hide this message.`
      )
    );
    return;
  }
  if (status === "stale") {
    logMessage(
      chalkStderr.yellow(
        `Your Convex AI files are out of date. Run ${chalkStderr.bold(`npx convex ai-files update`)} to get the latest.`
      )
    );
    return;
  }
  if (status === "silent") return;
  exhaustiveCheck(status);
}
export async function enableAiFiles({
  projectDir,
  convexDir,
  aiFilesConfig
}) {
  await installAiFiles({ projectDir, convexDir, aiFilesConfig });
  const { disableStalenessMessage: _, ...rest } = aiFilesConfig ?? {};
  return { ...rest, enabled: true };
}
export function disableAiFiles(aiFilesConfig) {
  const { disableStalenessMessage: _, ...rest } = aiFilesConfig ?? {};
  return { ...rest, enabled: false };
}
export async function removeAiFiles({
  projectDir,
  convexDir
}) {
  const agentSkillsCatalog = await fetchAgentSkillsCatalog();
  if (agentSkillsCatalog.kind === "error") {
    return {
      kind: "error",
      message: "Could not fetch canonical agent skills from version.convex.dev. Aborting `convex ai-files remove`."
    };
  }
  const removals = [
    await attemptToRemoveAgentsMdSection(projectDir),
    await attemptToRemoveClaudeMdSection(projectDir),
    await removeInstalledSkills({
      projectDir,
      skillNames: agentSkillsCatalog.data.skills.map(
        ({ skillName }) => skillName
      )
    }) === "removed",
    await removeLegacyCursorRules(projectDir),
    await attemptToDeleteAiDir({ projectDir, convexDir })
  ];
  if (removals.some(Boolean)) logMessage("Convex AI files removed.");
  else logMessage("No Convex AI files found \u2014 nothing to remove.");
  return { kind: "success" };
}
async function attemptToDeleteAiDir({
  projectDir,
  convexDir
}) {
  const aiDir = aiDirForConvexDir(convexDir);
  const relPath = path.relative(projectDir, aiDir);
  try {
    await fs.rm(aiDir, { recursive: true });
    logMessage(`${chalkStderr.green("\u2714")} Deleted ${relPath}/`);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    Sentry.captureException(error);
    logMessage(
      chalkStderr.yellow(`Could not delete ${relPath}/. Remove it manually.`)
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
  return await hasAiState(convexDir) || await hasExistingAiFilesArtifacts({ projectDir, convexDir });
}
export async function attemptSetupAiFiles({
  ctx,
  convexDir,
  projectDir,
  aiFilesConfig
}) {
  if (!isInInteractiveTerminal()) return;
  if (isAiFilesDisabled(aiFilesConfig)) return;
  if (await hasAiFilesBeenInstalledBefore({
    projectDir,
    convexDir,
    aiFilesConfig
  })) {
    await attemptToInstallAiFiles({ projectDir, convexDir, aiFilesConfig });
    return;
  }
  const shouldInstall = await promptYesNo(ctx, {
    message: "Set up Convex AI files? (guidelines, AGENTS.md, agent skills)",
    default: true
  });
  if (shouldInstall)
    await attemptToInstallAiFiles({ projectDir, convexDir, aiFilesConfig });
}
//# sourceMappingURL=index.js.map
