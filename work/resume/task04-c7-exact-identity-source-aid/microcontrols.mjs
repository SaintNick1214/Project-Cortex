// SOURCE_AID_ONLY: independent builtins and own fixed fixture, no C6 imports.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const fields=['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'];
const names={mtime_ns:'mtimeNs',ctime_ns:'ctimeNs'};
const wire=s=>({schema:'FS_IDENTITY_DECIMAL_V1',fields:Object.fromEntries(fields.map(k=>{const v=s[names[k]??k];assert.equal(typeof v,'bigint');return[k,v.toString()];}))});
function validate(v){assert.equal(v.schema,'FS_IDENTITY_DECIMAL_V1');assert.deepEqual(Object.keys(v.fields).sort(),fields.slice().sort());for(const k of fields)assert.match(v.fields[k],k.endsWith('_ns')?/^(0|-?[1-9][0-9]*)$/:/^(0|[1-9][0-9]*)$/);for(const k of fields)assert.equal(typeof v.fields[k],'string');return v;}
const equal=(a,b)=>fields.every(k=>validate(a).fields[k]===validate(b).fields[k]);
const rows=[];const run=(name,f)=>{f();rows.push({name,status:'PASS_OWN_MICROCONTROL_ONLY'});};
run('adjacent_unsafe_inode_collision',()=>{const a=9223372036855902365n,b=a+1n;assert.equal(Number(a),Number(b));assert.notEqual(a.toString(),b.toString());console.log(JSON.stringify({name:'inode_collision',exactA:a.toString(),exactB:b.toString(),rounded:Number(a),nodeRoundedDecimal:String(Number(a)),jsonA:JSON.stringify(Number(a))}));});
run('adjacent_nanosecond_collision_and_ms_rounding',()=>{const a=1780600000123456789n,b=a+1n;assert.equal(Number(a),Number(b));assert.equal(Number(a)/1e6,Number(b)/1e6);assert.notEqual(a.toString(),b.toString());});
run('python_exact_json_tokens_lossless_vs_plain_parse',()=>{const text='{"dev":9007199254740993,"ino":9223372036855902365,"mode":33188,"uid":0,"gid":0,"nlink":1,"size":17,"mtime_ns":1780600000123456789,"ctime_ns":1780600000123456790}';const plain=JSON.parse(text);assert.notEqual(String(plain.ino),'9223372036855902365');const exact=JSON.parse(text,(k,v,c)=>fields.includes(k)?(assert.ok(c&&/^(0|-?[1-9][0-9]*)$/.test(c.source)),c.source):v);assert.equal(exact.dev,'9007199254740993');assert.equal(exact.ino,'9223372036855902365');assert.equal(exact.mtime_ns,'1780600000123456789');assert.equal(exact.ctime_ns,'1780600000123456790');});
const fixture=new URL('./own-fixture.txt',import.meta.url),fd=fs.openSync(fixture,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
try{
 const native=fs.fstatSync(fd),a=wire(fs.fstatSync(fd,{bigint:true})),p=wire(fs.lstatSync(fixture,{bigint:true}));
 run('held_fd_path_exact_nine_and_native_stats_fidelity',()=>{assert.ok(equal(a,p));assert.equal(typeof native.ino,'number');assert.equal(typeof native.mtimeMs,'number');assert.ok(native instanceof fs.Stats);assert.equal(typeof native.isFile,'function');assert.equal(native.isFile(),true);assert.equal(typeof fs.fstatSync(fd,{bigint:true}).ino,'bigint');});
 run('exact_persist_load_and_all_nine_reject_changed',()=>{assert.ok(equal(a,JSON.parse(JSON.stringify(a))));for(const k of fields){const other=structuredClone(a);other.fields[k]=(BigInt(other.fields[k])+1n).toString();assert.equal(equal(a,other),false);}});
 run('safe_small_values_do_not_authorize_numeric_schema',()=>{for(const value of [1,9007199254740992,NaN,Infinity]){const other=structuredClone(a);other.fields.ino=value;assert.throws(()=>validate(other));}const other=structuredClone(a);delete other.fields.gid;assert.throws(()=>validate(other));});
 run('same_byte_hash_not_identity_authority',()=>{const other=structuredClone(a);other.fields.ino=(BigInt(a.fields.ino)+1n).toString();assert.equal(equal(a,other),false);assert.equal('same-sha256','same-sha256');});
 run('own_model_primary_secondary_error_preservation',()=>{const primary=Error('OWN_CAPTURE_PRIMARY'),secondary=Error('OWN_CLOSE_SECONDARY'),e=new AggregateError([primary,secondary],'OWN_FAILED',{cause:primary});assert.equal(e.cause,primary);assert.deepEqual(e.errors,[primary,secondary]);});
 console.log(JSON.stringify({label:'SOURCE_AID_ONLY',node:process.version,identity:a,controls:rows,count:rows.length,scope:'NO_CANDIDATE_IMPORT_EXECUTION_OR_QUALIFICATION'}));
}finally{fs.closeSync(fd);}
