// Import-aware current registration/alias inventory. Does not edit source or historical receipts.
import ts from 'typescript';import {readFile,readdir,writeFile}from'node:fs/promises';import path from'node:path';
const modules=new Map();const builders=new Set(['query','mutation','action','httpAction','internalQuery','internalMutation','internalAction']);
for(const entry of await readdir('convex-dev',{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith('.ts')){
 const file='convex-dev/'+entry.name,text=await readFile(file,'utf8'),ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),imports=new Map(),variables=new Map(),exports=new Set();
 for(const node of ast.statements){
  if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)&&node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings))for(const item of node.importClause.namedBindings.elements)imports.set(item.name.text,{module:node.moduleSpecifier.text,name:(item.propertyName??item.name).text});
  if(ts.isVariableStatement(node))for(const item of node.declarationList.declarations)if(ts.isIdentifier(item.name)&&item.initializer){variables.set(item.name.text,item.initializer);if(node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))exports.add(item.name.text);}
 }
 modules.set(path.basename(entry.name,'.ts'),{ast,imports,variables,exports,file});
}
function resolve(module,name,seen=new Set()){
 const key=module+':'+name;if(seen.has(key))return;seen.add(key);const m=modules.get(module);if(!m)return;const node=m.variables.get(name);
 if(node&&ts.isCallExpression(node)&&ts.isIdentifier(node.expression)){const imported=m.imports.get(node.expression.text);if(imported?.module==='./_generated/server'&&builders.has(imported.name))return{kind:imported.name,origin:key,line:m.ast.getLineAndCharacterOfPosition(node.getStart(m.ast)).line+1};}
 if(node&&ts.isIdentifier(node))return resolve(module,node.text,seen);
 if(!node){const imported=m.imports.get(name);if(imported?.module.startsWith('./'))return resolve(path.basename(imported.module,'.ts'),imported.name,seen);}
}
const registrations=[];for(const[module,m]of modules)for(const name of m.exports){const result=resolve(module,name);if(result)registrations.push({endpoint:module+':'+name,...result,visibility:result.kind.startsWith('internal')?'internal':'public',alias:result.origin!==module+':'+name});}
registrations.sort((a,b)=>a.endpoint.localeCompare(b.endpoint));
const initial=JSON.parse(await readFile(new URL('read-inventory1.json',import.meta.url),'utf8'));
const mapped=initial.converted.map(row=>({...row,actual:registrations.find(r=>r.endpoint===row.endpoint)}));
if(mapped.some(row=>row.actual?.kind!=='mutation'))throw Error('Fresh registration map incomplete');
const remainingPublicQueries=registrations.filter(row=>row.visibility==='public'&&row.kind==='query').map(row=>({...row,disposition:
 row.endpoint==='runtimeClient:signal'?'Root-owned opaque change signal':row.endpoint.startsWith('runtimeClient:')?'Root-owned fresh session successor pending':
 /^(?:a2a|factHistory):/.test(row.endpoint)||['agents:computeStats','memorySpaces:getStats'].includes(row.endpoint)?'Always-denying unavailable capability':'Requires explicit current classification'}));
const value={version:2,functionsDirectory:'convex-dev',converted: mapped,convertedAliases:registrations.filter(r=>r.alias&&mapped.some(m=>m.endpoint===r.origin)),
 internalFinalDelivery:registrations.find(r=>r.endpoint==='runtimeMemory:finalDelivery'),remainingPublicQueries,registrations,
 scope:'Current registration kinds and same-module/imported aliases; internal queries remain guarded by actual final admission/checkpoint/commit/delivery mutations. Root-owned session/signal/watchers close separately.'};
await writeFile(new URL('read-inventory2.json',import.meta.url),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({mapped:mapped.length,aliases:value.convertedAliases.map(r=>r.endpoint),remainingPublicQueries:remainingPublicQueries.map(r=>r.endpoint),registrations:registrations.length}));
