import { lstatSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export const fixtureDirectory=resolve(dirname(fileURLToPath(import.meta.url)),"..");
export const repo=resolve(fixtureDirectory,"../../../../..");
const archivedEvidence=realpathSync(resolve(fixtureDirectory,"../evidence"));
const within=(path,root)=>path===root||path.startsWith(root+sep);
const statIfPresent=path=>lstatSync(path,{throwIfNoEntry:false});

// Resolve the nearest existing ancestor, including symlinks, before creating any
// missing suffix. A symlink to the archive must fail even when its child is absent.
function canonicalDestination(path){
  let ancestor=resolve(path);
  const missing=[];
  while(!statIfPresent(ancestor)){
    missing.unshift(basename(ancestor));
    ancestor=dirname(ancestor);
  }
  const canonical=realpathSync(ancestor); // Dangling symlinks fail closed.
  if(missing.length&&!lstatSync(canonical).isDirectory())throw new Error("Output ancestor must be a directory.");
  return resolve(canonical,...missing);
}
function assertEvidenceDirectory(path){
  const canonical=canonicalDestination(path);
  if(within(canonical,archivedEvidence))throw new Error("Archived Task01 evidence is immutable, including symlink aliases; choose a fresh evidence directory.");
  const existing=statIfPresent(canonical);
  if(existing&&!existing.isDirectory())throw new Error("Evidence destination must be a directory.");
  return canonical;
}
// Module evaluation precedes every importing runner's subprocess/network work.
export const evidenceDirectory=assertEvidenceDirectory(resolve(process.env.CORTEX_QUALIFICATION_EVIDENCE_DIR??resolve(fixtureDirectory,"../../task01-security/evidence")));

export function evidenceFile(name){
  if(typeof name!=="string"||!name||name.includes("/")||name.includes("\\")||name==="."||name==="..")throw new Error("Evidence file name must be a basename.");
  assertEvidenceDirectory(evidenceDirectory);
  const file=resolve(evidenceDirectory,name);
  const canonical=canonicalDestination(file);
  if(within(canonical,archivedEvidence))throw new Error("Archived Task01 evidence is immutable, including output file symlinks.");
  const existing=statIfPresent(file);
  if(existing&&(existing.isSymbolicLink()||!existing.isFile()||existing.nlink!==1))throw new Error("Evidence output must be an unlinked regular file; symlink/hardlink aliases are forbidden.");
  mkdirSync(evidenceDirectory,{recursive:true});
  assertEvidenceDirectory(evidenceDirectory);
  return file;
}

export function privateEffectSecretFile(path){
  const privateRoot=resolve(realpathSync(repo),"work/backend-runtime/task01-security");
  if(typeof path!=="string"||!isAbsolute(path)||!within(resolve(path),privateRoot)||resolve(path)===privateRoot)throw new Error("Set CORTEX_QUALIFICATION_EFFECT_SECRET_FILE to an absolute private scratch path under work/backend-runtime/task01-security/.");
  if(canonicalDestination(privateRoot)!==privateRoot)throw new Error("Private secret root must not escape through a symlink.");
  const canonical=canonicalDestination(path);
  if(!within(canonical,privateRoot)||canonical===privateRoot)throw new Error("Private secret destination must remain canonically within private scratch; symlink escapes are forbidden.");
  const existing=statIfPresent(path);
  if(existing&&(existing.isSymbolicLink()||!existing.isFile()||existing.nlink!==1))throw new Error("Private secret must be an unlinked regular file; symlink/hardlink aliases are forbidden.");
  if(existing&&((existing.mode&0o777)!==0o600||(process.getuid&&existing.uid!==process.getuid())))throw new Error("Existing private secret must be owned by this process user with mode 0600.");
  return canonical;
}

export function qualificationTarget(){
  const receiptPath=process.env.CORTEX_QUALIFICATION_TARGET_RECEIPT;
  if(!receiptPath||!isAbsolute(receiptPath))throw new Error("Set CORTEX_QUALIFICATION_TARGET_RECEIPT to an absolute verified qualification receipt path. Generic product target.json is never used; the original qualification deployment was retired.");
  const target=JSON.parse(readFileSync(receiptPath,"utf8"));
  if(target.operation!=="create-disposable-development-target"||!["qualification","qualification-security"].includes(target.purpose)||!/^cortex-runtime-disposable-qualification(?:-security)?-[a-f0-9]+$/.test(target.projectSlug??"")||!/^Cortex runtime disposable qualification(?: security)? [a-f0-9]+$/.test(target.projectName??"")||target.isolationVerified!==true||target.deploymentType!=="dev"||target.productionDeployment!==false||target.sharedCiTarget!==false||target.kind!=="cloud"||target.retired===true||target.deleted===true||!Number.isSafeInteger(target.projectId)||target.projectId<=0)throw new Error("Rejected target: fixture requires a verified, active, qualification-purpose disposable cloud development project; product integration/production/shared targets are forbidden.");
  if(target.deploymentName==="efficient-ox-979")throw new Error("Original qualification deployment efficient-ox-979 was retired; provision a new qualification target.");
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(target.deploymentName??"")||target.deploymentUrl!==`https://${target.deploymentName}.convex.cloud`)throw new Error("Qualification deployment name and HTTPS URL do not agree.");
  return target;
}

export function qualificationDeploymentEnvironment(target){
  const envFile=process.env.CORTEX_QUALIFICATION_DEPLOY_ENV;
  if(!envFile||!isAbsolute(envFile))throw new Error("Set CORTEX_QUALIFICATION_DEPLOY_ENV to the absolute private env file for this qualification target.");
  if(typeof target.privateEnvironmentFile!=="string"||realpathSync(envFile)!==realpathSync(resolve(repo,target.privateEnvironmentFile)))throw new Error("Explicit deploy env path does not match the verified qualification receipt.");
  const values=parseEnv(readFileSync(envFile,"utf8"));
  if(!values.CONVEX_DEPLOY_KEY?.startsWith(`dev:${target.deploymentName}|`))throw new Error("Private development deploy key does not match the qualification deployment.");
  if(values.CONVEX_DEPLOYMENT&&values.CONVEX_DEPLOYMENT!==`dev:${target.deploymentName}`)throw new Error("Private deployment selector does not match qualification receipt.");
  if(values.CONVEX_URL&&values.CONVEX_URL!==target.deploymentUrl)throw new Error("Private URL selector does not match qualification receipt.");
  return {envFile,env:{...process.env,...values}};
}
