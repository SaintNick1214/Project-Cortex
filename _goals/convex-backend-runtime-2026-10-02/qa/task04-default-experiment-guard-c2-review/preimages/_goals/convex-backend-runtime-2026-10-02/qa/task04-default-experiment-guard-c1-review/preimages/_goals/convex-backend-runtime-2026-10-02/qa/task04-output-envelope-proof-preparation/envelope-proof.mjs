import { readFileSync,writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname,resolve } from 'node:path';
import { createHash } from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url));const root=resolve(here,'../../../..');
const profileSource=readFileSync(resolve(root,'src/domain/profile.ts'),'utf8');
const object=profileSource.match(/DEFAULT_EMBEDDING_PROFILE[^=]*= Object\.freeze\(\{([\s\S]*?)\}\);/);
if(!object)throw new Error('Profile source shape changed');
const profile={};for(const match of object[1].matchAll(/(\w+):\s*(?:"([^"]*)"|(\d+)),/g))profile[match[1]]=match[2]??Number(match[3]);
if(Object.keys(profile).sort().join(',')!=='chunking,dimensions,indexName,modelId,normalization,profileId'||profile.dimensions!==1536)throw new Error('Unexpected profile');
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v!==null&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';if(typeof v==='number'&&(!Number.isFinite(v)||Object.is(v,-0)))throw new Error('Noncanonical number');return JSON.stringify(v)}
const bytes=s=>Buffer.byteLength(s,'utf8');
const inequalityLeft=5n*2n**54n;const inequalityRight=10n**17n;
if(!(inequalityLeft<inequalityRight))throw new Error('17-digit rounding proof inequality failed');
let maximum=0;const witnessShapes=[];
for(let n=-323;n<=309;n++)for(let k=1;k<=17;k++)for(const sign of [0,1]){
 let length;
 if(n>=-5&&n<=21){if(n>=k)length=sign+n;else if(n>0)length=sign+k+1;else length=sign+2-n+k;}
 else length=sign+k+(k===1?0:1)+1+1+String(Math.abs(n-1)).length;
 if(length>maximum){maximum=length;witnessShapes.length=0;}
 if(length===maximum)witnessShapes.push({n,k,negative:Boolean(sign),length});
}
if(maximum!==25)throw new Error('Unexpected derived maximum');
const number=-0.0000012345678901234567;const numberCanonical=canonical(number);
if(bytes(numberCanonical)!==25)throw new Error('Number witness mismatch');
const profileCanonical=canonical(profile);const emptyEnvelope=canonical({profile,vectors:[[]]});const vectorWitness=canonical({profile,vectors:[Array(1536).fill(number)]});
const calculated=bytes(emptyEnvelope)+1536*maximum+1535;
if(bytes(vectorWitness)!==calculated||calculated!==40177)throw new Error('Envelope accounting mismatch');
const textEmpty=canonical({text:''});if(bytes(textEmpty)!==11)throw new Error('Text overhead mismatch');
const result={profile,profileSourceSHA256:createHash('sha256').update(profileSource).digest('hex'),profileCanonical,profileCanonicalBytes:bytes(profileCanonical),numberProof:{binary64SignificandBits:53,roundtripDecimalDigitsUpperBound:17,roundingInequality:{left:inequalityLeft.toString(),right:inequalityRight.toString(),meaning:'5e-17 < 2^-54, strict candidate decimal rounding error less than minimum relative binary64 midpoint distance'},nRange:[-323,309],finiteJSONStringMaximumBytes:maximum,allNotationShapesExhausted:633*17*2,maximumShapes:witnessShapes,attainingRealNumber:numberCanonical,attainingRealNumberBytes:25,proofIsFiniteNumberSamplesOnly:false},textEnvelope:{canonicalEmpty:textEmpty,fixedBytes:11,conditionalMaximum:'128*M+11',M64:128*64+11,M256:128*256+11},defaultEmbeddingEnvelope:{grammar:'canonical {profile:exactDefault,vectors:[oneArrayOf1536FiniteCanonicalNumbers]}',emptyEnvelopeCanonical:emptyEnvelope,fixedBytesIncludingEmptyArrayBrackets:bytes(emptyEnvelope),numberCount:1536,numberMaxBytes:maximum,commaCount:1535,maximumPrivateBytes:calculated,witnessSHA256:createHash('sha256').update(vectorWitness).digest('hex'),fits60000:calculated<=60000,secondVectorNotAllowedByAcceptedB:true,negativeZero:'domain canonical rejects -0; no normalization introduced'},actualModelReadiness:'NOT_RUN'};
writeFileSync(resolve(here,'envelope-proof-result.json'),JSON.stringify(result,null,2)+'\n');writeFileSync(resolve(here,'default-vector-max-witness.json'),vectorWitness+'\n');
console.log(JSON.stringify({numberMaxBytes:maximum,defaultVectorPrivateBytes:calculated,profileBytes:bytes(profileCanonical),textFixedBytes:11}));
