import path from "node:path";
import {
  GraphPlanError,
  graphFiles,
  graphImages,
  graphJson,
  validateGraphProject,
  type GraphProvider,
  type SelectedGraphProject,
} from "./contract.js";

export interface GraphOwnership {
  version: 1;
  projectId: string;
  provider: GraphProvider;
  image: string;
  composeProject: string;
  service: GraphProvider;
  volume: string;
  uri: string;
  boltPort: number;
  httpPort?: number;
  composeHash: string;
  labels: Record<string, string>;
  files: typeof graphFiles;
}
export function graphResourceIdentity(
  project: SelectedGraphProject,
  provider: GraphProvider,
): Pick<
  GraphOwnership,
  "projectId" | "composeProject" | "service" | "volume" | "labels"
> {
  if (!["neo4j", "memgraph"].includes(provider))
    throw new GraphPlanError("GRAPH_OPTIONS_INVALID");
  const projectId = validateGraphProject(project),
    composeProject = `cortex-graph-${projectId}`;
  return {
    projectId,
    composeProject,
    service: provider,
    volume: `${composeProject}-${provider}-data`,
    labels: {
      "io.cortex.graph.version": "1",
      "io.cortex.graph.project": projectId,
      "io.cortex.graph.provider": provider,
    },
  };
}
/** Fixed data identity for the single managed service, without filesystem observation. */
export function validateGraphResourceIdentity(
  identity: ReturnType<typeof graphResourceIdentity>,
  provider: GraphProvider,
): void {
  const projectName = `cortex-graph-${identity.projectId}`;
  const labels = {
    "io.cortex.graph.version": "1",
    "io.cortex.graph.project": identity.projectId,
    "io.cortex.graph.provider": provider,
  };
  if (
    !graphImages[provider] ||
    !/^[a-f0-9]{24}$/.test(identity.projectId) ||
    identity.composeProject !== projectName ||
    identity.service !== provider ||
    identity.volume !== `${projectName}-${provider}-data` ||
    graphJson(identity.labels) !== graphJson(labels)
  )
    throw new GraphPlanError("GRAPH_OWNERSHIP_CONFLICT");
}
/** Reject unknown/credential fields as well as a wrong selected project or fixed resource identity. */
export function validateGraphOwnership(
  input: unknown,
  expected: GraphOwnership,
): GraphOwnership {
  validateGraphResourceIdentity(expected, expected.provider);
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    graphJson(input) !== graphJson(expected) ||
    expected.version !== 1 ||
    expected.image !== graphImages[expected.provider]
  )
    throw new GraphPlanError("GRAPH_OWNERSHIP_CONFLICT");
  return structuredClone(expected);
}
export interface GraphResourceObservation {
  kind: "container" | "volume";
  name: string;
  labels: Record<string, string>;
  image?: string;
}
/** Validate actual selected observations before lifecycle actions; this cannot discover resources. */
export function validateGraphResources(
  project: SelectedGraphProject,
  owner: GraphOwnership,
  resources: readonly GraphResourceObservation[],
): void {
  const identity = graphResourceIdentity(project, owner.provider);
  if (
    identity.projectId !== owner.projectId ||
    identity.composeProject !== owner.composeProject ||
    identity.service !== owner.service ||
    identity.volume !== owner.volume ||
    graphJson(identity.labels) !== graphJson(owner.labels) ||
    owner.version !== 1 ||
    owner.image !== graphImages[owner.provider]
  )
    throw new GraphPlanError("GRAPH_OWNERSHIP_CONFLICT");
  const names = new Set<string>();
  for (const resource of resources) {
    if (
      !resource ||
      !["container", "volume"].includes(resource.kind) ||
      typeof resource.name !== "string" ||
      !resource.name ||
      !resource.labels ||
      names.has(`${resource.kind}:${resource.name}`)
    )
      throw new GraphPlanError("GRAPH_RESOURCE_CONFLICT");
    names.add(`${resource.kind}:${resource.name}`);
    if (
      Object.entries(identity.labels).some(
        ([key, value]) => resource.labels[key] !== value,
      ) ||
      resource.labels["com.docker.compose.project"] !== owner.composeProject
    )
      throw new GraphPlanError("GRAPH_RESOURCE_CONFLICT");
    if (resource.kind === "volume") {
      if (
        resource.name !== identity.volume ||
        resource.labels["com.docker.compose.volume"] !== "data"
      )
        throw new GraphPlanError("GRAPH_RESOURCE_CONFLICT");
    } else if (
      resource.name !== `${owner.composeProject}-${owner.service}-1` ||
      resource.image !== owner.image ||
      resource.labels["com.docker.compose.service"] !== owner.service ||
      resource.labels["com.docker.compose.project.working_dir"] !==
        project.root ||
      resource.labels["com.docker.compose.project.config_files"] !==
        path.join(project.root, graphFiles.compose)
    )
      throw new GraphPlanError("GRAPH_RESOURCE_CONFLICT");
  }
}
