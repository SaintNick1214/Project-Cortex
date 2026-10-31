import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const here=new URL('.',import.meta.url).pathname;
const prior=join(here,'../../task08-memory-functional-v2-20261008/native-actual');
// Source reuse in this QA namespace; original receipts and scripts stay unchanged.
let pack=await readFile(join(prior,'package-current3.mjs'),'utf8');
pack=pack.replace("{q,root,sha}","{qa as q,root,sha}").replaceAll('task08-pack','task09-pack').replaceAll('current3','current1');
await writeFile(join(here,'package-current1.mjs'),pack);
let deploy=await readFile(join(prior,'deploy-fixture.mjs'),'utf8');
deploy=deploy.replace('{openOwnedContext,q}', '{openOwnedContext,qa as q}');
await writeFile(join(here,'deploy-fixture.mjs'),deploy);
let install=await readFile(join(prior,'install-current3.mjs'),'utf8');
install=install.replace('{readFile,writeFile,access}', '{readFile,writeFile,access,mkdir}')
.replace('{openOwnedContext,q,sha}', '{openOwnedContext,qa as q,sha}')
.replace("join(q,'installed-task08-source-manifest2.json')","join(q,'../../task08-memory-functional-v2-20261008/native-actual/installed-task08-source-manifest3.json')")
.replaceAll('current3','current1').replaceAll('installed-task08','installed-task09');
const from="if(!prior||prior.sha256!==file.sha256)await writeFile(join(functions,file.path),bytes);";
const to="if(!prior||prior.sha256!==file.sha256){await mkdir(dirname(join(functions,file.path)),{recursive:true});await writeFile(join(functions,file.path),bytes);}";
install=install.replace(from,to);
const begin=install.indexOf(" for(const [source,destination]");
const end=install.indexOf(" for(const pin of preserved)",begin);
if(begin<0||end<0)throw Error('QA script shape changed');
install=install.slice(0,begin)+" const updated=schema;\n"+install.slice(end);
await writeFile(join(here,'install-current1.mjs'),install);
