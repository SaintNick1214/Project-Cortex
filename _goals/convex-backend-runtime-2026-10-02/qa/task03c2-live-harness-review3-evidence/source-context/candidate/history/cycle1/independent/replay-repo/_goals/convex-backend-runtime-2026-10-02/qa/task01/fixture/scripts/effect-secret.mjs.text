import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { closeSync, constants, fstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { evidenceFile, fixtureDirectory, privateEffectSecretFile, qualificationDeploymentEnvironment, qualificationTarget } from "./paths.mjs";

// Optional explicit private setup for the full interrupted-HTTP-effect check.
// Scoped security transport checks intentionally never invoke this command.
evidenceFile("effect-secret-setup.json");
const target=qualificationTarget();
const {envFile,env}=qualificationDeploymentEnvironment(target);
const privatePath=privateEffectSecretFile(process.env.CORTEX_QUALIFICATION_EFFECT_SECRET_FILE);
mkdirSync(dirname(privatePath),{recursive:true,mode:0o700});
privateEffectSecretFile(privatePath);
try{writeFileSync(privatePath,randomBytes(32).toString("hex"),{mode:0o600,flag:"wx"});}
catch(error){if(error.code!=="EEXIST")throw error;}
privateEffectSecretFile(privatePath);
const descriptor=openSync(privatePath,constants.O_RDONLY|constants.O_NOFOLLOW);
let secret;
try{
  const actual=fstatSync(descriptor);
  if(!actual.isFile()||actual.nlink!==1||(actual.mode&0o777)!==0o600||(process.getuid&&actual.uid!==process.getuid()))throw new Error("Opened private secret must be a user-owned regular file with mode 0600.");
  secret=readFileSync(descriptor,"utf8");
}finally{closeSync(descriptor);}
if(!/^[a-f0-9]{64}$/.test(secret))throw new Error("Private peer effect secret must be a 256-bit hexadecimal value.");
const child=spawnSync(process.execPath,["node_modules/convex/bin/main.js","env","set","QUALIFICATION_EFFECT_SECRET",secret,"--env-file",envFile],{cwd:fixtureDirectory,encoding:"utf8",env});
let log=String(child.stdout??"")+String(child.stderr??"");
for(const value of [secret,...Object.entries(env).filter(([key,value])=>/KEY|TOKEN|SECRET|PASSWORD/.test(key)&&value&&value.length>8).map(([,value])=>value)])log=log.replaceAll(value,"[REDACTED]");
writeFileSync(evidenceFile("effect-secret-setup.json"),JSON.stringify({version:1,deployment:target.deploymentName,privateFile:privatePath,exitCode:child.status,log},null,2));
console.log(JSON.stringify({status:child.status===0?"PASS":"FAIL",deployment:target.deploymentName,privateEffectSecretConfigured:child.status===0}));
process.exitCode=child.status??1;
