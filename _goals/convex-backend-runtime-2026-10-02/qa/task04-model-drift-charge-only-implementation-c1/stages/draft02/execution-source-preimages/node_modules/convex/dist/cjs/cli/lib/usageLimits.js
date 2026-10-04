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
  METRIC_LABELS: () => METRIC_LABELS,
  USAGE_LIMIT_METRICS: () => USAGE_LIMIT_METRICS,
  USAGE_LIMIT_TYPES: () => USAGE_LIMIT_TYPES,
  USAGE_LIMIT_WINDOWS: () => USAGE_LIMIT_WINDOWS,
  compareMetricNames: () => compareMetricNames,
  compareUsageLimits: () => compareUsageLimits,
  createUsageLimit: () => createUsageLimit,
  deleteUsageLimit: () => deleteUsageLimit,
  findUsageLimitByKey: () => findUsageLimitByKey,
  getCurrentUsage: () => getCurrentUsage,
  listUsageLimits: () => listUsageLimits,
  listUsageLimitsWithStatus: () => listUsageLimitsWithStatus,
  metricLabel: () => metricLabel,
  updateUsageLimit: () => updateUsageLimit
});
module.exports = __toCommonJS(usageLimits_exports);
var import_utils = require("./utils/utils.js");
const USAGE_LIMIT_METRICS = [
  "functionCalls",
  "queryMutationComputeGbHours",
  "actionComputeConvexGbHours",
  "actionComputeNodeJsGbHours",
  "actionComputeCpuGbHours",
  "databaseIoGb",
  "searchQueryGb",
  "dataEgressGb"
];
const _metricsExhaustive = true;
void _metricsExhaustive;
const USAGE_LIMIT_WINDOWS = ["day", "month"];
const USAGE_LIMIT_TYPES = ["warning", "disable"];
const METRIC_LABELS = {
  functionCalls: "Function calls",
  queryMutationComputeGbHours: "Query/Mutation compute",
  actionComputeConvexGbHours: "Action compute",
  actionComputeNodeJsGbHours: "Action compute (Node.js)",
  actionComputeCpuGbHours: "Action compute (CPU)",
  databaseIoGb: "Database I/O",
  searchQueryGb: "Search queries",
  dataEgressGb: "Data egress"
};
function metricLabel(metric) {
  return METRIC_LABELS[metric] ?? metric;
}
async function usageLimitFetch(ctx, deployment, path, init) {
  const fetch = (0, import_utils.deploymentFetch)(ctx, deployment);
  try {
    const response = await fetch(`/api/v1${path}`, {
      method: init?.method ?? "GET",
      ...init?.body !== void 0 ? { body: JSON.stringify(init.body) } : {}
    });
    const text = await response.text();
    return text.length > 0 ? JSON.parse(text) : void 0;
  } catch (e) {
    return await (0, import_utils.logAndHandleFetchError)(ctx, e);
  }
}
async function listUsageLimits(ctx, deployment) {
  const result = await usageLimitFetch(
    ctx,
    deployment,
    "/list_usage_limits"
  );
  return result.usageLimits;
}
async function createUsageLimit(ctx, deployment, config) {
  const result = await usageLimitFetch(
    ctx,
    deployment,
    "/create_usage_limit",
    {
      method: "POST",
      body: config
    }
  );
  return result.usageLimit;
}
async function updateUsageLimit(ctx, deployment, id, config) {
  const result = await usageLimitFetch(
    ctx,
    deployment,
    `/update_usage_limit/${id}`,
    { method: "POST", body: config }
  );
  return result.usageLimit;
}
async function deleteUsageLimit(ctx, deployment, id) {
  await usageLimitFetch(ctx, deployment, `/delete_usage_limit/${id}`, {
    method: "POST"
  });
}
async function getCurrentUsage(ctx, deployment) {
  return await usageLimitFetch(
    ctx,
    deployment,
    "/get_current_usage"
  );
}
function metricRank(metric) {
  const i = USAGE_LIMIT_METRICS.indexOf(metric);
  return i === -1 ? USAGE_LIMIT_METRICS.length : i;
}
const windowRank = (w) => w === "month" ? 0 : 1;
const typeRank = (t) => t === "warning" ? 0 : 1;
function compareUsageLimits(a, b) {
  return metricRank(a.metric) - metricRank(b.metric) || windowRank(a.window) - windowRank(b.window) || typeRank(a.limitType) - typeRank(b.limitType);
}
function compareMetricNames(a, b) {
  return metricRank(a) - metricRank(b);
}
function usageInWindow(usage, metric, window) {
  const m = usage.metrics[metric];
  if (m === void 0) {
    return null;
  }
  return window === "day" ? m.usage.current_day : m.usage.current_month;
}
async function listUsageLimitsWithStatus(ctx, deployment) {
  const [limits, usage] = await Promise.all([
    listUsageLimits(ctx, deployment),
    getCurrentUsage(ctx, deployment)
  ]);
  const withStatus = limits.map((limit) => {
    const currentUsage = usageInWindow(usage, limit.metric, limit.window);
    const unit = usage.metrics[limit.metric]?.unit ?? null;
    const triggered = limit.enabled && currentUsage !== null && currentUsage >= limit.limit;
    return { ...limit, currentUsage, unit, triggered };
  }).sort(compareUsageLimits);
  return { limits: withStatus, seedStatus: usage.seedStatus };
}
async function findUsageLimitByKey(ctx, deployment, key) {
  const match = (await listUsageLimits(ctx, deployment)).find(
    (limit) => limit.metric === key.metric && limit.window === key.window && limit.limitType === key.limitType
  );
  if (match === void 0) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `error: No ${key.limitType} usage limit on ${key.metric} per ${key.window}${deployment.deploymentNotice}.`
    });
  }
  return match;
}
//# sourceMappingURL=usageLimits.js.map
