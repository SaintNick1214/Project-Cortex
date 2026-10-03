"use strict";
import {
  AGENTS_MD_START_MARKER,
  AGENTS_MD_END_MARKER,
  agentsMdConvexSection
} from "../../codegen_templates/agentsmd.js";
import { agentsMdPath } from "./paths.js";
import {
  injectManagedSection,
  attemptToStripManagedSection,
  hasManagedSection,
  attemptToRemoveMarkdownSection
} from "./utils.js";
import { logMessage } from "../../../bundler/log.js";
import { chalkStderr } from "chalk";
function target(projectDir) {
  return {
    filePath: agentsMdPath(projectDir),
    startMarker: AGENTS_MD_START_MARKER,
    endMarker: AGENTS_MD_END_MARKER
  };
}
export async function injectAgentsMdSection({
  section,
  projectDir
}) {
  return injectManagedSection({ ...target(projectDir), section });
}
export async function attemptToStripAgentsMdSection(projectDir) {
  return attemptToStripManagedSection(target(projectDir));
}
export async function attemptToRemoveAgentsMdSection(projectDir) {
  return attemptToRemoveMarkdownSection({
    projectDir,
    strip: attemptToStripAgentsMdSection,
    fileName: "AGENTS.md"
  });
}
export async function hasAgentsMdInstalled(projectDir) {
  return hasManagedSection(target(projectDir));
}
export async function applyAgentsMdSection({
  projectDir,
  state,
  convexDirName
}) {
  const result = await injectAgentsMdSection({
    section: agentsMdConvexSection(convexDirName),
    projectDir
  });
  if (result.didWrite)
    logMessage(`${chalkStderr.green("\u2714")} AGENTS.md written`);
  state.agentsMdSectionHash = result.sectionHash;
  return result.didWrite;
}
//# sourceMappingURL=agentsmd.js.map
