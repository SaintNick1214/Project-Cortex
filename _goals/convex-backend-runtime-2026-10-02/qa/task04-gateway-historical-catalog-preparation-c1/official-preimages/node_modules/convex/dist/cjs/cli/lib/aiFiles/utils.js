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
var utils_exports = {};
__export(utils_exports, {
  attemptReadFile: () => attemptReadFile,
  attemptToRemoveMarkdownSection: () => attemptToRemoveMarkdownSection,
  attemptToStripManagedSection: () => attemptToStripManagedSection,
  exhaustiveCheck: () => exhaustiveCheck,
  hasManagedSection: () => hasManagedSection,
  iife: () => iife,
  injectManagedSection: () => injectManagedSection,
  isInInteractiveTerminal: () => isInInteractiveTerminal,
  readFileOrNull: () => readFileOrNull,
  safelyDeleteFile: () => safelyDeleteFile
});
module.exports = __toCommonJS(utils_exports);
var import_fs = require("fs");
var import_chalk = require("chalk");
var import_log = require("../../../bundler/log.js");
var import_hash = require("../utils/hash.js");
function isInInteractiveTerminal() {
  return process.stdin.isTTY === true;
}
async function attemptReadFile(filePath) {
  try {
    const content = await import_fs.promises.readFile(filePath, "utf8");
    if (content.length === 0) return { kind: "empty" };
    return { kind: "content", content };
  } catch (error) {
    if (error.code === "ENOENT")
      return { kind: "not-found" };
    throw error;
  }
}
async function readFileOrNull(filePath) {
  const result = await attemptReadFile(filePath);
  if (result.kind === "content") return result.content;
  if (result.kind === "empty") return "";
  if (result.kind === "not-found") return null;
  return exhaustiveCheck(result);
}
async function safelyDeleteFile(filePath) {
  try {
    await import_fs.promises.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
const iife = (fn) => fn();
async function injectManagedSection(opts) {
  const { filePath, startMarker, endMarker, section } = opts;
  const existing = await readFileOrNull(filePath) ?? "";
  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);
  const updated = iife(() => {
    if (startIdx !== -1 && endIdx !== -1)
      return existing.slice(0, startIdx) + section + existing.slice(endIdx + endMarker.length);
    if (existing.length > 0)
      return existing.trimEnd() + "\n\n" + section + "\n";
    return section + "\n";
  });
  const didWrite = updated !== existing;
  if (didWrite) await import_fs.promises.writeFile(filePath, updated, "utf8");
  return { sectionHash: (0, import_hash.hashSha256)(section), didWrite };
}
async function attemptToStripManagedSection(opts) {
  const { filePath, startMarker, endMarker } = opts;
  const content = await readFileOrNull(filePath);
  if (content === null) return "none";
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    return "none";
  }
  const before = content.slice(0, startIdx).trimEnd();
  const after = content.slice(endIdx + endMarker.length).trimStart();
  const updated = [before, after].filter(Boolean).join("\n\n");
  if (!updated.trim()) {
    await safelyDeleteFile(filePath);
    return "file";
  }
  await import_fs.promises.writeFile(filePath, updated + "\n", "utf8");
  return "section";
}
function exhaustiveCheck(_param) {
  throw new Error("Internal error: exhaustive check failed.");
}
async function attemptToRemoveMarkdownSection({
  projectDir,
  strip,
  fileName
}) {
  const result = await strip(projectDir);
  if (result === "section") {
    (0, import_log.logMessage)(
      `${import_chalk.chalkStderr.green("\u2714")} Removed Convex section from ${fileName}.`
    );
    return true;
  }
  if (result === "file") {
    (0, import_log.logMessage)(`${import_chalk.chalkStderr.green("\u2714")} Deleted ${fileName}.`);
    return true;
  }
  if (result === "none") return false;
  return exhaustiveCheck(result);
}
async function hasManagedSection(opts) {
  const content = await readFileOrNull(opts.filePath);
  return content !== null && content.includes(opts.startMarker) && content.includes(opts.endMarker);
}
//# sourceMappingURL=utils.js.map
