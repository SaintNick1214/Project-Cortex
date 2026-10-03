import { resolve } from "node:path";
import { livePreflight, fixture, repo } from "./guard.mjs";
import { ProcessOwner } from "./process-owner.mjs";
import { acceptedOperatorDenial } from "./operator-classifier.mjs";
export const operatorNames = Object.freeze([
  "runtimeAuth:provision", "runtimeAuth:recheck", "runtimeAuth:revokeGrant", "runtimeAuth:revokeMembership",
  "runtimeAuth:deletePrincipal", "runtimeAuth:deleteScope", "runtimeAuth:tombstoneResource",
  "sessions:incrementMessageCount", "sessions:incrementMemoryCount", "sessions:expireIdle",
]);
/** Trusted driver only. The SDK child never imports this module. */
export async function operator(name, args, owner = new ProcessOwner()) {
  const { env, envFile } = livePreflight();
  if (!operatorNames.includes(name)) throw new Error("OPERATOR_PROTOCOL_REJECTED");
  const result = await owner.run([resolve(repo, "node_modules/convex/bin/main.js"), "run", name, JSON.stringify(args), "--env-file", envFile], { cwd: fixture, env }, 25_000);
  if (result.code !== 0 || result.timedOut || result.overflow || result.signal) {
    throw new Error(acceptedOperatorDenial(name, result) ? "OPERATOR_AUTHORIZATION_DENIED" : "OPERATOR_UNAVAILABLE");
  }
  try { return result.stdout.trim() ? JSON.parse(result.stdout) : null; }
  catch { throw new Error("OPERATOR_UNAVAILABLE"); }
}
