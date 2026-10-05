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
var claudemd_exports = {};
__export(claudemd_exports, {
  CLAUDE_MD_END_MARKER: () => CLAUDE_MD_END_MARKER,
  CLAUDE_MD_START_MARKER: () => CLAUDE_MD_START_MARKER,
  claudeMdConvexSection: () => claudeMdConvexSection
});
module.exports = __toCommonJS(claudemd_exports);
var import_agentsmd = require("./agentsmd.js");
const CLAUDE_MD_START_MARKER = "<!-- convex-ai-start -->";
const CLAUDE_MD_END_MARKER = "<!-- convex-ai-end -->";
function claudeMdConvexSection(convexDir) {
  return `${CLAUDE_MD_START_MARKER}

${(0, import_agentsmd.convexAiMarkdownBody)(convexDir)}

${CLAUDE_MD_END_MARKER}`;
}
//# sourceMappingURL=claudemd.js.map
