"use strict";
import { logMessage } from "../../bundler/log.js";
import { chalkStderr } from "chalk";
import {
  deploymentDashboardUrl,
  deploymentDashboardUrlPage
} from "./dashboard.js";
function stylesFor(dtype) {
  switch (dtype) {
    case "prod":
      return {
        label: "Production",
        bg: "#eacae7",
        fg: "#641aa9",
        bar: "#8b21f1"
      };
    case "dev":
      return {
        label: "Development",
        bg: "#d2ecbb",
        fg: "#2b6536",
        bar: "#3ea34b"
      };
    case "local":
      return {
        label: "Local",
        bg: "#d2ecbb",
        fg: "#2b6536",
        bar: "#3ea34b"
      };
    case "anonymous":
      return {
        label: "Local",
        bg: "#d2ecbb",
        fg: "#2b6536",
        bar: "#3ea34b"
      };
    case "preview":
      return {
        label: "Preview",
        bg: "#fcedd7",
        fg: "#933615",
        bar: "#e25706"
      };
    case "custom":
      return {
        label: "Custom",
        bg: "#dfe2e9",
        fg: "#292b30",
        bar: "#989aa3"
      };
    case null:
      return {
        label: "",
        bg: "#dfe2e9",
        fg: "#292b30",
        bar: "#989aa3"
      };
    default:
      dtype;
      return {
        label: "Unknown",
        bg: "#dfe2e9",
        fg: "#292b30",
        bar: "#989aa3"
      };
  }
}
function osc8Link(text, url) {
  if (!process.stderr.isTTY) return text;
  return `\x1B]8;;${url}\x1B\\${text}\x1B]8;;\x1B\\`;
}
export function formatTargetedDeployment(header, creds, chalk) {
  const fields = creds.deploymentFields;
  const style = stylesFor(fields?.deploymentType ?? null);
  const bar = chalk.hex(style.bar)("\u258C");
  const tag = chalk.level > 0 ? chalk.bold.bgHex(style.bg).hex(style.fg)(` ${style.label} `) : `[${style.label}]`;
  const urlStyled = chalk.dim.underline(osc8Link(creds.url, creds.url));
  const dashUrl = dashboardUrlFor(fields);
  const dashboardSuffix = dashUrl ? process.stderr.isTTY ? ` (${osc8Link(chalk.underline("dashboard"), dashUrl)})` : ` (dashboard: ${dashUrl})` : "";
  let refLine;
  if (fields === null) {
    refLine = null;
  } else if (fields.deploymentType === "local") {
    const port = portFromUrl(creds.url);
    const portPart = port !== null ? `Port ${chalk.bold(port)}` : creds.url;
    const projectPart = fields.teamSlug && fields.projectSlug ? ` \u2022 in ${fields.teamSlug}${chalk.dim(":")}${fields.projectSlug}` : "";
    refLine = `${tag} ${portPart}${projectPart}${dashboardSuffix}`;
  } else if (fields.deploymentType === "anonymous") {
    const port = portFromUrl(creds.url);
    const portPart = port !== null ? `Port ${chalk.bold(port)}` : creds.url;
    refLine = `${tag} ${portPart} \u2022 No Convex account (run ${chalk.bold("npx convex login")} to link to a project)`;
  } else {
    const { dimPrefix, boldTail, defaultAlias } = deploymentRefFor(fields);
    const aliasPart = defaultAlias === null ? "" : ` ${chalk.dim("(")}${chalk.bold(defaultAlias)}${chalk.dim(")")}`;
    refLine = `${tag} ${chalk.dim(dimPrefix)}${chalk.bold(boldTail)}${aliasPart}${dashboardSuffix}`;
  }
  return [
    header === null ? null : `${bar} ${header}`,
    refLine === null ? null : `${bar} ${refLine}`,
    `${bar} ${chalk.dim("\u2514\u2500")} ${urlStyled}`
  ].filter((x) => x !== null).join("\n");
}
function portFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.port || null;
  } catch {
    return null;
  }
}
export function announceDeploymentTarget(header, creds) {
  logMessage(formatTargetedDeployment(header, creds, chalkStderr));
}
function deploymentRefFor(fields) {
  if (fields === null) {
    return { dimPrefix: "", boldTail: "", defaultAlias: null };
  }
  if (fields.deploymentType === "local") {
    return { dimPrefix: "", boldTail: "local", defaultAlias: null };
  }
  const isCloud = fields.deploymentType === "dev" || fields.deploymentType === "preview" || fields.deploymentType === "prod" || fields.deploymentType === "custom";
  if (isCloud && fields.teamSlug && fields.projectSlug && fields.reference) {
    const defaultAlias = fields.isDefault && (fields.deploymentType === "dev" || fields.deploymentType === "prod") ? fields.deploymentType : null;
    return {
      dimPrefix: `${fields.teamSlug}:${fields.projectSlug}:`,
      boldTail: fields.reference,
      defaultAlias
    };
  }
  return { dimPrefix: "", boldTail: fields.deploymentName, defaultAlias: null };
}
function dashboardUrlFor(fields) {
  if (fields === null || fields.deploymentType === "anonymous") {
    return null;
  }
  if (fields.teamSlug && fields.projectSlug) {
    return deploymentDashboardUrl(
      fields.teamSlug,
      fields.projectSlug,
      fields.deploymentName
    );
  }
  return deploymentDashboardUrlPage(fields.deploymentName, "");
}
//# sourceMappingURL=announceDeploymentTarget.js.map
