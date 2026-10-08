'use strict';
const SCHEMA='FS_IDENTITY_DECIMAL_V1';
const FIELDS=Object.freeze(['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']);
const nativeFields=Object.freeze({mtime_ns:'mtimeNs',ctime_ns:'ctimeNs'});
const fail=()=>{throw Error('QA_C7_EXACT_IDENTITY_SCHEMA');};
function object(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();const d=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(d).length!==keys.length||keys.some(k=>!d[k]||!('value'in d[k])||!d[k].enumerable))fail();return value;}
function decimal(value,signed=false){if(typeof value!=='string'||!(signed?/^(?:0|[1-9][0-9]*|-[1-9][0-9]*)$/:/^(?:0|[1-9][0-9]*)$/).test(value))fail();return value;}
function validate(identity){object(identity,['schema','fields']);if(identity.schema!==SCHEMA)fail();object(identity.fields,FIELDS);for(const k of FIELDS)decimal(identity.fields[k],k.endsWith('_ns'));return identity;}
function capture(stats){const fields={};for(const k of FIELDS){const n=stats[nativeFields[k]??k];if(typeof n!=='bigint')throw Error('QA_C7_NUMBER_STATS_PRECISION_LIMITED');fields[k]=decimal(n.toString(10),k.endsWith('_ns'));}return Object.freeze({schema:SCHEMA,fields:Object.freeze(fields)});}
function same(a,b){validate(a);validate(b);return FIELDS.every(k=>a.fields[k]===b.fields[k]);}
function sameStats(a,b){return same(capture(a),capture(b));}
function stable(a,b){validate(a);validate(b);return ['dev','ino'].every(k=>a.fields[k]===b.fields[k]);}
function bounded(value,max=Number.MAX_SAFE_INTEGER){decimal(value);const n=BigInt(value);if(!Number.isSafeInteger(max)||max<0||n>BigInt(max))throw Error('QA_C7_INTEGER_BOUNDS');return Number(n);}
function pid(value){if(typeof value==='number'){if(!Number.isSafeInteger(value)||value<=0)throw Error('QA_C7_PID_SCHEMA');return value;}const n=bounded(decimal(value));if(n<=0)throw Error('QA_C7_PID_SCHEMA');return n;}
function startTime(value){return decimal(value);}
function validateTree(value){const seen=new Set();function walk(v){if(typeof v==='bigint')fail();if(!v||typeof v!=='object')return;if(seen.has(v))throw Error('QA_C7_JSON_CYCLE');seen.add(v);const descriptors=Object.getOwnPropertyDescriptors(v);for(const key of Reflect.ownKeys(descriptors))if(typeof key!=='string'||!('value'in descriptors[key]))fail();if(descriptors.schema?.value===SCHEMA)validate(v);for(const k of Object.keys(v)){const entry=descriptors[k].value;if(k==='identity'||/^(?:source|destination|original|producer|final|pin)Identity$/.test(k))validate(entry);walk(entry);}seen.delete(v);}walk(value);return value;}
/* A complete JSON tokenizer retains original integer tokens. No regex rewriting,
 * rounded-number recovery, reviver duplicate-key loss, or global JSON override. */
function parse(text,{legacyExact=false}={}){
 if(Buffer.isBuffer(text))text=text.toString('utf8');if(typeof text!=='string')fail();let i=0;const numeric=new WeakMap();
 const ws=()=>{while(i<text.length&&/[\t\n\r ]/.test(text[i]))i++;};
 function string(){const begin=i++;while(i<text.length){const c=text[i++];if(c==='"')return JSON.parse(text.slice(begin,i));if(c==='\\'){if(text[i]==='u'){i++;if(!/^[0-9a-fA-F]{4}$/.test(text.slice(i,i+4)))fail();i+=4;}else{if(!/["\\/bfnrt]/.test(text[i]??''))fail();i++;}}else if(c.charCodeAt(0)<32)fail();}fail();}
 function value(){ws();const c=text[i];if(c==='"')return {value:string()};if(c==='{'||c==='['){i++;const array=c==='[',v=array?[]:{},tokens={};ws();if(text[i]===(array?']':'}')){i++;return {value:v};}for(;;){ws();let key;if(array)key=String(v.length);else{if(text[i]!=='"')fail();key=string();if(Object.hasOwn(v,key))throw Error('QA_C7_JSON_DUPLICATE_KEY');ws();if(text[i++]!==':')fail();}const n=value();Object.defineProperty(v,key,{value:n.value,enumerable:true,writable:true,configurable:true});if(n.token!==undefined)tokens[key]=n.token;ws();if(text[i]===(array?']':'}')){i++;numeric.set(v,tokens);return {value:v};}if(text[i++]!==',')fail();}}
 for(const [token,n]of [['true',true],['false',false],['null',null]])if(text.startsWith(token,i)){i+=token.length;return {value:n};}
 const match=/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(i));if(!match)fail();i+=match[0].length;return {value:Number(match[0]),token:match[0]};}
 const result=value().value;ws();if(i!==text.length)fail();
 function walk(v){if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){const x=v[k];if(k==='identity'||/^(?:source|destination|original|producer|final|pin)Identity$/.test(k)){
   if(x?.schema===SCHEMA){validate(x);continue;}
   if(!legacyExact)throw Error('QA_C7_LEGACY_IDENTITY_PRECISION_LIMITED');object(x,FIELDS);const fields={};for(const f of FIELDS){const token=numeric.get(x)?.[f];if(token===undefined)fail();fields[f]=decimal(token,f.endsWith('_ns'));}v[k]={schema:SCHEMA,fields};validate(v[k]);
  }else walk(x);}if(v.schema===SCHEMA)validate(v);}
 walk(result);return result;
}
module.exports=Object.freeze({SCHEMA,FIELDS,validate,capture,same,sameStats,stable,bounded,pid,startTime,parse,validateTree});
