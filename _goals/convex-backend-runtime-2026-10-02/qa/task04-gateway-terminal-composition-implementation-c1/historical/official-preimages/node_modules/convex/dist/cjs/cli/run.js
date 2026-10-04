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
var run_exports = {};
__export(run_exports, {
  run: () => run
});
module.exports = __toCommonJS(run_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_chalk = require("chalk");
var import_log = require("../bundler/log.js");
var import_context = require("../bundler/context.js");
var import_value = require("../values/value.js");
var import_api = require("./lib/api.js");
var import_command = require("./lib/command.js");
var import_run = require("./lib/run.js");
var import_utils = require("./lib/utils/utils.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_run2 = require("./lib/localDeployment/run.js");
var import_runTestFunction = require("./lib/runTestFunction.js");
var import_utils2 = require("./lib/utils/utils.js");
const run = new import_extra_typings.Command("run").summary(
  "Run a function or evaluate an inline readonly query on your deployment"
).description(
  [
    "Run a function or evaluate an inline readonly query on your deployment.",
    "",
    '\u2022 Run a function with JSON arguments: `npx convex run messages:send \'{"body": "hello", "author": "me"}\'`',
    "\u2022 Run a function on prod: `npx convex run messages:list --prod`",
    "\u2022 Live-update a query's result: `npx convex run messages:list --watch`",
    "\u2022 Push local code before running: `npx convex run messages:send '{}' --push`",
    "\u2022 Evaluate an inline readonly query: `npx convex run --inline-query 'await ctx.db.query(\"messages\").take(5)'`",
    "",
    "Arguments are specified as a JSON object. By default, this runs on your dev deployment."
  ].join("\n")
).allowExcessArguments(false).addRunOptions().addDeploymentSelectionOptions((0, import_command.actionDescription)("Run the function on")).showHelpAfterError().action(async (functionName, argsString, options) => {
  const ctx = await (0, import_context.oneoffContext)(options);
  const target = await resolveRunTarget({
    ctx,
    functionName,
    argsString,
    options
  });
  if (target.kind === "function" || options.push) {
    await (0, import_utils.ensureHasConvexDependency)(ctx, "run");
  }
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const deployment = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    { ensureLocalRunning: false }
  );
  if (deployment.deploymentFields?.deploymentType === "prod" && options.push) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `\`convex run\` doesn't support pushing functions to prod deployments. Remove the --push flag. To push to production use \`npx convex deploy\`.`
    });
  }
  await (0, import_run2.withRunningBackend)({
    ctx,
    deployment: {
      deploymentUrl: deployment.url,
      deploymentFields: deployment.deploymentFields
    },
    action: async () => {
      if (target.kind === "inlineQuery") {
        if (options.push) {
          await (0, import_run.pushToDeployment)(ctx, {
            deploymentUrl: deployment.url,
            adminKey: deployment.adminKey,
            deploymentName: deployment.deploymentFields?.deploymentName ?? null,
            typecheck: options.typecheck,
            typecheckComponents: options.typecheckComponents,
            codegen: options.codegen === "enable",
            liveComponentSources: Boolean(options.liveComponentSources)
          });
        }
        return await runInlineQueryInDeployment({
          ctx,
          deploymentUrl: deployment.url,
          adminKey: deployment.adminKey,
          inlineQuery: target.inlineQuery,
          ...options.component !== void 0 ? { componentPath: options.component } : {}
        });
      }
      await (0, import_run.runInDeployment)(ctx, {
        deploymentUrl: deployment.url,
        adminKey: deployment.adminKey,
        deploymentName: deployment.deploymentFields?.deploymentName ?? null,
        functionName: target.functionName,
        argsString: target.argsString,
        componentPath: options.component,
        identityString: options.identity,
        push: Boolean(options.push),
        watch: Boolean(options.watch),
        typecheck: options.typecheck,
        typecheckComponents: options.typecheckComponents,
        codegen: options.codegen === "enable",
        liveComponentSources: Boolean(options.liveComponentSources)
      });
    }
  });
});
async function resolveRunTarget(args) {
  const inlineQuery = args.options.inlineQuery?.trim();
  if (inlineQuery !== void 0 && args.functionName !== void 0) {
    return await args.ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`npx convex run` accepts either <functionName> or `--inline-query`, not both."
    });
  }
  if (inlineQuery === void 0) {
    if (args.functionName === void 0) {
      return await args.ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "`npx convex run` requires either <functionName> or `--inline-query`."
      });
    }
    return {
      kind: "function",
      functionName: args.functionName,
      argsString: args.argsString ?? "{}"
    };
  }
  if (inlineQuery.length === 0) {
    return await args.ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--inline-query` must not be empty."
    });
  }
  if (args.options.watch) {
    return await args.ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--inline-query` can't be combined with `--watch`. Use `convex run <functionName> --watch` for named deployed queries."
    });
  }
  if (args.options.identity !== void 0) {
    return await args.ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--inline-query` can't be combined with `--identity`."
    });
  }
  return { kind: "inlineQuery", inlineQuery };
}
async function runInlineQueryInDeployment(args) {
  try {
    const componentId = await resolveInlineQueryComponentId(args);
    const outcome = await (0, import_runTestFunction.runTestFunctionQuery)(args.ctx, {
      deploymentUrl: args.deploymentUrl,
      adminKey: args.adminKey,
      querySource: (0, import_runTestFunction.inlineQueryToQuerySource)(args.inlineQuery),
      ...componentId !== void 0 ? { componentId } : {}
    });
    if (outcome.kind === "applicationFailure") {
      return await args.ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: import_chalk.chalkStderr.red(
          `Query failed: ${JSON.stringify(outcome.payload, null, 2)}`
        )
      });
    }
    for (const line of outcome.logLines) {
      (0, import_log.logMessage)(line);
    }
    const convexValue = (0, import_value.jsonToConvex)(outcome.value);
    if (convexValue !== null) (0, import_log.logOutput)((0, import_run.formatValue)(convexValue));
  } catch (err) {
    if (err instanceof import_utils2.ThrowingFetchError) return await err.handle(args.ctx);
    return await (0, import_utils2.logAndHandleFetchError)(args.ctx, err);
  }
}
async function resolveInlineQueryComponentId(args) {
  const componentPath = args.componentPath?.trim();
  if (componentPath === void 0 || componentPath === "_App") {
    return void 0;
  }
  if (componentPath.length === 0) {
    return await args.ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--component` must not be empty."
    });
  }
  const components = await (0, import_run.runSystemQuery)(args.ctx, {
    deploymentUrl: args.deploymentUrl,
    adminKey: args.adminKey,
    functionName: "_system/frontend/components:list",
    componentPath: void 0,
    args: {}
  });
  const component = components.find(({ path }) => path === componentPath);
  if (component !== void 0) {
    return component.id;
  }
  const availableComponents = components.map(({ path }) => path).filter((path) => path.length > 0).sort();
  const availableComponentsMessage = availableComponents.length === 0 ? "This deployment has no mounted components." : `Available components:
${availableComponents.map((path) => `\u2022 ${import_chalk.chalkStderr.gray(path)}`).join("\n")}`;
  return await args.ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: `Component path "${componentPath}" was not found.

${availableComponentsMessage}
Omit \`--component\` to target the app root.`
  });
}
//# sourceMappingURL=run.js.map
