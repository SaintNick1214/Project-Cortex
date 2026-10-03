import assert from 'node:assert/strict';
import { authDenial, rememberPlatformWire } from './native-engine.mjs';
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
console.log(JSON.stringify({scope:'OFFLINE_AUTH_CLASSIFIER',status:'PASS',negativeControls:15+malformed,arbitraryDeniedAccepted:false,privateDiagnosticAccepted:false,dispatches:0,signatures:0}));
