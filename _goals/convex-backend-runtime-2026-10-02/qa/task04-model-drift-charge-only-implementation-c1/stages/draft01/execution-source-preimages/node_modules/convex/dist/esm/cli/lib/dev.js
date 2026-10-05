"use strict";
import { chalkStderr } from "chalk";
import { spawn } from "child_process";
import {
  logError,
  logFinishedStep,
  logMessage,
  logWarning,
  showSpinner,
  showSpinnerIfSlow,
  stopSpinner
} from "../../bundler/log.js";
import { runPush } from "./components.js";
import { performance } from "perf_hooks";
import path from "path";
import { LogManager, watchLogs } from "./logs.js";
import {
  formatDuration,
  getCurrentTimeString,
  waitForever,
  waitUntilCalled
} from "./utils/utils.js";
import { Crash, WatchContext, Watcher } from "./watch.js";
import { runFunctionAndLog, subscribe } from "./run.js";
import { readProjectConfig, getAuthKitConfig } from "./config.js";
import {
  syncAuthKitConfigAfterPush,
  ensureAuthKitProvisionedBeforeBuild
} from "./workos/workos.js";
import { handleDashboard } from "./localDeployment/dashboard.js";
import { loadDeploymentConfig } from "./localDeployment/filePaths.js";
import { LocalDeploymentError } from "./localDeployment/errors.js";
export async function devAgainstDeployment(ctx, credentials, devOptions) {
  const logManager = new LogManager(devOptions.tailLogs);
  const { projectConfig } = await readProjectConfig(ctx);
  const authKitConfig = await getAuthKitConfig(ctx, projectConfig);
  if (authKitConfig && credentials.deploymentName) {
    const deploymentType = credentials.deploymentType;
    if (deploymentType === "dev" || deploymentType === "preview" || deploymentType === "prod") {
      await ensureAuthKitProvisionedBeforeBuild(
        ctx,
        credentials.deploymentName,
        { deploymentUrl: credentials.url, adminKey: credentials.adminKey },
        deploymentType
      );
    }
  }
  if (!devOptions.once && !devOptions.untilSuccess && credentials.deploymentType === "anonymous" && credentials.deploymentName !== null) {
    const deploymentConfig = loadDeploymentConfig(
      ctx,
      "anonymous",
      credentials.deploymentName
    );
    if (deploymentConfig === null) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Could not find local deployment config. This is a bug in Convex.`,
        errForSentry: new LocalDeploymentError(
          `Could not find local deployment config to start the anonymous dashboard.`
        )
      });
    }
    await handleDashboard(
      ctx,
      {
        name: credentials.deploymentName,
        cloudPort: deploymentConfig.ports.cloud,
        adminKey: deploymentConfig.adminKey
      },
      {
        backendVersion: credentials.backendVersion
      }
    );
  }
  const promises = [];
  if (devOptions.tailLogs !== "disable") {
    promises.push(
      watchLogs(ctx, credentials.url, credentials.adminKey, "stderr", {
        logManager,
        success: false
      })
    );
  }
  promises.push(
    watchAndPush(
      ctx,
      {
        ...credentials,
        verbose: devOptions.verbose,
        dryRun: false,
        typecheck: devOptions.typecheck,
        typecheckComponents: devOptions.typecheckComponents,
        debug: false,
        debugBundlePath: devOptions.debugBundlePath,
        debugNodeApis: devOptions.debugNodeApis,
        codegen: devOptions.codegen,
        liveComponentSources: devOptions.liveComponentSources,
        pushAllModules: devOptions.pushAllModules,
        logManager,
        // Pass logManager to control logs during deploy
        largeIndexDeletionCheck: "no verification",
        // `convex dev` can’t push to prod
        warnOnSlowSchemaValidation: true,
        message: null
      },
      devOptions
    )
  );
  await Promise.race(promises);
  await ctx.flushAndExit(0);
}
export async function watchAndPush(outerCtx, options, cmdOptions) {
  const watch = { watcher: void 0 };
  const authKitCache = {
    lastAppliedConfig: void 0
  };
  let numFailures = 0;
  let ran = false;
  let pushed = false;
  let shellChild;
  let shellExited;
  let shellCleanupHandle;
  let shellSigintListener;
  let tableNameTriggeringRetry;
  let shouldRetryOnDeploymentEnvVarChange;
  let isFirstPush = true;
  try {
    while (true) {
      const start = performance.now();
      tableNameTriggeringRetry = null;
      shouldRetryOnDeploymentEnvVarChange = false;
      const ctx = new WatchContext(
        cmdOptions.traceEvents,
        outerCtx.bigBrainAuth(),
        isFirstPush
      );
      options.logManager?.beginDeploy();
      showSpinner("Preparing Convex functions...");
      try {
        await runPush(ctx, options);
        const end = performance.now();
        options.logManager?.endDeploy();
        numFailures = 0;
        logFinishedStep(
          `${getCurrentTimeString()} Convex functions ready! (${formatDuration(
            end - start
          )})`
        );
        const { projectConfig } = await readProjectConfig(ctx);
        const authKitConfig = await getAuthKitConfig(ctx, projectConfig);
        const currentConfigString = authKitConfig ? JSON.stringify(authKitConfig) : void 0;
        if (!isFirstPush && currentConfigString !== authKitCache.lastAppliedConfig) {
          await syncAuthKitConfigAfterPush(ctx, projectConfig, {
            deploymentUrl: options.url,
            adminKey: options.adminKey
          });
        }
        authKitCache.lastAppliedConfig = currentConfigString;
        isFirstPush = false;
        if (cmdOptions.run !== void 0 && !ran) {
          switch (cmdOptions.run.kind) {
            case "function":
              await runFunctionInDev(
                ctx,
                options,
                cmdOptions.run.name,
                cmdOptions.run.component
              );
              break;
            case "shell": {
              const shellCommand = cmdOptions.run.command;
              const signalShellChild = (signal) => {
                if (!shellChild) {
                  return;
                }
                const child = shellChild;
                try {
                  if (child.pid !== void 0) {
                    try {
                      process.kill(-child.pid, signal);
                    } catch {
                      child.kill(signal);
                    }
                  } else {
                    child.kill(signal);
                  }
                } catch {
                }
              };
              const clearShellSigintListener = () => {
                if (shellSigintListener) {
                  process.off("SIGINT", shellSigintListener);
                  shellSigintListener = void 0;
                }
              };
              shellChild = spawn(shellCommand, [], {
                shell: true,
                stdio: "inherit",
                detached: true
              });
              shellSigintListener = () => {
                clearShellSigintListener();
                signalShellChild("SIGINT");
              };
              process.prependListener("SIGINT", shellSigintListener);
              shellCleanupHandle = outerCtx.registerCleanup(async () => {
                if (shellSigintListener) {
                  clearShellSigintListener();
                } else {
                  const SIGTERM_ESCALATION_MS = 1e3;
                  await Promise.race([
                    shellExited,
                    new Promise(
                      (resolve) => setTimeout(resolve, SIGTERM_ESCALATION_MS)
                    )
                  ]);
                }
                if (shellChild) {
                  signalShellChild("SIGTERM");
                }
                await shellExited;
              });
              shellExited = new Promise((resolve) => {
                shellChild.on("error", (error) => {
                  logError(
                    `Failed to run command \`${shellCommand}\`: ${error.message}`
                  );
                  shellChild = void 0;
                  resolve();
                  void outerCtx.flushAndExit(1);
                });
                shellChild.on("exit", (code, signal) => {
                  shellChild = void 0;
                  resolve();
                  if (signal) {
                    return;
                  }
                  if (code !== null && code !== 0) {
                    logError(
                      `Command \`${shellCommand}\` exited with code ${code}`
                    );
                    void outerCtx.flushAndExit(1);
                  }
                });
              });
              break;
            }
            default: {
              cmdOptions.run;
              await ctx.crash({
                exitCode: 1,
                errorType: "fatal",
                printedMessage: `Unexpected arguments for --run`,
                errForSentry: `Unexpected arguments for --run: ${JSON.stringify(
                  cmdOptions.run
                )}`
              });
            }
          }
          ran = true;
        }
        pushed = true;
      } catch (e) {
        if (!(e instanceof Crash) || !e.errorType) {
          throw e;
        }
        if (e.errorType === "fatal") {
          break;
        }
        if (e.errorType === "transient" || e.errorType === "already handled") {
          const delay = nextBackoff(numFailures);
          numFailures += 1;
          if (e.errorType === "transient") {
            logWarning(
              chalkStderr.yellow(
                `Failed due to network error, retrying in ${formatDuration(
                  delay
                )}...`
              )
            );
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        console.assert(
          e.errorType === "invalid filesystem data" || e.errorType === "invalid filesystem or env vars" || e.errorType["invalid filesystem or db data"] !== void 0
        );
        if (e.errorType === "invalid filesystem or env vars") {
          shouldRetryOnDeploymentEnvVarChange = true;
        } else if (e.errorType !== "invalid filesystem data" && e.errorType["invalid filesystem or db data"] !== void 0) {
          tableNameTriggeringRetry = e.errorType["invalid filesystem or db data"];
        }
        if (cmdOptions.once) {
          await outerCtx.flushAndExit(1, e.errorType);
        }
        stopSpinner();
      }
      if (cmdOptions.once) {
        return;
      }
      if (pushed && cmdOptions.untilSuccess) {
        return;
      }
      const fileSystemWatch = getFileSystemWatch(ctx, watch, cmdOptions);
      const tableWatch = getTableWatch(
        ctx,
        options,
        tableNameTriggeringRetry?.tableName ?? null,
        tableNameTriggeringRetry?.componentPath
      );
      const envVarWatch = getDeplymentEnvVarWatch(
        ctx,
        options,
        shouldRetryOnDeploymentEnvVarChange
      );
      await Promise.race([
        fileSystemWatch.watch(),
        tableWatch.watch(),
        envVarWatch.watch()
      ]);
      fileSystemWatch.stop();
      void tableWatch.stop();
      void envVarWatch.stop();
    }
  } finally {
    if (shellExited) {
      await shellExited;
    }
    if (shellSigintListener) {
      process.off("SIGINT", shellSigintListener);
      shellSigintListener = void 0;
    }
    if (shellCleanupHandle) {
      outerCtx.removeCleanup(shellCleanupHandle);
    }
  }
}
async function runFunctionInDev(ctx, credentials, functionName, componentPath) {
  await runFunctionAndLog(ctx, {
    deploymentUrl: credentials.url,
    adminKey: credentials.adminKey,
    functionName,
    argsString: "{}",
    componentPath,
    callbacks: {
      onSuccess: () => {
        logFinishedStep(`Finished running function "${functionName}"`);
      }
    }
  });
}
function getTableWatch(ctx, credentials, tableName, componentPath) {
  return getFunctionWatch(ctx, {
    deploymentUrl: credentials.url,
    adminKey: credentials.adminKey,
    parsedFunctionName: "_system/cli/queryTable",
    getArgs: () => tableName !== null ? { tableName } : null,
    componentPath
  });
}
function getDeplymentEnvVarWatch(ctx, credentials, shouldRetryOnDeploymentEnvVarChange) {
  return getFunctionWatch(ctx, {
    deploymentUrl: credentials.url,
    adminKey: credentials.adminKey,
    parsedFunctionName: "_system/cli/queryEnvironmentVariables",
    getArgs: () => shouldRetryOnDeploymentEnvVarChange ? {} : null,
    componentPath: void 0
  });
}
function getFunctionWatch(ctx, args) {
  const [stopPromise, stop] = waitUntilCalled();
  return {
    watch: async () => {
      const functionArgs = args.getArgs();
      if (functionArgs === null) {
        return waitForever();
      }
      let changes = 0;
      return subscribe(ctx, {
        deploymentUrl: args.deploymentUrl,
        adminKey: args.adminKey,
        parsedFunctionName: args.parsedFunctionName,
        parsedFunctionArgs: functionArgs,
        componentPath: args.componentPath,
        until: stopPromise,
        callbacks: {
          onChange: () => {
            changes++;
            if (changes > 1) {
              stop();
            }
          }
        }
      });
    },
    stop: () => {
      stop();
    }
  };
}
function getFileSystemWatch(ctx, watch, cmdOptions) {
  let hasStopped = false;
  return {
    watch: async () => {
      const observations = ctx.fs.finalize();
      if (observations === "invalidated") {
        logMessage("Filesystem changed during push, retrying...");
        return;
      }
      if (!watch.watcher) {
        watch.watcher = new Watcher(observations);
        await showSpinnerIfSlow(
          "Preparing to watch files...",
          500,
          async () => {
            await watch.watcher.ready();
          }
        );
        stopSpinner();
      }
      watch.watcher.update(observations);
      let anyChanges = false;
      do {
        await watch.watcher.waitForEvent();
        if (hasStopped) {
          return;
        }
        for (const event of watch.watcher.drainEvents()) {
          if (cmdOptions.traceEvents) {
            logMessage(
              "Processing",
              event.name,
              path.relative("", event.absPath)
            );
          }
          const result = observations.overlaps(event);
          if (result.overlaps) {
            const relPath = path.relative("", event.absPath);
            if (cmdOptions.traceEvents) {
              logMessage(`${relPath} ${result.reason}, rebuilding...`);
            }
            anyChanges = true;
            break;
          }
        }
      } while (!anyChanges);
      let deadline = performance.now() + quiescenceDelay;
      while (true) {
        const now = performance.now();
        if (now >= deadline) {
          break;
        }
        const remaining = deadline - now;
        if (cmdOptions.traceEvents) {
          logMessage(`Waiting for ${formatDuration(remaining)} to quiesce...`);
        }
        const remainingWait = new Promise(
          (resolve) => setTimeout(() => resolve("timeout"), deadline - now)
        );
        const result = await Promise.race([
          remainingWait,
          watch.watcher.waitForEvent().then(() => "newEvents")
        ]);
        if (result === "newEvents") {
          for (const event of watch.watcher.drainEvents()) {
            const result2 = observations.overlaps(event);
            if (result2.overlaps) {
              if (cmdOptions.traceEvents) {
                logMessage(
                  `Received an overlapping event at ${event.absPath}, delaying push.`
                );
              }
              deadline = performance.now() + quiescenceDelay;
            }
          }
        } else {
          if (result !== "timeout") {
            logError(
              "Assertion failed: Unexpected result from watcher: " + result
            );
          }
        }
      }
    },
    stop: () => {
      hasStopped = true;
    }
  };
}
const initialBackoff = 500;
const maxBackoff = 16e3;
const quiescenceDelay = 500;
export function nextBackoff(prevFailures) {
  const baseBackoff = initialBackoff * Math.pow(2, prevFailures);
  const actualBackoff = Math.min(baseBackoff, maxBackoff);
  const jitter = actualBackoff * (Math.random() - 0.5);
  return actualBackoff + jitter;
}
//# sourceMappingURL=dev.js.map
