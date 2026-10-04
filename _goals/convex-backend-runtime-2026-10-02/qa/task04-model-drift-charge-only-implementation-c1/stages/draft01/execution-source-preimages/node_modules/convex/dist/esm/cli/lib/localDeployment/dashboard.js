"use strict";
import {
  dashboardOutDir,
  loadProjectDashboardConfig,
  loadUuidForAnonymousUser,
  saveProjectDashboardConfig
} from "./filePaths.js";
import { choosePorts } from "./utils.js";
import { startServer } from "./serve.js";
import { localDeploymentUrl, selfHostedEventTag } from "./run.js";
import serveHandler from "serve-handler";
import {
  ensureBackendBinaryDownloaded,
  ensureDashboardDownloaded
} from "./download.js";
import { bigBrainAPIMaybeThrows } from "../utils/utils.js";
export const DEFAULT_LOCAL_DASHBOARD_PORT = 6790;
export async function handleDashboard(ctx, deployment, options) {
  const { version } = await ensureBackendBinaryDownloaded(
    ctx,
    options.backendVersion === void 0 ? { kind: "latest" } : { kind: "version", version: options.backendVersion }
  );
  const anonymousId = loadUuidForAnonymousUser(ctx) ?? void 0;
  await ensureDashboardDownloaded(ctx, version);
  const [dashboardPort] = await choosePorts(ctx, {
    count: 1,
    startPort: DEFAULT_LOCAL_DASHBOARD_PORT,
    requestedPorts: [null, null]
  });
  saveProjectDashboardConfig(ctx, deployment.name, {
    port: dashboardPort
  });
  let hasReportedSelfHostedEvent = false;
  const serverOptions = { cors: false };
  const { cleanupHandle } = await startServer(
    ctx,
    dashboardPort,
    async (request, response) => {
      const pathname = new URL(
        request.url ?? "/",
        // We only want to extract the pathname so the base doesn’t matter
        "http://localhost"
      ).pathname;
      if (pathname === "/api/current_deployment") {
        serverOptions;
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({
            name: deployment.name,
            url: localDeploymentUrl(deployment.cloudPort),
            adminKey: deployment.adminKey
          })
        );
        return;
      }
      if (!hasReportedSelfHostedEvent) {
        hasReportedSelfHostedEvent = true;
        void reportSelfHostedEvent(ctx, {
          anonymousId,
          eventName: "self_host_dashboard_connected",
          tag: selfHostedEventTag("anonymous")
        });
      }
      await serveHandler(request, response, {
        public: dashboardOutDir()
      });
    },
    serverOptions
  );
  return {
    dashboardPort,
    cleanupHandle
  };
}
async function reportSelfHostedEvent(ctx, {
  anonymousId,
  eventName,
  eventFields,
  tag
}) {
  try {
    await bigBrainAPIMaybeThrows({
      ctx,
      method: "POST",
      path: "self_hosted_event",
      data: {
        selfHostedUuid: anonymousId,
        eventName,
        eventFields,
        tag
      }
    });
  } catch {
  }
}
export function dashboardUrl(ctx, deploymentName) {
  const dashboardConfig = loadProjectDashboardConfig(ctx, deploymentName);
  if (dashboardConfig === null) {
    return null;
  }
  return `http://127.0.0.1:${dashboardConfig.port}/`;
}
//# sourceMappingURL=dashboard.js.map
