import {writeFile,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext} from './common.mjs';
const c=await openOwnedContext();try{
 const path=join(c.handoff.privateDirectory,'task09-owner-jwt.txt');await writeFile(path,c.token('cortex-owner'),{mode:0o600});await chmod(path,0o600);
 await c.publish('browser-token-metadata1',{path,mode:'0600',subject:'cortex-owner',scope:{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId},tokenValuesPrinted:false,lifetimeSeconds:7200});console.log(JSON.stringify({path,mode:'0600',valuesPrinted:false}));
}finally{await c.close();}
