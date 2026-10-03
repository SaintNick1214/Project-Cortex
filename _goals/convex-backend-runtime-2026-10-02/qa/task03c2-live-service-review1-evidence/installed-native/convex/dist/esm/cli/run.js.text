"use strict";
import { Command } from "@commander-js/extra-typings";
import { chalkStderr } from "chalk";
import { logMessage, logOutput } from "../bundler/log.js";
import { oneoffContext } from "../bundler/context.js";
import { jsonToConvex } from "../values/value.js";
import { loadSelectedDeploymentCredentials } from "./lib/api.js";
import { actionDescription } from "./lib/command.js";
import {
  formatValue,
  pushToDeployment,
  runInDeployment,
  runSystemQuery
} from "./lib/run.js";
import { ensureHasConvexDependency } from "./lib/utils/utils.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
import { withRunningBackend } from "./lib/localDeployment/run.js";
import {
  inlineQueryToQuerySource,
  runTestFunctionQuery
} from "./lib/runTestFunction.js";
import {
  logAndHandleFetchError,
  ThrowingFetchError
} from "./lib/utils/utils.js";
export const run = new Command("run").summary(
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
).allowExcessArguments(false).addRunOptions().addDeploymentSelectionOptions(actionDescription("Run the function on")).showHelpAfterError().action(async (functionName, argsString, options) => {
  const ctx = await oneoffContext(options);
  const target = await resolveRunTarget({
    ctx,
    functionName,
    argsString,
    options
  });
  if (target.kind === "function" || options.push) {
    await ensureHasConvexDependency(ctx, "run");
  }
  const deploymentSelection = await getDeploymentSelection(ctx, options);
  const deployment = await loadSelectedDeploymentCredentials(
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
  await withRunningBackend({
    ctx,
    deployment: {
      deploymentUrl: deployment.url,
      deploymentFields: deployment.deploymentFields
    },
    action: async () => {
      if (target.kind === "inlineQuery") {
        if (options.push) {
          await pushToDeployment(ctx, {
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
      await runInDeployment(ctx, {
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
    const outcome = await runTestFunctionQuery(args.ctx, {
      deploymentUrl: args.deploymentUrl,
      adminKey: args.adminKey,
      querySource: inlineQueryToQuerySource(args.inlineQuery),
      ...componentId !== void 0 ? { componentId } : {}
    });
    if (outcome.kind === "applicationFailure") {
      return await args.ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: chalkStderr.red(
          `Query failed: ${JSON.stringify(outcome.payload, null, 2)}`
        )
      });
    }
    for (const line of outcome.logLines) {
      logMessage(line);
    }
    const convexValue = jsonToConvex(outcome.value);
    if (convexValue !== null) logOutput(formatValue(convexValue));
  } catch (err) {
    if (err instanceof ThrowingFetchError) return await err.handle(args.ctx);
    return await logAndHandleFetchError(args.ctx, err);
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
  const components = await runSystemQuery(args.ctx, {
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
${availableComponents.map((path) => `\u2022 ${chalkStderr.gray(path)}`).join("\n")}`;
  return await args.ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: `Component path "${componentPath}" was not found.

${availableComponentsMessage}
Omit \`--component\` to target the app root.`
  });
}
//# sourceMappingURL=run.js.map
