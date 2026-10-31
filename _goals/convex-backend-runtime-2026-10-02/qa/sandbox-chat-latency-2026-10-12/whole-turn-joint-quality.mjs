import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {spawn,execFileSync} from "node:child_process";
const R=process.cwd(),Q=path.join(R,"_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12"),sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const git=args=>execFileSync("git",args,{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const changed=[...new Set([...git(["diff","--name-only"]),...git(["ls-files","--others","--exclude-standard"])])].filter(p=>/^(convex-dev|src|tests|packages|\.github)\//.test(p)&&fs.statSync(path.join(R,p)).isFile());
const hashes=Object.fromEntries(changed.map(p=>[p,sha(fs.readFileSync(path.join(R,p)))]));
const lintPaths=changed.filter(p=>p.endsWith(".ts")&&/^(convex-dev|tests)\//.test(p));
const inputs={baseline:"126231a0102936998837dd14a64a77d2b4d09785",head:git(["rev-parse","HEAD"])[0],node:process.version,npm:execFileSync("npm",["--version"],{encoding:"utf8"}).trim(),hashes,lintPaths};
fs.writeFileSync(path.join(Q,"whole-turn-joint-quality-inputs.json"),JSON.stringify(inputs,null,2)+"\n");
async function run(name,args){const log=path.join(Q,`whole-turn-joint-${name}-v1.log`),fd=fs.openSync(log,"w");const result=await new Promise(resolve=>{const p=spawn(process.execPath,args,{cwd:R,env:process.env,stdio:["ignore",fd,fd]});p.on("error",error=>resolve({exitCode:null,error:error.message}));p.on("close",(exitCode,signal)=>resolve({exitCode,signal}));});fs.closeSync(fd);fs.writeFileSync(path.join(Q,`whole-turn-joint-${name}-v1-exit.json`),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify({check:name,...result}));return result;}
const types=path.join(R,"node_modules/typescript/bin/tsc"),lint=path.join(R,"node_modules/eslint/bin/eslint.js");
const early=await Promise.all([run("root-types",[types,"--noEmit","-p","tsconfig.json"]),run("backend-types",[types,"--noEmit","-p","convex-dev/tsconfig.json"]),run("lint-types",[types,"--noEmit","-p","tsconfig.lint.json"]),run("scoped-lint",[lint,...lintPaths])]);
if(early.some(r=>r.exitCode!==0)){process.exitCode=1;}else{
 const npmCli=fs.realpathSync(path.join(path.dirname(process.execPath),"npm"));
 const built=await run("build",[npmCli,"run","build"]);
 if(built.exitCode!==0)process.exitCode=1;else{const packed=await run("packed-contracts",[path.join(R,"scripts/verify-public-contracts.mjs")]);process.exitCode=packed.exitCode===0?0:1;}
}
const unchanged=Object.entries(hashes).every(([p,h])=>sha(fs.readFileSync(path.join(R,p)))===h);
fs.writeFileSync(path.join(Q,"whole-turn-joint-input-check.json"),JSON.stringify({unchanged,count:changed.length},null,2)+"\n");if(!unchanged)process.exitCode=1;
