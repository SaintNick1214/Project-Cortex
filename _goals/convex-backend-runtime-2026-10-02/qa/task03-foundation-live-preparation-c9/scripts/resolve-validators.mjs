import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { preparation, repo } from './guard.mjs';
const cache = new Map();
function moduleAt(path) {
 if (cache.has(path)) return cache.get(path);
 const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
 const bindings=new Map(),imports=new Map();
 for(const stmt of source.statements) {
  if(ts.isImportDeclaration(stmt) && stmt.importClause?.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings) && stmt.moduleSpecifier.text.startsWith('.')) {
   const target=resolve(dirname(path),stmt.moduleSpecifier.text)+'.ts';
   for(const item of stmt.importClause.namedBindings.elements) imports.set(item.name.text,{path:target,name:item.propertyName?.text??item.name.text});
  }
  if(ts.isVariableStatement(stmt)) for(const d of stmt.declarationList.declarations) if(ts.isIdentifier(d.name)&&d.initializer) bindings.set(d.name.text,d.initializer);
 }
 const result={source,bindings,imports};cache.set(path,result);return result;
}
function expand(node,path,trail=new Set()) {
 if(ts.isIdentifier(node)) {
  const key=path+':'+node.text;if(trail.has(key))throw Error('cyclic '+key);
  const next=new Set([...trail,key]), mod=moduleAt(path);
  if(mod.bindings.has(node.text))return expand(mod.bindings.get(node.text),path,next);
  if(mod.imports.has(node.text)){const link=mod.imports.get(node.text);return expandIdentifier(link.name,link.path,next);}
  throw Error('unresolved '+key);
 }
 if(ts.isObjectLiteralExpression(node)) {
  const fields={};for(const p of node.properties){
   if(ts.isSpreadAssignment(p))Object.assign(fields,expand(p.expression,path,trail).fields);
   else if(ts.isPropertyAssignment(p))fields[p.name.text]=expand(p.initializer,path,trail);
   else if(ts.isShorthandPropertyAssignment(p))fields[p.name.text]=expand(p.name,path,trail);
   else throw Error('unsupported property');
  }return {type:'object',fields};
 }
 if(ts.isArrayLiteralExpression(node))return {type:'arrayLiteral',items:node.elements.map(n=>expand(n,path,trail))};
 if(ts.isStringLiteral(node)||ts.isNumericLiteral(node))return {type:'literalValue',value:ts.isNumericLiteral(node)?Number(node.text):node.text};
 if(node.kind===ts.SyntaxKind.TrueKeyword||node.kind===ts.SyntaxKind.FalseKeyword)return {type:'literalValue',value:node.kind===ts.SyntaxKind.TrueKeyword};
 if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.getText()==='v')return {type:node.expression.name.text==='object'?'objectValidator':node.expression.name.text,parameters:node.arguments.map(n=>expand(n,path,trail))};
 throw Error('unsupported '+node.getText(moduleAt(path).source));
}
function expandIdentifier(name,path,trail){const mod=moduleAt(path);if(!mod.bindings.has(name))throw Error('missing imported '+name);return expand(mod.bindings.get(name),path,trail);}
const ledger=JSON.parse(readFileSync(resolve(preparation,'path-ledger.json')));
let resolved=0;const unresolved=[];
for(const row of ledger.cases) {
 const path=resolve(repo,row.source),mod=moduleAt(path),name=row.path.split(':')[1],node=mod.bindings.get(name);
 try {
  if(!node||!ts.isCallExpression(node)||!ts.isObjectLiteralExpression(node.arguments[0]))throw Error('registration initializer');
  const args=node.arguments[0].properties.find(p=>ts.isPropertyAssignment(p)&&p.name.text==='args');
  if(!args)throw Error('missing args');
  row.validatorSchema=expand(args.initializer,path);row.argumentsStatus='SHAPE_RESOLVED_SEMANTIC_BINDING_PENDING';resolved++;
 }catch(error){unresolved.push({path:row.path,reason:error.message});}
}
writeFileSync(resolve(preparation,'path-ledger.json'),JSON.stringify({...ledger,validatorResolution:{resolved,unresolved}},null,2)+'\n');
console.log(JSON.stringify({resolved,unresolved}));
