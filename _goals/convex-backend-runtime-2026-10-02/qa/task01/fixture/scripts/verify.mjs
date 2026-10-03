import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const commands=[
  ["npm exec --yes --package=npm@12.2.0 -- npm --version",["exec","--yes","--package=npm@12.2.0","--","npm","--version"]],
  ["npm exec --yes --package=npm@12.2.0 -- npm run typecheck",["exec","--yes","--package=npm@12.2.0","--","npm","run","typecheck"]],
  ["npm exec --yes --package=npm@12.2.0 -- npm run check:transport",["exec","--yes","--package=npm@12.2.0","--","npm","run","check:transport"]],
];
const results=[];
for(const [command,args] of commands){
  const result=spawnSync("npm",args,{encoding:"utf8",env:process.env});
  results.push({command,exitCode:result.status,stdout:result.stdout,stderr:result.stderr});
  console.log(command+": "+(result.status===0?"PASS":"FAIL"));
}
const live=JSON.parse(readFileSync("../evidence/live-receipts.json","utf8"));
const result={version:1,observedAt:new Date().toISOString(),node:process.version,lockSha256:createHash("sha256").update(readFileSync("package-lock.json")).digest("hex"),commands:results,liveReceiptStatus:live.status,liveCheckCount:live.checks.length,status:results.every(r=>r.exitCode===0)&&live.status==="PASS"?"PASS":"FAIL"};
writeFileSync("../evidence/check-commands.json",JSON.stringify(result,null,2));
process.exitCode=result.status==="PASS"?0:1;
