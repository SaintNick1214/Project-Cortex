"use strict";
function parseInProjectSelector(s) {
  if (s === "dev") return { kind: "dev" };
  if (s === "prod") return { kind: "prod" };
  if (s === "local") return { kind: "local" };
  return { kind: "reference", reference: s };
}
export function parseDeploymentSelector(selector) {
  if (/^[a-z]+-[a-z]+-[0-9]+$/.test(selector)) {
    return { kind: "deploymentName", deploymentName: selector };
  }
  const parts = selector.split(":");
  if (parts.length === 3) {
    return {
      kind: "inTeamProject",
      teamSlug: parts[0],
      projectSlug: parts[1],
      selector: parseInProjectSelector(parts[2])
    };
  }
  if (parts.length === 2) {
    return {
      kind: "inProject",
      projectSlug: parts[0],
      selector: parseInProjectSelector(parts[1])
    };
  }
  return {
    kind: "inCurrentProject",
    selector: parseInProjectSelector(selector)
  };
}
//# sourceMappingURL=deploymentSelector.js.map
