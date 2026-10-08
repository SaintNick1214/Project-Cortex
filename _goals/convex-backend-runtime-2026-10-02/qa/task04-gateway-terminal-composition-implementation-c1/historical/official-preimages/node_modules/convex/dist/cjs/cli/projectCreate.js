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
var projectCreate_exports = {};
__export(projectCreate_exports, {
  projectCreate: () => projectCreate
});
module.exports = __toCommonJS(projectCreate_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_chalk = require("chalk");
var import_api = require("./lib/api.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_utils = require("./lib/utils/utils.js");
var import_prompts = require("./lib/utils/prompts.js");
var import_dashboard = require("./lib/dashboard.js");
async function runProjectCreate(nameArg, options) {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  await (0, import_deploymentSelection.ensureAuthCanCreateDeployment)(ctx);
  const { team } = await (0, import_utils.validateOrSelectTeam)(ctx, options.team, "Team:");
  let projectName = nameArg;
  if (!projectName) {
    if (!process.stdin.isTTY) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Specify a project name:\n  `npx convex project create my-app`"
      });
    }
    projectName = await (0, import_prompts.promptString)(ctx, {
      message: "Project name:"
    });
  }
  (0, import_log.showSpinner)(`Creating project ${projectName}...`);
  const { projectSlug } = await (0, import_api.createProject)(ctx, {
    teamId: team.id,
    projectName,
    deploymentToProvision: null
  });
  (0, import_log.logFinishedStep)(
    `Created project ${import_chalk.chalkStderr.bold(projectSlug)} in team ${import_chalk.chalkStderr.bold(team.slug)}, manage it at ${import_chalk.chalkStderr.bold(
      (0, import_dashboard.projectDashboardUrl)(team.slug, projectSlug)
    )}`
  );
  (0, import_log.logMessage)(
    import_chalk.chalkStderr.gray(
      `Next, add a deployment with \`npx convex deployment create ${team.slug}:${projectSlug}:dev --type dev\` (pass \`--region us\` to choose a region).`
    )
  );
}
const projectCreate = new import_extra_typings.Command("create").summary("Create a new project").description(
  [
    "Create a new project.",
    "",
    "Provisioning a deployment is a separate step \u2014 after creating the",
    "project, run `npx convex deployment create` to add one.",
    "",
    "\u2022 Create a project in your only team: `npx convex project create my-app`",
    "\u2022 Pick the team: `npx convex project create my-app --team my-team`"
  ].join("\n")
).allowExcessArguments(false).argument(
  "[name]",
  "The name of the new project. Prompted for when omitted in an interactive terminal; required otherwise."
).addOption(
  new import_extra_typings.Option(
    "--team <team_slug>",
    "The team to create the project in. Defaults to your only team, or prompts when you belong to several."
  )
).action(runProjectCreate);
//# sourceMappingURL=projectCreate.js.map
