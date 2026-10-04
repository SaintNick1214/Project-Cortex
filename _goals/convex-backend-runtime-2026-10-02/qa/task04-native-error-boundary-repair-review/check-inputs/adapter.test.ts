import {describe,it,expect} from '@jest/globals';
import {ConvexError} from 'convex/values';
import {domainControl} from './adapter-source';
import {canonicalModelJson,assertModelRequestIdentity,resolveModelPolicy} from '/workspace/Project-Cortex/src/domain/model-policy';
function thrown(f:()=>unknown){try{f();}catch(e){return e;}throw new Error('expected throw');}
describe('fresh descriptor and source-owned adapter investigations',()=>{
 it.each(['INVALID_INPUTX: private','INVALID_INPUT:private',' INVALID_INPUT: private','XINVALID_INPUT: private','INVALID_INPUT\n: private','BUDGET_EXCEEDED: private','FORBIDDEN: private','UNCERTAIN_OUTCOME: private','OTHER: private'])('closed anchored code refuses %s',message=>{const e=new Error(message);expect(thrown(()=>domainControl(()=>{throw e;}))).toBe(e);});
 it('Error subclass source-looking message stays original',()=>{class ForeignError extends Error{} const e=new ForeignError('INVALID_INPUT: private'); expect(thrown(()=>domainControl(()=>{throw e;}))).toBe(e);});
 it('inherited message stays original',()=>{const e=new Error();expect(thrown(()=>domainControl(()=>{throw e;}))).toBe(e);});
 it('getter metadata never executes',()=>{let reads=0;const e=new Error();Object.defineProperty(e,'message',{get(){reads++;return 'INVALID_INPUT: private';}});expect(thrown(()=>domainControl(()=>{throw e;}))).toBe(e);expect(reads).toBe(0);});
 it('descriptor trap preserves original proxy identity',()=>{const e=new Proxy(new Error('INVALID_INPUT: private'),{getOwnPropertyDescriptor(){throw new Error('POLICY_DENIED: trap');}});expect(thrown(()=>domainControl(()=>{throw e;}))).toBe(e);});
 it('typed source-looking error retains data and identity',()=>{const e=new ConvexError({code:'INVALID_INPUT',attemptState:'uncertain',outcome:'uncertain',nested:{charged:80}});expect(thrown(()=>domainControl(()=>{throw e;}))).toBe(e);expect(e.data).toEqual({code:'INVALID_INPUT',attemptState:'uncertain',outcome:'uncertain',nested:{charged:80}});});
 it('actual canonical cycles produce sanitized uncertain envelope',()=>{const x:any={secret:'private-value'};x.self=x;const e:any=thrown(()=>domainControl(()=>canonicalModelJson(x),'uncertain'));expect(e).toBeInstanceOf(ConvexError);expect(e.data).toEqual({version:1,code:'INVALID_INPUT',message:'Model operation control failed.',retryable:false,outcome:'uncertain'});});
 it('actual PURE trap unknown cause retained',()=>{const cause=new Error('upstream private-value');const x=new Proxy({},{getPrototypeOf(){throw cause;}});expect(thrown(()=>domainControl(()=>canonicalModelJson(x)))).toBe(cause);});
 it('actual identity conflict equal hashes and distinct canonicals sanitized',()=>{const e:any=thrown(()=>domainControl(()=>assertModelRequestIdentity({hash:'same',canonical:'secret-a'},{hash:'same',canonical:'secret-b'}),'uncertain'));expect(e.data).toEqual({version:1,code:'IDEMPOTENCY_CONFLICT',message:'Model operation control failed.',retryable:false,outcome:'uncertain'});});
 it('actual resolver invalid shape produces source code',()=>{const e:any=thrown(()=>domainControl(()=>resolveModelPolicy({})));expect(e.data.code).toBe('INVALID_INPUT');expect(e.data.message).toBe('Model operation control failed.');});
});
