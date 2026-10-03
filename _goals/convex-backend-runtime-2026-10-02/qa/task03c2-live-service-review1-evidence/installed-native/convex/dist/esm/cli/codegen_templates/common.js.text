"use strict";
export function header(oneLineDescription) {
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
export function apiComment(apiName, type) {
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
export function compareStrings(a, b) {
  return collator.compare(a, b);
}
export function compareModulePaths(a, b) {
  const aNormalized = a.replace(/\\/g, "/");
  const bNormalized = b.replace(/\\/g, "/");
  return aNormalized < bNormalized ? -1 : aNormalized > bNormalized ? 1 : 0;
}
//# sourceMappingURL=common.js.map
