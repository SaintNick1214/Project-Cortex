from pathlib import Path
s=Path('/workspace/Project-Cortex/work/resume/task04-default-experiment-guard-c1-review');t=(s/'scripts/offline-check.mjs').read_text();prefix=t[:t.index("await test('compiled")]
(s/'scripts/hostile.mjs').write_text(prefix+'''
const outcomes=[];
async function probe(name,body){try {outcomes.push({name,...await body()});}catch(e){outcomes.push({name,error:String(e)});}}
await probe('late genuine terminal with money still unknown must release slot independently',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null});
 let rejected=null;try{await capture(h,'C01',{lifetime:'qualified-terminal',money:'unknown',microUSD:null});}catch(e){rejected=String(e);}
 const s=h.state();assert.equal(s.reserved,29031);assert.equal(s.known,0);
 return {contractMet:s.active===null&&s.attempts[0].slotReleased,rejected,active:s.active,slotReleased:s.attempts[0].slotReleased};
});
await probe('known money then genuine terminal missing money should release once',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown'});let rejected=null;
 try{await capture(h,'C01',{money:'unknown',microUSD:null});}catch(e){rejected=String(e);}const s=h.state();assert.equal(s.known,10);
 return {contractMet:s.active===null,rejected,active:s.active,reserved:s.reserved,known:s.known};
});
await probe('usage evidence cannot conflict between first and refined receipt',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null,usageInput:1});let rejected=null;
 try{await capture(h,'C01',{usageInput:2});}catch(e){rejected=String(e);}return {contractMet:rejected!==null,rejected,refinements:h.state().attempts[0].refinements.length,known:h.state().known};
});
await probe('terminal refinement cannot accept unlimited new receipts',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null,usageInput:1});await capture(h,'C01',{usageInput:1});let rejected=null;
 try{await capture(h,'C01',{usageInput:2});await capture(h,'C01',{usageInput:3});}catch(e){rejected=String(e);}return {contractMet:rejected!==null,rejected,refinements:h.state().attempts[0].refinements.length,slotReleased:h.state().attempts[0].slotReleased,known:h.state().known};
});
await probe('charge scope cannot become production evidence',async()=>{const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{evidenceScope:'production'});assert.equal(h.state().known,0);assert.equal(h.state().stopped,true);return {contractMet:true};});
await probe('private query allowlist excludes attached values',async()=>{const h=await new Harness().setup();await reserve(h);const privateResultCanonical=canonical({text:'offline-private-canary'}),resultHash=await digest(privateResultCanonical);await capture(h,'C01',{resultHash});await h.mutation(guard.attach,{...args('C01'),dispatchIdentity:h.state().attempts[0].dispatchIdentity,privateResultCanonical});const view=await h.mutation(guard.inspect);assert.equal(JSON.stringify(view).includes('offline-private-canary'),false);return {contractMet:true};});
console.log(JSON.stringify({classification:'INDEPENDENT_HOSTILE_OUTCOMES_OFFLINE_ONLY',outcomes}));
''')
