/** Offline interpretation of the ONE already captured result. No service/client. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSourceFactsResponse } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/sources.ts';
const q=dirname(fileURLToPath(import.meta.url)),priv='/Users/SaintNick/.codex/tmp/cortex-task16-ci-native-5b5ba39cd23b';
const json=async name=>JSON.parse(await readFile(join(priv,name),'utf8'));
const state=JSON.parse(await readFile(join(q,'outcomes1.json'),'utf8'));
const attempts=await json('successor3-memory-failure-runtimeModelAttempts1.private.json');
const sources=await json('successor3-memory-failure-runtimeMemorySources1.private.json');
const a=attempts.find(x=>x._id===state.attempts[0]._id),s=sources.find(x=>x._id===state.sources[0]._id);
assert.ok(a&&s);
const text=JSON.parse(a.privateResultCanonical).text,structured=JSON.parse(text);
let outcome='RETURNED',code=null,sourceFrames=[],factCount=null;
try{factCount=parseSourceFactsResponse(structured,s).length;}catch(error){outcome='THREW';code=/^([A-Z_]+):/.exec(String(error.message))?.[1]??error.name;sourceFrames=[...new Set(String(error.stack).match(/(?:sources|extraction)\.(?:js|ts):\d+:\d+/g)??[])];}
const allowed=['fact','factType','subject','predicate','object','confidence','tags','entities','relations'];
const metric=structured.facts.map(fact=>({keys:Object.keys(fact).sort(),unexpectedKeys:Object.keys(fact).filter(k=>!allowed.includes(k)),stringChecks:Object.fromEntries(['fact','subject','predicate','object'].map(key=>[key,{type:typeof fact[key],length:typeof fact[key]==='string'?fact[key].length:null,trimMatches:typeof fact[key]==='string'?fact[key]===fact[key].trim():null,trimmedNonempty:typeof fact[key]==='string'?fact[key].trim().length>0:null}])),factType:fact.factType,confidenceType:typeof fact.confidence,confidenceInRange:typeof fact.confidence==='number'&&fact.confidence>=0&&fact.confidence<=1,tagsArray:Array.isArray(fact.tags),tagsStringTypes:Array.isArray(fact.tags)?fact.tags.every(x=>typeof x==='string'):null,entityCount:fact.entities?.length,entityTypes:fact.entities?.map(x=>x.type),relationCount:fact.relations?.length}));
const receipt={status:'OFFLINE_RETAINED_ACTUAL_RESULT_PARSER_DIAGNOSIS',serviceEffects:0,modelEffects:0,attemptId:a._id,privateResultSha256:createHash('sha256').update(a.privateResultCanonical).digest('hex'),parser:{outcome,code,sourceFrames,factCount},topLevelKeys:Object.keys(structured),factMetrics:metric};
await writeFile(join(q,'retained-result-parser1.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:receipt.status,parser:receipt.parser,factMetrics:metric}));
