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
var common_exports = {};
__export(common_exports, {
  apiComment: () => apiComment,
  compareModulePaths: () => compareModulePaths,
  compareStrings: () => compareStrings,
  header: () => header
});
module.exports = __toCommonJS(common_exports);
function header(oneLineDescription) {
  return `/* eslint-disable */
  /**
   * ${oneLineDescription}
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run \`npx convex dev\`.
   * @module
   */
  `;
}
function apiComment(apiName, type) {
  return `
  /**
     * A utility for referencing Convex functions in your app's${type ? ` ${type}` : ""} API.
     *
     * Usage:
     * \`\`\`js
     * const myFunctionReference = ${apiName}.myModule.myFunction;
     * \`\`\`
     */`;
}
const collator = new Intl.Collator("en-US", {
  usage: "sort",
  numeric: true,
  sensitivity: "case",
  ignorePunctuation: false,
  caseFirst: "false"
});
function compareStrings(a, b) {
  return collator.compare(a, b);
}
function compareModulePaths(a, b) {
  const aNormalized = a.replace(/\\/g, "/");
  const bNormalized = b.replace(/\\/g, "/");
  return aNormalized < bNormalized ? -1 : aNormalized > bNormalized ? 1 : 0;
}
//# sourceMappingURL=common.js.map
