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
var deploymentSelector_exports = {};
__export(deploymentSelector_exports, {
  parseDeploymentSelector: () => parseDeploymentSelector
});
module.exports = __toCommonJS(deploymentSelector_exports);
function parseInProjectSelector(s) {
  if (s === "dev") return { kind: "dev" };
  if (s === "prod") return { kind: "prod" };
  if (s === "local") return { kind: "local" };
  return { kind: "reference", reference: s };
}
function parseDeploymentSelector(selector) {
  if (/^[a-z]+-[a-z]+-[0-9]+$/.test(selector)) {
    return { kind: "deploymentName", deploymentName: selector };
  }
  const parts = selector.split(":");
  if (parts.length === 3) {
    return {
      kind: "inTeamProject",
      teamSlug: parts[0],
      projectSlug: parts[1],
      selector: parseInProjectSelector(parts[2])
    };
  }
  if (parts.length === 2) {
    return {
      kind: "inProject",
      projectSlug: parts[0],
      selector: parseInProjectSelector(parts[1])
    };
  }
  return {
    kind: "inCurrentProject",
    selector: parseInProjectSelector(selector)
  };
}
//# sourceMappingURL=deploymentSelector.js.map
