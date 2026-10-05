"use strict";
import { execSync } from "child_process";
import { Command, Option } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import {
  logFailure,
  logFinishedStep,
  logMessage,
  showSpinner
} from "../bundler/log.js";
import {
  ensureAuthCanCreateDeployment,
  getDeploymentSelection,
  getProjectDetails,
  deploymentNameFromSelection
} from "./lib/deploymentSelection.js";
import {
  logNoDefaultRegionMessage,
  selectRegion,
  typedBigBrainClient,
  typedPlatformClient
} from "./lib/utils/utils.js";
import { getTeamAndProjectFromPreviewAdminKey } from "./lib/deployment.js";
import { saveSelectedDeployment } from "./deploymentSelect.js";
import { promptOptions, promptString } from "./lib/utils/prompts.js";
import { chalkStderr } from "chalk";
import { parseDeploymentSelector } from "./lib/deploymentSelector.js";
import {
  parseExpiration,
  resolveExpiration,
  validateExpiration
} from "./lib/expiration.js";
import { ensureBackendBinaryDownloaded } from "./lib/localDeployment/download.js";
import {
  loadProjectLocalConfig,
  saveDeploymentConfig
} from "./lib/localDeployment/filePaths.js";
import { chooseLocalBackendPorts } from "./lib/localDeployment/utils.js";
import { bigBrainStart } from "./lib/localDeployment/bigBrain.js";
import { importDefaultEnvVars } from "./lib/localDeployment/localDeployment.js";
import { localDeploymentUrl } from "./lib/localDeployment/run.js";
import { announceDeploymentTarget } from "./lib/announceDeploymentTarget.js";
import { generateLocalDevSecrets } from "./lib/localDeployment/secrets.js";
const SUPPORTED_TYPES = ["dev", "prod", "preview"];
export const deploymentCreate = new Command("create").summary("Create a new deployment for a project").description(
  [
    "Create a new deployment for a project.",
    "",
    "\u2022 Create a dev deployment and select it: `npx convex deployment create dev/my-new-feature --type dev --select`",
    "\u2022 Create a prod deployment named \u201Cstaging\u201D: `npx convex deployment create staging --type prod`"
  ].join("\n")
).argument(
  "[reference]",
  "The reference for the new deployment, e.g. `staging` or `dev/my-feature`. \nUse `local` to create a local deployment. \nYou can specify a team and project with `team-slug:project-slug:ref` (e.g. `my-team:my-project:staging` or `my-team:my-project:local`). \nCan be omitted when using `--default`."
).allowExcessArguments(false).addOption(
  new Option("--type <type>", "Deployment type").choices(SUPPORTED_TYPES)
).option("--region <region>", "Deployment region").addOption(new Option("--class <class>", "Deployment class").hideHelp()).option(
  "--select",
  "Select the new deployment. This will update the Convex environment variables in .env.local. Subsequent `npx convex` commands will run against this deployment."
).option(
  "--default",
  "Make the new deployment your default production deployment (used by `npx convex deploy`) or your personal dev deployment."
).option(
  "--expiration <value>",
  'When the deployment expires (e.g. "none", "in 7 days", "2026-04-01T00:00:00Z", or a UNIX timestamp in seconds or milliseconds)'
).addOption(new Option("--expiry <value>").hideHelp()).addOption(new Option("--expires <value>").hideHelp()).action(async (refParam, options) => {
  const expiration = options.expiration ?? options.expiry ?? options.expires;
  const ctx = await oneoffContext({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  await ensureAuthCanCreateDeployment(ctx);
  const currentDeployment = await getDeploymentSelection(ctx, {
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  if (refParam !== void 0) {
    const localTarget = parseLocalCreateTarget(refParam);
    if (localTarget !== null) {
      const cloudOnlyFlags = ["type", "region", "class", "default"];
      for (const flag of cloudOnlyFlags) {
        if (options[flag]) {
          return await ctx.crash({
            exitCode: 1,
            errorType: "fatal",
            printedMessage: `--${flag} cannot be used when creating a local deployment`
          });
        }
      }
      if (expiration !== void 0) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `--expiration cannot be used when creating a local deployment`
        });
      }
      if (localTarget.kind === "needsTeam") {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "Please use `team:project:local` to specify the team when creating a local deployment in a different project."
        });
      }
      await createLocalDeployment(
        ctx,
        currentDeployment,
        options.select ?? false,
        localTarget.kind === "inTeamProject" ? {
          teamSlug: localTarget.teamSlug,
          projectSlug: localTarget.projectSlug
        } : null
      );
      return;
    }
  }
  const expiresAt = await resolveExpiresAtOrCrash(ctx, expiration);
  const {
    ref,
    regionDetails,
    classDetails,
    projectId,
    type,
    isDefault,
    teamSlug,
    projectSlug
  } = process.stdin.isTTY ? await resolveOptionsInteractively(
    ctx,
    currentDeployment,
    refParam,
    options
  ) : await resolveOptionsNoninteractively(
    ctx,
    currentDeployment,
    refParam,
    options
  );
  showSpinner(
    `Creating ${type} deployment` + (regionDetails ? ` in region ${regionDetails.displayName}` : "") + (classDetails ? ` with class ${classDetails.type}` : "") + "..."
  );
  const created = (await typedPlatformClient(ctx).POST(
    "/projects/{project_id}/create_deployment",
    {
      params: {
        path: { project_id: projectId }
      },
      body: {
        type,
        region: regionDetails?.name ?? null,
        reference: ref ?? null,
        isDefault,
        ...expiresAt !== void 0 ? { expiresAt } : {},
        ...classDetails ? { class: classDetails.type } : {}
      }
    }
  )).data;
  if (created.kind !== "cloud") {
    const err = `Expected cloud deployment to be created but got ${created.kind}`;
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: err,
      errForSentry: err
    });
  }
  logFinishedStep(
    options.select ? `Created and selected new ${created.deploymentType} deployment:` : `Created new ${created.isDefault ? "default " : ""}${created.deploymentType} deployment:`
  );
  announceDeploymentTarget(null, {
    url: created.deploymentUrl,
    deploymentFields: {
      deploymentName: created.name,
      deploymentType: created.deploymentType,
      teamSlug,
      projectSlug,
      reference: created.reference,
      isDefault: created.isDefault
    }
  });
  if (!options.select) {
    if (type !== "prod") {
      const selectRef = `${teamSlug}:${projectSlug}:${created.reference}`;
      logMessage(
        `
To make \`npx convex\` use this deployment, run ${chalkStderr.bold(`npx convex deployment select ${selectRef}`)}`
      );
      logMessage(
        chalkStderr.gray(
          "Hint: use `--select` to immediately select the newly created deployment."
        )
      );
    }
  } else {
    const selection = {
      kind: "deploymentWithinProject",
      targetProject: {
        kind: "teamAndProjectSlugs",
        teamSlug,
        projectSlug
      },
      selectionWithinProject: {
        kind: "deploymentSelector",
        selector: created.reference
      }
    };
    await saveSelectedDeployment(
      ctx,
      created.reference,
      selection,
      deploymentNameFromSelection(currentDeployment)
    );
  }
});
export async function createLocalDeployment(ctx, currentDeployment, select, baseDeployment) {
  const existing = loadProjectLocalConfig(ctx);
  if (existing) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "A local deployment already exists."
    });
  }
  const {
    teamSlug,
    slug: projectSlug,
    id: cloudProjectId
  } = baseDeployment ? await getProjectDetails(ctx, {
    kind: "teamAndProjectSlugs",
    teamSlug: baseDeployment.teamSlug,
    projectSlug: baseDeployment.projectSlug
  }) : await resolveProject(ctx, currentDeployment);
  showSpinner("Downloading local backend...");
  const { version, binaryPath: latestBinaryPath } = await ensureBackendBinaryDownloaded(ctx, {
    kind: "latest"
  });
  const { cloudPort, sitePort } = await chooseLocalBackendPorts(ctx);
  showSpinner("Registering local deployment...");
  const { deploymentName } = await bigBrainStart(ctx, {
    port: cloudPort,
    projectSlug,
    teamSlug,
    instanceName: null
  });
  const { instanceSecret, adminKey } = await generateLocalDevSecrets(ctx, {
    deploymentName,
    latestBinaryPath
  });
  saveDeploymentConfig(ctx, "local", deploymentName, {
    backendVersion: version,
    ports: { cloud: cloudPort, site: sitePort },
    adminKey,
    instanceSecret,
    cloudProjectId
  });
  logFinishedStep(
    select ? "Created and selected local deployment:" : "Created local deployment:"
  );
  announceDeploymentTarget(null, {
    url: `http://127.0.0.1:${cloudPort}`,
    deploymentFields: {
      deploymentName,
      deploymentType: "local",
      teamSlug,
      projectSlug,
      reference: null,
      isDefault: false
    }
  });
  await importDefaultEnvVars(ctx, {
    teamSlug,
    projectSlug,
    deploymentName,
    deploymentUrl: localDeploymentUrl(cloudPort),
    adminKey
  });
  if (select) {
    const selection = {
      kind: "deploymentWithinProject",
      targetProject: {
        kind: "deploymentName",
        deploymentName,
        deploymentType: "local"
      },
      selectionWithinProject: {
        kind: "deploymentSelector",
        selector: "local"
      }
    };
    await saveSelectedDeployment(
      ctx,
      "local",
      selection,
      deploymentNameFromSelection(currentDeployment)
    );
  }
  const devCommand = "npx convex dev";
  if (select) {
    logMessage(`
Run ${chalkStderr.bold(devCommand)} to start it.`);
  } else {
    logMessage(
      `
To use this deployment, run:
` + chalkStderr.bold(`      npx convex deployment select local
`) + `  Then, run ${chalkStderr.bold(devCommand)} to start it.`
    );
  }
}
async function resolveOptionsNoninteractively(ctx, currentDeployment, refParam, options) {
  let ref;
  let teamAndProject;
  if (refParam) {
    const result = parseSelectorForNewDeployment(refParam);
    if (result.kind === "invalid") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: result.message
      });
    }
    ref = result.ref;
    teamAndProject = result.teamAndProject;
  }
  if (!ref && !options.default) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Specify a deployment ref or use --default:\n  `npx convex deployment create my-deployment-ref --type dev`\n  `npx convex deployment create --type prod --default`"
    });
  }
  if (!options.type) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `--type is required (supported values: ${SUPPORTED_TYPES.join(", ")})`
    });
  }
  const project = teamAndProject ? await getProjectDetails(ctx, {
    kind: "teamAndProjectSlugs",
    teamSlug: teamAndProject.teamSlug,
    projectSlug: teamAndProject.projectSlug
  }) : await resolveProject(ctx, currentDeployment);
  const projectId = project.id;
  let regionDetails = null;
  if (options.region) {
    const availableRegions = await fetchAvailableRegions(ctx, project.teamId);
    regionDetails = await resolveRegionDetailsOrCrash(
      ctx,
      availableRegions,
      options.region
    );
  }
  let classDetails = null;
  if (options.class) {
    const availableClasses = await fetchAvailableClasses(ctx, project.teamId);
    classDetails = await resolveClassDetailsOrCrash(
      ctx,
      availableClasses,
      options.class
    );
  }
  return {
    ref,
    isDefault: options.default ?? null,
    projectId,
    regionDetails,
    classDetails,
    type: options.type,
    teamSlug: project.teamSlug,
    projectSlug: project.slug
  };
}
async function resolveOptionsInteractively(ctx, currentDeployment, refParam, options) {
  let deploymentType;
  if (options.type) {
    deploymentType = logAndUse("type", options.type);
  } else {
    const dtypeChoices = [
      {
        name: "dev",
        value: "dev"
      },
      {
        name: "preview",
        value: "preview"
      },
      {
        name: "prod",
        value: "prod"
      }
    ];
    deploymentType = await promptOptions(ctx, {
      message: "Deployment type?",
      choices: dtypeChoices
    });
  }
  let ref;
  let teamAndProject;
  if (refParam) {
    const result = parseSelectorForNewDeployment(refParam);
    if (result.kind === "invalid") {
      logFailure(result.message);
    } else {
      ref = logAndUse("ref", result.ref);
      teamAndProject = result.teamAndProject;
    }
  }
  while (ref === void 0) {
    const gitDefault = defaultRef(localGitBranch(), deploymentType);
    const input = await promptString(ctx, {
      message: "What do you want to call this deployment?\n" + chalkStderr.reset.dim(
        "The deployment reference will be used to identify your deployment on the dashboard and in CLI commands.\nExamples: staging, dev/james/feature"
      ) + "\n>",
      ...gitDefault !== void 0 ? { default: gitDefault } : {},
      validate: validateTentativeReference
    });
    const result = parseSelectorForNewDeployment(input);
    if (result.kind === "invalid") {
      logFailure(result.message);
      continue;
    }
    ref = result.ref;
    teamAndProject = result.teamAndProject;
  }
  const project = teamAndProject ? await getProjectDetails(ctx, {
    kind: "teamAndProjectSlugs",
    teamSlug: teamAndProject.teamSlug,
    projectSlug: teamAndProject.projectSlug
  }) : await resolveProject(ctx, currentDeployment);
  const availableRegions = await fetchAvailableRegions(ctx, project.teamId);
  let regionDetails;
  if (options.region) {
    regionDetails = await resolveRegionDetailsOrCrash(
      ctx,
      availableRegions,
      options.region
    );
    logAndUse("region", regionDetails.displayName);
  } else {
    const teams = (await typedBigBrainClient(ctx).GET("/teams")).data;
    const team = teams.find((team2) => team2.slug === project.teamSlug);
    if (!team) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Error: Team ${project.teamSlug} not found.`
      });
    }
    const regionName = team.defaultRegion ?? await selectRegion(ctx, team.id, deploymentType);
    regionDetails = await resolveRegionDetailsOrCrash(
      ctx,
      availableRegions,
      regionName
    );
    if (team.defaultRegion) {
      logFinishedStep(
        `Using team default region of ${regionDetails.displayName}`
      );
    } else {
      await logNoDefaultRegionMessage(team.slug);
    }
  }
  let classDetails = null;
  if (options.class) {
    const availableClasses = await fetchAvailableClasses(ctx, project.teamId);
    classDetails = await resolveClassDetailsOrCrash(
      ctx,
      availableClasses,
      options.class
    );
    logAndUse("class", classDetails.type);
  }
  return {
    ref,
    isDefault: options.default ?? null,
    projectId: project.id,
    regionDetails,
    classDetails,
    type: deploymentType,
    teamSlug: project.teamSlug,
    projectSlug: project.slug
  };
}
function parseSelectorForNewDeployment(selectorString) {
  const selector = parseDeploymentSelector(selectorString);
  switch (selector.kind) {
    case "deploymentName":
      return {
        kind: "invalid",
        message: `"${selector.deploymentName}" is not a valid deployment reference. References can't look like "word-word-123" \u2014 that format is reserved for automatically-generated deployment names.`
      };
    case "inCurrentProject": {
      const inner = selector.selector;
      if (inner.kind === "dev") {
        return {
          kind: "invalid",
          message: `"dev" is reserved as an alias for your default dev deployment.`
        };
      }
      if (inner.kind === "prod") {
        return {
          kind: "invalid",
          message: `"prod" is reserved as an alias for your default production deployment.`
        };
      }
      if (inner.kind === "local") {
        return {
          kind: "invalid",
          message: `"local" is reserved as an alias for your local deployment. To create one, run ${chalkStderr.bold("npx convex deployment create local")}`
        };
      }
      return { kind: "valid", ref: inner.reference };
    }
    case "inProject": {
      return {
        kind: "invalid",
        message: `Please use "team:project:ref" to specify the team when creating a new deployment in a different project.`
      };
    }
    case "inTeamProject": {
      const inner = selector.selector;
      if (inner.kind === "dev") {
        return {
          kind: "invalid",
          message: `"dev" is reserved as an alias for your default dev deployment.`
        };
      }
      if (inner.kind === "prod") {
        return {
          kind: "invalid",
          message: `"prod" is reserved as an alias for your default production deployment.`
        };
      }
      if (inner.kind === "local") {
        return {
          kind: "invalid",
          message: `"local" is reserved as an alias for your local deployment. To create one, run ${chalkStderr.bold(`npx convex deployment create ${selector.teamSlug}:${selector.projectSlug}:local`)}`
        };
      }
      return {
        kind: "valid",
        ref: inner.reference,
        teamAndProject: {
          teamSlug: selector.teamSlug,
          projectSlug: selector.projectSlug
        }
      };
    }
    default:
      selector;
      return {
        kind: "invalid",
        message: "Unknown state. This is a bug in Convex."
      };
  }
}
function parseLocalCreateTarget(refParam) {
  const parsed = parseDeploymentSelector(refParam);
  if (parsed.kind === "inCurrentProject" && parsed.selector.kind === "local") {
    return { kind: "inCurrentProject" };
  }
  if (parsed.kind === "inProject" && parsed.selector.kind === "local") {
    return { kind: "needsTeam" };
  }
  if (parsed.kind === "inTeamProject" && parsed.selector.kind === "local") {
    return {
      kind: "inTeamProject",
      teamSlug: parsed.teamSlug,
      projectSlug: parsed.projectSlug
    };
  }
  return null;
}
async function resolveProject(ctx, deploymentSelection) {
  switch (deploymentSelection.kind) {
    case "existingDeployment": {
      const { deploymentFields } = deploymentSelection.deploymentToActOn;
      if (deploymentFields) {
        return await getProjectDetails(ctx, {
          kind: "deploymentName",
          deploymentName: deploymentFields.deploymentName,
          deploymentType: null
        });
      }
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Cannot infer project from the current deployment configuration. Use `team:project:ref` to specify team and project slugs."
      });
    }
    case "deploymentWithinProject": {
      return await getProjectDetails(ctx, deploymentSelection.targetProject);
    }
    case "preview": {
      const slugs = await getTeamAndProjectFromPreviewAdminKey(
        ctx,
        deploymentSelection.previewDeployKey
      );
      return await getProjectDetails(ctx, {
        kind: "teamAndProjectSlugs",
        teamSlug: slugs.teamSlug,
        projectSlug: slugs.projectSlug
      });
    }
    case "chooseProject":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "No project configured yet. Use `team:project:ref` to specify team and project slugs."
      });
    case "anonymous":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Cannot create a deployment in anonymous mode. Run `npx convex login` and configure a project first."
      });
    default: {
      deploymentSelection;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Unexpected deployment selection kind.`
      });
    }
  }
}
const REGION_NAME_TO_ALIAS = {
  "aws-us-east-1": "us",
  "aws-eu-west-1": "eu"
};
const REGION_ALIAS_TO_NAME = Object.fromEntries(
  Object.entries(REGION_NAME_TO_ALIAS).map(([name, alias]) => [alias, name])
);
export async function fetchAvailableRegions(ctx, teamId) {
  const regionsResponse = (await typedPlatformClient(ctx).GET(
    "/teams/{team_id}/list_deployment_regions",
    {
      params: {
        path: { team_id: `${teamId}` }
      }
    }
  )).data;
  return regionsResponse.items.filter((item) => item.available);
}
export function resolveRegionDetails(availableRegions, region) {
  const resolvedRegion = REGION_ALIAS_TO_NAME[region] ?? region;
  return availableRegions.find((item) => item.name === resolvedRegion) ?? null;
}
async function resolveRegionDetailsOrCrash(ctx, availableRegions, region) {
  const regionDetails = resolveRegionDetails(availableRegions, region);
  if (!regionDetails) {
    return await crashInvalidRegion(ctx, availableRegions, region);
  }
  return regionDetails;
}
function invalidRegionMessage(availableRegions, region) {
  const formatted = availableRegions.map(
    (item) => `    Use \`--region ${REGION_NAME_TO_ALIAS[item.name] ?? item.name}\` for ${item.displayName}`
  ).join("\n");
  return `Invalid region "${region}".

` + formatted;
}
async function crashInvalidRegion(ctx, availableRegions, region) {
  return await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: invalidRegionMessage(availableRegions, region)
  });
}
export async function fetchAvailableClasses(ctx, teamId) {
  const classesResponse = (await typedPlatformClient(ctx).GET(
    "/teams/{team_id}/list_deployment_classes",
    {
      params: {
        path: { team_id: `${teamId}` }
      }
    }
  )).data;
  return classesResponse.items.filter((item) => item.available);
}
export function resolveClassDetails(availableClasses, className) {
  return availableClasses.find((item) => item.type === className) ?? null;
}
async function resolveClassDetailsOrCrash(ctx, availableClasses, className) {
  const classDetails = resolveClassDetails(availableClasses, className);
  if (!classDetails) {
    return await crashInvalidClass(ctx, availableClasses, className);
  }
  return classDetails;
}
function invalidClassMessage(availableClasses, className) {
  const formatted = availableClasses.map((item) => `    \`--class ${item.type}\``).join("\n");
  return `Invalid class "${className}".

Available classes:
` + formatted;
}
async function crashInvalidClass(ctx, availableClasses, className) {
  return await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: invalidClassMessage(availableClasses, className)
  });
}
async function resolveExpiresAtOrCrash(ctx, expiration) {
  if (!expiration) {
    return void 0;
  }
  const parsed = parseExpiration(expiration);
  if (parsed.kind === "error") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: parsed.message
    });
  }
  const now = Date.now();
  const resolved = resolveExpiration(parsed, now);
  if (resolved !== null) {
    const validation = validateExpiration(resolved, now);
    if (validation.kind === "error") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: validation.message
      });
    }
  }
  return resolved;
}
function logAndUse(label, value) {
  logFinishedStep(`Using ${label}: ${chalkStderr.bold(value)}`);
  return value;
}
function validateTentativeReference(tentativeReference) {
  if (tentativeReference.length < 3) {
    return "References must be at least 3 characters";
  }
  if (tentativeReference.length > 100) {
    return "References must be at most 100 characters";
  }
  if (!/^[a-z0-9/-]+$/.test(tentativeReference)) {
    return "References can only contain lowercase letters, numbers, `-`, and `/`";
  }
  if (tentativeReference === "dev") {
    return '"dev" is reserved as an alias for your default dev deployment.';
  }
  if (tentativeReference === "prod") {
    return '"prod" is reserved as an alias for your default production deployment.';
  }
  if (tentativeReference === "local") {
    return `"local" is reserved as an alias for your local deployment. To create one, run ${chalkStderr.bold("npx convex deployment create local")}`;
  }
  if (/^[a-z]+-[a-z]+-\d+$/.test(tentativeReference)) {
    return `References can't look like "word-word-123" \u2014 that format is reserved for automatically-generated deployment names. Try something like dev/my-feature or staging instead.`;
  }
  return true;
}
function localGitBranch() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5e3
    }).toString().trim();
    if (!branch || branch === "HEAD" || branch === "main" || branch === "master") {
      return null;
    }
    return branch;
  } catch {
    return null;
  }
}
function defaultRef(branch, deploymentType) {
  if (deploymentType !== "dev" && deploymentType !== "preview") {
    return void 0;
  }
  if (!branch) return void 0;
  const slug = branch.replace(/[^a-z0-9/-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!slug) return void 0;
  const ref = `${deploymentType}/${slug}`;
  const valid = validateTentativeReference(ref);
  if (valid !== true) return void 0;
  return ref;
}
//# sourceMappingURL=deploymentCreate.js.map
