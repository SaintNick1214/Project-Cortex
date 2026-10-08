import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const qa=path.dirname(new URL(import.meta.url).pathname),configPath=path.join(qa,'jest.current.json'),resolverPath=path.join(qa,'current-resolver.cjs');
const original=fs.readFileSync(configPath),resolver=fs.readFileSync(resolverPath),results=[];
for(const kind of ['historical-mapper','historical-resolver','historical-test','env-loader','resolver-source']){
 try{
 const c=JSON.parse(original);
 if(kind==='historical-mapper')c.moduleNameMapper={'^.*runtimeGateway$':path.join(qa,'historical/catalog/convex-dev/runtimeGateway.ts')};
 if(kind==='historical-resolver')c.resolver=path.join(qa,'historical/resolver.cjs');
 if(kind==='historical-test')c.testMatch=[path.join(qa,'historical/catalog/tests/unit/runtime/gateway-dispatch.test.ts')];
 if(kind==='env-loader')c.setupFiles=['dotenv/config'];
 if(kind==='resolver-source')fs.writeFileSync(resolverPath,Buffer.concat([resolver,Buffer.from('\n// hostile source drift\n')]));
 else fs.writeFileSync(configPath,JSON.stringify(c,null,2)+'\n');
 const argv=[path.join(qa,'run-current.mjs'),'--list'],startUTC=new Date().toISOString();const r=spawnSync(process.execPath,argv,{cwd:'/workspace/Project-Cortex',env:process.env,encoding:'utf8',timeout:10000});
 assert.equal(r.status,1);assert.ok(!r.stdout.includes('CURRENT_PREIMPORT_GUARD_PASS'));
 results.push({kind,argv:[process.execPath,...argv],cwd:'/workspace/Project-Cortex',startUTC,endUTC:new Date().toISOString(),exitCode:r.status,stdout:r.stdout,stderr:r.stderr,deniedBeforeJest:true});
 }finally{fs.writeFileSync(configPath,original);fs.writeFileSync(resolverPath,resolver);}
}
// The actual current resolver independently rejects historical resolution before import.
const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);const resolve=require(resolverPath);
assert.throws(()=>resolve('wrong',{basedir:'/workspace/Project-Cortex',defaultResolver:()=>path.join(qa,'historical/catalog/convex-dev/runtimeGateway.ts')}),/HISTORICAL_CURRENT_IMPORT_DENIED/);
results.push({kind:'actual-current-resolver-historical-denial',deniedBeforeImport:true});
fs.writeFileSync(path.join(qa,'current-guard-results.json'),JSON.stringify({passed:results.length,results},null,2)+'\n');console.log(JSON.stringify({passed:results.length,actualRunnerPrechildDenials:5,actualResolverDenials:1}));
