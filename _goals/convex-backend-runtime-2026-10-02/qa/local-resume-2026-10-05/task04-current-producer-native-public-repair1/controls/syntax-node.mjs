import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const D=path.dirname(path.dirname(fileURLToPath(import.meta.url))),rows=[];
function visit(p){for(const name of fs.readdirSync(p).sort()){const q=path.join(p,name),s=fs.lstatSync(q);if(s.isDirectory())visit(q);else if(q.endsWith('.mjs')||q.endsWith('.cjs')){try{const code=fs.readFileSync(q,'utf8');if(q.endsWith('.mjs'))new vm.SourceTextModule(code,{identifier:q});else new vm.Script(code,{filename:q});rows.push({path:path.relative(D,q),status:'PASS'});}catch(e){rows.push({path:path.relative(D,q),status:'FAIL',error:String(e)});}}}}
visit(path.join(D,'source'));
const output={scope:'STATIC_SOURCE_SYNTAX_NO_EVALUATION_NO_LINKING',count:rows.length,rows};
fs.writeFileSync(path.join(D,'controls/js-syntax-results1.json'),JSON.stringify(output)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({count:rows.length,failures:rows.filter(r=>r.status!=='PASS')}));
if(rows.some(r=>r.status!=='PASS'))process.exitCode=1;
