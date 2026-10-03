"use strict";
import { chalkStderr } from "chalk";
import path from "path";
import { performance } from "perf_hooks";
import {
  changeSpinner,
  logError,
  logFailure,
  logMessage,
  showSpinner
} from "../../bundler/log.js";
import * as Sentry from "@sentry/node";
import * as semver from "semver";
import { formatDuration, spawnAsync } from "./utils/utils.js";
import { readProjectConfig } from "./config.js";
import { WatchContext } from "./watch.js";
const SLOW_TYPECHECK_THRESHOLD_MS = 1e4;
const SLOW_TYPECHECK_DOCS_URL = "https://docs.convex.dev/cli/troubleshooting/typecheck-performance";
export async function resolveTypescriptCompiler(ctx, cliOption) {
  const { projectConfig } = await readProjectConfig(ctx);
  return cliOption ?? projectConfig?.typescriptCompiler ?? "tsc";
}
export async function typeCheckFunctionsInMode(ctx, typeCheckMode, functionsDir) {
  if (typeCheckMode === "disable") {
    return;
  }
  const typescriptCompiler = await resolveTypescriptCompiler(ctx);
  const typecheckStart = performance.now();
  const slowTypecheckTimeout = setTimeout(() => {
    changeSpinner(
      `Still running TypeScript... see ${SLOW_TYPECHECK_DOCS_URL} to troubleshoot.`
    );
  }, SLOW_TYPECHECK_THRESHOLD_MS);
  try {
    await typeCheckFunctions(
      ctx,
      typescriptCompiler,
      functionsDir,
      async (result, logSpecificError, runOnError) => {
        if (result === "cantTypeCheck" && typeCheckMode === "enable" || result === "typecheckFailed") {
          logSpecificError?.();
          logError(
            chalkStderr.gray(
              "To ignore failing typecheck, use `--typecheck=disable`."
            )
          );
          try {
            const result2 = await runOnError?.();
            if (result2 === "success") {
              return;
            }
          } catch {
          }
          await ctx.crash({
            exitCode: 1,
            errorType: "invalid filesystem data",
            printedMessage: null
          });
        }
      }
    );
  } finally {
    clearTimeout(slowTypecheckTimeout);
  }
  maybeLogSlowTypecheckSuggestion(ctx, performance.now() - typecheckStart);
}
export async function typeCheckFunctions(ctx, typescriptCompiler, functionsDir, handleResult) {
  const tsconfig = path.join(functionsDir, "tsconfig.json");
  if (!ctx.fs.exists(tsconfig)) {
    return handleResult("cantTypeCheck", () => {
      logError(
        "Found no convex/tsconfig.json to use to typecheck Convex functions, so skipping typecheck."
      );
      logError("Run `npx convex codegen --init` to create one.");
    });
  }
  await runTsc(
    ctx,
    typescriptCompiler,
    ["--project", functionsDir],
    handleResult
  );
}
async function runTsc(ctx, typescriptCompiler, tscArgs, handleResult) {
  const compilerPath = findTypeScriptCompilerPath(ctx.fs, typescriptCompiler);
  if (!compilerPath) {
    return handleResult("cantTypeCheck", () => {
      logError(
        chalkStderr.gray(
          `No \`${typescriptCompiler}\` binary found, so skipping typecheck.`
        )
      );
    });
  }
  const versionResult = await spawnAsync(ctx, process.execPath, [
    compilerPath,
    "--version"
  ]);
  const version = versionResult.stdout.match(/Version (.*)/)?.[1] ?? null;
  const hasOlderTypeScriptVersion = version && semver.lt(version, "4.8.4");
  await runTscInner(ctx, compilerPath, tscArgs, handleResult);
  if (hasOlderTypeScriptVersion) {
    logError(
      chalkStderr.yellow(
        "Convex works best with TypeScript version 4.8.4 or newer -- npm i --save-dev typescript@latest to update."
      )
    );
  }
}
export function findTypeScriptCompilerPath(fs, typescriptCompiler) {
  switch (typescriptCompiler) {
    case "tsgo": {
      const tsgoPaths = ["tsgo", "tsgo.js"].map(
        (filename) => path.join(
          "node_modules",
          "@typescript",
          "native-preview",
          "bin",
          filename
        )
      );
      return tsgoPaths.find((path2) => fs.exists(path2));
    }
    case "tsc": {
      const tscPaths = [
        // TypeScript 7's recommended alias when the TypeScript 6 API is also installed.
        path.join("node_modules", "@typescript", "native", "bin", "tsc"),
        path.join("node_modules", "typescript", "bin", "tsc")
      ];
      return tscPaths.find((path2) => fs.exists(path2));
    }
    default:
      typescriptCompiler;
  }
}
async function runTscInner(ctx, tscPath, tscArgs, handleResult) {
  const result = await spawnAsync(ctx, process.execPath, [
    tscPath,
    ...tscArgs,
    "--listFiles"
  ]);
  if (result.status === null) {
    return handleResult("typecheckFailed", () => {
      logFailure(`TypeScript typecheck timed out.`);
      if (result.error) {
        logError(chalkStderr.red(`${result.error.toString()}`));
      }
    });
  }
  const filesTouched = result.stdout.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  let anyPathsFound = false;
  for (const fileTouched of filesTouched) {
    const absPath = path.resolve(fileTouched);
    let st;
    try {
      st = ctx.fs.stat(absPath);
      anyPathsFound = true;
    } catch {
      continue;
    }
    ctx.fs.registerPath(absPath, st);
  }
  if (filesTouched.length > 0 && !anyPathsFound) {
    const err = new Error(
      `Failed to stat any files emitted by tsc (received ${filesTouched.length})`
    );
    Sentry.captureException(err);
  }
  if (!result.error && result.status === 0) {
    return handleResult("success");
  }
  if (result.stdout.startsWith("error TS18003")) {
    return handleResult("success");
  }
  return handleResult(
    "typecheckFailed",
    () => {
      logFailure("TypeScript typecheck via `tsc` failed.");
    },
    async () => {
      showSpinner("Collecting TypeScript errors");
      await spawnAsync(
        ctx,
        process.execPath,
        [tscPath, ...tscArgs, "--pretty", "true"],
        {
          stdio: "inherit"
        }
      );
      ctx.fs.invalidate();
      return "success";
    }
  );
}
function maybeLogSlowTypecheckSuggestion(ctx, durationMs) {
  if (!(ctx instanceof WatchContext)) {
    return;
  }
  if (!ctx.isFirstPush) {
    return;
  }
  if (durationMs <= SLOW_TYPECHECK_THRESHOLD_MS) {
    return;
  }
  const formattedDuration = formatDuration(durationMs);
  logMessage(
    chalkStderr.gray(
      `Typechecking took ${formattedDuration}. For faster iteration, see ${SLOW_TYPECHECK_DOCS_URL} to troubleshoot typecheck performance.`
    )
  );
}
//# sourceMappingURL=typecheck.js.map
