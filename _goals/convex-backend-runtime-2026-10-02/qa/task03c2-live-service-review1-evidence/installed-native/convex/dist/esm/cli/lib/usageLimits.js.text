"use strict";
import { deploymentFetch, logAndHandleFetchError } from "./utils/utils.js";
export const USAGE_LIMIT_METRICS = [
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
export const USAGE_LIMIT_WINDOWS = ["day", "month"];
export const USAGE_LIMIT_TYPES = ["warning", "disable"];
export const METRIC_LABELS = {
  functionCalls: "Function calls",
  queryMutationComputeGbHours: "Query/Mutation compute",
  actionComputeConvexGbHours: "Action compute",
  actionComputeNodeJsGbHours: "Action compute (Node.js)",
  actionComputeCpuGbHours: "Action compute (CPU)",
  databaseIoGb: "Database I/O",
  searchQueryGb: "Search queries",
  dataEgressGb: "Data egress"
};
export function metricLabel(metric) {
  return METRIC_LABELS[metric] ?? metric;
}
async function usageLimitFetch(ctx, deployment, path, init) {
  const fetch = deploymentFetch(ctx, deployment);
  try {
    const response = await fetch(`/api/v1${path}`, {
      method: init?.method ?? "GET",
      ...init?.body !== void 0 ? { body: JSON.stringify(init.body) } : {}
    });
    const text = await response.text();
    return text.length > 0 ? JSON.parse(text) : void 0;
  } catch (e) {
    return await logAndHandleFetchError(ctx, e);
  }
}
export async function listUsageLimits(ctx, deployment) {
  const result = await usageLimitFetch(
    ctx,
    deployment,
    "/list_usage_limits"
  );
  return result.usageLimits;
}
export async function createUsageLimit(ctx, deployment, config) {
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
export async function updateUsageLimit(ctx, deployment, id, config) {
  const result = await usageLimitFetch(
    ctx,
    deployment,
    `/update_usage_limit/${id}`,
    { method: "POST", body: config }
  );
  return result.usageLimit;
}
export async function deleteUsageLimit(ctx, deployment, id) {
  await usageLimitFetch(ctx, deployment, `/delete_usage_limit/${id}`, {
    method: "POST"
  });
}
export async function getCurrentUsage(ctx, deployment) {
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
export function compareUsageLimits(a, b) {
  return metricRank(a.metric) - metricRank(b.metric) || windowRank(a.window) - windowRank(b.window) || typeRank(a.limitType) - typeRank(b.limitType);
}
export function compareMetricNames(a, b) {
  return metricRank(a) - metricRank(b);
}
function usageInWindow(usage, metric, window) {
  const m = usage.metrics[metric];
  if (m === void 0) {
    return null;
  }
  return window === "day" ? m.usage.current_day : m.usage.current_month;
}
export async function listUsageLimitsWithStatus(ctx, deployment) {
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
export async function findUsageLimitByKey(ctx, deployment, key) {
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
