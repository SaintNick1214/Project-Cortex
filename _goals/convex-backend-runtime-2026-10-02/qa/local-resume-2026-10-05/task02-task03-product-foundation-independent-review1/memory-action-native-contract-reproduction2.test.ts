import { describe, expect, it } from '@jest/globals';
import { getFunctionName } from 'convex/server';
import * as auth from '../../../../../convex-dev/runtimeAuth';
import * as memories from '../../../../../convex-dev/memories';
import { harness } from '../../../../../tests/unit/runtimeEndpointAuth/sharedfixtures';
import fs from 'node:fs';
import path from 'node:path';
type Native = { _handler: (ctx: unknown,args: unknown)=>Promise<unknown>; exportArgs(): string };
const registrations: Record<string, unknown> = {
  'runtimeAuth:authorize': auth.authorize, 'runtimeAuth:recheck': auth.recheck,
  'memories:keywordSearchMemories': memories.keywordSearchMemories,
  'memories:fetchMemoriesByIds': memories.fetchMemoriesByIds,
};
const results: unknown[] = [];
describe('independent authorized action native argument contract', () => {
  it('forwards only native declared reference fields through every internal call', async () => {
    const h=harness(); const own=await h.provisionScope(); await h.seedData('memories',own,'same-id');
    const calls: unknown[]=[];
    const ctx={runQuery: async (ref: Parameters<typeof getFunctionName>[0], args: Record<string,unknown>) => {
      const name=getFunctionName(ref), n=registrations[name] as Native;
      const schema=JSON.parse(n.exportArgs()) as {value:Record<string,{fieldType:{type:string,value:Record<string,unknown>}}>};
      const declared=schema.value.reference?.fieldType;
      const reference=args.reference as Record<string,unknown>|undefined;
      const extra=declared && reference ? Object.keys(reference).filter(key=>!Object.hasOwn(declared.value,key)) : [];
      calls.push({name,referenceKeys:reference?Object.keys(reference).sort():[],extra});
      if(extra.length) throw new Error('Native object argument has extra fields: '+extra.sort().join(','));
      return await n._handler(h.ctx,args);
    }};
    let outcome:unknown,error:unknown;
    try { outcome=await (memories.search as unknown as Native)._handler(ctx,{memorySpaceId:'space-a',query:'private'}); }
    catch(e) { error=e; }
    const row={expected:'authorized search succeeds with one owned result',calls,outcome,error:error instanceof Error?error.message:String(error)};
    results.push(row);
    fs.writeFileSync(path.join(new URL('.',import.meta.url).pathname,'memory-action-native-contract-raw2.json'),JSON.stringify(results,null,2)+'\n');
    expect(error).toBeUndefined(); expect(outcome).toHaveLength(1);
  });
});
