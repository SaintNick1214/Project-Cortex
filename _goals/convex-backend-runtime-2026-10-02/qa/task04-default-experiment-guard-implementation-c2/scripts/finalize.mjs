import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const q=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['fixture/convex/canonical.ts','fixture/convex/compiled.ts','fixture/convex/guard.ts','fixture/convex/runner.ts','fixture/convex/schema.ts','fixture/package.json','fixture/tsconfig.json','eslint.config.mjs','scripts/offline-check.mjs','scripts/refinement-check.mjs','scripts/hostile.mjs','scripts/verify.mjs','scripts/finalize.mjs'];
mkdirSync(resolve(q,'verification-preimages'),{recursive:true});for(const file of files)copyFileSync(resolve(q,file),resolve(q,'verification-preimages',file.replaceAll('/','--')));
const rows=[];function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())walk(path);else if(relative(q,path)!=='qa-manifest.json'){const bytes=readFileSync(path);rows.push({path:relative(q,path),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}walk(q);rows.sort((a,b)=>a.path.localeCompare(b.path));writeFileSync(resolve(q,'qa-manifest.json'),JSON.stringify({version:1,classification:'IMPLEMENTED_OFFLINE_FIXTURE_ONLY_REVIEW_PENDING',utc:new Date().toISOString(),excludesOnly:'qa-manifest.json',rows},null,2)+'\n');console.log(JSON.stringify({files:rows.length,status:'FROZEN_OFFLINE_PACKET',native:'NOT_RUN',officialDriver:'NOT_IMPLEMENTED'}));
