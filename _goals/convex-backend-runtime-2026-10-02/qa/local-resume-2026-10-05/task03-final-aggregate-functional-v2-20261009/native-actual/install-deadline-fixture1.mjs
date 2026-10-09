import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {openNativeContext,q,sha} from './common.mjs';
const c=await openNativeContext();
try {
 await c.verifyTarget('deadline-fixture1-target-verified');
 const installed=JSON.parse(await readFile(join(q,'installed-sdk5-source-manifest.json'))),fn=join(c.host,c.functionsDirectory);
 const overlays=new Map(installed.QAOverlay.map(row=>[row.path,row.sha256]));
 for(const row of installed.files)assert.equal(sha(await readFile(join(fn,row.path))),overlays.get(row.path)??row.sha256,row.path);
 const rootHttp=join(fn,'http.ts'),preimage=await readFile(rootHttp);assert.equal(sha(preimage),installed.preserved.find(row=>row.path==='custom/backend/http.ts').sha256);
 const destination=join(fn,'task03Deadline.ts');let exists=true;try{await access(destination);}catch(error){if(error.code==='ENOENT')exists=false;else throw error;}assert.equal(exists,false);
 await writeFile(join(q,'deadline-fixture1-http-preimage.ts'),preimage,{flag:'wx'});
 const fixture=await readFile(join(q,'task03Deadline.fixture.ts'));await writeFile(destination,fixture,{flag:'wx'});
 const http=preimage.toString().replace('const http=httpRouter();','import { downloadDeadline, uploadDeadline } from "./task03Deadline";\nconst http=httpRouter();');
 assert.notEqual(http,preimage.toString());const final=http.replace('export default http;','http.route({path:"/qa/task03/assets/download",method:"GET",handler:downloadDeadline});\nhttp.route({path:"/qa/task03/assets/upload",method:"POST",handler:uploadDeadline});\nexport default http;');
 assert.notEqual(final,http);await writeFile(rootHttp,final);
 await c.publish('deadline-fixture1-install',{status:'OWNED_QA_FIXTURE_INSTALLED_NOT_DEPLOYED',projectId:c.state.projectId,fixture:{path:destination,sha256:sha(fixture),bytes:fixture.length},httpPreimageSha256:sha(preimage),httpPostimageSha256:sha(final),addedQAOnlyRoutes:['GET /qa/task03/assets/download','POST /qa/task03/assets/upload'],productRoutesAndHostPreserved:true,realRPConceAndRealClock:true,fakeClock:false,providerDispatches:0,restorePending:true});
}finally{await c.close();}
