import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
const root = process.cwd(), out = path.dirname(new URL(import.meta.url).pathname);
const sources = ["src/client-runtime/assets.ts", "src/client-runtime/client.ts", "src/client-runtime/types.ts", "src/client-runtime/index.ts", "tests/unit/client-runtime/assets.test.ts"];
const manifest = sources.map(file => { const bytes = readFileSync(file); return { path: file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; });
const jobs = [["client-tests2", ["--experimental-vm-modules", "node_modules/jest/bin/jest.js", "--config", path.join(out, "jest.config.mjs"), "--runInBand", "--json", "--outputFile=" + path.join(out,"unit-results2.json")]], ["sdk-types2", ["node_modules/typescript/bin/tsc", "--noEmit"]], ["client-lint2", ["node_modules/eslint/bin/eslint.js", ...sources, "--report-unused-disable-directives"]]];
const results = await Promise.all(jobs.map(([name,args]) => new Promise(resolve => {
  const start=Date.now(), child=spawn(process.execPath,args,{cwd:root,env:{...process.env,NODE_OPTIONS:"--max-old-space-size=1024"},stdio:["ignore","pipe","pipe"]}); let output="";
  child.stdout.on("data",data=>{output+=data});child.stderr.on("data",data=>{output+=data});
  child.on("close",(exitCode,signal)=> {writeFileSync(path.join(out,name+".log"),output);resolve({name,command:[process.execPath,...args],cwd:root,exitCode,signal,durationMs:Date.now()-start,log:name+".log"});});
})));
const report={version:1,timestampUtc:new Date().toISOString(),scope:"CONTROLLED_BROWSER_CLIENT_NO_SERVICE",node:process.version,sourceManifest:manifest,results,actualServiceQualification:false};
writeFileSync(path.join(out,"checks2.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));
process.exitCode=results.some(r=>r.exitCode!==0)?1:0;
