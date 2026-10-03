import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { evidenceFile, fixtureDirectory, qualificationDeploymentEnvironment, qualificationTarget, repo } from "./paths.mjs";

evidenceFile("target-safety.json");
const scratch=resolve(repo,"work/backend-runtime/task01-security/target-safety");
mkdirSync(scratch,{recursive:true,mode:0o700});
const receiptPath=resolve(scratch,"receipt.json"),envPath=resolve(scratch,"deploy.env");
const base={operation:"create-disposable-development-target",purpose:"qualification-security",projectId:12345,projectSlug:"cortex-runtime-disposable-qualification-security-a1b2c3d4",projectName:"Cortex runtime disposable qualification security a1b2c3d4",deploymentName:"qualification-test-001",deploymentUrl:"https://qualification-test-001.convex.cloud",deploymentType:"dev",kind:"cloud",isolationVerified:true,productionDeployment:false,sharedCiTarget:false,privateEnvironmentFile:envPath};
const saved={receipt:process.env.CORTEX_QUALIFICATION_TARGET_RECEIPT,env:process.env.CORTEX_QUALIFICATION_DEPLOY_ENV,key:process.env.CONVEX_DEPLOY_KEY};
const cases=[];
const check=(name,fn)=>{fn();cases.push({name,status:"PASS"});};
try{
  delete process.env.CORTEX_QUALIFICATION_TARGET_RECEIPT;
  check("missing-explicit-receipt-no-generic-fallback",()=>assert.throws(()=>qualificationTarget(),/Generic product target.json is never used/));
  process.env.CORTEX_QUALIFICATION_TARGET_RECEIPT="work/backend-runtime/target.json";
  check("relative-receipt-rejected",()=>assert.throws(()=>qualificationTarget(),/absolute verified qualification receipt/));
  process.env.CORTEX_QUALIFICATION_TARGET_RECEIPT=receiptPath;
  const write=patch=>writeFileSync(receiptPath,JSON.stringify({...base,...patch}));
  write({});
  check("qualification-purpose-name-dev-url-accepted",()=>assert.equal(qualificationTarget().deploymentName,base.deploymentName));
  for(const [name,patch] of [["missing-purpose",{purpose:undefined}],["integration-purpose",{purpose:"integration"}],["integration-project-name",{projectSlug:"cortex-runtime-disposable-integration-a1b2c3d4",projectName:"Cortex runtime disposable integration a1b2c3d4"}],["production",{deploymentType:"prod",productionDeployment:true}],["shared-ci",{sharedCiTarget:true}],["unverified",{isolationVerified:false}],["retired",{retired:true}],["wrong-url",{deploymentUrl:"https://different-deployment.convex.cloud"}]]){
    write(patch);check(name+"-rejected",()=>assert.throws(()=>qualificationTarget(),/Rejected target|name and HTTPS URL/));
  }
  write({deploymentName:"efficient-ox-979",deploymentUrl:"https://efficient-ox-979.convex.cloud"});
  check("archived-original-deployment-rejected",()=>assert.throws(()=>qualificationTarget(),/was retired/));
  write({});
  delete process.env.CORTEX_QUALIFICATION_DEPLOY_ENV;
  check("missing-explicit-deploy-env-rejected",()=>assert.throws(()=>qualificationDeploymentEnvironment(base),/CORTEX_QUALIFICATION_DEPLOY_ENV/));
  process.env.CORTEX_QUALIFICATION_DEPLOY_ENV=envPath;
  writeFileSync(envPath,"CONVEX_DEPLOY_KEY=dev:qualification-test-001|test-only-placeholder\nCONVEX_DEPLOYMENT=dev:qualification-test-001\nCONVEX_URL=https://qualification-test-001.convex.cloud\n",{mode:0o600});
  check("wrong-private-env-path-rejected",()=>assert.throws(()=>qualificationDeploymentEnvironment({...base,privateEnvironmentFile:receiptPath}),/does not match the verified qualification receipt/));
  process.env.CONVEX_DEPLOY_KEY="dev:unrelated-integration|test-only-placeholder";
  check("explicit-private-env-overrides-ambient-selector",()=>assert.ok(qualificationDeploymentEnvironment(base).env.CONVEX_DEPLOY_KEY.startsWith("dev:qualification-test-001|")));
  writeFileSync(envPath,"CONVEX_DEPLOY_KEY=dev:unrelated-integration|test-only-placeholder\n",{mode:0o600});
  check("mismatched-private-deploy-key-rejected",()=>assert.throws(()=>qualificationDeploymentEnvironment(base),/does not match the qualification deployment/));
  for(const script of ["deploy.mjs","qualify.mjs","effect-secret.mjs"]){
    const env={...process.env,CORTEX_QUALIFICATION_TARGET_RECEIPT:resolve(repo,"work/backend-runtime/target.json"),CORTEX_QUALIFICATION_DEPLOY_ENV:resolve(scratch,"never-provided.env"),CORTEX_QUALIFICATION_EVIDENCE_DIR:resolve(scratch,"blocked-command-evidence")};
    const result=spawnSync(process.execPath,[resolve(fixtureDirectory,"scripts",script),"invalid-offline-selection"],{cwd:fixtureDirectory,encoding:"utf8",env});
    check(script+"-rejects-actual-product-receipt-before-deploy-or-inference",()=>{assert.notEqual(result.status,0);assert.match(result.stderr,/Rejected target/);});
  }
  const archive=spawnSync(process.execPath,["--input-type=module","-e","await import('./scripts/paths.mjs');"],{cwd:fixtureDirectory,encoding:"utf8",env:{...process.env,CORTEX_QUALIFICATION_EVIDENCE_DIR:resolve(fixtureDirectory,"../evidence")}});
  check("archived-evidence-directory-rejected",()=>{assert.notEqual(archive.status,0);assert.match(archive.stderr,/Archived Task01 evidence is immutable/);});
  const alias=resolve(scratch,"archive-alias");if(!existsSync(alias))symlinkSync(resolve(fixtureDirectory,"../evidence"),alias,"dir");
  const symlink=spawnSync(process.execPath,["--input-type=module","-e","const paths=await import('./scripts/paths.mjs');paths.evidenceFile('never-written.json');"],{cwd:fixtureDirectory,encoding:"utf8",env:{...process.env,CORTEX_QUALIFICATION_EVIDENCE_DIR:alias}});
  check("archived-evidence-symlink-alias-rejected",()=>{assert.notEqual(symlink.status,0);assert.match(symlink.stderr,/Archived Task01 evidence is immutable/);});
  writeFileSync(evidenceFile("target-safety.json"),JSON.stringify({version:1,status:"PASS",networkCalls:0,cases},null,2));
  console.log(JSON.stringify({status:"PASS",cases:cases.length,networkCalls:0}));
}finally{
  for(const [name,value] of [["CORTEX_QUALIFICATION_TARGET_RECEIPT",saved.receipt],["CORTEX_QUALIFICATION_DEPLOY_ENV",saved.env],["CONVEX_DEPLOY_KEY",saved.key]])if(value===undefined)delete process.env[name];else process.env[name]=value;
}
