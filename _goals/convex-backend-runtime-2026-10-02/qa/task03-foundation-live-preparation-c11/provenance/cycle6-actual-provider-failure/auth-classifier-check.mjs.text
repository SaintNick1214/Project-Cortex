import assert from 'node:assert/strict';
import { authDenial, rememberPlatformWire, opaqueInternalFailure } from './native-engine.mjs';
const admitted=[{version:1,code:'FORBIDDEN',message:'Access denied',retryable:false,outcome:'not_dispatched'},{version:1,code:'UNAUTHENTICATED',message:'Verified identity required',retryable:false,outcome:'not_dispatched'},{code:'FORBIDDEN',message:'Access denied'},{code:'FORBIDDEN',message:'Artifact operation denied.'}];
for(const data of admitted){const error=new Error('native');error.data=data;authDenial(undefined,error);}
let malformed=0;for(const value of admitted){for(const data of [{...value,message:'Private provider memory secret'},{...value,private:'secret'},{...value,version:99},{...value,retryable:true},{...value,outcome:'unknown'}]){const error=new Error('unsupported');error.data=data;assert.throws(()=>authDenial(undefined,error));malformed++;}}
for(const data of ['FORBIDDEN','UNAUTHENTICATED',{code:'FORBIDDEN'},{code:'UNAUTHENTICATED'}]){const error=new Error('unsupported');error.data=data;assert.throws(()=>authDenial(undefined,error));malformed++;}
const wire=JSON.stringify({code:'InvalidAuth',message:'Could not authenticate: JWT issuer not configured'});assert.equal(rememberPlatformWire(401,wire),true);authDenial(undefined,new Error(wire));
const failures=['Private provider diagnostic Unauthenticated memory secret','Unauthenticated','InvalidAuth private diagnostic','Could not authenticate arbitrary backend diagnostic','[CONVEX Q(x:y)] Server Error Uncaught Error: Unauthenticated','ArgumentValidationError InvalidAuth','Could not find public function InvalidAuth'];
for(const text of failures)assert.throws(()=>authDenial(undefined,new Error(text)));
assert.equal(rememberPlatformWire(401,JSON.stringify({code:'InvalidAuth',message:'Server Error Uncaught provider'})),false);
assert.equal(rememberPlatformWire(200,wire),false);assert.equal(rememberPlatformWire(401,JSON.stringify({code:'BadRequest',message:'InvalidAuth'})),false);
for(const data of ['DENIED','PERMISSION_DENIED',{code:'DENIED'},{code:'INVALID_INPUT'},{code:'CAPABILITY_NOT_READY'}]){const error=new Error('unsupported');error.data=data;assert.throws(()=>authDenial(undefined,error));}
const opaque=new Error('fixed opaque failure');opaque.data={version:1,code:'INTERNAL_FAILURE',message:'Memory control failed.',retryable:false,outcome:'not_dispatched'};assert.equal(opaqueInternalFailure(opaque),true);assert.throws(()=>authDenial(undefined,opaque));for(const patch of [{message:'private diagnostic'},{private:'secret'},{outcome:'unknown'},{code:'FORBIDDEN'}]){const malformed=new Error('unsupported');malformed.data={...opaque.data,...patch};assert.equal(opaqueInternalFailure(malformed),false);assert.throws(()=>authDenial(undefined,malformed));}
let legacyStatusPositives=0;for(const code of ['InvalidAuth','Unauthenticated'])for(const status of [400,401,403]){const body=JSON.stringify({code,message:'Synthetic legacy '+code+' '+status});assert.equal(rememberPlatformWire(status,body),true);authDenial(undefined,new Error(body));legacyStatusPositives++;}
let headerNegatives=0;
const headerBody=JSON.stringify({code:'InvalidAuthHeader',message:'Synthetic header rejection'});
assert.throws(()=>authDenial(undefined,new Error(headerBody)));headerNegatives++;
assert.equal(rememberPlatformWire(401,headerBody),true);authDenial(undefined,new Error(headerBody));
for(const status of [0,200,400,403,404,500,560]){const body=JSON.stringify({code:'InvalidAuthHeader',message:'Synthetic wrong status '+status});assert.equal(rememberPlatformWire(status,body),false);assert.throws(()=>authDenial(undefined,new Error(body)));headerNegatives++;}
for(const value of [
 {code:'InvalidAuthHeader',message:'Synthetic extra',private:'extra'},
 {code:'InvalidAuthHeader'}, {message:'Synthetic missing code'},
 {code:'InvalidAuthHeader',message:3}, {code:'InvalidAuthHeader',message:null},
 {code:'UnknownHeader',message:'Synthetic unknown code'},
 {code:3,message:'Synthetic code type'},
 {code:'InvalidAuthHeader',message:'ArgumentValidationError synthetic'},
 {code:'InvalidAuthHeader',message:'Could not find public function synthetic'},
 {code:'InvalidAuthHeader',message:'Server Error synthetic'},
 {code:'InvalidAuthHeader',message:'Uncaught synthetic'},
]){const body=JSON.stringify(value);assert.equal(rememberPlatformWire(401,body),false);assert.throws(()=>authDenial(undefined,new Error(body)));headerNegatives++;}
for(const text of ['InvalidAuthHeader','Synthetic arbitrary InvalidAuthHeader diagnostic','[CONVEX Q(a2a:send)] Server Error '+headerBody,headerBody+' extra']){assert.throws(()=>authDenial(undefined,new Error(text)));headerNegatives++;}
const fakeNative=new Error('Synthetic backend diagnostic');fakeNative.data={code:'InvalidAuthHeader',message:'Synthetic header rejection'};assert.throws(()=>authDenial(undefined,fakeNative));headerNegatives++;
const collisionBody=JSON.stringify({code:'InvalidAuthHeader',message:'Synthetic current response collision'});
assert.equal(rememberPlatformWire(401,collisionBody),true);authDenial(undefined,new Error(collisionBody));
assert.equal(rememberPlatformWire(560,collisionBody),false);assert.throws(()=>authDenial(undefined,new Error(collisionBody)));headerNegatives++;
assert.throws(()=>authDenial(undefined,new Error(collisionBody)));headerNegatives++;
assert.equal(rememberPlatformWire(401,collisionBody),true);authDenial(undefined,new Error(collisionBody));
assert.equal(rememberPlatformWire(403,collisionBody),false);assert.throws(()=>authDenial(undefined,new Error(collisionBody)));headerNegatives++;
assert.equal(rememberPlatformWire(401,collisionBody),true);authDenial(undefined,new Error(collisionBody));
console.log(JSON.stringify({scope:'OFFLINE_AUTH_CLASSIFIER',status:'PASS',originalNegativeControls:20+malformed,observedHeaderNegativeControls:headerNegatives,negativeControls:20+malformed+headerNegatives,observedHeaderPositiveControls:4,legacyStatusPositiveControls:legacyStatusPositives,current401Then560CollisionRejected:true,staleWireRejected:true,fresh401Recovery:true,arbitraryDeniedAccepted:false,privateDiagnosticAccepted:false,opaqueFailureIsAuthDenial:false,dispatches:0,signatures:0}));
