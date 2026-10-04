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
var logVars_exports = {};
__export(logVars_exports, {
  varNames: () => varNames,
  vars: () => vars
});
module.exports = __toCommonJS(logVars_exports);
const REQUEST_ID = Symbol("var.requestId");
const IP = Symbol("var.ip");
const USER_AGENT = Symbol("var.userAgent");
const NOW = Symbol("var.now");
const CONVEX_ACTOR = Symbol("var.convexActor");
const varNames = {
  [REQUEST_ID]: "requestId",
  [IP]: "ip",
  [USER_AGENT]: "userAgent",
  [NOW]: "now",
  [CONVEX_ACTOR]: "convexActor"
};
const vars = {
  /** Resolved to the request ID. */
  requestId: REQUEST_ID,
  /** Resolved to the client's IP address. */
  ip: IP,
  /** Resolved to the client's User-Agent header. */
  userAgent: USER_AGENT,
  /**
   * Resolved to the current server timestamp, as milliseconds from the
   * Unix epoch.
   */
  now: NOW,
  /**
   * If the function was invoked using admin auth (either directly or while
   * acting as an end user, e.g. from the dashboard), resolved to information
   * about the admin. Otherwise, resolved to `null`.
   */
  convexActor: CONVEX_ACTOR
};
//# sourceMappingURL=logVars.js.map
