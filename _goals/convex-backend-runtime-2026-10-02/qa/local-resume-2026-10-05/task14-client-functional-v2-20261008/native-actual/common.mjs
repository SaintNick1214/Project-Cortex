import assert from 'node:assert/strict';import {dirname,join} from 'node:path';import {readFile,writeFile} from 'node:fs/promises';
import {openOwnedContext as open13,q as q13,sha,denied,waitUntil} from '../../task13-media-functional-v2-20261008/native-actual/common.mjs';
export {q13,sha,denied,waitUntil};export const q=dirname(new URL(import.meta.url).pathname);
export async function openOwnedContext(){const c=await open13(),ui=JSON.parse(await readFile(join(q13,'ui14-public-fixture1.json')));assert.equal(ui.tenantId,c.tenantId);assert.equal(ui.memorySpaceId,c.memorySpaceId);const publish=async(name,value)=>{assert.match(name,/^[a-z0-9][a-z0-9._-]*$/);await writeFile(join(q,name+'.json'),c.redact(JSON.stringify(value,null,2))+'\n',{flag:'wx'});};return{...c,ui,publish};}
