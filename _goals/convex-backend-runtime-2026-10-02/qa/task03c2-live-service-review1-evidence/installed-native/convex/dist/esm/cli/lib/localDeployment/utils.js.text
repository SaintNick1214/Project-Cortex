"use strict";
import { logMessage } from "../../../bundler/log.js";
import { detect } from "detect-port";
import { chalkStderr } from "chalk";
export async function choosePorts(ctx, {
  count,
  requestedPorts,
  suggestedPorts,
  startPort
}) {
  const ports = [];
  for (let i = 0; i < count; i++) {
    const requestedPort = requestedPorts?.[i];
    if (requestedPort !== null) {
      const port = await detect(requestedPort);
      if (port !== requestedPort) {
        return ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Requested port ${requestedPort} is not available`
        });
      }
      ports.push(port);
    } else {
      const suggestedPort = suggestedPorts?.[ports.length] ?? null;
      if (suggestedPort !== null) {
        const port2 = await detect(suggestedPort);
        if (port2 === suggestedPort) {
          ports.push(suggestedPort);
          continue;
        }
      }
      const portToTry = ports.length > 0 ? ports[ports.length - 1] + 1 : startPort;
      const port = await detect(portToTry);
      ports.push(port);
    }
  }
  return ports;
}
export async function chooseLocalBackendPorts(ctx, options) {
  const { suggestedPorts, requestedPorts } = options ?? {};
  const [cloudPort, sitePort] = await choosePorts(ctx, {
    count: 2,
    startPort: 3210,
    requestedPorts: [
      requestedPorts?.cloud ?? null,
      requestedPorts?.site ?? null
    ],
    suggestedPorts: [
      suggestedPorts?.cloud ?? null,
      suggestedPorts?.site ?? null
    ]
  });
  return { cloudPort, sitePort };
}
export function printLocalDeploymentWelcomeMessage() {
  logMessage(
    chalkStderr.cyan("You're trying out the beta local deployment feature!")
  );
  logMessage(
    chalkStderr.cyan(
      "To learn more, read the docs: https://docs.convex.dev/cli/local-deployments"
    )
  );
}
export const LOCAL_BACKEND_INSTANCE_SECRET = "4361726e697461732c206c69746572616c6c79206d65616e696e6720226c6974";
export function releaseDate(version) {
  return /^precompiled-(\d{4}-\d{2}-\d{2})-/.exec(version)?.[1] ?? null;
}
//# sourceMappingURL=utils.js.map
