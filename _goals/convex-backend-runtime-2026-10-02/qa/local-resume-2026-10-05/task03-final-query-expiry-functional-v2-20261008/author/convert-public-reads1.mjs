import ts from 'typescript';import{readFile,writeFile,readdir}from'node:fs/promises';
const dir=new URL('./',import.meta.url);
const selected=['agentDefinitions','agents','immutable','memories','runtimeIngestion','runtimeGraph','users','facts','runs','contexts','memorySpaces','sessions','runtimeMemoryContext','conversationSnapshots','runtimeTranscript','governance','mutable','runtimeMemory','conversations','conversationShares','runtimeAgent'];
const retained=new Set(['agents:computeStats','memorySpaces:getStats']);const converted=[];const sourceChanges=[];
for(const name of selected){const path=`convex-dev/${name}.ts`,source=await readFile(path,'utf8'),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true),edits=[];
for(const s of ast.statements)if(ts.isVariableStatement(s)&&s.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))for(const d of s.declarationList.declarations)if(d.initializer&&ts.isCallExpression(d.initializer)&&d.initializer.expression.getText(ast)==='query'){
const endpoint=name+':'+d.name.getText(ast);if(retained.has(endpoint))continue;const e=d.initializer.expression;edits.push({start:e.getStart(ast),end:e.end,value:'mutation'});converted.push({module:name,name:d.name.getText(ast),endpoint,from:'query',to:'mutation'});}
if(!edits.length)continue;
const imp=ast.statements.find(s=>ts.isImportDeclaration(s)&&s.moduleSpecifier.text==='./_generated/server');if(!imp||!ts.isNamedImports(imp.importClause.namedBindings))throw Error(path+' registration import');
const bindings=imp.importClause.namedBindings;const names=bindings.elements.map(e=>e.name.text);if(!names.includes('mutation'))names.push('mutation');if(![...retained].some(n=>n.startsWith(name+':')))names.splice(names.indexOf('query'),1);
edits.push({start:bindings.getStart(ast),end:bindings.end,value:'{ '+names.join(', ')+' }'});
let next=source;for(const e of edits.sort((a,b)=>b.start-a.start))next=next.slice(0,e.start)+e.value+next.slice(e.end);await writeFile(path,next);sourceChanges.push(path);
}
const map=new Set(converted.map(r=>r.module+'.'+r.name));const sdkChanges=[];
async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const name=path+'/'+entry.name;if(entry.isDirectory()){if(name==='src/client-runtime')continue;await walk(name);}else if(name.endsWith('.ts')){
const source=await readFile(name,'utf8'),ast=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true),edits=[];
const visit=n=>{if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='query'&&n.arguments.length){const a=n.arguments[0].getText(ast);const m=/^api\.([A-Za-z]+)\.([A-Za-z]+)$/.exec(a);if(m&&map.has(m[1]+'.'+m[2]))edits.push({start:n.expression.name.getStart(ast),end:n.expression.name.end});}ts.forEachChild(n,visit);};visit(ast);
if(edits.length){let next=source;for(const e of edits.sort((a,b)=>b.start-a.start))next=next.slice(0,e.start)+'mutation'+next.slice(e.end);await writeFile(name,next);sdkChanges.push({path:name,calls:edits.length});}
}}}await walk('src');
await writeFile(new URL('read-inventory1.json',dir),JSON.stringify({version:1,converted,retainedAlwaysUnavailable:[...retained,'a2a:*','factHistory:*'],RootOwned:['runtimeAuth','runtimeClient'],backendFiles:sourceChanges,legacySdkFiles:sdkChanges},null,2)+'\n');console.log(JSON.stringify({converted:converted.length,backendFiles:sourceChanges,legacySdkFiles:sdkChanges}));
