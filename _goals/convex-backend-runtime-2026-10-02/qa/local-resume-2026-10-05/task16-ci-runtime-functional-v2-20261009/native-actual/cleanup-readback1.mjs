/** No cleanup replay. Read actual scope disposition after the source operator's missing-null output error. */
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openCi,q,root} from './ci-common1.mjs';
const c=await openCi(),results=[];
const hosts=JSON.parse(await readFile(join(c.pointer.privateDirectory,'hosts.json'))),fixtures=await import(pathToFileURL(join(root,'scripts/ci/runtime-fixtures.mjs')));
for(const host of hosts){await c.verify(host.kind,host.kind+'-cleanup-readback-target-verified1');const{ConvexHttpClient}=await import(pathToFileURL(join(host.path,'node_modules/convex/dist/esm/browser/index.js'))),{makeFunctionReference}=await import(pathToFileURL(join(host.path,'node_modules/convex/dist/esm/server/index.js'))),plan=fixtures.fixturePlan(c.env,host.kind);
 for(const[role,identity]of Object.entries(plan.identities)){const client=new ConvexHttpClient(c.credentials[host.kind].url,{logger:false});client.setAuth(fixtures.issueFixtureToken(c.env,host.kind,role));try{const session=await client.mutation(makeFunctionReference('runtimeClient:session'),{tenantId:identity.tenantId,memorySpaceId:identity.memorySpaceId});results.push({kind:host.kind,role,status:'CURRENT_AUTHORITY',tenantId:session.tenantId,principalId:session.principalId});}catch(error){results.push({kind:host.kind,role,status:'DENIED',code:error.data?.code??'UNTYPED_ERROR',error:c.redact(error.message).slice(0,1000)});}}
}
await c.publish('cleanup-readback1',{status:'READONLY_PARTIAL_CLEANUP_DISPOSITION_CAPTURED',results,cleanupMutationsByDiagnostic:0,modelCalls:0,noAuthorityRestoration:true});console.log(JSON.stringify({status:'READONLY_CLEANUP_DISPOSITION_CAPTURED',results:results.map(({kind,role,status,code})=>({kind,role,status,code}))}));
