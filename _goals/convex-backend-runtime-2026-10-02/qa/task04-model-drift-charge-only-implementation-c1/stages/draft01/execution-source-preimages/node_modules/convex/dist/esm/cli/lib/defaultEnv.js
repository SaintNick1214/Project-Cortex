"use strict";
import { typedPlatformClient } from "./utils/utils.js";
export function defaultEnvBackend(ctx, projectId, dtype) {
  return {
    async get(name) {
      const result = (await typedPlatformClient(ctx).GET(
        "/projects/{project_id}/list_default_environment_variables",
        {
          params: {
            path: { project_id: projectId },
            query: { name, deploymentType: dtype }
          }
        }
      )).data;
      const items = result.items;
      if (items.length === 0) return null;
      return { name: items[0].name, value: items[0].value };
    },
    async list() {
      const result = (await typedPlatformClient(ctx).GET(
        "/projects/{project_id}/list_default_environment_variables",
        {
          params: {
            path: { project_id: projectId },
            query: { deploymentType: dtype }
          }
        }
      )).data;
      return result.items.map(
        (item) => ({ name: item.name, value: item.value })
      );
    },
    async update(changes) {
      await typedPlatformClient(ctx).POST(
        "/projects/{project_id}/update_default_environment_variables",
        {
          params: {
            path: { project_id: projectId }
          },
          body: {
            changes: changes.map((c) => ({
              name: c.name,
              deploymentType: dtype,
              value: c.value ?? null
            }))
          }
        }
      );
    },
    notice: ` (in default env vars for ${dtype} deployments)`
  };
}
//# sourceMappingURL=defaultEnv.js.map
