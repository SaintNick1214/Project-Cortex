"use strict";
import { convexAiMarkdownBody } from "./agentsmd.js";
export const CLAUDE_MD_START_MARKER = "<!-- convex-ai-start -->";
export const CLAUDE_MD_END_MARKER = "<!-- convex-ai-end -->";
export function claudeMdConvexSection(convexDir) {
  return `${CLAUDE_MD_START_MARKER}

${convexAiMarkdownBody(convexDir)}

${CLAUDE_MD_END_MARKER}`;
}
//# sourceMappingURL=claudemd.js.map
