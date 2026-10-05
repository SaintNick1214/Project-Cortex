"use strict";
import {
  CLAUDE_MD_END_MARKER,
  CLAUDE_MD_START_MARKER,
  claudeMdConvexSection
} from "../../codegen_templates/claudemd.js";
import { claudeMdPath } from "./paths.js";
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
    filePath: claudeMdPath(projectDir),
    startMarker: CLAUDE_MD_START_MARKER,
    endMarker: CLAUDE_MD_END_MARKER
  };
}
export async function injectClaudeMdSection({
  section,
  projectDir
}) {
  return injectManagedSection({ ...target(projectDir), section });
}
export async function attemptToStripClaudeMdSection(projectDir) {
  return attemptToStripManagedSection(target(projectDir));
}
export async function attemptToRemoveClaudeMdSection(projectDir) {
  return attemptToRemoveMarkdownSection({
    projectDir,
    strip: attemptToStripClaudeMdSection,
    fileName: "CLAUDE.md"
  });
}
export async function hasClaudeMdInstalled(projectDir) {
  return hasManagedSection(target(projectDir));
}
export async function applyClaudeMdSection({
  projectDir,
  state,
  convexDirName
}) {
  const result = await injectClaudeMdSection({
    section: claudeMdConvexSection(convexDirName),
    projectDir
  });
  if (result.didWrite)
    logMessage(`${chalkStderr.green("\u2714")} CLAUDE.md written`);
  state.claudeMdHash = result.sectionHash;
  return result.didWrite;
}
//# sourceMappingURL=claudemd.js.map
