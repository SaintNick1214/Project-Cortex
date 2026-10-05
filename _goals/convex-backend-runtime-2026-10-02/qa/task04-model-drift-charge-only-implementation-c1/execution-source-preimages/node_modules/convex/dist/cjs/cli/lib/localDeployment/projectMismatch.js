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
var projectMismatch_exports = {};
__export(projectMismatch_exports, {
  checkLocalConfigMatchesProject: () => checkLocalConfigMatchesProject,
  getCloudProjectSlugsBestEffort: () => getCloudProjectSlugsBestEffort,
  pauseLocalDeploymentBestEffort: () => pauseLocalDeploymentBestEffort,
  targetProjectForLocalSelector: () => targetProjectForLocalSelector
});
module.exports = __toCommonJS(projectMismatch_exports);
var import_log = require("../../../bundler/log.js");
var import_deploymentSelection = require("../deploymentSelection.js");
var import_utils = require("../utils/utils.js");
var import_bigBrain = require("./bigBrain.js");
async function targetProjectForLocalSelector(ctx, parsed, currentSelection) {
  switch (parsed.kind) {
    case "inTeamProject":
      return await (0, import_deploymentSelection.getProjectDetails)(ctx, {
        kind: "teamAndProjectSlugs",
        teamSlug: parsed.teamSlug,
        projectSlug: parsed.projectSlug
      });
    case "inCurrentProject":
      if (currentSelection.kind !== "deploymentWithinProject") return null;
      return await (0, import_deploymentSelection.getProjectDetails)(ctx, currentSelection.targetProject);
    case "inProject": {
      if (currentSelection.kind !== "deploymentWithinProject") return null;
      const current = await (0, import_deploymentSelection.getProjectDetails)(
        ctx,
        currentSelection.targetProject
      );
      return await (0, import_deploymentSelection.getProjectDetails)(ctx, {
        kind: "teamAndProjectSlugs",
        teamSlug: current.teamSlug,
        projectSlug: parsed.projectSlug
      });
    }
    default:
      return null;
  }
}
function checkLocalConfigMatchesProject(_ctx, localConfig, target) {
  if (localConfig.cloudProjectId === void 0) {
    return "skip";
  }
  return localConfig.cloudProjectId === target.id ? "match" : "mismatch";
}
async function getCloudProjectSlugsBestEffort(ctx, cloudProjectId) {
  try {
    const result = await (0, import_utils.typedPlatformClient)(ctx, { throw: true }).GET(
      "/projects/{project_id}",
      {
        params: { path: { project_id: cloudProjectId } }
      }
    );
    const project = result.data;
    if (!project) return null;
    return { teamSlug: project.teamSlug, slug: project.slug };
  } catch (e) {
    (0, import_log.logVerbose)(
      `Failed to resolve cloud project ${cloudProjectId}: ${e}`
    );
    return null;
  }
}
async function pauseLocalDeploymentBestEffort(ctx, project) {
  if (project === null) return;
  try {
    await (0, import_bigBrain.bigBrainPause)(ctx, {
      teamSlug: project.teamSlug,
      projectSlug: project.slug
    });
  } catch (e) {
    (0, import_log.logVerbose)(`Failed to pause local deployment: ${e}`);
  }
}
//# sourceMappingURL=projectMismatch.js.map
