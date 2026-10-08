import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { evidenceFile, fixtureDirectory, repo } from "./paths.mjs";

evidenceFile("effect-ordering.json");
const privateRoot=resolve(repo,"work/backend-runtime/task01-security");
mkdirSync(privateRoot,{recursive:true,mode:0o700});
const scratch=mkdtempSync(resolve(privateRoot,"ordering-"));
const archive=resolve(fixtureDirectory,"../evidence");
const originalLive=resolve(archive,"live-receipts.json");
const hash=file=>createHash("sha256").update(readFileSync(file)).digest("hex");
const beforeLive=hash(originalLive);
const targetPath=resolve(scratch,"target.json"),envPath=resolve(scratch,"deploy.env");
writeFileSync(targetPath,JSON.stringify({operation:"create-disposable-development-target",purpose:"qualification-security",projectId:12345,projectSlug:"cortex-runtime-disposable-qualification-security-a1b2c3d4",projectName:"Cortex runtime disposable qualification security a1b2c3d4",deploymentName:"qualification-test-001",deploymentUrl:"https://qualification-test-001.convex.cloud",deploymentType:"dev",kind:"cloud",isolationVerified:true,productionDeployment:false,sharedCiTarget:false,privateEnvironmentFile:envPath}));
writeFileSync(envPath,"CONVEX_DEPLOY_KEY=dev:qualification-test-001|test-only-placeholder\n",{mode:0o600});

// Builtin ESM bindings and the actual Convex client are intercepted in each child.
// Positive controls prove interception is active; all outbound fallbacks fail closed.
const preload=resolve(scratch,"intercept.mjs");
writeFileSync(preload,`
import fs from "node:fs";
import cp from "node:child_process";
import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";
import { ConvexHttpClient } from ${JSON.stringify(import.meta.resolve("convex/browser"))};
const record=kind=>fs.appendFileSync(process.env.INTERCEPT_EVENTS,JSON.stringify({kind})+"\\n");
const blocked=kind=>(..._args)=>{record(kind);throw new Error("Unexpected intercepted outbound operation: "+kind);};
cp.spawnSync=(..._args)=>{record("spawnSync");return {status:0,stdout:"INTERCEPTED subprocess; no network\\n",stderr:""};};
cp.spawn=blocked("spawn");
globalThis.fetch=blocked("fetch");
http.request=blocked("http.request");http.get=blocked("http.get");
https.request=blocked("https.request");https.get=blocked("https.get");
net.connect=blocked("net.connect");net.createConnection=blocked("net.createConnection");
tls.connect=blocked("tls.connect");
const originalRead=fs.readFileSync;
fs.readFileSync=function(path,...args){if(String(path).endsWith("/qualification/jwt-private.pem")){record("private-key-read");return Buffer.from("test-only intercepted signing key");}return originalRead.call(this,path,...args);};
crypto.sign=(..._args)=>Buffer.from("test-only-signature");
ConvexHttpClient.prototype.action=async function(){record("ConvexHttpClient.action");return {ok:true,intercepted:true};};
ConvexHttpClient.prototype.query=blocked("ConvexHttpClient.query");
ConvexHttpClient.prototype.mutation=blocked("ConvexHttpClient.mutation");
syncBuiltinESMExports();
`);

