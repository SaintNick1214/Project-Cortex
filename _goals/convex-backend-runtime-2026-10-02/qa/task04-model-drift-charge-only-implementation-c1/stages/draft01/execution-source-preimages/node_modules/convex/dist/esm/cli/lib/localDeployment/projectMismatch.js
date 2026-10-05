"use strict";
import { logVerbose } from "../../../bundler/log.js";
import {
  getProjectDetails
} from "../deploymentSelection.js";
import { typedPlatformClient } from "../utils/utils.js";
import { bigBrainPause } from "./bigBrain.js";
export async function targetProjectForLocalSelector(ctx, parsed, currentSelection) {
  switch (parsed.kind) {
    case "inTeamProject":
      return await getProjectDetails(ctx, {
        kind: "teamAndProjectSlugs",
        teamSlug: parsed.teamSlug,
        projectSlug: parsed.projectSlug
      });
    case "inCurrentProject":
      if (currentSelection.kind !== "deploymentWithinProject") return null;
      return await getProjectDetails(ctx, currentSelection.targetProject);
    case "inProject": {
      if (currentSelection.kind !== "deploymentWithinProject") return null;
      const current = await getProjectDetails(
        ctx,
        currentSelection.targetProject
      );
      return await getProjectDetails(ctx, {
        kind: "teamAndProjectSlugs",
        teamSlug: current.teamSlug,
        projectSlug: parsed.projectSlug
      });
    }
    default:
      return null;
  }
}
export function checkLocalConfigMatchesProject(_ctx, localConfig, target) {
  if (localConfig.cloudProjectId === void 0) {
    return "skip";
  }
  return localConfig.cloudProjectId === target.id ? "match" : "mismatch";
}
export async function getCloudProjectSlugsBestEffort(ctx, cloudProjectId) {
  try {
    const result = await typedPlatformClient(ctx, { throw: true }).GET(
      "/projects/{project_id}",
      {
        params: { path: { project_id: cloudProjectId } }
      }
    );
    const project = result.data;
    if (!project) return null;
    return { teamSlug: project.teamSlug, slug: project.slug };
  } catch (e) {
    logVerbose(
      `Failed to resolve cloud project ${cloudProjectId}: ${e}`
    );
    return null;
  }
}
export async function pauseLocalDeploymentBestEffort(ctx, project) {
  if (project === null) return;
  try {
    await bigBrainPause(ctx, {
      teamSlug: project.teamSlug,
      projectSlug: project.slug
    });
  } catch (e) {
    logVerbose(`Failed to pause local deployment: ${e}`);
  }
}
//# sourceMappingURL=projectMismatch.js.map
