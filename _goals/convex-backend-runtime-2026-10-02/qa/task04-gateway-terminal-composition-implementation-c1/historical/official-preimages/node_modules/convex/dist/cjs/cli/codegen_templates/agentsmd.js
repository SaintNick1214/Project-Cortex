"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var agentsmd_exports = {};
__export(agentsmd_exports, {
  AGENTS_MD_END_MARKER: () => AGENTS_MD_END_MARKER,
  AGENTS_MD_START_MARKER: () => AGENTS_MD_START_MARKER,
  agentsMdConvexSection: () => agentsMdConvexSection,
  convexAiMarkdownBody: () => convexAiMarkdownBody
});
module.exports = __toCommonJS(agentsmd_exports);
const AGENTS_MD_START_MARKER = "<!-- convex-ai-start -->";
const AGENTS_MD_END_MARKER = "<!-- convex-ai-end -->";
function convexAiMarkdownBody(convexDir) {
  const normalizedConvexDir = convexDir.replaceAll("\\", "/");
  return `This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
\`${normalizedConvexDir}/_generated/ai/guidelines.md\` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
\`npx convex ai-files install\`.`;
}
function agentsMdConvexSection(convexDir) {
  return `${AGENTS_MD_START_MARKER}

${convexAiMarkdownBody(convexDir)}

${AGENTS_MD_END_MARKER}`;
}
//# sourceMappingURL=agentsmd.js.map