const cases=[];
let sequence=0;
function run(script,evidence,secret){
  const eventsFile=resolve(scratch,`events-${sequence++}.jsonl`);
  const child=spawnSync(process.execPath,["--import",preload,resolve(fixtureDirectory,"scripts",script)],{cwd:fixtureDirectory,encoding:"utf8",env:{...process.env,CORTEX_QUALIFICATION_TARGET_RECEIPT:targetPath,CORTEX_QUALIFICATION_DEPLOY_ENV:envPath,CORTEX_QUALIFICATION_EVIDENCE_DIR:evidence,CORTEX_QUALIFICATION_EFFECT_SECRET_FILE:secret??resolve(scratch,"never-created-secret.txt"),INTERCEPT_EVENTS:eventsFile}});
  const events=existsSync(eventsFile)?readFileSync(eventsFile,"utf8").trim().split("\n").filter(Boolean).map(line=>JSON.parse(line)):[];
  return {child,events};
}
function deny(name,script,evidence,secret,pattern=/Archived Task01 evidence is immutable|symlink|Private secret|private secret/){
  const {child,events}=run(script,evidence,secret);
  assert.notEqual(child.status,0,name);assert.match(child.stderr,pattern,name);assert.equal(events.length,0,name+": external/signing effects must be zero");
  cases.push({name,status:"PASS",exitCode:child.status,interceptedEffects:0});
}
function fresh(name){const path=resolve(scratch,name);mkdirSync(path,{recursive:true});return path;}

