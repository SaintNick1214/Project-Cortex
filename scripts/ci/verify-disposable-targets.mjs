import { pathToFileURL } from "node:url";

/** Fail before either deployment or purge. Never include credential values in errors. */
export function verifyDisposableCiTargets(env) {
  const deny = code => { throw new Error(code); };
  let approved;
  try { approved = JSON.parse(env.CORTEX_CI_DISPOSABLE_DEPLOYMENTS ?? ""); }
  catch { deny("CI_DISPOSABLE_TARGET_ALLOWLIST_REQUIRED"); }
  if (!Array.isArray(approved) || approved.length < 2 || approved.length > 16
    || approved.some(name => typeof name !== "string" || !/^[a-z][a-z0-9-]{2,80}$/.test(name))
    || new Set(approved).size !== approved.length) deny("CI_DISPOSABLE_TARGET_ALLOWLIST_INVALID");
  const targets = [];
  for (const suffix of ["", "_CLI"]) {
    const key = env[`CONVEX_DEPLOY_KEY${suffix}`];
    const match = typeof key === "string" && /^dev:([a-z][a-z0-9-]{2,80})\|([^\s|]+)$/.exec(key);
    if (!match) deny("CI_REQUIRES_DEVELOPMENT_DEPLOYMENT_KEY");
    const name = match[1];
    if (!approved.includes(name)) deny("CI_TARGET_NOT_APPROVED_DISPOSABLE");
    if (env[`CONVEX_URL${suffix}`] !== `https://${name}.convex.cloud`) deny("CI_DEPLOYMENT_URL_MISMATCH");
    targets.push({ kind: suffix ? "cli" : "sdk", deploymentName: name, deploymentType: "dev" });
  }
  if (targets[0].deploymentName === targets[1].deploymentName) deny("CI_REQUIRES_ISOLATED_SDK_AND_CLI_TARGETS");
  return targets;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const targets = verifyDisposableCiTargets(process.env);
    console.log(JSON.stringify({ version: 1, status: "APPROVED_DEVELOPMENT_SELECTORS", targets, liveServiceQualification: false }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "CI_TARGET_VERIFICATION_FAILED");
    process.exitCode = 1;
  }
}
