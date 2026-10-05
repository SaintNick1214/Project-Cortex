"use strict";
import path from "path";
const AI_FILES_PARENT_DIR = "_generated";
const AI_FILES_DIR = "ai";
export function aiDirForConvexDir(convexDir) {
  return path.join(convexDir, AI_FILES_PARENT_DIR, AI_FILES_DIR);
}
export function guidelinesPathForConvexDir(convexDir) {
  return path.join(aiDirForConvexDir(convexDir), "guidelines.md");
}
export function aiFilesStatePathForConvexDir(convexDir) {
  return path.join(aiDirForConvexDir(convexDir), "ai-files.state.json");
}
export function agentsMdPath(projectDir) {
  return path.join(projectDir ?? process.cwd(), "AGENTS.md");
}
export function claudeMdPath(projectDir) {
  return path.join(projectDir ?? process.cwd(), "CLAUDE.md");
}
//# sourceMappingURL=paths.js.map
