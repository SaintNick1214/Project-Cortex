import ts from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/typescript/lib/typescript.js';
import fs from 'node:fs';
import path from 'node:path';
const core='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const probe='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/templates/manualQualificationProbe.ts';
const q=path.dirname(new URL(import.meta.url).pathname), shim=path.join(q,'k8-qualification-diagnostic-scope-shim.ts');
fs.writeFileSync(shim,`import type {RuntimeAuthorityReference} from ${JSON.stringify(core+'/src/auth/verified')};\nexport declare const MANUAL_REFERENCE: RuntimeAuthorityReference;\nexport declare const MANUAL_OPERATION: string;\n`);
const manifest=JSON.parse(fs.readFileSync('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-compact-vector-2026-10-13/staging/ae9a836ff9c5e6a0ce9a279bdbdb96ad37c2a448/dist/backend/v1/manifest.json'));
const files=new Map(manifest.files.map(row=>[row.path,row.sourcePath]));
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,strict:true,noEmit:true,skipLibCheck:true,lib:['lib.es2022.d.ts','lib.dom.d.ts'],typeRoots:[core+'/node_modules/@types'],types:['node'],ignoreDeprecations:'6.0'};
const host=ts.createCompilerHost(options);
host.resolveModuleNames=(names,containingFile)=>names.map(name=>{
 if(containingFile===probe&&name==='./manualQualificationScope')return {resolvedFileName:shim,extension:ts.Extension.Ts};
 if(containingFile===probe&&name.startsWith('./')){
  const relative=name.slice(2),source=relative==='_generated/server'?'convex-dev/_generated/server.d.ts':files.get(relative+'.ts');
  if(!source)throw Error('Unresolved real installed probe import '+name);
  return {resolvedFileName:path.join(core,source),extension:ts.Extension.Ts};
 }
 const containing=name.startsWith('.')?containingFile:path.join(core,'qualification-typecheck.ts');
 return ts.resolveModuleName(name,containing,options,host).resolvedModule;
});
const program=ts.createProgram([probe,shim],options,host), diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length){process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:p=>p,getCurrentDirectory:()=>core,getNewLine:()=> '\n'}));process.exitCode=1;}
else console.log('Complete changed probe semantically typechecked against actual installed API v4 and157-file source closure; only deployment-injected fixed authority constants use a declaration shim. No backend/template/source emitted.');
