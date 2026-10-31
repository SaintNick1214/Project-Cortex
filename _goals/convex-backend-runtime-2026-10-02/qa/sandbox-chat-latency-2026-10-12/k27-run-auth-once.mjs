import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { K27_PINS as p, requireK27ReadyPins } from './k27-collector-pins.mjs';
requireK27ReadyPins();
const options = { '--session':p.sessionId,'--name':p.name,'--id':p.targetId,'--expires-at':p.expiresAt,'--source-commit':p.sourceCommit,'--manifest-sha256':p.manifestSha256,'--sdk-archive-sha256':p.sdkArchiveSha256,'--image-id':p.imageId,'--owner-control':1 };
const child = spawn(process.execPath,[fileURLToPath(new URL('./k27-auth-close-qualification-readonly.mjs',import.meta.url)),...Object.entries(options).flatMap(([k,v])=>[k,String(v)])],{env:process.env,stdio:'inherit'});
child.once('error',()=>{process.exitCode=1;});
child.once('close',code=>{process.exitCode=code??1;});
