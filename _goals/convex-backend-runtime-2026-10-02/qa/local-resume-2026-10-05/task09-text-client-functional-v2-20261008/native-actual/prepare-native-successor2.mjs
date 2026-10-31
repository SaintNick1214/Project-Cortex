import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const q=new URL('.',import.meta.url).pathname;
let raw=await readFile(join(q,'seed-and-native1.mjs'),'utf8');
raw=raw.replace('operation=randomUUID();',"operation=JSON.parse(await readFile(join(qa,'native1-calls.json'))).operation;");
const seedBegin=raw.indexOf(" const remembered=await call('governed-owned-memory-seed'");
const seedEnd=raw.indexOf('\n const request=',seedBegin);
if(seedBegin<0||seedEnd<0)throw Error('Unknown QA seed body');
raw=raw.slice(0,seedBegin)+" const priorSeed=JSON.parse(await readFile(join(qa,'native1-calls.json'))).records.find(x=>x.label==='governed-owned-memory-seed');\n const remembered=priorSeed.result;assert.equal(remembered.created,true);assert.ok(remembered.receiptId);assert.ok(remembered.facts.some(x=>x.object===codeword));records.push({...priorSeed,reusedCompletedPaidReceipt:true});\n"+raw.slice(seedEnd);
raw=raw.replace("const execution=initialState.runtimeAgentExecutions.find(x=>x.runId===handle.runId);assert.ok(execution.operations.some(x=>x.kind==='tool'&&x.toolName==='memory_recall'&&x.state==='complete'));", "const full=await client.observe(handle);const tools=full.parts.filter(x=>x.part.type==='tool');assert.ok(tools.some(x=>x.part.name==='memory_recall'&&x.part.phase==='succeeded'));");
raw=raw.replace("toolOperations:execution.operations.filter(x=>x.kind==='tool')",'toolParts:tools');
// New receipts preserve the original stale modern-remember shape oracle and its paid seed.
raw=raw.replaceAll("'native1-","'native2-").replace("join(qa,'native2-calls.json')", "join(qa,'native1-calls.json')");
// Both references to the actual completed seed use the old immutable receipt.
raw=raw.replace("const priorSeed=JSON.parse(await readFile(join(qa,'native2-calls.json')))","const priorSeed=JSON.parse(await readFile(join(qa,'native1-calls.json')))");
await writeFile(join(q,'seed-and-native2.mjs'),raw);
