import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext as openBase,q} from './common.mjs';
export {q,sha,waitUntil,denied,observeRun} from './common.mjs';
export async function openOwnedContext(){const base=await openBase(),scope=JSON.parse(await readFile(join(q,'installed-financial-scope.json'),'utf8'));
 return {...base,ownerSubject:scope.ownerSubject,tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,owner:base.http(scope.ownerSubject),scope};}
