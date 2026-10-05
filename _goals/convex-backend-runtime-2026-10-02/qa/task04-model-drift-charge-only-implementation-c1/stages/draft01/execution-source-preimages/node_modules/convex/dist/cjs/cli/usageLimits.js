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
var usageLimits_exports = {};
__export(usageLimits_exports, {
  usage: () => usage,
  usageLimits: () => usageLimits
});
module.exports = __toCommonJS(usageLimits_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_log = require("../bundler/log.js");
var import_command = require("./lib/command.js");
var import_utils = require("./lib/utils/utils.js");
var import_run = require("./lib/localDeployment/run.js");
var import_env = require("./env.js");
var import_usageLimits = require("./lib/usageLimits.js");
async function parseLimit(ctx, value) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `error: --limit must be a positive integer, got "${value}".`
    });
  }
  return limit;
}
function formatTable(header, rows, rightAlign = []) {
  const right = new Set(rightAlign);
  const widths = header.map(
    (cell, i) => Math.max(cell.length, ...rows.map((row) => (row[i] ?? "").length))
  );
  const pad = (cell, i) => right.has(i) ? cell.padStart(widths[i]) : cell.padEnd(widths[i]);
  const rule = (left, mid, r) => left + widths.map((w) => "\u2500".repeat(w + 2)).join(mid) + r;
  const line = (cells) => "\u2502 " + cells.map((cell, i) => pad(cell ?? "", i)).join(" \u2502 ") + " \u2502";
  return [
    rule("\u250C", "\u252C", "\u2510"),
    line(header),
    rule("\u251C", "\u253C", "\u2524"),
    ...rows.map(line),
    rule("\u2514", "\u2534", "\u2518")
  ].join("\n");
}
const NUMBER_FORMAT_COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 3
});
function formatNumberCompact(value) {
  const formatted = NUMBER_FORMAT_COMPACT.format(value);
  return formatted === "-0" ? "0" : formatted;
}
const LIMIT_FORMAT = new Intl.NumberFormat("en-US");
function formatLimitAmount(value) {
  return LIMIT_FORMAT.format(value);
}
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");
function formatNumber(value) {
  const formatted = NUMBER_FORMAT.format(value);
  return formatted === "-0" ? "0" : formatted;
}
function unitFor(amount, unit) {
  return amount === 1 && unit === "calls" ? "call" : unit;
}
function formatAmount(value, unit) {
  return unit === null ? formatNumberCompact(value) : `${formatNumberCompact(value)} ${unitFor(value, unit)}`;
}
function usageLimitRow(limit) {
  const currentUsage = limit.currentUsage === null ? "\u2014" : `${formatAmount(limit.currentUsage, limit.unit)} (${formatNumber(
    Math.round(limit.currentUsage / limit.limit * 100)
  )}%)`;
  return [
    (0, import_usageLimits.metricLabel)(limit.metric),
    limit.window,
    limit.limitType,
    formatAmount(limit.limit, limit.unit),
    currentUsage,
    limit.enabled ? "yes" : "no",
    limit.triggered ? "yes" : "no"
  ];
}
const metricOption = new import_extra_typings.Option(
  "--metric <metric>",
  "The metric to limit."
).choices(import_usageLimits.USAGE_LIMIT_METRICS);
const windowOption = new import_extra_typings.Option(
  "--window <window>",
  "The window the limit is measured over."
).choices(import_usageLimits.USAGE_LIMIT_WINDOWS);
const typeOption = new import_extra_typings.Option(
  "--type <type>",
  "`warning` only notifies; `disable` pauses the deployment when exceeded."
).choices(import_usageLimits.USAGE_LIMIT_TYPES);
function seedStatusMessage(seedStatus) {
  return seedStatus === "failed" ? "We couldn't load this deployment's historical usage, so the usage shown below may understate its actual usage. Limits are still enforced going forward." : "Historical usage is still being loaded, so the usage shown below may understate this deployment's actual usage. Check back shortly for accurate totals.";
}
const listCmd = new import_extra_typings.Command("list").summary("List configured usage limits").description(
  [
    "List the usage limits configured on your deployment.",
    "",
    "\u2022 List all usage limits: `npx convex deployment usage-limits list`",
    "\u2022 Print as JSON: `npx convex deployment usage-limits list --json`"
  ].join("\n")
).option("--json", "Output the usage limits as JSON.").configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (cmdOptions, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await (0, import_env.selectEnvDeployment)(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "deployment usage-limits list");
  await (0, import_run.withRunningBackend)({
    ctx,
    deployment,
    action: async () => {
      const { limits, seedStatus } = await (0, import_usageLimits.listUsageLimitsWithStatus)(
        ctx,
        deployment
      );
      if (cmdOptions.json) {
        (0, import_log.logOutput)(JSON.stringify(limits, null, 2));
        return;
      }
      if (limits.length === 0) {
        (0, import_log.logMessage)(
          `No usage limits configured${deployment.deploymentNotice}.`
        );
        return;
      }
      if (seedStatus !== "complete") {
        (0, import_log.logMessage)(seedStatusMessage(seedStatus));
      }
      (0, import_log.logOutput)(
        formatTable(
          [
            "Metric",
            "Window",
            "Type",
            "Limit",
            "Current Usage",
            "Active",
            "Triggered"
          ],
          limits.map(usageLimitRow),
          [3, 4]
        )
      );
    }
  });
});
const setCmd = new import_extra_typings.Command("set").summary("Create or update a usage limit").description(
  [
    "Create a usage limit, or update the existing one for the same",
    "(metric, window, type). At most one limit exists per combination.",
    "",
    "\u2022 Set the amount (creates or replaces it):",
    "  `npx convex deployment usage-limits set --metric functionCalls --window day --type disable --limit 1000000`",
    "\u2022 Deactivate without deleting: add `--inactive` (use `--active` to re-enable).",
    "\u2022 Toggle active state without changing the amount: omit `--limit`."
  ].join("\n")
).addOption(metricOption.makeOptionMandatory()).addOption(windowOption.makeOptionMandatory()).addOption(typeOption.makeOptionMandatory()).option(
  "--limit <limit>",
  "The limit amount, in the metric's native units. Required when creating; kept as-is when omitted while updating."
).option("--active", "Enforce the limit (the default for a new limit).").option("--inactive", "Create or leave the limit unenforced.").configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (cmdOptions, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await (0, import_env.selectEnvDeployment)(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "deployment usage-limits set");
  if (cmdOptions.active && cmdOptions.inactive) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "error: Pass at most one of --active and --inactive."
    });
  }
  const newLimit = cmdOptions.limit === void 0 ? void 0 : await parseLimit(ctx, cmdOptions.limit);
  await (0, import_run.withRunningBackend)({
    ctx,
    deployment,
    action: async () => {
      const existing = (await (0, import_usageLimits.listUsageLimits)(ctx, deployment)).find(
        (l) => l.metric === cmdOptions.metric && l.window === cmdOptions.window && l.limitType === cmdOptions.type
      );
      const label = `${cmdOptions.type} usage limit on ${(0, import_usageLimits.metricLabel)(cmdOptions.metric)} per ${cmdOptions.window}`;
      if (existing === void 0) {
        if (newLimit === void 0) {
          return ctx.crash({
            exitCode: 1,
            errorType: "fatal",
            printedMessage: "error: --limit is required when creating a usage limit."
          });
        }
        const enabled2 = !cmdOptions.inactive;
        const created = await (0, import_usageLimits.createUsageLimit)(ctx, deployment, {
          metric: cmdOptions.metric,
          window: cmdOptions.window,
          limitType: cmdOptions.type,
          limit: newLimit,
          enabled: enabled2
        });
        (0, import_log.logFinishedStep)(
          `Created ${label}: ${formatLimitAmount(created.limit)}, ${created.enabled ? "active" : "inactive"}${deployment.deploymentNotice}.`
        );
        return;
      }
      const enabled = cmdOptions.active ? true : cmdOptions.inactive ? false : existing.enabled;
      const limit = newLimit ?? existing.limit;
      const changes = [];
      if (limit !== existing.limit) {
        changes.push(
          `limit ${formatLimitAmount(existing.limit)} \u2192 ${formatLimitAmount(limit)}`
        );
      }
      if (enabled !== existing.enabled) {
        changes.push(
          `${existing.enabled ? "active" : "inactive"} \u2192 ${enabled ? "active" : "inactive"}`
        );
      }
      if (changes.length === 0) {
        (0, import_log.logFinishedStep)(
          `No changes to ${label} (${formatLimitAmount(existing.limit)}, ${existing.enabled ? "active" : "inactive"})${deployment.deploymentNotice}.`
        );
        return;
      }
      await (0, import_usageLimits.updateUsageLimit)(ctx, deployment, existing.id, {
        metric: existing.metric,
        window: existing.window,
        limitType: existing.limitType,
        limit,
        enabled
      });
      (0, import_log.logFinishedStep)(
        `Updated ${label}: ${changes.join(", ")}${deployment.deploymentNotice}.`
      );
    }
  });
});
const removeCmd = new import_extra_typings.Command("remove").alias("rm").alias("delete").summary("Delete a usage limit").description(
  [
    "Delete a usage limit, identified by its (metric, window, type).",
    "",
    "\u2022 `npx convex deployment usage-limits remove --metric functionCalls --window day --type warning`"
  ].join("\n")
).addOption(metricOption.makeOptionMandatory()).addOption(windowOption.makeOptionMandatory()).addOption(typeOption.makeOptionMandatory()).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (cmdOptions, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await (0, import_env.selectEnvDeployment)(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "deployment usage-limits remove");
  await (0, import_run.withRunningBackend)({
    ctx,
    deployment,
    action: async () => {
      const existing = await (0, import_usageLimits.findUsageLimitByKey)(ctx, deployment, {
        metric: cmdOptions.metric,
        window: cmdOptions.window,
        limitType: cmdOptions.type
      });
      await (0, import_usageLimits.deleteUsageLimit)(ctx, deployment, existing.id);
      (0, import_log.logFinishedStep)(
        `Deleted ${existing.limitType} usage limit on ${(0, import_usageLimits.metricLabel)(existing.metric)} per ${existing.window}${deployment.deploymentNotice}.`
      );
    }
  });
});
const usage = new import_extra_typings.Command("usage").summary("Show current usage for each metric").description(
  [
    "Show usage so far in the current day and calendar month for every metric.",
    "",
    "\u2022 Show current usage: `npx convex deployment usage`",
    "\u2022 Print as JSON: `npx convex deployment usage --json`"
  ].join("\n")
).option("--json", "Output the usage as JSON.").configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).addDeploymentSelectionOptions((0, import_command.actionDescription)("Show current usage for")).action(async (cmdOptions, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await (0, import_env.selectEnvDeployment)(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "deployment usage");
  await (0, import_run.withRunningBackend)({
    ctx,
    deployment,
    action: async () => {
      const usage2 = await (0, import_usageLimits.getCurrentUsage)(ctx, deployment);
      if (cmdOptions.json) {
        (0, import_log.logOutput)(JSON.stringify(usage2, null, 2));
        return;
      }
      if (usage2.seedStatus !== "complete") {
        (0, import_log.logMessage)(seedStatusMessage(usage2.seedStatus));
      }
      (0, import_log.logOutput)(
        formatTable(
          ["Metric", "Day", "Month"],
          Object.entries(usage2.metrics).sort(([a], [b]) => (0, import_usageLimits.compareMetricNames)(a, b)).map(([metric, m]) => [
            (0, import_usageLimits.metricLabel)(metric),
            formatAmount(m.usage.current_day, m.unit),
            formatAmount(m.usage.current_month, m.unit)
          ])
        )
      );
    }
  });
});
const usageLimits = new import_extra_typings.Command("usage-limits").summary("List and configure deployment usage limits").description(
  [
    "List and configure usage limits on your deployment.",
    "",
    "A usage limit either warns or pauses your deployment when a metric",
    "(function calls, database bandwidth, \u2026) crosses a threshold within a",
    "daily or monthly window. Each limit is identified by its",
    "(metric, window, type).",
    "",
    "\u2022 List usage limits: `npx convex deployment usage-limits list`",
    "\u2022 Create or update one: `npx convex deployment usage-limits set --metric functionCalls --window day --type disable --limit 1000000`",
    "\u2022 Delete one: `npx convex deployment usage-limits remove --metric functionCalls --window day --type disable`"
  ].join("\n")
).addCommand(listCmd).addCommand(setCmd).addCommand(removeCmd).helpCommand(false).addDeploymentSelectionOptions(
  (0, import_command.actionDescription)("List and configure usage limits on")
);
//# sourceMappingURL=usageLimits.js.map
