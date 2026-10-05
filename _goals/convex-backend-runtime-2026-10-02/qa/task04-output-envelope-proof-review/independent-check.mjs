import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const root='/workspace/Project-Cortex';const out=root+'/_goals/convex-backend-runtime-2026-10-02/qa/task04-output-envelope-proof-review';
const base=root+'/_goals/convex-backend-runtime-2026-10-02/qa/';
const decoder=new TextDecoder('utf-8',{fatal:false,ignoreBOM:true});
const F=b=>Buffer.byteLength(JSON.stringify(decoder.decode(b)))-2;
const artifact=fs.readFileSync(base+'task04-output-vocabulary-acquisition/o200k_base.tiktoken');
assert.equal(crypto.createHash('sha256').update(artifact).digest('hex'),'446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d');
let maximum=0;let witnesses=[];let seen=new Set();let rows=0;
for(const line of artifact.toString().trimEnd().split('\n')){const [b64,rank]=line.split(' ');assert.equal(+rank,rows++);const b=Buffer.from(b64,'base64');assert.equal(b.toString('base64'),b64);assert(!seen.has(b64));seen.add(b64);const cost=F(b);if(cost>maximum){maximum=cost;witnesses=[];}if(cost===maximum)witnesses.push({rank:+rank,bytes:b.length,hex:b.toString('hex')});}
assert.equal(rows,199998);assert.equal(maximum,128);assert.deepEqual(witnesses.map(w=>w.rank),[72056]);
let scalarCount=0;let scalarMax=0;for(let cp=128;cp<=0x10ffff;cp++){if(cp>=0xd800&&cp<=0xdfff)continue;scalarCount++;scalarMax=Math.max(scalarMax,Buffer.byteLength(JSON.stringify(String.fromCodePoint(cp)))-2);}
assert.equal(scalarCount,1111936);assert.equal(scalarMax,4);
const official=fs.readFileSync(base+'task04-input-result-bound-research/public/tiktoken-openai-public.raw','utf8');const model=fs.readFileSync(base+'task04-input-result-bound-research/public/tiktoken-model-current.raw','utf8');
assert(official.includes('446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d'));assert(model.includes('"gpt-4o-": "o200k_base"'));assert(model.includes('"gpt-4.1-": "o200k_base"'));
let checks=0;let negative=0;
function pair(a,b){let fa=F(a),fb=F(b),fj=F(Buffer.concat([a,b]));assert(fj<=fa+fb,JSON.stringify({a:a.toString('hex'),b:b.toString('hex'),fa,fb,fj}));checks++;if(fj<fa+fb)negative++;}
for(let a=0;a<256;a++)for(let b=0;b<256;b++)pair(Buffer.from([a]),Buffer.from([b]));
const prefixes=[];for(let lead=0xc2;lead<=0xf4;lead++){prefixes.push(Buffer.from([lead]));if(lead<0xe0)continue;for(let b=0x80;b<=0xbf;b++){if(lead===0xe0&&b<0xa0||lead===0xed&&b>0x9f||lead===0xf0&&b<0x90||lead===0xf4&&b>0x8f)continue;prefixes.push(Buffer.from([lead,b]));if(lead>=0xf0)for(let c of [0x80,0x81,0x9f,0xa0,0xbf])prefixes.push(Buffer.from([lead,b,c]));}}
for(let p of prefixes)for(let next=0;next<=255;next++){pair(p,Buffer.from([next]));pair(p,Buffer.from([next,0x80,0xbf,0x22,0x5c,0x00]));}
let seed=0x4c0ffee;function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;}
for(let i=0;i<50000;i++){const a=Buffer.alloc(random()%12),b=Buffer.alloc(random()%12);for(let j=0;j<a.length;j++)a[j]=random()%256;for(let j=0;j<b.length;j++)b[j]=random()%256;pair(a,b);}
const equalCounterexamples=[['e2','82ac'],['f09f98','80']].map(([a,b])=>{a=Buffer.from(a,'hex');b=Buffer.from(b,'hex');return {left:a.toString('hex'),right:b.toString('hex'),separate:F(a)+F(b),joint:F(Buffer.concat([a,b]))}});assert.deepEqual(equalCounterexamples.map(x=>[x.separate,x.joint]),[[9,3],[6,4]]);
const require=createRequire(root+'/package.json');const ts=require('typescript');const source=fs.readFileSync(root+'/src/domain/model-policy.ts','utf8');const snippet=source.slice(source.indexOf('export function canonicalModelJson'),source.indexOf('// These private leaves'));
const transpiled=ts.transpileModule(snippet.replace('export function','function'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const canonical=new Function(transpiled+';return canonicalModelJson')();
for(const invalid of [-0,NaN,Infinity,-Infinity,undefined,Array(1),new Date(),{get text(){throw Error('getter must never execute')}}])assert.throws(()=>canonical(invalid));
const profileSource=fs.readFileSync(root+'/src/domain/profile.ts','utf8');const profileText=profileSource.match(/Object.freeze\((\{[\s\S]*?\})\);/)[1];const profile=new Function('return ('+profileText+')')();assert.equal(Object.keys(profile).length,6);assert.equal(profile.dimensions,1536);
const value=-0.0000012345678901234567;assert.equal(Buffer.byteLength(canonical(value)),25);const envelope=canonical({profile,vectors:[Array(1536).fill(value)]});assert.equal(Buffer.byteLength(envelope),40177);assert.equal(Buffer.byteLength(canonical(profile)),215);assert.equal(Buffer.byteLength(canonical({profile,vectors:[[]]})),242);assert.equal(canonical({text:''}),'\u007b"text":""}');assert.equal(Buffer.byteLength(canonical({text:''})),11);
const binary=Buffer.alloc(8);let finiteNumbers=0;let numberMax=0;function numberCheck(bits){binary.writeBigUInt64LE(bits);const n=binary.readDoubleLE();if(!Number.isFinite(n)||Object.is(n,-0))return;const length=Buffer.byteLength(canonical(n));assert(length<=25);finiteNumbers++;numberMax=Math.max(numberMax,length);}
for(let e=0n;e<=2046n;e++)for(let m of [0n,1n,2n,(1n<<51n)-1n,1n<<51n,(1n<<52n)-2n,(1n<<52n)-1n])for(let sign of [0n,1n])numberCheck((sign<<63n)|(e<<52n)|m);
for(let i=0;i<50000;i++)numberCheck((BigInt(random())<<32n)|BigInt(random()));
assert(5n*(2n**54n)<10n**17n);
const saved=fs.readFileSync(base+'task04-output-envelope-proof-preparation/default-vector-max-witness.json');assert.equal(saved.length,40178);assert.equal(saved.toString(),envelope+'\n');
const result={completeVocabulary:{rows,maximum,witnesses},completeNonASCIIScalars:{scalarCount,scalarMax},adversarialDecoder:{checks,strictReductions:negative,prefixRepresentatives:prefixes.length,counterexamplesToEquality:equalCounterexamples,noCounterexampleFound:true,role:'falsification support only; general theorem rests on reviewed analytical boundary-state proof',BOM:'ignoreBOM=true preserves U+FEFF as Python replacement decoding; no provider assertion'},canonicalSerializer:{source:'src/domain/model-policy.ts actual function compiled without modification',negativeZeroNonfiniteSparseAccessorNonplainRejected:true,profileBytes:215,textOverhead:11,vectorBytes:40177,fileBytes:40178},binary64Samples:{finiteNumbers,numberMax,role:'adversarial falsification only; general 25-byte bound rests on midpoint and notation proof'},theoremReview:{boundaryStates:'no pending prefix or one proper valid scalar prefix; invalid next byte reprocessed identically',completion:'joint L<=4, independent 3+3k>=6',interruption:'joint3<=3+3k',induction:'extends to any finite sequence of fragments',shortestDecimal:'17-significant-digit candidate error < minimum relative binary64 midpoint distance 2^-54; shortest k<=17',notation:'all n=-323..309 and k=1..17 grammars yield <=25; real 25-byte witness attains it'},scope:'conditional output proof only; serving decoder/tokenizer/cap/native result correspondence NOT_RUN'};
fs.writeFileSync(out+'/independent-result.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({rows,maximum,scalarCount,decoderChecks:checks,finiteNumbers,vectorBytes:40177}));
