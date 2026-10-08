import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const preparation=path.dirname(fileURLToPath(import.meta.url));
const loc=JSON.parse(fs.readFileSync(path.join(preparation,'fixture-locator.json')));
export const {repo,fixture,scratch}=loc;
export function canonical(p,base,privateFile=false){
 const resolved=path.resolve(p);assert.ok(resolved===base||resolved.startsWith(base+path.sep));const s=fs.lstatSync(p);assert.ok(!s.isSymbolicLink());
 if(privateFile){assert.ok(s.isFile());assert.equal(s.uid,process.getuid());assert.equal(s.mode&0o777,0o600);}return p;
}
export function livePreflight(){
 const proof=JSON.parse(fs.readFileSync(path.join(preparation,'live-target-verification.json')));
 assert.equal(proof.status,'PASS');assert.equal(proof.production,false);assert.equal(proof.ownedPidLive,true);assert.equal(proof.fixture,fixture);
 const config=JSON.parse(fs.readFileSync(path.join(fixture,'.convex/local/default/config.json')));
 assert.equal(config.deploymentName,'anonymous-'+path.basename(fixture));assert.ok(config.cloudProjectId===undefined||config.cloudProjectId===null);
 assert.ok(Number.isInteger(config.ports.cloud)&&config.ports.cloud>0);assert.ok(typeof config.adminKey==='string'&&config.adminKey.length>20);
 const deploymentUrl='http://127.0.0.1:'+config.ports.cloud;assert.equal(deploymentUrl,proof.url);
 return {target:{deploymentUrl,operation:proof.operation},values:{CONVEX_DEPLOY_KEY:config.adminKey}};
}
export function verifyCodegen(){for(const name of ['api.d.ts','server.d.ts','dataModel.d.ts'])assert.ok(fs.statSync(path.join(fixture,'convex/_generated',name)).isFile());}
