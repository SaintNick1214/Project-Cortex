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
var paths_exports = {};
__export(paths_exports, {
  agentsMdPath: () => agentsMdPath,
  aiDirForConvexDir: () => aiDirForConvexDir,
  aiFilesStatePathForConvexDir: () => aiFilesStatePathForConvexDir,
  claudeMdPath: () => claudeMdPath,
  guidelinesPathForConvexDir: () => guidelinesPathForConvexDir
});
module.exports = __toCommonJS(paths_exports);
var import_path = __toESM(require("path"), 1);
const AI_FILES_PARENT_DIR = "_generated";
const AI_FILES_DIR = "ai";
function aiDirForConvexDir(convexDir) {
  return import_path.default.join(convexDir, AI_FILES_PARENT_DIR, AI_FILES_DIR);
}
function guidelinesPathForConvexDir(convexDir) {
  return import_path.default.join(aiDirForConvexDir(convexDir), "guidelines.md");
}
function aiFilesStatePathForConvexDir(convexDir) {
  return import_path.default.join(aiDirForConvexDir(convexDir), "ai-files.state.json");
}
function agentsMdPath(projectDir) {
  return import_path.default.join(projectDir ?? process.cwd(), "AGENTS.md");
}
function claudeMdPath(projectDir) {
  return import_path.default.join(projectDir ?? process.cwd(), "CLAUDE.md");
}
//# sourceMappingURL=paths.js.map
