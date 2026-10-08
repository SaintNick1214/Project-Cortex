"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var configure_exports = {};
__export(configure_exports, {
  _deploymentCredentialsOrConfigure: () => _deploymentCredentialsOrConfigure,
  deploymentCredentialsOrConfigure: () => deploymentCredentialsOrConfigure,
  selectProject: () => selectProject,
  updateEnvAndConfigForDeploymentSelection: () => updateEnvAndConfigForDeploymentSelection
});
module.exports = __toCommonJS(configure_exports);
var import_chalk = require("chalk");
var import_log = require("../bundler/log.js");
var import_api = require("./lib/api.js");
var import_config = require("./lib/config.js");
var import_deployment = require("./lib/deployment.js");
var import_init = require("./lib/init.js");
var import_utils = require("./lib/utils/utils.js");
var import_envvars = require("./lib/envvars.js");
var import_path = __toESM(require("path"), 1);
var import_dashboard = require("./lib/dashboard.js");
var import_codegen = require("./lib/codegen.js");
var import_localDeployment = require("./lib/localDeployment/localDeployment.js");
var import_prompts = require("./lib/utils/prompts.js");
var import_aiFiles = require("./lib/aiFiles/index.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_login = require("./lib/login.js");
var import_anonymous = require("./lib/localDeployment/anonymous.js");
var import_deploy2 = require("./lib/deploy2.js");
async function deploymentCredentialsOrConfigure(ctx, deploymentSelection, chosenConfiguration, cmdOptions) {
  const selectedDeployment = await _deploymentCredentialsOrConfigure(
    ctx,
    deploymentSelection,
    chosenConfiguration,
    cmdOptions
  );
  const { convexSiteUrl: siteUrl } = await (0, import_deploy2.fetchDeploymentCanonicalUrls)(ctx, {
    adminKey: selectedDeployment.adminKey,
    deploymentUrl: selectedDeployment.url
  });
  if (selectedDeployment.deploymentFields !== null) {
    await updateEnvAndConfigForDeploymentSelection(
      ctx,
      {
        url: selectedDeployment.url,
        siteUrl,
        deploymentName: selectedDeployment.deploymentFields.deploymentName,
        teamSlug: selectedDeployment.deploymentFields.teamSlug,
        projectSlug: selectedDeployment.deploymentFields.projectSlug,
        deploymentType: selectedDeployment.deploymentFields.deploymentType
      },
      (0, import_deploymentSelection.deploymentNameFromSelection)(deploymentSelection)
    );
  } else {
    await handleManuallySetUrlAndAdminKey(ctx, {
      url: selectedDeployment.url,
      siteUrl,
      adminKey: selectedDeployment.adminKey
    });
  }
  return {
    url: selectedDeployment.url,
    adminKey: selectedDeployment.adminKey,
    deploymentFields: selectedDeployment.deploymentFields === null ? null : { ...selectedDeployment.deploymentFields, siteUrl }
  };
}
async function _deploymentCredentialsOrConfigure(ctx, deploymentSelection, chosenConfiguration, cmdOptions) {
  switch (deploymentSelection.kind) {
    case "existingDeployment":
      await assertLocalOptionsAreDefault(ctx, cmdOptions.localOptions);
      return {
        url: deploymentSelection.deploymentToActOn.url,
        adminKey: deploymentSelection.deploymentToActOn.adminKey,
        deploymentFields: deploymentSelection.deploymentToActOn.deploymentFields
      };
    case "chooseProject": {
      await (0, import_login.ensureLoggedIn)(ctx, {
        overrideAuthUrl: cmdOptions.overrideAuthUrl,
        overrideAuthClient: cmdOptions.overrideAuthClient,
        overrideAuthUsername: cmdOptions.overrideAuthUsername,
        overrideAuthPassword: cmdOptions.overrideAuthPassword
      });
      return await handleChooseProject(
        ctx,
        chosenConfiguration,
        deploymentSelection.selectionWithinProject,
        cmdOptions
      );
    }
    case "preview":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Use `npx convex deploy` to use preview deployments."
      });
    case "deploymentWithinProject": {
      return await handleDeploymentWithinProject(ctx, {
        chosenConfiguration,
        deploymentSelection,
        cmdOptions
      });
    }
    case "anonymous": {
      const hasAuth = ctx.bigBrainAuth() !== null;
      const isAgentMode = process.env.CONVEX_AGENT_MODE === "anonymous";
      if (!isAgentMode && process.stdin.isTTY && hasAuth && deploymentSelection.deploymentName !== null) {
        const shouldConfigure = chosenConfiguration !== null || await (0, import_prompts.promptYesNo)(ctx, {
          message: `${import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME} is configured with deployment ${deploymentSelection.deploymentName}, which is not linked with your account. Would you like to link it now?`
        });
        if (shouldConfigure) {
          return await handleChooseProject(
            ctx,
            chosenConfiguration,
            deploymentSelection.selectionWithinProject,
            cmdOptions
          );
        }
      }
      const alreadyHasConfiguredAnonymousDeployment = deploymentSelection.deploymentName !== null && chosenConfiguration === null;
      if (isAgentMode) {
        (0, import_log.logWarning)(
          import_chalk.chalkStderr.yellow.bold(
            "CONVEX_AGENT_MODE=anonymous mode is in beta, functionality may change in the future."
          )
        );
      }
      const shouldPromptForLogin = isAgentMode || !process.stdin.isTTY ? "no" : alreadyHasConfiguredAnonymousDeployment ? "no" : await (0, import_prompts.promptOptions)(ctx, {
        message: "Welcome to Convex! Would you like to login to your account?",
        choices: [
          {
            name: "Start without an account (run Convex locally)",
            value: "no"
          },
          { name: "Login or create an account", value: "yes" }
        ],
        default: "no"
      });
      if (shouldPromptForLogin === "no") {
        const result = await (0, import_anonymous.handleAnonymousDeployment)(ctx, {
          chosenConfiguration,
          deploymentName: deploymentSelection.deploymentName,
          ...cmdOptions.localOptions
        });
        return {
          adminKey: result.adminKey,
          url: result.deploymentUrl,
          deploymentFields: {
            deploymentName: result.deploymentName,
            deploymentType: "anonymous",
            projectSlug: null,
            teamSlug: null,
            reference: null,
            isDefault: false
          }
        };
      }
      return await handleChooseProject(
        ctx,
        chosenConfiguration,
        deploymentSelection.selectionWithinProject,
        cmdOptions
      );
    }
  }
}
async function handleDeploymentWithinProject(ctx, {
  chosenConfiguration,
  deploymentSelection,
  cmdOptions
}) {
  const hasAuth = ctx.bigBrainAuth() !== null;
  const loginMessage = hasAuth && (0, import_deploymentSelection.shouldAllowAnonymousDevelopment)() ? void 0 : `Tip: You can try out Convex without creating an account by clearing the ${import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME} environment variable (often in .env.local).`;
  await (0, import_login.ensureLoggedIn)(ctx, {
    message: loginMessage,
    overrideAuthUrl: cmdOptions.overrideAuthUrl,
    overrideAuthClient: cmdOptions.overrideAuthClient,
    overrideAuthUsername: cmdOptions.overrideAuthUsername,
    overrideAuthPassword: cmdOptions.overrideAuthPassword
  });
  if (chosenConfiguration !== null) {
    const result = await handleChooseProject(
      ctx,
      chosenConfiguration,
      deploymentSelection.selectionWithinProject,
      cmdOptions
    );
    return result;
  }
  const accessResult = await (0, import_api.checkAccessToSelectedProject)(
    ctx,
    deploymentSelection.targetProject
  );
  if (accessResult.kind === "noAccess") {
    (0, import_log.logMessage)("You don't have access to the selected project.");
    const result = await handleChooseProject(
      ctx,
      chosenConfiguration,
      deploymentSelection.selectionWithinProject,
      cmdOptions
    );
    return result;
  }
  const selectedDeployment = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    // We'll start running it below
    { ensureLocalRunning: false }
  );
  if (selectedDeployment.deploymentFields !== null && selectedDeployment.deploymentFields.deploymentType === "local") {
    const localDeployment = await (0, import_localDeployment.handleLocalDeployment)(ctx, {
      teamSlug: selectedDeployment.deploymentFields.teamSlug,
      projectSlug: selectedDeployment.deploymentFields.projectSlug,
      forceUpgrade: cmdOptions.localOptions.forceUpgrade,
      ports: cmdOptions.localOptions.ports,
      backendVersion: cmdOptions.localOptions.backendVersion
    });
    return {
      url: localDeployment.deploymentUrl,
      adminKey: localDeployment.adminKey,
      deploymentFields: selectedDeployment.deploymentFields
    };
  }
  await assertLocalOptionsAreDefault(ctx, cmdOptions.localOptions);
  return {
    url: selectedDeployment.url,
    adminKey: selectedDeployment.adminKey,
    deploymentFields: selectedDeployment.deploymentFields
  };
}
async function handleChooseProject(ctx, chosenConfiguration, selectionWithinProject, cmdOptions) {
  await (0, import_login.ensureLoggedIn)(ctx, {
    overrideAuthUrl: cmdOptions.overrideAuthUrl,
    overrideAuthClient: cmdOptions.overrideAuthClient,
    overrideAuthUsername: cmdOptions.overrideAuthUsername,
    overrideAuthPassword: cmdOptions.overrideAuthPassword
  });
  const project = await selectProject(ctx, chosenConfiguration, {
    team: cmdOptions.team,
    project: cmdOptions.project,
    devDeployment: cmdOptions.devDeployment
  });
  if (selectionWithinProject.kind === "prod" || project.devDeployment !== "local") {
    await assertLocalOptionsAreDefault(ctx, cmdOptions.localOptions);
  }
  const deploymentOptions = selectionWithinProject.kind === "prod" ? { kind: "prod" } : project.devDeployment === "local" ? { kind: "local", ...cmdOptions.localOptions } : { kind: "dev" };
  const {
    deploymentName,
    deploymentUrl: url,
    adminKey,
    reference,
    isDefault
  } = await ensureDeploymentProvisioned(ctx, {
    teamSlug: project.teamSlug,
    projectSlug: project.projectSlug,
    deploymentOptions
  });
  return {
    url,
    adminKey,
    deploymentFields: {
      deploymentName,
      deploymentType: deploymentOptions.kind,
      projectSlug: project.projectSlug,
      teamSlug: project.teamSlug,
      reference,
      isDefault
    }
  };
}
async function handleManuallySetUrlAndAdminKey(ctx, cmdOptions) {
  const { url, siteUrl, adminKey } = cmdOptions;
  const didErase = await (0, import_deployment.eraseDeploymentEnvVar)(ctx);
  if (didErase) {
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellowBright(
        `Removed the CONVEX_DEPLOYMENT environment variable from .env.local`
      )
    );
  }
  const envFileConfig = await (0, import_envvars.writeUrlsToEnvFile)(ctx, {
    convexUrl: url,
    siteUrl
  });
  if (envFileConfig !== null && (envFileConfig.convexUrlEnvVar || envFileConfig.siteUrlEnvVar)) {
    const updatedVars = [
      envFileConfig.convexUrlEnvVar,
      envFileConfig.siteUrlEnvVar
    ].filter(Boolean).join(" and ");
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.green(`Saved ${updatedVars} to ${envFileConfig.envFile}`)
    );
  }
  return { url, adminKey };
}
async function selectProject(ctx, chosenConfiguration, cmdOptions) {
  const choice = chosenConfiguration !== "ask" && chosenConfiguration !== null ? chosenConfiguration : await askToConfigure(ctx);
  switch (choice) {
    case "new":
      return selectNewProject(ctx, chosenConfiguration, cmdOptions);
    case "existing":
      return selectExistingProject(ctx, chosenConfiguration, cmdOptions);
    default:
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "No project selected."
      });
  }
}
const cwd = import_path.default.basename(process.cwd());
async function selectNewProject(ctx, chosenConfiguration, config) {
  const { team: selectedTeam, chosen: didChooseBetweenTeams } = await (0, import_utils.validateOrSelectTeam)(ctx, config.team, "Team:");
  let projectName = config.project || cwd;
  let choseProjectInteractively = false;
  if (!config.project) {
    projectName = await (0, import_prompts.promptString)(ctx, {
      message: "Project name:",
      default: config.defaultProjectName || cwd
    });
    choseProjectInteractively = true;
  }
  const { devDeployment } = await (0, import_utils.selectDevDeploymentType)(ctx, {
    chosenConfiguration,
    newOrExisting: "new",
    teamSlug: selectedTeam.slug,
    userHasChosenSomethingInteractively: didChooseBetweenTeams || choseProjectInteractively,
    projectSlug: void 0,
    devDeploymentFromFlag: config.devDeployment
  });
  const region = devDeployment === "cloud" ? await (0, import_utils.selectRegionOrUseDefault)(ctx, selectedTeam, "dev") : null;
  (0, import_log.showSpinner)("Creating new Convex project...");
  const deploymentToProvision = devDeployment === "cloud" ? {
    deploymentType: "dev",
    region
  } : null;
  let projectSlug;
  try {
    ({ projectSlug } = await (0, import_api.createProject)(ctx, {
      teamId: selectedTeam.id,
      projectName,
      deploymentToProvision
    }));
  } catch (err) {
    (0, import_log.logFailure)("Unable to create project.");
    return await (0, import_utils.logAndHandleFetchError)(ctx, err);
  }
  const teamSlug = selectedTeam.slug;
  const teamMessage = didChooseBetweenTeams ? " in team " + import_chalk.chalkStderr.bold(teamSlug) : "";
  (0, import_log.logFinishedStep)(
    `Created project ${import_chalk.chalkStderr.bold(
      projectSlug
    )}${teamMessage}, manage it at ${import_chalk.chalkStderr.bold(
      (0, import_dashboard.projectDashboardUrl)(teamSlug, projectSlug)
    )}`
  );
  await (0, import_codegen.doInitConvexFolder)(ctx);
  const { configPath, projectConfig } = await (0, import_config.readProjectConfig)(ctx);
  const folder = (0, import_utils.functionsDir)(configPath, projectConfig);
  await (0, import_aiFiles.attemptSetupAiFiles)({
    ctx,
    aiFilesConfig: projectConfig.aiFiles,
    convexDir: import_path.default.resolve(folder),
    projectDir: import_path.default.resolve(import_path.default.dirname(configPath))
  });
  return { teamSlug, projectSlug, devDeployment };
}
async function selectExistingProject(ctx, chosenConfiguration, config) {
  const {
    team: { slug: teamSlug },
    chosen
  } = await (0, import_utils.validateOrSelectTeam)(ctx, config.team, "Team:");
  const projectSlug = await (0, import_utils.validateOrSelectProject)(
    ctx,
    config.project,
    teamSlug,
    "Configure project",
    "Project:"
  );
  if (projectSlug === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Run the command again to create a new project instead."
    });
  }
  const { devDeployment } = await (0, import_utils.selectDevDeploymentType)(ctx, {
    chosenConfiguration,
    newOrExisting: "existing",
    teamSlug,
    projectSlug,
    userHasChosenSomethingInteractively: chosen || !config.project,
    devDeploymentFromFlag: config.devDeployment
  });
  (0, import_log.logFinishedStep)(`Reinitialized project ${import_chalk.chalkStderr.bold(projectSlug)}`);
  return { teamSlug, projectSlug, devDeployment };
}
async function askToConfigure(ctx) {
  if (!await (0, import_utils.hasProjects)(ctx)) {
    return "new";
  }
  return await (0, import_prompts.promptOptions)(ctx, {
    message: "What would you like to configure?",
    default: "new",
    choices: [
      { name: "create a new project", value: "new" },
      { name: "choose an existing project", value: "existing" }
    ]
  });
}
async function ensureDeploymentProvisioned(ctx, options) {
  switch (options.deploymentOptions.kind) {
    case "dev":
    case "prod": {
      const credentials = await (0, import_api.fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows)(
        ctx,
        {
          kind: "teamAndProjectSlugs",
          teamSlug: options.teamSlug,
          projectSlug: options.projectSlug
        },
        options.deploymentOptions.kind
      );
      return credentials;
    }
    case "local": {
      const credentials = await (0, import_localDeployment.handleLocalDeployment)(ctx, {
        teamSlug: options.teamSlug,
        projectSlug: options.projectSlug,
        ...options.deploymentOptions
      });
      return credentials;
    }
    default:
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Invalid deployment type: ${options.deploymentOptions.kind}`,
        errForSentry: `Invalid deployment type: ${options.deploymentOptions.kind}`
      });
  }
}
async function updateEnvAndConfigForDeploymentSelection(ctx, options, existingValue) {
  const { configPath, projectConfig } = await (0, import_config.readProjectConfig)(ctx);
  const { wroteToGitIgnore, changedDeploymentEnvVar } = options.deploymentType !== "prod" ? await (0, import_deployment.writeDeploymentEnvVar)(
    ctx,
    options.deploymentType,
    {
      team: options.teamSlug,
      project: options.projectSlug,
      deploymentName: options.deploymentName
    },
    existingValue
  ) : { wroteToGitIgnore: false, changedDeploymentEnvVar: false };
  await (0, import_config.ensureConvexFunctionsDir)(ctx, projectConfig);
  await (0, import_init.finalizeConfiguration)(ctx, {
    deploymentType: options.deploymentType,
    deploymentName: options.deploymentName,
    url: options.url,
    siteUrl: options.siteUrl,
    wroteToGitIgnore,
    changedDeploymentEnvVar,
    functionsPath: (0, import_utils.functionsDir)(configPath, projectConfig)
  });
}
async function assertLocalOptionsAreDefault(ctx, localOptions) {
  if (localOptions.ports.cloud !== void 0) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--local-cloud-port` can only be used when developing with a local deployment. Use `npx convex deployment select local` to use a local deployment."
    });
  }
  if (localOptions.ports.site !== void 0) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--local-site-port` can only be used when developing with a local deployment. Use `npx convex deployment select local` to use a local deployment."
    });
  }
  if (localOptions.backendVersion !== void 0) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--local-backend-version` can only be used when developing with a local deployment. Use `npx convex deployment select local` to use a local deployment."
    });
  }
  if (localOptions.dashboardVersion !== void 0) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--local-dashboard-version` can only be used when developing with a local deployment. Use `npx convex deployment select local` to use a local deployment."
    });
  }
  if (localOptions.forceUpgrade === true) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--local-force-upgrade` can only be used when developing with a local deployment. Use `npx convex deployment select local` to use a local deployment."
    });
  }
}
//# sourceMappingURL=configure.js.map
