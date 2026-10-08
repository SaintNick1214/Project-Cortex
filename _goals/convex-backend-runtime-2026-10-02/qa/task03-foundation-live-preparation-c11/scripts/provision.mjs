import { readFileSync, writeFileSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { preparationReviewed, canonical, fixture as root, preparation, scratch, validateTarget, sha256 } from './guard.mjs';
const receiptFile=resolve(scratch,'target.json'),envFile=resolve(scratch,'deploy.env');
// Parent-owned management operation. Run only after the frozen harness review PASS.
preparationReviewed();
for(const name of ['CONVEX_DEPLOY_KEY','CONVEX_DEPLOYMENT','CONVEX_URL','CONVEX_DEPLOYMENT_TOKEN','CONVEX_OVERRIDE_ACCESS_TOKEN','CONVEX_SELF_HOSTED_URL','CONVEX_SELF_HOSTED_ADMIN_KEY'])if(process.env[name])throw new Error('Inherited target selector conflicts before provisioning');
const team = process.env.CONVEX_TEAM_ID;
const token = process.env.CONVEX_TEAM_API_KEY;
if (!team || !token) throw new Error("Missing configured Convex team credentials");
const request = JSON.parse(readFileSync(resolve(root, "project-request.json"), "utf8"));
const keyMatch=JSON.parse(readFileSync(canonical(process.env.CORTEX_FOUNDATION_KEY_CHECK_RECEIPT,scratch,true)));
if(keyMatch.operation!==request.operation||keyMatch.status!=='PASS'||keyMatch.publicKeyMatches!==true||keyMatch.candidateSha256!==sha256(readFileSync(resolve(preparation,'runtime-freeze.json'))))throw new Error('Reviewed existing-key match required');
const ownershipFile = resolve(scratch, "created-project.json");
for (const path of [receiptFile, envFile, ownershipFile]) {
  canonical(scratch, scratch);
  if (lstatSync(path, { throwIfNoEntry: false })) throw new Error("Owned provisioning path already exists");
}
if (request.purpose !== "task03-foundation-currentguard-c11" || request.deploymentType !== "dev"
  || request.kind !== "cloud" || request.productionDeployment !== false
  || request.sharedCiTarget !== false) throw new Error("Invalid disposable target request");
let calls=0;const deadline=Date.now()+150000;
const api = async (path, method = "GET", body) => {
  if(++calls>4||Date.now()>deadline)throw new Error("Management operation ceiling");
  const response = await fetch(`https://api.convex.dev/v1${path}`, {
    method, redirect:'error',
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Convex management request failed: HTTP ${response.status}`);
  return response.json();
};
if(request.projectName.toLowerCase().replaceAll(" ","-")!==request.projectSlug || !/^cortex-foundation-disposable-[a-f0-9]{12}$/.test(request.projectSlug))throw new Error("Request name and slug mismatch");
const startedAt = new Date().toISOString();
const project = await api(`/teams/${encodeURIComponent(team)}/create_project`, "POST", {
  projectName: request.projectName, deploymentType: "dev",
});
// Save ownership before further management calls, for partial-provision recovery.
writeFileSync(ownershipFile, JSON.stringify({
  operation:request.operation, requestSha256:sha256(JSON.stringify(request)), id: project.id, slug: project.slug, requestedName: request.projectName,
  deploymentName: project.deploymentName, startedAt,
}, null, 2) + "\n", { flag: "wx", mode: 0o600 });
if (!Number.isSafeInteger(project.id) || project.id <= 0
  || project.slug !== request.projectSlug || !project.deploymentName
  || project.deploymentUrl !== `https://${project.deploymentName}.convex.cloud`) {
  throw new Error("Created project did not match exact disposable request; owned receipt retained");
}
const observedProject = await api(`/projects/${project.id}`);
if (observedProject.id !== project.id || observedProject.slug !== request.projectSlug
  || observedProject.name !== request.projectName) throw new Error("Observed project identity mismatch");
const deployment = await api(`/deployments/${encodeURIComponent(project.deploymentName)}`);
if (deployment.name !== project.deploymentName || deployment.projectId !== project.id
  || deployment.deploymentType !== "dev" || deployment.kind !== "cloud"
  || deployment.deploymentUrl !== project.deploymentUrl) throw new Error("Observed deployment mismatch");
const key = await api(`/deployments/${encodeURIComponent(deployment.name)}/create_deploy_key`, "POST", {
  name: "cortex-task03-foundation-currentguard-c11", expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
});
const values = {
  CONVEX_DEPLOY_KEY: key.deployKey,
  CONVEX_DEPLOYMENT: `dev:${deployment.name}`,
  CONVEX_URL: deployment.deploymentUrl,
};
const target = {
  ...request, requestSha256:sha256(JSON.stringify(request)), projectId: project.id, deploymentName: deployment.name,
  deploymentUrl: deployment.deploymentUrl,
  active: true, retired: false, deleted: false, isolationVerified: true,
  createdAt: startedAt, userAuthorization: "create a fresh instance, no cap",
  privateEnvironmentFile: "work/backend-runtime/task03-foundation-live-c11/deploy.env",
};
validateTarget(target, request, values, process.env);
writeFileSync(envFile, Object.entries(values).map(([name, value]) => `${name}=${value}`).join("\n") + "\n", { flag: "wx", mode: 0o600 });
writeFileSync(receiptFile, JSON.stringify(target, null, 2) + "\n", { flag: "wx", mode: 0o600 });
canonical(envFile, scratch, true);
canonical(receiptFile, scratch, true);
process.stdout.write(JSON.stringify({
  operation: "provisioned-disposable-auth-target", projectId: project.id,
  deploymentName: deployment.name, type: "dev", kind: "cloud", isolationVerified: true,
}) + "\n");
