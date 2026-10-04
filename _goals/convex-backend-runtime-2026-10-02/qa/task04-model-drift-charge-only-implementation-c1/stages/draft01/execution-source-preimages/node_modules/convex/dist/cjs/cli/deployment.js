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
var deployment_exports = {};
__export(deployment_exports, {
  deployment: () => deployment
});
module.exports = __toCommonJS(deployment_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_deploymentSelect = require("./deploymentSelect.js");
var import_deploymentCreate = require("./deploymentCreate.js");
var import_deploymentToken = require("./deploymentToken.js");
var import_usageLimits = require("./usageLimits.js");
const deployment = new import_extra_typings.Command("deployment").summary("Manage deployments").description("Manage deployments in your project.").addCommand(import_deploymentSelect.deploymentSelect).addCommand(import_deploymentCreate.deploymentCreate).addCommand(import_deploymentToken.deploymentToken).addCommand(import_usageLimits.usage).addCommand(import_usageLimits.usageLimits);
//# sourceMappingURL=deployment.js.map
