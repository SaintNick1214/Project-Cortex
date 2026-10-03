import assert from 'node:assert/strict';
import { assertSanitizedHostFailure } from './lifecycle.mjs';
assertSanitizedHostFailure(Object.freeze({code:'HOST_TOKEN_FETCH_FAILED',attemptId:1}));
const malformed=[{code:'HOST_TOKEN_FETCH_FAILED',attemptId:1,message:'fixture private provider diagnostic'},{code:'HOST_TOKEN_FETCH_FAILED',attemptId:1,token:'fixture-private-token'},{code:'HOST_TOKEN_FETCH_FAILED',attemptId:1,cause:'private cause'},{code:'HOST_TOKEN_FETCH_FAILED',attemptId:0},{code:'HOST_TOKEN_FETCH_FAILED',attemptId:NaN},{code:'INVALID_HOST_TOKEN',attemptId:1},{code:'HOST_TOKEN_FETCH_FAILED'},'HOST_TOKEN_FETCH_FAILED'];
for(const value of malformed)assert.throws(()=>assertSanitizedHostFailure(value&&typeof value==='object'?Object.freeze(value):value));
assert.throws(()=>assertSanitizedHostFailure({code:'HOST_TOKEN_FETCH_FAILED',attemptId:1}));
console.log(JSON.stringify({scope:'OFFLINE_HOST_CALLBACK_PAYLOAD',status:'PASS',malformedRejected:9,serviceCalls:0,signatures:0}));
