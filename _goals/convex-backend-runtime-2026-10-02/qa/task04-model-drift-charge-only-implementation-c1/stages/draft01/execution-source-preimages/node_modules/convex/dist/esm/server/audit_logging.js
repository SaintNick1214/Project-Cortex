"use strict";
import { version } from "../index.js";
import { performAsyncSyscall } from "./impl/syscall.js";
import { varNames } from "./logVars.js";
function validateKey(key) {
  if (key.startsWith("$")) {
    throw new Error(`Audit log body keys must not start with "$": "${key}"`);
  }
}
function cloneValue(value) {
  if (typeof value === "symbol") {
    if (!(value in varNames)) {
      throw new Error(`Unknown audit var symbol: ${String(value)}.`);
    }
    return { $var: varNames[value] };
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
export function cloneWithSentinels(body) {
  const result = {};
  for (const [key, val] of Object.entries(body)) {
    validateKey(key);
    result[key] = cloneValue(val);
  }
  return result;
}
export const audit = async (body) => {
  await performAsyncSyscall("1.0/auditLog", {
    body: cloneWithSentinels(body),
    version
  });
};
//# sourceMappingURL=audit_logging.js.map
