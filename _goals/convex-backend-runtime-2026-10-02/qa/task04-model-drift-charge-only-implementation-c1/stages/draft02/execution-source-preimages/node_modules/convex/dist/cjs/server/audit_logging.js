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
var audit_logging_exports = {};
__export(audit_logging_exports, {
  audit: () => audit,
  cloneWithSentinels: () => cloneWithSentinels
});
module.exports = __toCommonJS(audit_logging_exports);
var import__ = require("../index.js");
var import_syscall = require("./impl/syscall.js");
var import_logVars = require("./logVars.js");
function validateKey(key) {
  if (key.startsWith("$")) {
    throw new Error(`Audit log body keys must not start with "$": "${key}"`);
  }
}
function cloneValue(value) {
  if (typeof value === "symbol") {
    if (!(value in import_logVars.varNames)) {
      throw new Error(`Unknown audit var symbol: ${String(value)}.`);
    }
    return { $var: import_logVars.varNames[value] };
  }
  if (value === null || value === void 0 || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  const result = {};
  for (const [key, val] of Object.entries(value)) {
    validateKey(key);
    result[key] = cloneValue(val);
  }
  return result;
}
function cloneWithSentinels(body) {
  const result = {};
  for (const [key, val] of Object.entries(body)) {
    validateKey(key);
    result[key] = cloneValue(val);
  }
  return result;
}
const audit = async (body) => {
  await (0, import_syscall.performAsyncSyscall)("1.0/auditLog", {
    body: cloneWithSentinels(body),
    version: import__.version
  });
};
//# sourceMappingURL=audit_logging.js.map
