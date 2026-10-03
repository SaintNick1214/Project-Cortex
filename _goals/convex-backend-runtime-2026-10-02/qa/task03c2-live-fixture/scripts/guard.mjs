import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { parseEnv } from "node:util";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const repo = resolve(root, "../../../..");
export const scratch = resolve(repo, "work/backend-runtime/task03c2-live-fixture");
export const fixture = resolve(root, "fixture");
export const keyFile = resolve(repo, "work/backend-runtime/qualification/jwt-private.pem");
export const receiptFile = resolve(scratch, "target.json");
export const envFile = resolve(scratch, "deploy.env");
const within = (path, base) => path === base || path.startsWith(base + sep);
export const hash = (data) => createHash("sha256").update(data).digest("hex");
const fail = () => { throw new Error("Qualification preflight rejected; no service operation dispatched."); };
const json = (path, base) => JSON.parse(readFileSync(canonical(path, base, { existing: true }), "utf8"));

/** Reject every existing path component alias, even aliases ending in absent files. */
export function canonical(path, base, { privateFile = false, existing = false } = {}) {
  if (typeof path !== "string" || path !== resolve(path) || !within(path, base)) fail();
  const components = path.split(sep).filter(Boolean);
  let current = sep;
  let missing = false;
  for (let i = 0; i < components.length; i++) {
    current = resolve(current, components[i]);
    const stat = lstatSync(current, { throwIfNoEntry: false });
    if (!stat) { missing = true; continue; }
    if (missing || stat.isSymbolicLink() || realpathSync(current) !== current) fail();
    if (i < components.length - 1 && !stat.isDirectory()) fail();
    if (i === components.length - 1 && stat.isFile() && stat.nlink !== 1) fail();
  }
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (existing && !stat) fail();
  if (privateFile && (!stat?.isFile() || stat.nlink !== 1 || (stat.mode & 0o777) !== 0o600 || stat.uid !== process.getuid())) fail();
  return path;
}

export function localPreflight(outputName) {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 24 || (major === 24 && minor < 15)) fail();
  canonical(root, repo, { existing: true });
  canonical(scratch, repo, { existing: true });
  const stat = lstatSync(scratch);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700) fail();
  for (const entry of json(resolve(root, "archive-preservation.json"), root)) {
    const path = canonical(resolve(repo, entry.path), repo, { existing: true });
    if (hash(readFileSync(path)) !== entry.sha256) fail();
  }
  for (const entry of json(resolve(root, "source-provenance.json"), root).copied) {
    const path = canonical(resolve(root, entry.fixture), root, { existing: true });
    if (hash(readFileSync(path)) !== entry.sha256) fail();
  }
  for (const entry of json(resolve(root, "sdk-provenance.json"), root).files) {
    const path = canonical(resolve(scratch, entry.path), scratch, { existing: true });
    if (hash(readFileSync(path)) !== entry.sha256) fail();
  }
  for (const [name, version] of Object.entries({ convex: "1.46.0", ws: "8.21.0", "https-proxy-agent": "7.0.6", tsx: "4.23.15" })) {
    if (json(resolve(repo, "node_modules", name, "package.json"), repo).version !== version) fail();
  }
  if (outputName !== undefined) {
    if (typeof outputName !== "string" || !/^[a-z0-9][a-z0-9.-]*\.json$/.test(outputName)) fail();
    const output = canonical(resolve(root, "evidence", outputName), root);
    if (lstatSync(output, { throwIfNoEntry: false })) fail(); // Evidence is append only.
    return output;
  }
}

export function validateTarget(target, request, values, inherited = {}) {
  const forbidden = ["CONVEX_DEPLOYMENT_TOKEN", "CONVEX_OVERRIDE_ACCESS_TOKEN", "CONVEX_SELF_HOSTED_URL", "CONVEX_SELF_HOSTED_ADMIN_KEY"];
  if (forbidden.some((name) => values[name] || inherited[name])) fail();
  if (target.operation !== request.operation || target.purpose !== "qualification-auth"
    || target.projectName !== request.projectName || target.projectSlug !== request.projectSlug
    || !/^cortex-runtime-disposable-qualification-auth-[a-f0-9]{10}$/.test(target.projectSlug)
    || target.kind !== "cloud" || target.deploymentType !== "dev" || target.active !== true
    || target.retired !== false || target.deleted !== false || target.isolationVerified !== true
    || target.productionDeployment !== false || target.sharedCiTarget !== false
    || !Number.isSafeInteger(target.projectId) || target.projectId <= 0
    || !Number.isFinite(Date.parse(target.createdAt))
    || ["efficient-ox-979", "fiery-setter-784"].includes(target.deploymentName)
    || !/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(target.deploymentName ?? "")
    || target.deploymentUrl !== `https://${target.deploymentName}.convex.cloud`
    || target.privateEnvironmentFile !== "work/backend-runtime/task03c2-live-fixture/deploy.env") fail();
  if (!values.CONVEX_DEPLOY_KEY?.startsWith(`dev:${target.deploymentName}|`)
    || values.CONVEX_DEPLOY_KEY.length <= `dev:${target.deploymentName}|`.length
    || values.CONVEX_DEPLOYMENT !== `dev:${target.deploymentName}`
    || values.CONVEX_URL !== target.deploymentUrl) fail();
  const allowed = new Set(["CONVEX_DEPLOY_KEY", "CONVEX_DEPLOYMENT", "CONVEX_URL"]);
  if (Object.keys(values).some((name) => !allowed.has(name))) fail();
  for (const name of allowed) if (inherited[name] && inherited[name] !== values[name]) fail();
  return target;
}

