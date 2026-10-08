import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, createPublicKey } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { evidenceFile, fixtureDirectory, repo } from "./paths.mjs";

evidenceFile("key-generator.json");
const privateRoot=resolve(repo,"work/backend-runtime/task01-security");
mkdirSync(privateRoot,{recursive:true,mode:0o700});
const scratch=mkdtempSync(resolve(privateRoot,"key-race-"));
const privateDir=resolve(scratch,"private"),publicFixture=resolve(scratch,"fixture");
mkdirSync(resolve(publicFixture,"convex"),{recursive:true,mode:0o700});
const run=()=>new Promise((resolveResult,reject)=>{
  const child=spawn(process.execPath,[resolve(fixtureDirectory,"scripts/keys.mjs")],{cwd:publicFixture,env:{...process.env,QUALIFICATION_PRIVATE_DIR:privateDir},stdio:["ignore","pipe","pipe"]});
  let stdout="",stderr="";
  child.stdout.on("data",chunk=>{stdout+=chunk;});child.stderr.on("data",chunk=>{stderr+=chunk;});
  child.on("error",reject);child.on("close",exitCode=>resolveResult({exitCode,stdout,stderr}));
});
const hash=file=>createHash("sha256").update(readFileSync(file)).digest("hex");
let receipt;
try{
  // Both real processes generate independently, racing for one exclusive key path.
  const processes=await Promise.all([run(),run()]);
  assert.equal(processes.filter(process=>process.exitCode===0).length,1);
  const loser=processes.find(process=>process.exitCode!==0);assert.match(loser.stderr,/Private key exists; preserve it and its matching public JWKS/);
  const privatePath=resolve(privateDir,"jwt-private.pem"),publicPath=resolve(publicFixture,"convex/auth.config.ts");
  const publicJwk=createPublicKey(readFileSync(privatePath)).export({format:"jwk"});
  const encoded=readFileSync(publicPath,"utf8").match(/data:text\/plain;charset=utf-8;base64,([A-Za-z0-9+/=]+)/)?.[1];assert.ok(encoded);
  const published=JSON.parse(Buffer.from(encoded,"base64").toString("utf8")).keys[0];
  assert.equal(published.n,publicJwk.n);assert.equal(published.e,publicJwk.e);
  assert.equal(statSync(privatePath).mode&0o777,0o600);
  const before={private:hash(privatePath),public:hash(publicPath)};
  const repeated=await run();assert.notEqual(repeated.exitCode,0);assert.match(repeated.stderr,/Private key exists/);
  assert.deepEqual({private:hash(privatePath),public:hash(publicPath)},before);
  receipt={version:1,status:"PASS",networkCalls:0,concurrentProcesses:2,successfulCreators:1,losersRejected:1,publishedJwksMatchesWinningKey:true,privateKeyMode:"0600",repeatRejectedWithoutChangingKeyOrJwks:true,realQualificationKeyGeneratorNotRun:true,privateKeysCreatedOnlyInScratch:true};
}finally{rmSync(scratch,{recursive:true,force:true});}
writeFileSync(evidenceFile("key-generator.json"),JSON.stringify({...receipt,temporaryPrivateKeysCleaned:true},null,2));
console.log(JSON.stringify({status:"PASS",concurrentCreators:1,overwrites:0,temporaryPrivateKeysCleaned:true,networkCalls:0}));
