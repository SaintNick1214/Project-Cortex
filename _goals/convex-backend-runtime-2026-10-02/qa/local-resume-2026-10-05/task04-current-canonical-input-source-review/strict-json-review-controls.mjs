// Reviewer-only finite helper boundary checks. No producer pipeline or subjects.
import fs from 'node:fs';
import crypto from 'node:crypto';
const helper=new URL('../../../../../work/resume/task04-c8-current-canonical-input-producers/source/consumer_schema.mjs',import.meta.url);
const before=fs.readFileSync(helper);
const {strictJSON,shape}=await import(helper.href);

const tested = [
  ['duplicate-key', '{"x":1,"x":2}', 'CONSUMER_DUPLICATE_JSON_KEY'],
  ['partial-record', '{"x":', 'CONSUMER_JSON_VALUE'],
  ['trailing-content', '{} false', 'CONSUMER_TRAILING_JSON'],
  ['unsafe-plain-integer', '9007199254740993', 'CONSUMER_UNSAFE_JSON_NUMBER'],
  ['unsafe-decimal-integer', '9007199254740993.0', 'CONSUMER_UNSAFE_JSON_NUMBER'],
  ['unsafe-exponent-integer', '9.007199254740993e15', 'CONSUMER_UNSAFE_JSON_NUMBER'],
  ['unsafe-large-exponent-integer', '1e20', 'CONSUMER_UNSAFE_JSON_NUMBER'],
  ['nonfinite-exponent', '1e309', 'CONSUMER_UNSAFE_JSON_NUMBER'],
];
const controls = tested.map(([name, raw, expected]) => {
  try {
    const value = strictJSON(Buffer.from(raw));
    return {name, status:'FAIL', expected, accepted:value, safeInteger:Number.isSafeInteger(value)};
  } catch (error) {
    return {name, status:error.message===expected?'PASS':'FAIL', expected, denied:error.message};
  }
});
for (const [name, raw, expected] of [['finite-fraction','0.125',0.125], ['safe-exponent-integer','1e3',1000]]) {
  try { const value=strictJSON(Buffer.from(raw)); controls.push({name,status:value===expected?'PASS':'FAIL',value,expected}); }
  catch(error) { controls.push({name,status:'FAIL',denied:error.message}); }
}
try { shape({scope:'PUBLIC',UNKNOWN:true},['scope']); controls.push({name:'unknown-field',status:'FAIL'}); }
catch(error) { controls.push({name:'unknown-field',status:error.message==='CONSUMER_STRICT_SCHEMA_UNKNOWN_OR_MISSING'?'PASS':'FAIL',denied:error.message}); }
const bytes=fs.readFileSync(helper);
controls.push({name:'reviewed-helper-content-unchanged',status:before.equals(bytes)?'PASS':'FAIL'});
const result={scope:'REVIEWER_HELPER_BOUNDARY_ONLY_NO_PRODUCER_PIPELINE',helper:String(helper),helperBytes:bytes.length,helperSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),controls,ROOT:'ABSENT',original122:'HELD',nativeQualification:false};
const label=process.argv[2]??'initial';
if(!['initial','repaired-r3'].includes(label))throw Error('REVIEWER_FINITE_RESULT_LABEL');
const resultPath=new URL('./strict-json-review-results-'+label+'.json',import.meta.url);
fs.writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({scope:result.scope,passed:controls.filter(row=>row.status==='PASS').length,failed:controls.filter(row=>row.status==='FAIL').length,resultPath:String(resultPath)}));
process.exitCode=controls.some(row=>row.status==='FAIL')?1:0;
