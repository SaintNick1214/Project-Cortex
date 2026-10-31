import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import ts from 'typescript';
const root=process.cwd(),q=path.join(root,'_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12'),receipts=[];
for(const name of ['runtimeTranscript','runtimeAgent']){
 const before=fs.readFileSync(path.join(q,'native-transcript-read-before-'+name+'.ts'),'utf8');
 const source=before.replace(/from (["'])(\.[^"']+)\1/g,(_all,_quote,relative)=>{
  const absolute=path.resolve(root,'convex-dev',relative);
  const file=name==='runtimeAgent'&&relative==='./runtimeTranscript'?path.join(q,'native-transcript-read-original-runtimeTranscript.mjs'):['.ts','.js','/index.ts'].map(ext=>absolute+ext).find(file=>fs.existsSync(file));
  if(!file)throw Error('Missing control import '+relative);return 'from '+JSON.stringify(file);
 });
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const output=path.join(q,'native-transcript-read-original-'+name+'.mjs');fs.writeFileSync(output,js);receipts.push({name,beforeSha256:crypto.createHash('sha256').update(before).digest('hex'),controlSha256:crypto.createHash('sha256').update(js).digest('hex'),onlyTransformation:'Erased TypeScript + resolved original relative module paths; Agent points to original Transcript control'});
}
fs.writeFileSync(path.join(q,'native-transcript-read-original-controls.json'),JSON.stringify(receipts,null,2)+'\n');
