import { randomUUID, sign as rsaSign } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonical, livePreflight, repo, root, scratch, writeDriverReceipt } from "./guard.mjs";
import { sdkEnvironment } from "./protocol.mjs";
import { ProcessOwner } from "./process-owner.mjs";
import { operator } from "./operator.mjs";
import { drive } from "./driver-engine.mjs";

export async function qualification() {
  const runId = randomUUID(), output = `qualify-${runId}.json`, ledgerName = `owned-${runId}.json`;
  const { target, env, privateKey, jwk, output: validatedOutput } = livePreflight(output);
  const path = canonical(resolve(scratch, ledgerName), scratch);
  const startedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify({ runId, deploymentName: target.deploymentName, owned: [], attemptedScopes: [], operations: [] }), { flag: "wx", mode: 0o600 });
  const owner = new ProcessOwner();
  const checkpoint = async (authority) => {
    canonical(path, scratch, { privateFile: true, existing: true });
    writeFileSync(path, JSON.stringify({ runId, deploymentName: target.deploymentName, owned: authority.owned,
      attemptedScopes: [...authority.attemptedScopes.values()], operations: authority.operations }, null, 2), { flag: "w", mode: 0o600 });
  };
  const signer = async (subject, variant) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { iss: variant === "wrong-issuer" ? "https://wrong-issuer.invalid" : "https://cortex-qualification.invalid",
      aud: variant === "wrong-audience" ? "wrong-audience" : "cortex-task01", sub: subject, iat: now - 1, exp: variant === "expired" ? now - 60 : now + 900 };
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: jwk.kid, typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url"), input = `${header}.${body}`;
    const signature = rsaSign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url");
    return `${input}.${variant === "forged" ? signature.slice(0, -12) + "AAAAAAAAAAAA" : signature}`;
  };
  return await drive({ owner, args: ["--import", resolve(repo, "node_modules/tsx/dist/loader.mjs"), resolve(root, "scripts/client.ts")],
    env: sdkEnvironment(env), cwd: repo,
    bootstrap: { version: 1, phase: "live", runId, endpoint: target.deploymentUrl, timeoutMs: 12_000, quietMs: 750 },
    sign: signer, operator: (name, args) => operator(name, args, owner), checkpoint,
    finish: async (receipt, authority) => {
      let ledgerCheckpoint = "saved";
      try { await checkpoint(authority); } catch { ledgerCheckpoint = "unavailable"; }
      writeDriverReceipt(validatedOutput, { ...receipt, ledgerCheckpoint, startedAt, completedAt: new Date().toISOString(), deploymentName: target.deploymentName, cleanupLedger: ledgerName,
        scope: "accepted03A/03C1/03B2A and metadata SDK consumers", whole03Certified: false, whole09Certified: false,
        requestMs: 12_000, operatorMs: 25_000, wholeMs: 600_000, quietMs: 750,
        isolation: "code/import/env/IPC boundary; same-UID filesystem is not an OS sandbox", limitations: ["Tasks05/12/13 and UI remain pending", "No inference supplied"] });
    },
  });
}
