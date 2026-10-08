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
var expiration_exports = {};
__export(expiration_exports, {
  parseExpiration: () => parseExpiration,
  resolveExpiration: () => resolveExpiration,
  validateExpiration: () => validateExpiration
});
module.exports = __toCommonJS(expiration_exports);
const PARSE_ERROR_MESSAGE = `Supported formats:
  "none"                          \u2014 no expiration
  "in 7 days"                     \u2014 relative (minutes, hours, days)
  "2026-04-01T00:00:00Z"          \u2014 UTC datetime
  "1711828382"                    \u2014 Unix timestamp (seconds)
  "1711828382000"                 \u2014 Unix timestamp (milliseconds)`;
const UNIT_MS = {
  minute: 60 * 1e3,
  hour: 60 * 60 * 1e3,
  day: 24 * 60 * 60 * 1e3
};
function parseExpiration(input) {
  const trimmed = input.trim();
  if (trimmed.toLowerCase() === "none") {
    return { kind: "none" };
  }
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return {
      kind: "absolute",
      timestampMs: n < 1e12 ? n * 1e3 : n
      // already milliseconds
    };
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(trimmed)) {
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) {
      return {
        kind: "error",
        message: `Invalid UTC datetime: "${trimmed}". ${PARSE_ERROR_MESSAGE}`
      };
    }
    return { kind: "absolute", timestampMs: date.getTime() };
  }
  const relativeMatch = trimmed.match(/^in\s+(\d+)\s+(minute|hour|day)s?$/i);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    return { kind: "relative", amount, unit };
  }
  return {
    kind: "error",
    message: `Invalid expiration format: "${trimmed}". ${PARSE_ERROR_MESSAGE}`
  };
}
function resolveExpiration(parsed, now) {
  switch (parsed.kind) {
    case "none":
      return null;
    case "absolute":
      return parsed.timestampMs;
    case "relative": {
      const base = now ?? Date.now();
      return base + parsed.amount * UNIT_MS[parsed.unit];
    }
  }
}
function validateExpiration(timestampMs, now) {
  const base = now ?? Date.now();
  const thirtyMinutes = 30 * 60 * 1e3;
  const oneYear = 365 * 24 * 60 * 60 * 1e3;
  if (timestampMs <= base) {
    return { kind: "error", message: "Expiration must be in the future." };
  }
  if (timestampMs - base < thirtyMinutes) {
    return {
      kind: "error",
      message: "Expiration must be at least 30 minutes from now."
    };
  }
  if (timestampMs - base > oneYear) {
    return {
      kind: "error",
      message: "Expiration must be at most 1 year from now."
    };
  }
  return { kind: "success" };
}
//# sourceMappingURL=expiration.js.map
