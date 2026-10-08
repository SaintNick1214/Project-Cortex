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
var init_exports = {};
__export(init_exports, {
  init: () => init
});
module.exports = __toCommonJS(init_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_configure = require("./configure.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_updates = require("./lib/updates.js");
var import_usage = require("./lib/usage.js");
const init = new import_extra_typings.Command("init").description(
  "Ensures a Convex project is configured and initialized in the current directory. Does nothing if one is already configured. Unlike `npx convex dev`, it will not push code or typecheck.\nTypically you can skip this and run `npx convex dev` directly which will both initialize and continously deploy code. \n\nTo initialize an agent: `export CONVEX_AGENT_MODE=anonymous && npx convex init && npx convex env set < .env.defaults && npx convex dev`."
).summary(
  "Ensures a Convex project is configured. Does not push code. No-ops if already configured."
).allowExcessArguments(false).action(async () => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  (0, import_context.installSigintHandler)(ctx);
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {});
  const credentials = await (0, import_configure.deploymentCredentialsOrConfigure)(
    ctx,
    deploymentSelection,
    null,
    {
      prod: false,
      localOptions: {
        ports: {
          cloud: void 0,
          site: void 0
        },
        forceUpgrade: false
      }
    }
  );
  if (credentials.deploymentFields !== null) {
    await Promise.all([
      (0, import_usage.usageStateWarning)(ctx, credentials.deploymentFields.deploymentName),
      (0, import_updates.checkVersionAndAiFilesStaleness)(ctx)
    ]);
  }
  await ctx.flushAndExit(0);
});
//# sourceMappingURL=init.js.map
