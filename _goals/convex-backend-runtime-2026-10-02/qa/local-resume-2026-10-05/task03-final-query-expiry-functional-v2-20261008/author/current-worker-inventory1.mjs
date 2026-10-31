// Current AST registration inventory; historical compose/receipt files remain immutable.
import ts from 'typescript';import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';
const destination=process.argv[2];if(!destination)throw Error('owned output directory required');const endpoints=[];
for(const module of ['admin','graphSync','governance']){
 const file=`convex-dev/${module}.ts`,source=await readFile(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
 for(const statement of ast.statements)if(ts.isVariableStatement(statement)&&statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))for(const item of statement.declarationList.declarations){
  if(!item.initializer||!ts.isCallExpression(item.initializer))continue;const kind=item.initializer.expression.getText(ast);
  if(['query','mutation','internalQuery','internalMutation','action','internalAction'].includes(kind))endpoints.push({path:module+':'+item.name.getText(ast),kind,visibility:kind.startsWith('internal')?'internal':'public'});
 }
}
if(endpoints.length!==25||endpoints.filter(e=>e.visibility==='public').length!==7)throw Error('worker registration contract changed');
await mkdir(destination,{recursive:true});await writeFile(path.join(destination,'public-path-inventory.json'),JSON.stringify({version:1,completeness:{unresolved:[]},endpoints},null,2)+'\n');
