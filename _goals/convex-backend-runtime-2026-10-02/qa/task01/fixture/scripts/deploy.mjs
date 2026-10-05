import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { evidenceFile, fixtureDirectory, qualificationDeploymentEnvironment, qualificationTarget } from "./paths.mjs";

evidenceFile("deploy.txt");
const target=qualificationTarget();
const {envFile,env}=qualificationDeploymentEnvironment(target);
// Scoped transport checks do not invoke the private HTTP effect; do not create its secret.
const secretValues = Object.entries(env).filter(([key,value]) => /KEY|TOKEN|SECRET|PASSWORD/.test(key) && value && value.length > 8).map(([,value]) => value);
const child = spawnSync(process.execPath, ["node_modules/convex/bin/main.js", "dev", "--once", "--codegen", "disable", "--typecheck", "disable", "--tail-logs", "disable", "--env-file", envFile], { cwd:fixtureDirectory,encoding: "utf8", env });
let log = String(child.stdout ?? "") + String(child.stderr ?? "");
for (const secret of secretValues) log = log.replaceAll(secret, "[REDACTED]");
writeFileSync(evidenceFile("deploy.txt"), log); // Revalidate immediately before writing.
console.log(log);
process.exitCode = child.status ?? 1;
