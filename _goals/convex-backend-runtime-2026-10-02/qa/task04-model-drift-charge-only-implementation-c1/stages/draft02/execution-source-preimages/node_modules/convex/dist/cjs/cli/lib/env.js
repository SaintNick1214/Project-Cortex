"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var env_exports = {};
__export(env_exports, {
  deploymentEnvBackend: () => deploymentEnvBackend,
  envGet: () => envGet,
  envList: () => envList,
  envRemove: () => envRemove,
  envSet: () => envSet
});
module.exports = __toCommonJS(env_exports);
var import_chalk = require("chalk");
var dotenv = __toESM(require("dotenv"), 1);
var import_log = require("../../bundler/log.js");
var import_run = require("./run.js");
var import_utils = require("./utils/utils.js");
var import_stdin = require("./utils/stdin.js");
var import_prompts = require("./utils/prompts.js");
var import_envvars = require("./envvars.js");
var import_formatEnvValueForDotfile = require("./formatEnvValueForDotfile.js");
var import_utils2 = require("./utils/utils.js");
function formatList(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
function deploymentEnvBackend(ctx, deployment) {
  return {
    async get(name) {
      const envVar = await (0, import_run.runSystemQuery)(ctx, {
        ...deployment,
        functionName: "_system/cli/queryEnvironmentVariables:get",
        componentPath: void 0,
        args: { name }
      });
      return envVar;
    },
    async list() {
      return await (0, import_run.runSystemQuery)(ctx, {
        ...deployment,
        functionName: "_system/cli/queryEnvironmentVariables",
        componentPath: void 0,
        args: {}
      });
    },
    async update(changes) {
      const fetch = (0, import_utils.deploymentFetch)(ctx, deployment);
      try {
        await fetch("/api/update_environment_variables", {
          body: JSON.stringify({ changes }),
          method: "POST"
        });
      } catch (e) {
        return await (0, import_utils.logAndHandleFetchError)(ctx, e);
      }
    },
    notice: deployment.deploymentNotice ?? ""
  };
}
async function envSet(ctx, backend, originalName, originalValue, options) {
  const { fromFile, force = false } = options ?? {};
  if (originalName) {
    let name = originalName, value;
    const parsed = await allowEqualsSyntax(ctx, originalName, originalValue);
    if (parsed) {
      [name, value] = parsed;
    } else if (fromFile) {
      value = await getFileContents(ctx, fromFile);
    } else if (!process.stdin.isTTY) {
      value = await getStdIn(ctx);
    } else {
      value = await (0, import_prompts.promptSecret)(ctx, {
        message: `Enter value for ${name}:`
      });
    }
    await backend.update([{ name, value }]);
    if (options?.secret) {
      const formatted = /\s/.test(value) ? `"${value}"` : value;
      (0, import_log.logFinishedStep)(
        `Successfully set ${import_chalk.chalkStderr.bold(name)} to ${import_chalk.chalkStderr.bold(formatted)}${backend.notice}`
      );
    } else {
      (0, import_log.logFinishedStep)(
        `Successfully set ${import_chalk.chalkStderr.bold(name)}${backend.notice}`
      );
    }
    return true;
  }
  let content, source;
  if (fromFile) {
    content = await getFileContents(ctx, fromFile);
    source = fromFile;
  } else if (!process.stdin.isTTY) {
    content = await getStdIn(ctx);
    source = "stdin";
  } else {
    return false;
  }
  await envSetFromContent(ctx, backend, {
    content,
    source,
    force
  });
  return true;
}
async function envGet(ctx, backend, name) {
  const envVar = await backend.get(name);
  if (envVar === null) {
    (0, import_log.logFailure)(`Environment variable "${name}" not found${backend.notice}`);
    return;
  }
  (0, import_log.logOutput)(`${envVar.value}`);
}
async function envRemove(ctx, backend, name) {
  await backend.update([{ name, value: null }]);
  (0, import_log.logFinishedStep)(
    `Successfully unset ${import_chalk.chalkStderr.bold(name)}${backend.notice}`
  );
}
async function envList(ctx, backend, options) {
  const envs = await backend.list();
  if (envs.length === 0) {
    (0, import_log.logMessage)(`No environment variables set${backend.notice}`);
    return;
  }
  for (const { name, value } of envs) {
    if (options?.namesOnly) {
      (0, import_log.logOutput)(name);
      continue;
    }
    const { formatted, warning } = (0, import_formatEnvValueForDotfile.formatEnvValueForDotfile)(value);
    if (warning) {
      (0, import_log.logMessage)(`Warning (${name}): ${warning}`);
    }
    (0, import_log.logOutput)(`${name}=${formatted}`);
  }
}
async function getFileContents(ctx, filePath) {
  if (!ctx.fs.exists(filePath)) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `error: file not found: ${filePath}`
    });
  }
  return ctx.fs.readUtf8File(filePath);
}
async function getStdIn(ctx) {
  try {
    return await (0, import_stdin.readFromStdin)();
  } catch (error) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `error: failed to read from stdin: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}
async function envSetFromContent(ctx, backend, options) {
  const { content, source, force } = options;
  const parsedEnv = dotenv.parse(content);
  const envVars = Object.entries(parsedEnv);
  const filteredVars = [];
  const envVarsToSet = [];
  const managedVars = /* @__PURE__ */ new Set([
    import_utils2.CONVEX_DEPLOY_KEY_ENV_VAR_NAME,
    import_utils2.CONVEX_DEPLOYMENT_TOKEN_ENV_VAR_NAME,
    import_utils2.CONVEX_DEPLOYMENT_ENV_VAR_NAME,
    import_utils2.CONVEX_SELF_HOSTED_URL_VAR_NAME,
    import_utils2.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME,
    ...import_envvars.EXPECTED_CONVEX_URL_NAMES,
    ...import_envvars.EXPECTED_SITE_URL_NAMES
  ]);
  for (const [name, value] of envVars) {
    if (managedVars.has(name)) {
      filteredVars.push(name);
    } else {
      envVarsToSet.push([name, value]);
    }
  }
  if (filteredVars.length > 0) {
    const varNames = filteredVars.map((n) => import_chalk.chalkStderr.bold(n));
    const formattedNames = formatList(varNames);
    (0, import_log.logMessage)(
      `Skipping ${filteredVars.length} CLI-managed environment variable${filteredVars.length === 1 ? "" : "s"}: ${formattedNames}`
    );
  }
  if (envVarsToSet.length === 0) {
    if (envVars.length === 0) {
      (0, import_log.logMessage)(`No environment variables found in ${source}.`);
    }
    return;
  }
  const existingEnvVars = await backend.list();
  const existingEnvMap = new Map(
    existingEnvVars.map((env) => [env.name, env.value])
  );
  const newVars = [];
  const updatedVars = [];
  const unchangedVars = [];
  const conflicts = [];
  for (const [name, value] of envVarsToSet) {
    const existingValue = existingEnvMap.get(name);
    if (existingValue === void 0) {
      newVars.push([name, value]);
    } else if (existingValue === value) {
      unchangedVars.push([name, value]);
    } else if (force) {
      updatedVars.push([name, value]);
    } else {
      conflicts.push({ name, existing: existingValue, new: value });
    }
  }
  if (conflicts.length > 0) {
    const varNames = conflicts.map((c) => import_chalk.chalkStderr.bold(c.name));
    const formattedNames = formatList(varNames);
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `error: environment variable${conflicts.length === 1 ? "" : "s"} ${formattedNames} already exist${conflicts.length === 1 ? "s" : ""} with different value${conflicts.length === 1 ? "" : "s"}.

Use ${import_chalk.chalkStderr.bold("--force")} to overwrite existing values.`
    });
  }
  const varsToUpdate = force ? [...newVars, ...updatedVars] : newVars;
  const changes = varsToUpdate.map(([name, value]) => ({
    name,
    value
  }));
  if (changes.length > 0) {
    await backend.update(changes);
  }
  const newCount = newVars.length;
  const updatedCount = updatedVars.length;
  const unchangedCount = unchangedVars.length;
  const parts = [];
  if (newCount > 0) parts.push(`${newCount} new`);
  if (updatedCount > 0) parts.push(`${updatedCount} updated`);
  if (unchangedCount > 0) parts.push(`${unchangedCount} unchanged`);
  const totalProcessed = newCount + updatedCount + unchangedCount;
  if (changes.length === 0) {
    (0, import_log.logMessage)(
      `All ${totalProcessed} environment variable${totalProcessed === 1 ? "" : "s"} from ${import_chalk.chalkStderr.bold(source)} already set${backend.notice}`
    );
  } else {
    (0, import_log.logFinishedStep)(
      `Successfully set ${changes.length} environment variable${changes.length === 1 ? "" : "s"} from ${import_chalk.chalkStderr.bold(source)} (${parts.join(", ")})${backend.notice}`
    );
  }
}
async function allowEqualsSyntax(ctx, name, value) {
  if (/^[a-zA-Z][a-zA-Z0-9_]*=/.test(name)) {
    const [n, ...values] = name.split("=");
    if (value === void 0) {
      return [n, values.join("=")];
    } else {
      await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `When setting an environment variable, you can either set a value with 'NAME=value', or with NAME value, but not both. Are you missing quotes around the CLI argument? Try: 
  npx convex env set '${name} ${value}'`
      });
    }
  }
  if (value === void 0) return null;
  return [name, value];
}
//# sourceMappingURL=env.js.map
