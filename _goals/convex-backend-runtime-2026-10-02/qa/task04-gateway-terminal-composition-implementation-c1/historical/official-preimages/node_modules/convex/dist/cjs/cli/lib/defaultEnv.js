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
var defaultEnv_exports = {};
__export(defaultEnv_exports, {
  defaultEnvBackend: () => defaultEnvBackend
});
module.exports = __toCommonJS(defaultEnv_exports);
var import_utils = require("./utils/utils.js");
function defaultEnvBackend(ctx, projectId, dtype) {
  return {
    async get(name) {
      const result = (await (0, import_utils.typedPlatformClient)(ctx).GET(
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
      const result = (await (0, import_utils.typedPlatformClient)(ctx).GET(
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
      await (0, import_utils.typedPlatformClient)(ctx).POST(
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
