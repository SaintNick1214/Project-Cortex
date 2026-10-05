import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
const root='/workspace/Project-Cortex';const qa=path.join(root,'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-historical-catalog-preparation-c1');
const queue=['@convex-dev/ai-sdk-provider','ai','@ai-sdk/openai','@ai-sdk/openai-compatible','zod','convex','@jest/globals','ts-jest'];const packages=new Map();
function locate(name,from=root+'/package.json'){
 const require=createRequire(from);let entry;try{entry=require.resolve(name+'/package.json');}catch{entry=require.resolve(name);}
 let folder=path.dirname(entry);while(folder!=='/') {const p=path.join(folder,'package.json');if(fs.existsSync(p)){const meta=JSON.parse(fs.readFileSync(p,'utf8'));if(meta.name===name)return {folder,meta};}folder=path.dirname(folder);}throw Error('MISSING_PACKAGE:'+name);
}
const seeds=queue.map(name=>locate(name));
for(let i=0;i<seeds.length;i++){
 const {folder,meta}=seeds[i];if(packages.has(folder))continue;packages.set(folder,meta);
 for(const name of Object.keys(meta.dependencies??{}))seeds.push(locate(name,path.join(folder,'package.json')));
}
const files=[];function visit(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true})){if(item.name==='node_modules')continue;const p=path.join(folder,item.name);if(item.isDirectory())visit(p);else if(item.isFile()&&/\.(?:js|cjs|mjs|json)$/.test(p)){
 const b=fs.readFileSync(p);const relative=path.relative(root,p);const snap=path.join(qa,'official-preimages',relative);fs.mkdirSync(path.dirname(snap),{recursive:true});fs.writeFileSync(snap,b);files.push({path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),snapshot:path.relative(qa,snap)});
}}}
for(const folder of packages.keys())visit(folder);
const out={scope:'HISTORICAL_OFFICIAL_RUNTIME_PINS_ONLY',packages:[...packages].map(([folder,meta])=>({folder,name:meta.name,version:meta.version})),files};fs.writeFileSync(path.join(qa,'official-catalog.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({packages:packages.size,files:files.length,bytes:files.reduce((n,x)=>n+x.bytes,0)}));
