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
var state_exports = {};
__export(state_exports, {
  aiFilesStateSchema: () => aiFilesStateSchema,
  attemptReadAiState: () => attemptReadAiState,
  hasAiState: () => hasAiState,
  readAiStateOrDefault: () => readAiStateOrDefault,
  writeAiState: () => writeAiState
});
module.exports = __toCommonJS(state_exports);
var Sentry = __toESM(require("@sentry/node"), 1);
var import_fs = require("fs");
var import_zod = require("zod");
var import_paths = require("./paths.js");
var import_utils = require("./utils.js");
const aiFilesStateSchema = import_zod.z.object({
  guidelinesHash: import_zod.z.string().nullable(),
  agentsMdSectionHash: import_zod.z.string().nullable(),
  claudeMdHash: import_zod.z.string().nullable(),
  // Commit SHA from get-convex/agent-skills that was current when skills were
  // last installed. Used to detect when newer skills are available.
  agentSkillsSha: import_zod.z.string().nullable()
});
const DEFAULT_AI_STATE = {
  guidelinesHash: null,
  agentsMdSectionHash: null,
  claudeMdHash: null,
  agentSkillsSha: null
};
async function attemptReadAiState(convexDir) {
  const result = await (0, import_utils.attemptReadFile)((0, import_paths.aiFilesStatePathForConvexDir)(convexDir));
  if (result.kind === "not-found" || result.kind === "empty")
    return { kind: "no-file" };
  try {
    const state = aiFilesStateSchema.parse(JSON.parse(result.content));
    return { kind: "ok", state };
  } catch (error) {
    Sentry.captureException(error);
    return { kind: "parse-error", error };
  }
}
async function readAiStateOrDefault(convexDir) {
  const result = await attemptReadAiState(convexDir);
  if (result.kind === "ok") return result.state;
  if (result.kind === "no-file") return { ...DEFAULT_AI_STATE };
  if (result.kind === "parse-error") return { ...DEFAULT_AI_STATE };
  return (0, import_utils.exhaustiveCheck)(result);
}
async function hasAiState(convexDir) {
  const result = await attemptReadAiState(convexDir);
  return result.kind === "ok";
}
async function writeAiState({
  state,
  convexDir
}) {
  const validated = aiFilesStateSchema.parse(state);
  await import_fs.promises.mkdir((0, import_paths.aiDirForConvexDir)(convexDir), { recursive: true });
  await import_fs.promises.writeFile(
    (0, import_paths.aiFilesStatePathForConvexDir)(convexDir),
    JSON.stringify(validated, null, 2) + "\n",
    "utf8"
  );
}
//# sourceMappingURL=state.js.map
