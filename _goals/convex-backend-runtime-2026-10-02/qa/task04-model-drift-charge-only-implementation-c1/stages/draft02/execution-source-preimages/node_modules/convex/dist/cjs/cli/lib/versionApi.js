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
var versionApi_exports = {};
__export(versionApi_exports, {
  downloadGuidelines: () => downloadGuidelines,
  fetchAgentSkillsCatalog: () => fetchAgentSkillsCatalog,
  fetchAgentSkillsSha: () => fetchAgentSkillsSha,
  getVersion: () => getVersion,
  validateAgentSkillCatalogResult: () => validateAgentSkillCatalogResult,
  validateVersionResult: () => validateVersionResult
});
module.exports = __toCommonJS(versionApi_exports);
var Sentry = __toESM(require("@sentry/node"), 1);
var import_zod = require("zod");
var import_version = require("../version.js");
const DEFAULT_VERSION_API_ORIGIN = "https://version.convex.dev";
const VERSION_API_ORIGIN_ENV_VAR = "CONVEX_VERSION_API_ORIGIN";
function versionApiOrigin() {
  return process.env[VERSION_API_ORIGIN_ENV_VAR] ?? DEFAULT_VERSION_API_ORIGIN;
}
function versionApiEndpoint(path) {
  return `${versionApiOrigin()}${path}`;
}
const HEADERS = {
  "Convex-Client": `npm-cli-${import_version.version}`,
  // Useful telemetry proxy for "human at a terminal" vs automated/background execution.
  "Convex-Interactive": process.stdin.isTTY === true ? "true" : "false"
};
if (process.env.CONVEX_AGENT_MODE) {
  HEADERS["Convex-Agent-Mode"] = process.env.CONVEX_AGENT_MODE;
}
const optionalStringToNullSchema = import_zod.z.unknown().optional().transform((value) => typeof value === "string" ? value : null);
const optionalTrueToBooleanSchema = import_zod.z.unknown().optional().transform((value) => value === true);
const versionResultSchema = import_zod.z.object({
  message: import_zod.z.string().nullable(),
  guidelinesHash: optionalStringToNullSchema,
  agentSkillsSha: optionalStringToNullSchema,
  disableSkillsCli: optionalTrueToBooleanSchema,
  disableSkillsCliMessage: optionalStringToNullSchema
});
const agentSkillStatusSchema = import_zod.z.discriminatedUnion("kind", [
  import_zod.z.object({
    kind: import_zod.z.literal("active")
  }),
  import_zod.z.object({
    kind: import_zod.z.literal("deleted"),
    deletedAt: import_zod.z.number()
  })
]);
const agentSkillCatalogEntrySchema = import_zod.z.object({
  skillName: import_zod.z.string(),
  status: agentSkillStatusSchema,
  hash: import_zod.z.string(),
  lastSeenRepoSha: import_zod.z.string(),
  lastSeenAt: import_zod.z.number()
});
const agentSkillCatalogResultSchema = import_zod.z.object({
  latestRepoSha: import_zod.z.string().nullable(),
  skills: import_zod.z.array(agentSkillCatalogEntrySchema)
});
async function getVersion() {
  try {
    const req = await fetch(versionApiEndpoint("/v1/version"), {
      headers: HEADERS
    });
    if (!req.ok) {
      Sentry.captureException(
        new Error(`Failed to fetch version: status = ${req.status}`)
      );
      return { kind: "error" };
    }
    const json = await req.json();
    const result = validateVersionResult(json);
    if (result === null) return { kind: "error" };
    return { kind: "ok", data: result };
  } catch (error) {
    Sentry.captureException(error);
    return { kind: "error" };
  }
}
function validateVersionResult(json) {
  const result = versionResultSchema.safeParse(json);
  if (!result.success) {
    Sentry.captureMessage("Invalid version result", "error");
    return null;
  }
  return result.data;
}
function validateAgentSkillCatalogResult(json) {
  const result = agentSkillCatalogResultSchema.safeParse(json);
  if (!result.success) {
    Sentry.captureMessage("Invalid agent skill catalog result", "error");
    return null;
  }
  return result.data;
}
async function fetchAgentSkillsSha() {
  const versionData = await getVersion();
  if (versionData.kind === "error") return null;
  return versionData.data.agentSkillsSha;
}
async function fetchAgentSkillsCatalog() {
  try {
    const req = await fetch(versionApiEndpoint("/v1/agent_skills"), {
      headers: HEADERS
    });
    if (!req.ok) {
      Sentry.captureException(
        new Error(
          `Failed to fetch agent skills catalog: status = ${req.status}`
        )
      );
      return { kind: "error" };
    }
    const json = await req.json();
    const result = validateAgentSkillCatalogResult(json);
    if (result === null) return { kind: "error" };
    return { kind: "ok", data: result };
  } catch (error) {
    Sentry.captureException(error);
    return { kind: "error" };
  }
}
async function downloadGuidelines() {
  try {
    const req = await fetch(versionApiEndpoint("/v1/guidelines"), {
      headers: HEADERS
    });
    if (!req.ok) {
      Sentry.captureMessage(
        `Failed to fetch Convex guidelines: status = ${req.status}`
      );
      return null;
    }
    const text = await req.text();
    return text;
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}
//# sourceMappingURL=versionApi.js.map
