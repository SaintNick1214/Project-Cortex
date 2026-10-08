import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const q=dirname(new URL(import.meta.url).pathname),pointer=JSON.parse(await readFile(join(q,'fixture-pointer.json')));
const state=JSON.parse(await readFile(join(pointer.privateDirectory,'state.json'))),host=join(pointer.privateDirectory,'project');
assert.equal(state.operation,pointer.operation);assert.equal(state.teamId,325340);assert.equal(state.production,false);
assert.equal(state.retired,undefined);assert.ok(state.projectId);assert.ok(state.deploymentName);
const baseline=JSON.parse(await readFile(join(q,'baseline-packages.json'))),sha=b=>createHash('sha256').update(b).digest('hex');
for(const item of [baseline.sdk,baseline.cli])assert.equal(sha(await readFile(item.file)),item.sha256);
await mkdir(host,{mode:0o700});await chmod(host,0o700);
const pkg={name:'task10-embedding-native-host',private:true,type:'module',dependencies:{'@cortexmemory/sdk':'file:'+baseline.sdk.file,'@cortexmemory/cli':'file:'+baseline.cli.file,convex:'1.46.0'},devDependencies:{typescript:'~6.0.3','@types/node':'^26.6.4'}};
await writeFile(join(host,'package.json'),JSON.stringify(pkg,null,2)+'\n');
async function install(label){
 const npm='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
 const args=[npm,'install','--ignore-scripts','--no-audit','--no-fund','--registry','https://registry.npmjs.org'];
 const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(k)))};env.PATH=dirname(process.execPath)+':'+env.PATH;
 const began=Date.now(),child=spawn(process.execPath,args,{cwd:host,env,detached:true,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='',closed=false,timedOut=false;const signals=[];
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const stop=signal=>{if(closed)return;try{process.kill(-child.pid,signal);signals.push(signal);}catch(error){if(error.code!=='ESRCH')throw error;}};
 const timer=setTimeout(()=>{timedOut=true;stop('SIGTERM');},120000),hard=setTimeout(()=>{if(timedOut)stop('SIGKILL');},125000);
 let exit;try{exit=await new Promise((ok,no)=>{child.once('error',no);child.once('close',(code,signal)=>{closed=true;ok({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);}
 await writeFile(join(q,label+'.stdout.log'),stdout);await writeFile(join(q,label+'.stderr.log'),stderr);
 await writeFile(join(q,label+'.json'),JSON.stringify({args,cwd:host,pid:child.pid,...exit,timedOut,elapsedMs:Date.now()-began,deadlineMs:120000,signals,childClosed:closed,node:process.version,npm:'12.2.0'},null,2)+'\n');
 assert.equal(exit.code,0);assert.equal(timedOut,false);
}
await install('host-npm-install1');
const manifest=JSON.parse(await readFile(join(host,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json')));
assert.equal(sha(await readFile(join(host,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'))),baseline.sdk.manifestSha256);
pkg.dependencies={...pkg.dependencies,...manifest.dependencies};await writeFile(join(host,'package.json'),JSON.stringify(pkg,null,2)+'\n');await install('host-explicit-dependencies1');
const keys=generateKeyPairSync('rsa',{modulusLength:2048}),kid='task10-embedding-'+state.operation;
const jwk={...keys.publicKey.export({format:'jwk'}),kid,alg:'RS256',use:'sig'};
const auth={issuer:'https://cortex-task10-embedding.example',applicationID:'cortex-task10-embedding',kid,
 jwks:'data:application/json;base64,'+Buffer.from(JSON.stringify({keys:[jwk]})).toString('base64'),hostIssuer:'https://unrelated-task10-host.example',hostAudience:'unrelated-host'};
await writeFile(join(pointer.privateDirectory,'jwt-private.pem'),keys.privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600});
await writeFile(join(pointer.privateDirectory,'auth.json'),JSON.stringify(auth),{mode:0o600});
const functions='custom/backend';await mkdir(join(host,functions),{recursive:true});
const files={
 'convex.json':JSON.stringify({functions:functions+'/',node:{externalPackages:[]}},null,2)+'\n',
 [functions+'/tsconfig.json']:JSON.stringify({compilerOptions:{allowJs:true,strict:true,moduleResolution:'Bundler',jsx:'react-jsx',skipLibCheck:true,allowSyntheticDefaultImports:true,target:'ESNext',lib:['ES2021','dom'],forceConsistentCasingInFileNames:true,module:'ESNext',isolatedModules:true,noEmit:true,types:['node']},include:['./**/*'],exclude:['_generated']},null,2)+'\n',
 [functions+'/schema.ts']:'import {defineSchema,defineTable} from "convex/server";\nimport {v} from "convex/values";\nexport default defineSchema({hostNotes:defineTable({owner:v.string(),text:v.string()}).index("by_owner",["owner"])},{schemaValidation:true});\n',
 [functions+'/convex.config.ts']:'import {defineApp} from "convex/server";\nconst app=defineApp();\nexport default app;\n',
 [functions+'/auth.config.ts']:'import type {AuthConfig} from "convex/server";\nexport default {providers:['+JSON.stringify({type:'customJwt',issuer:auth.hostIssuer,jwks:auth.jwks,algorithm:'RS256',applicationID:auth.hostAudience})+']} satisfies AuthConfig;\n',
 [functions+'/host.ts']:`import {mutation,query} from "./_generated/server";\nimport {v,ConvexError} from "convex/values";\nconst owner=async(ctx:any)=>{const i=await ctx.auth.getUserIdentity();if(!i||i.issuer!==${JSON.stringify(auth.hostIssuer)})throw new ConvexError("HOST_AUTH_REQUIRED");return i.subject;};\nexport const seed=mutation({args:{text:v.string()},handler:async(ctx,args)=>{const subject=await owner(ctx);const row=await ctx.db.query("hostNotes").withIndex("by_owner",q=>q.eq("owner",subject)).unique();if(row)return {noteId:row._id};return {noteId:await ctx.db.insert("hostNotes",{owner:subject,text:args.text})};}});\nexport const authenticated=query({args:{},handler:async(ctx)=>{const subject=await owner(ctx);return ctx.db.query("hostNotes").withIndex("by_owner",q=>q.eq("owner",subject)).collect();}});\n`,
 [functions+'/hostNode.ts']:`"use node";\nimport {action} from "./_generated/server";\nimport {ConvexError} from "convex/values";\nexport const health=action({args:{},handler:async(ctx)=>{const i=await ctx.auth.getUserIdentity();if(!i||i.issuer!==${JSON.stringify(auth.hostIssuer)})throw new ConvexError("HOST_AUTH_REQUIRED");return {runtime:"node",subject:i.subject};}});\n`,
 [functions+'/http.ts']:'import {httpRouter} from "convex/server";\nimport {httpAction} from "./_generated/server";\nconst http=httpRouter();\nhttp.route({path:"/host-health",method:"GET",handler:httpAction(async()=>new Response("host-route-preserved",{status:200}))});\nexport default http;\n',
};
for(const [name,body] of Object.entries(files))await writeFile(join(host,name),body);
await writeFile(join(q,'host-originals.json'),JSON.stringify(Object.fromEntries(Object.entries(files).map(([name,body])=>[name,{content:body,sha256:sha(body)}])),null,2)+'\n');
await writeFile(join(q,'host-assembled.json'),JSON.stringify({projectId:state.projectId,host,functionsDirectory:functions+'/',baselineManifest:baseline.sdk.manifestSha256,ownStockHostOnly:true,task10CandidateDeployed:false,inference:false},null,2)+'\n');
console.log(JSON.stringify({status:'HOST_ASSEMBLED',projectId:state.projectId,baselineManifest:baseline.sdk.manifestSha256}));
