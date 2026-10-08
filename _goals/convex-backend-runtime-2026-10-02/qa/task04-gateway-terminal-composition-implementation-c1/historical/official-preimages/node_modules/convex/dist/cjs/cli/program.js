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
var program_exports = {};
__export(program_exports, {
  buildProgram: () => buildProgram
});
module.exports = __toCommonJS(program_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_aiFiles = require("./aiFiles.js");
var import_auth = require("./auth.js");
var import_codegen = require("./codegen.js");
var import_convexExport = require("./convexExport.js");
var import_convexImport = require("./convexImport.js");
var import_dashboard = require("./dashboard.js");
var import_data = require("./data.js");
var import_deploy = require("./deploy.js");
var import_deployment = require("./deployment.js");
var import_deployments = require("./deployments.js");
var import_dev = require("./dev.js");
var import_docs = require("./docs.js");
var import_env = require("./env.js");
var import_functionSpec = require("./functionSpec.js");
var import_init = require("./init.js");
var import_insights = require("./insights.js");
var import_integration = require("./integration.js");
var import_login = require("./login.js");
var import_logout = require("./logout.js");
var import_logs = require("./logs.js");
var import_mcp = require("./mcp.js");
var import_network_test = require("./network_test.js");
var import_project = require("./project.js");
var import_reinit = require("./reinit.js");
var import_run = require("./run.js");
var import_typecheck = require("./typecheck.js");
var import_update = require("./update.js");
var import_version = require("./version.js");
function buildProgram() {
  const program = new import_extra_typings.Command();
  return program.name("convex").usage("<command> [options]").description("Start developing with Convex by running `npx convex dev`.").addCommand(import_login.login, { hidden: true }).addCommand(import_init.init, { hidden: true }).addCommand(import_reinit.reinit, { hidden: true }).addCommand(import_dev.dev).addCommand(import_deploy.deploy).addCommand(import_deployments.deployments, { hidden: true }).addCommand(import_run.run).addCommand(import_convexImport.convexImport).addCommand(import_dashboard.dashboard).addCommand(import_docs.docs).addCommand(import_logs.logs).addCommand(import_typecheck.typecheck, { hidden: true }).addCommand(import_auth.auth, { hidden: true }).addCommand(import_convexExport.convexExport).addCommand(import_env.env).addCommand(import_data.data).addCommand(import_deployment.deployment).addCommand(import_project.project).addCommand(import_codegen.codegen).addCommand(import_update.update).addCommand(import_logout.logout).addCommand(import_network_test.networkTest, { hidden: true }).addCommand(import_integration.integration, { hidden: true }).addCommand(import_functionSpec.functionSpec).addCommand(import_insights.insights).addCommand(import_mcp.mcp).addCommand(import_aiFiles.aiFiles).helpCommand("help <command>", "Show help for given <command>").version(import_version.version).configureHelp({ visibleOptions: () => [] }).showHelpAfterError();
}
//# sourceMappingURL=program.js.map
