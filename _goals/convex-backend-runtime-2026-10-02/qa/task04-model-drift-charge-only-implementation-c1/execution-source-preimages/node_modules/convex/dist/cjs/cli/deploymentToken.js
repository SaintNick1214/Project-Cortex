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
var deploymentToken_exports = {};
__export(deploymentToken_exports, {
  deploymentToken: () => deploymentToken
});
module.exports = __toCommonJS(deploymentToken_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_deploymentTokenCreate = require("./deploymentTokenCreate.js");
var import_deploymentTokenDelete = require("./deploymentTokenDelete.js");
const deploymentToken = new import_extra_typings.Command("token").summary("Manage access tokens").description(
  "Create and delete access tokens. Currently supports deploy keys."
).addCommand(import_deploymentTokenCreate.deploymentTokenCreate).addCommand(import_deploymentTokenDelete.deploymentTokenDelete);
//# sourceMappingURL=deploymentToken.js.map
