"use strict";
import path from "path";
import { chalkStderr } from "chalk";
import { logMessage } from "../../../bundler/log.js";
import {
  AGENTS_MD_START_MARKER,
  AGENTS_MD_END_MARKER,
  agentsMdConvexSection
} from "../../codegen_templates/agentsmd.js";
import {
  CLAUDE_MD_START_MARKER,
  CLAUDE_MD_END_MARKER,
  claudeMdConvexSection
} from "../../codegen_templates/claudemd.js";
import { getVersion } from "../versionApi.js";
import { hashSha256 } from "../utils/hash.js";
import {
  agentsMdPath,
  claudeMdPath,
  guidelinesPathForConvexDir
} from "./paths.js";
import { attemptReadAiState } from "./state.js";
import { isAiFilesDisabled } from "./index.js";
import { readFileOrNull } from "./utils.js";
function logGuidelinesStatus({
  guidelinesFile,
  guidelinesRelPath,
  state,
  canonicalGuidelinesHash,
  networkAvailable
}) {
  if (guidelinesFile === null || guidelinesFile === "") {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} ${guidelinesRelPath}: not on disk \u2014 run ${chalkStderr.bold("npx convex ai-files install")} to reinstall`
    );
    return;
  }
  const isLocallyModified = state.guidelinesHash !== null && hashSha256(guidelinesFile) !== state.guidelinesHash;
  if (isLocallyModified) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} ${guidelinesRelPath}: installed, modified locally (changes will be overwritten on next update)`
    );
    return;
  }
  const isOutOfDate = networkAvailable && canonicalGuidelinesHash !== null && state.guidelinesHash !== null && state.guidelinesHash !== canonicalGuidelinesHash;
  if (isOutOfDate) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} ${guidelinesRelPath}: installed, out of date \u2014 run ${chalkStderr.bold("npx convex ai-files update")}`
    );
    return;
  }
  logMessage(
    `  ${chalkStderr.green("\u2714")} ${guidelinesRelPath}: installed${networkAvailable ? ", up to date" : ""}`
  );
}
function logAgentsMdStatus({
  agentsContent,
  state,
  convexDirName
}) {
  const hasSection = agentsContent !== null && agentsContent.includes(AGENTS_MD_START_MARKER) && agentsContent.includes(AGENTS_MD_END_MARKER);
  if (!hasSection) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} AGENTS.md: Convex section missing \u2014 run ${chalkStderr.bold("npx convex ai-files install")} to reinstall`
    );
    return;
  }
  const currentHash = hashSha256(agentsMdConvexSection(convexDirName));
  if (state.agentsMdSectionHash !== null && state.agentsMdSectionHash !== currentHash) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} AGENTS.md: Convex section out of date \u2014 run ${chalkStderr.bold("npx convex ai-files update")}`
    );
  } else {
    logMessage(
      `  ${chalkStderr.green("\u2714")} AGENTS.md: Convex section present, up to date`
    );
  }
}
function logClaudeMdStatus({
  claudeContent,
  state,
  convexDirName
}) {
  const hasSection = claudeContent !== null && claudeContent.includes(CLAUDE_MD_START_MARKER) && claudeContent.includes(CLAUDE_MD_END_MARKER);
  if (!hasSection) {
    if (claudeContent === null) {
      logMessage(
        `  ${chalkStderr.yellow("\u26A0")} CLAUDE.md: missing - run ${chalkStderr.bold("npx convex ai-files install")} to create it`
      );
    } else {
      logMessage(
        `  ${chalkStderr.yellow("\u26A0")} CLAUDE.md: no Convex section present - run ${chalkStderr.bold("npx convex ai-files update")} to add it`
      );
    }
    return;
  }
  const currentHash = hashSha256(claudeMdConvexSection(convexDirName));
  if (state.claudeMdHash !== null && state.claudeMdHash !== currentHash) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} CLAUDE.md: Convex section out of date - run ${chalkStderr.bold("npx convex ai-files update")}`
    );
  } else {
    logMessage(
      `  ${chalkStderr.green("\u2714")} CLAUDE.md: Convex section present, up to date`
    );
  }
}
function logSkillsStatus({
  state,
  canonicalAgentSkillsSha,
  networkAvailable
}) {
  if (state.agentSkillsSha === null) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} Agent skills: not installed \u2014 run ${chalkStderr.bold("npx convex ai-files install")} to install`
    );
    return;
  }
  const isStale = networkAvailable && canonicalAgentSkillsSha !== null && state.agentSkillsSha !== null && state.agentSkillsSha !== canonicalAgentSkillsSha;
  if (isStale) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} Agent skills: installed, out of date \u2014 run ${chalkStderr.bold("npx convex ai-files update")}`
    );
  } else {
    logMessage(
      `  ${chalkStderr.green("\u2714")} Agent skills: installed${networkAvailable ? ", up to date" : ""}`
    );
  }
}
export async function statusAiFiles({
  projectDir,
  convexDir,
  aiFilesConfig
}) {
  const convexDirName = path.relative(projectDir, convexDir);
  const guidelinesRelPath = path.relative(
    projectDir,
    guidelinesPathForConvexDir(convexDir)
  );
  if (isAiFilesDisabled(aiFilesConfig)) {
    logMessage(`Convex AI files: ${chalkStderr.yellow("disabled")}`);
    logMessage(
      `  Run ${chalkStderr.bold("npx convex ai-files enable")} to re-enable.`
    );
    return;
  }
  const stateResult = await attemptReadAiState(convexDir);
  if (stateResult.kind !== "ok") {
    logMessage(`Convex AI files: ${chalkStderr.yellow("not installed")}`);
    logMessage(
      `Run ${chalkStderr.bold("npx convex ai-files install")} to get started.`
    );
    return;
  }
  const { state } = stateResult;
  logMessage(`Convex AI files: ${chalkStderr.green("enabled")}`);
  const [versionData, guidelinesFile, agentsContent, claudeContent] = await Promise.all([
    getVersion(),
    readFileOrNull(guidelinesPathForConvexDir(convexDir)),
    readFileOrNull(agentsMdPath(projectDir)),
    readFileOrNull(claudeMdPath(projectDir))
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
