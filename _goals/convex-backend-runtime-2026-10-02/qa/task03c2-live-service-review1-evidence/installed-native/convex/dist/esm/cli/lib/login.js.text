"use strict";
import { errors, custom } from "openid-client";
import {
  bigBrainAPI,
  bigBrainFetch,
  logAndHandleFetchError,
  throwingFetch,
  isWebContainer,
  typedPlatformClient
} from "./utils/utils.js";
import open from "open";
import { chalkStderr } from "chalk";
import { provisionHost } from "./config.js";
import { version } from "../version.js";
import {
  changeSpinner,
  logError,
  logFailure,
  logFinishedStep,
  logMessage,
  logOutput,
  logVerbose,
  showSpinner
} from "../../bundler/log.js";
import { Issuer } from "openid-client";
import { hostname } from "os";
import { execSync } from "child_process";
import { promptString, promptYesNo } from "./utils/prompts.js";
import {
  formatPathForPrinting,
  globalConfigPath,
  modifyGlobalConfig
} from "./utils/globalConfig.js";
import { updateBigBrainAuthAfterLogin } from "./deploymentSelection.js";
custom.setHttpOptionsDefaults({
  timeout: parseInt(process.env.OPENID_CLIENT_TIMEOUT || "10000")
});
export async function isAuthorizedHeader(ctx, header) {
  try {
    const resp = await fetch(`${provisionHost}/api/authorize`, {
      method: "HEAD",
      headers: {
        Authorization: header,
        "Convex-Client": `npm-cli-${version}`
      }
    });
    return resp.status === 200;
  } catch (e) {
    logError(
      `Unexpected error when authorizing - are you connected to the internet?`
    );
    return await logAndHandleFetchError(ctx, e);
  }
}
export async function checkAuthorization(ctx, acceptOptIns) {
  const header = ctx.bigBrainAuth()?.header ?? null;
  if (header === null) {
    return false;
  }
  if (!await isAuthorizedHeader(ctx, header)) {
    return false;
  }
  const shouldContinue = await optins(ctx, acceptOptIns);
  if (!shouldContinue) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: null
    });
  }
  return true;
}
async function performDeviceAuthorization(ctx, authClient, shouldOpen, vercel, vercelOverride) {
  let handle;
  try {
    handle = await authClient.deviceAuthorization();
  } catch {
    return promptString(ctx, {
      message: "Open https://dashboard.convex.dev/auth, log in and paste the token here:"
    });
  }
  const { verification_uri_complete, user_code, expires_in } = handle;
  const urlToOpen = vercel ? `https://vercel.com/sso/integrations/${vercelOverride || "convex"}?url=${verification_uri_complete}` : verification_uri_complete;
  logMessage(
    `Visit ${urlToOpen} to finish logging in.
You should see the following code which expires in ${expires_in % 60 === 0 ? `${expires_in / 60} minutes` : `${expires_in} seconds`}: ${user_code}`
  );
  if (shouldOpen) {
    shouldOpen = await promptYesNo(ctx, {
      message: `Open the browser?`,
      default: true
    });
  }
  if (shouldOpen) {
    showSpinner(`Opening ${urlToOpen} in your browser to log in...
`);
    try {
      const p = await open(urlToOpen);
      p.once("error", () => {
        changeSpinner(`Manually open ${urlToOpen} in your browser to log in.`);
      });
      changeSpinner("Waiting for the confirmation...");
    } catch {
      logError(chalkStderr.red(`Unable to open browser.`));
      changeSpinner(`Manually open ${urlToOpen} in your browser to log in.`);
    }
  } else {
    showSpinner(`Open ${urlToOpen} in your browser to log in.`);
  }
  try {
    const tokens = await handle.poll();
    if (typeof tokens.access_token === "string") {
      return tokens.access_token;
    } else {
      throw Error("Access token is missing");
    }
  } catch (err) {
    switch (err.error) {
      case "access_denied":
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "Access denied.",
          errForSentry: err
        });
      case "expired_token":
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "Device flow expired.",
          errForSentry: err
        });
      default: {
        const message = err instanceof errors.OPError ? `Error = ${err.error}; error_description = ${err.error_description}` : `Login failed with error: ${err}`;
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: message,
          errForSentry: err
        });
      }
    }
  }
}
async function performPasswordAuthentication(ctx, clientId, username, password) {
  if (!process.env.WORKOS_API_SECRET) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "WORKOS_API_SECRET environment variable is not set"
    });
  }
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      email: username,
      password,
      client_id: clientId,
      client_secret: process.env.WORKOS_API_SECRET
    })
  };
  try {
    const response = await throwingFetch(
      "https://apiauth.convex.dev/user_management/authenticate",
      options
    );
    const data = await response.json();
    if (typeof data.access_token === "string") {
      return data.access_token;
    } else {
      throw Error("Access token is missing");
    }
  } catch (err) {
    logFailure(`Password flow failed: ${err}`);
    if (err.response) {
      logError(chalkStderr.red(`${JSON.stringify(err.response.data)}`));
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      errForSentry: err,
      printedMessage: null
    });
  }
}
export async function performLogin(ctx, {
  overrideAuthUrl,
  overrideAuthClient,
  overrideAuthUsername,
  overrideAuthPassword,
  overrideAccessToken,
  loginFlow,
  open: open2,
  acceptOptIns,
  dumpAccessToken,
  deviceName: deviceNameOverride,
  anonymousId,
  vercel,
  vercelOverride
} = {}) {
  loginFlow = loginFlow || "auto";
  let deviceName = deviceNameOverride ?? "";
  if (!deviceName && process.platform === "darwin") {
    try {
      deviceName = execSync("scutil --get ComputerName").toString().trim();
    } catch {
    }
  }
  if (!deviceName) {
    deviceName = hostname();
  }
  if (!deviceNameOverride) {
    logMessage(
      chalkStderr.bold(
        `Welcome to developing with Convex, let's get you logged in.`
      )
    );
    deviceName = await promptString(ctx, {
      message: "Device name:",
      default: deviceName
    });
  }
  const issuer = overrideAuthUrl ?? "https://auth.convex.dev";
  const clientId = overrideAuthClient ?? "HFtA247jp9iNs08NTLIB7JsNPMmRIyfi";
  let accessToken;
  if (overrideAccessToken) {
    accessToken = overrideAccessToken;
  } else if (overrideAuthUsername && overrideAuthPassword) {
    accessToken = await performPasswordAuthentication(
      ctx,
      clientId,
      overrideAuthUsername,
      overrideAuthPassword
    );
  } else if (loginFlow === "paste" || loginFlow === "auto" && isWebContainer()) {
    accessToken = await promptString(ctx, {
      message: "Open https://dashboard.convex.dev/auth, log in and paste the token here:"
    });
  } else {
    let authIssuer;
    try {
      authIssuer = await Issuer.discover(issuer);
    } catch {
      authIssuer = void 0;
    }
    if (authIssuer) {
      const authClient = new authIssuer.Client({
        client_id: clientId,
        token_endpoint_auth_method: "none",
        id_token_signed_response_alg: "RS256"
      });
      accessToken = await performDeviceAuthorization(
        ctx,
        authClient,
        open2 ?? true,
        vercel,
        vercelOverride
      );
    } else {
      accessToken = await promptString(ctx, {
        message: "Open https://dashboard.convex.dev/auth, log in and paste the token here:"
      });
    }
  }
  if (dumpAccessToken) {
    logOutput(`${accessToken}`);
    return await ctx.crash({
      exitCode: 0,
      errorType: "fatal",
      printedMessage: null
    });
  }
  ctx._updateBigBrainAuth({
    accessToken,
    kind: "accessToken",
    header: `Bearer ${accessToken}`
  });
  const response = await typedPlatformClient(ctx).POST(
    "/create_personal_access_token",
    {
      // `anonymousId` links a prior anonymous session to this account. It's
      // intentionally absent from the generated platform API types,
      // so cast to pass it through.
      body: { name: deviceName, anonymousId }
    }
  );
  const newAccessToken = response.data.accessToken;
  const globalConfig = { accessToken: newAccessToken };
  try {
    await modifyGlobalConfig(ctx, globalConfig);
    const path = globalConfigPath();
    logFinishedStep(`Saved credentials to ${formatPathForPrinting(path)}`);
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      errForSentry: err,
      printedMessage: null
    });
  }
  logVerbose(`performLogin: updating big brain auth after login`);
  await updateBigBrainAuthAfterLogin(ctx, newAccessToken);
  logVerbose(`performLogin: checking opt ins, acceptOptIns: ${acceptOptIns}`);
  const shouldContinue = await optins(ctx, acceptOptIns ?? false);
  if (!shouldContinue) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: null
    });
  }
  if (vercel) {
    await promptJoinVercelTeams(ctx);
  }
}
async function promptJoinVercelTeams(ctx) {
  const fetch2 = bigBrainFetch(ctx);
  let teams;
  try {
    const res = await fetch2(
      new URL("vercel/potential_teams", `${provisionHost}/`)
    );
    if (!res.ok) {
      logVerbose(
        `vercel/potential_teams returned ${res.status}; skipping team-join prompt`
      );
      return;
    }
    teams = await res.json();
  } catch (err) {
    logVerbose(`Failed to fetch potential Vercel teams: ${String(err)}`);
    return;
  }
  if (teams.length === 0) return;
  for (const [index, team] of teams.entries()) {
    const displayName = team.teamName.replace(/ \(Vercel\)$/, "");
    const counter = teams.length > 1 ? `[${index + 1}/${teams.length}] ` : "";
    const lines = [
      chalkStderr.bold(`${counter}You've been invited to join ${displayName}`) + ` (${team.planName}) through the Vercel marketplace.`
    ];
    if (team.pricingNotice) {
      lines.push(chalkStderr.yellow(team.pricingNotice));
    }
    lines.push(`Join "${displayName}"?`);
    const join = await promptYesNo(ctx, {
      message: `${lines.join("\n")}`,
      default: true
    });
    if (!join) continue;
    try {
      await fetch2(
        new URL(
          `vercel/potential_teams/${team.teamId}/join`,
          `${provisionHost}/`
        ),
        { method: "POST" }
      );
      logFinishedStep(`Joined ${displayName}`);
    } catch (err) {
      logFailure(`Failed to join ${displayName}: ${String(err)}`);
    }
  }
}
async function optins(ctx, acceptOptIns) {
  const bbAuth = ctx.bigBrainAuth();
  if (bbAuth === null) {
    return false;
  }
  switch (bbAuth.kind) {
    case "accessToken":
      break;
    case "deploymentKey":
    case "projectKey":
    case "previewDeployKey":
      return true;
    default: {
      bbAuth;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        errForSentry: `Unexpected auth kind ${bbAuth.kind}`,
        printedMessage: "Hit an unexpected error while logging in."
      });
    }
  }
  const data = await bigBrainAPI({
    ctx,
    method: "POST",
    path: "check_opt_ins"
  });
  if (data.optInsToAccept.length === 0) {
    return true;
  }
  for (const optInToAccept of data.optInsToAccept) {
    const confirmed = acceptOptIns || await promptYesNo(ctx, {
      message: optInToAccept.message
    });
    if (!confirmed) {
      logFailure("Please accept the Terms of Service to use Convex.");
      return Promise.resolve(false);
    }
  }
  const optInsAccepted = data.optInsToAccept.map((o) => o.optIn);
  const args = { optInsAccepted };
  await bigBrainAPI({
    ctx,
    method: "POST",
    path: "accept_opt_ins",
    data: args
  });
  return true;
}
export async function ensureLoggedIn(ctx, options) {
  const isLoggedIn = await checkAuthorization(ctx, false);
  if (!isLoggedIn) {
    if (options?.message) {
      logMessage(options.message);
    }
    await performLogin(ctx, {
      acceptOptIns: false,
      overrideAuthUrl: options?.overrideAuthUrl,
      overrideAuthClient: options?.overrideAuthClient,
      overrideAuthUsername: options?.overrideAuthUsername,
      overrideAuthPassword: options?.overrideAuthPassword
    });
  }
}
//# sourceMappingURL=login.js.map