/** This must run before clients, child processes, token signing or evidence writes. */
export function livePreflight(outputName) {
  const output = localPreflight(outputName);
  for (const [name, expected] of [["CORTEX_QUALIFICATION_TARGET_RECEIPT", receiptFile], ["CORTEX_QUALIFICATION_DEPLOY_ENV", envFile]]) {
    if (process.env[name] !== expected) fail();
  }
  canonical(receiptFile, scratch, { privateFile: true, existing: true });
  canonical(envFile, scratch, { privateFile: true, existing: true });
  canonical(keyFile, resolve(repo, "work/backend-runtime/qualification"), { privateFile: true, existing: true });
  const target = JSON.parse(readFileSync(receiptFile, "utf8"));
  const request = json(resolve(root, "project-request.json"), root);
  const values = parseEnv(readFileSync(envFile, "utf8"));
  validateTarget(target, request, values, process.env);
  const { privateKey, jwk } = verifiedSigningKey();
  // Only the target selectors enter subprocesses; no inherited upstream keys or model configuration.
  const runtime = {};
  for (const name of ["HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "no_proxy", "NODE_EXTRA_CA_CERTS"]) {
    if (process.env[name]) runtime[name] = process.env[name];
  }
  const env = { PATH: process.env.PATH, LANG: "C.UTF-8", CI: "1", NO_COLOR: "1", NODE_USE_ENV_PROXY: "1", ...runtime, npm_config_cache: resolve(repo, "work/backend-runtime/npm12-cache"), ...values };
  return { target, output, env, envFile, privateKey, jwk };
}

/** Read the existing parent-trusted key only; no generation, rotation or signing. */
export function verifiedSigningKey() {
  canonical(keyFile, resolve(repo, "work/backend-runtime/qualification"), { privateFile: true, existing: true });
  const config = readFileSync(canonical(resolve(fixture, "convex/auth.config.ts"), root, { existing: true }), "utf8");
  const provenance = json(resolve(root, "source-provenance.json"), root);
  if (hash(config) !== provenance.authConfig.sha256) fail();
  const encoded = config.match(/base64,([A-Za-z0-9+/=]+)/)?.[1];
  if (!encoded) fail();
  const jwk = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")).keys[0];
  const privateKey = createPrivateKey(readFileSync(keyFile));
  const actual = createPublicKey(privateKey).export({ format: "jwk" });
  if (actual.n !== jwk.n || actual.e !== jwk.e || actual.kty !== "RSA") fail();
  return { privateKey, jwk };
}

export function writeEvidence(outputName, value, live = true) {
  const output = live ? livePreflight(outputName).output : localPreflight(outputName);
  writeFileSync(output, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
}

/** A driver binds this output during initial live preflight. Final/crash output
 * needs only canonical append-only destination validation, never child/key access
 * or a second deployment preflight after shutdown.
 */
export function writeDriverReceipt(output, value) {
  if (typeof output !== "string" || !/^qualify-[a-f0-9-]{36}\.json$/.test(output.split(sep).at(-1))) fail();
  writeInitialReceipt(output, value);
}

/** Use the output captured by the initial exclusive preflight for all operation
 * final/error receipts. Canonical/exclusive checks remain; no key/target reread.
 */
export function writeInitialReceipt(output, value) {
  if (typeof output !== "string" || dirname(output) !== resolve(root, "evidence") || !/^(?:qualify|deploy|codegen|cleanup)-[a-f0-9-]{36}\.json$/.test(output.split(sep).at(-1))) fail();
  canonical(output, root);
  if (lstatSync(output, { throwIfNoEntry: false })) fail();
  writeFileSync(output, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
}