try{
  const directoryAlias=resolve(scratch,"archive-alias");symlinkSync(archive,directoryAlias,"dir");
  const nonexistentSuffix="guard-probe-must-not-create";
  assert.equal(existsSync(resolve(archive,nonexistentSuffix)),false);
  for(const script of ["deploy.mjs","gateway-check.mjs","qualify.mjs","effect-secret.mjs","verify.mjs","keys-check.mjs"]){
    deny(script+"-directory-alias-before-effects",script,directoryAlias);
    deny(script+"-nonexistent-suffix-alias-before-effects",script,resolve(directoryAlias,nonexistentSuffix,"nested"));
  }
  assert.equal(existsSync(resolve(archive,nonexistentSuffix)),false);
  for(const [script,names] of [["deploy.mjs",["deploy.txt"]],["gateway-check.mjs",["gateway-chat.json"]],["qualify.mjs",["live-receipts.json"]],["effect-secret.mjs",["effect-secret-setup.json"]],["verify.mjs",["check-commands.json","transport.json","live-receipts.json"]],["keys-check.mjs",["key-generator.json"]]]){
    for(const name of names){
      const dir=fresh(`output-${sequence}`);symlinkSync(originalLive,resolve(dir,name));
      deny(script+"-"+name+"-archive-file-alias-before-effects",script,dir);
    }
  }
  const danglingEvidence=fresh("dangling-output");symlinkSync(resolve(archive,"guard-never-existing-output.json"),resolve(danglingEvidence,"deploy.txt"));
  deny("dangling-output-symlink-fails-before-deploy","deploy.mjs",danglingEvidence,undefined,/ENOENT/);
  const linkedEvidence=fresh("hardlinked-output");const linkSource=resolve(scratch,"nonarchive-source.txt");writeFileSync(linkSource,"private scratch marker");linkSync(linkSource,resolve(linkedEvidence,"deploy.txt"));
  deny("hardlinked-output-fails-before-deploy","deploy.mjs",linkedEvidence,undefined,/hardlink/);

  const publicDir=fresh("public-outside-private-root");
  // This outside destination is an OS temp-like work fixture, never real QA.
  // Its canonical location is outside the allowed private root.
  const outside=resolve(repo,"work/backend-runtime",`ordering-outside-${process.pid}`);mkdirSync(outside,{mode:0o700});
  try{
    const privateAlias=resolve(scratch,"private-parent-alias");symlinkSync(outside,privateAlias,"dir");
    const escaped=resolve(privateAlias,"missing-parent/secret.txt");
    deny("private-parent-symlink-nonexistent-suffix-rejected","effect-secret.mjs",publicDir,escaped);
    assert.equal(existsSync(resolve(outside,"missing-parent")),false);
    const publicAlias=resolve(scratch,"qa-parent-alias");symlinkSync(resolve(fixtureDirectory,"../../task01-security"),publicAlias,"dir");
    deny("private-parent-symlink-into-QA-rejected","effect-secret.mjs",publicDir,resolve(publicAlias,"guard-no-secret.txt"));
    assert.equal(existsSync(resolve(fixtureDirectory,"../../task01-security/guard-no-secret.txt")),false);
    const outsideFile=resolve(outside,"existing.txt");writeFileSync(outsideFile,"a".repeat(64),{mode:0o600});
    const fileAlias=resolve(scratch,"private-file-alias.txt");symlinkSync(outsideFile,fileAlias);
    deny("existing-private-file-symlink-rejected","effect-secret.mjs",publicDir,fileAlias);
    const internalAlias=resolve(scratch,"private-internal-alias.txt"),internalFile=resolve(scratch,"private-real.txt");writeFileSync(internalFile,"b".repeat(64),{mode:0o600});symlinkSync(internalFile,internalAlias);
    deny("internal-private-file-symlink-rejected","effect-secret.mjs",publicDir,internalAlias);
    const danglingSecret=resolve(scratch,"private-dangling.txt");symlinkSync(resolve(outside,"absent.txt"),danglingSecret);
    deny("dangling-private-file-symlink-rejected","effect-secret.mjs",publicDir,danglingSecret,/ENOENT/);
    const linkedSecret=resolve(scratch,"private-hardlinked.txt");linkSync(internalFile,linkedSecret);
    deny("hardlinked-private-file-rejected","effect-secret.mjs",publicDir,linkedSecret,/hardlink/);
    const openSecret=resolve(scratch,"open-secret.txt");writeFileSync(openSecret,"c".repeat(64),{mode:0o600});chmodSync(openSecret,0o644);
    const before=hash(openSecret);
    deny("existing-private-secret-mode-0644-rejected","effect-secret.mjs",publicDir,openSecret,/mode 0600/);
    assert.equal(hash(openSecret),before);assert.equal(statSync(openSecret).mode&0o777,0o644);
  }finally{rmSync(outside,{recursive:true,force:true});}
  for(const script of ["deploy.mjs","gateway-check.mjs"]){
    const {child,events}=run(script,fresh(`positive-${script}`));
    assert.equal(child.status,0);assert.ok(events.some(event=>event.kind===(script==="deploy.mjs"?"spawnSync":"ConvexHttpClient.action")));
    cases.push({name:script+"-positive-control-interception-active",status:"PASS",interceptedEffects:events.length,liveEffects:0});
  }
  const secureFile=resolve(scratch,"created-secret.txt");
  const created=run("effect-secret.mjs",fresh("positive-secret-create"),secureFile);
  assert.equal(created.child.status,0);assert.deepEqual(created.events,[{kind:"spawnSync"}]);assert.equal(statSync(secureFile).mode&0o777,0o600);
  const secureHash=hash(secureFile);
  const reused=run("effect-secret.mjs",fresh("positive-secret-reuse"),secureFile);
  assert.equal(reused.child.status,0);assert.deepEqual(reused.events,[{kind:"spawnSync"}]);assert.equal(hash(secureFile),secureHash);
  cases.push({name:"secure-private-secret-create-and-reuse-no-overwrite",status:"PASS",interceptedEffects:2,mode:"0600",liveEffects:0});
  assert.equal(hash(originalLive),beforeLive);
}finally{rmSync(scratch,{recursive:true,force:true});}
const receipt={version:1,status:"PASS",observedAt:new Date().toISOString(),networkCalls:0,paidCalls:0,deployments:0,deniedCases:cases.filter(check=>check.interceptedEffects===0).length,cases,archiveLiveReceiptUnchanged:true,noArchiveDirectoriesOrSecretsCreated:true,privateTestSecretsCleaned:true,realQualificationKeyNotRead:true,interceptionPositiveControls:true};
writeFileSync(evidenceFile("effect-ordering.json"),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({status:"PASS",cases:cases.length,networkCalls:0,paidCalls:0,deployments:0,privateTestSecretsCleaned:true}));
