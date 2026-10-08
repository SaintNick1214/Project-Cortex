import assert from 'node:assert/strict';
import {canonical,parseCanonical} from '../convex/validate.ts';
let reads=0;const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){reads++;return 'DUMMY'}});assert.throws(()=>canonical(getter));assert.equal(reads,0);assert.equal(canonical({z:'DUMMY',a:'DUMMY'}),'{"a":"DUMMY","z":"DUMMY"}');
const actual=canonical({'2':'DUMMY-two','10':'DUMMY-ten'}),expected='{"10":"DUMMY-ten","2":"DUMMY-two"}';let correctAccepted;try{parseCanonical(expected);correctAccepted=true}catch{correctAccepted=false}console.log(JSON.stringify({scope:'DUMMY_CANONICAL_JS_UTF16_ORDER',actual,expected,correctAccepted,getterReads:reads}));assert.equal(actual,expected,'object keys must be sorted lexicographically by JS UTF16 units');
