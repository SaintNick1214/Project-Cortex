import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const copy=path.join(base,'subject-copy');
const {compose}=await import(pathToFileURL(path.join(copy,'current-compose.mjs')));
const dest=path.join(copy,'file-symlink-destination');
fs.mkdirSync(path.join(dest,'replica/convex-dev'),{recursive:true});
const target=path.join(base,'owned-overwrite-target.ts');const pre='export const ownedReviewSentinel = true;\n';
fs.writeFileSync(target,pre);fs.symlinkSync(target,path.join(dest,'replica/convex-dev/schema.ts'));
let error;try{compose(dest)}catch(e){error=String(e)}
const after=fs.readFileSync(target);const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(hash(pre)===hash(after))throw new Error('Expected symlink overwrite was not reproduced');
console.log(JSON.stringify({name:'replica preexisting file symlink is followed by copyFileSync before native probe',status:'DEFECT_REPRODUCED',scope:'OWNED_REVIEW_ONLY',beforeBytes:pre,beforeSHA256:hash(pre),afterSHA256:hash(after),matchesPinnedCurrentSchema:hash(after)==='b95bdd8b643b9d8d7f3d6ed2770181cff15e116110af3b3648bb4492e58495c2',error,scratchRetained:fs.existsSync(path.join(dest,'replica'))},null,2));
