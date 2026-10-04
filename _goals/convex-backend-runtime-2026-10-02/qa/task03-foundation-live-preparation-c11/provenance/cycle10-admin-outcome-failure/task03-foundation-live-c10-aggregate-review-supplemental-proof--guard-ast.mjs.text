import fs from 'node:fs'; import ts from 'typescript';
const inventory=JSON.parse(fs.readFileSync('work/resume/current-foundation-c10-aggregate-review/current-inventory/public-path-inventory.json'));
const rows=[];
for(const row of inventory.endpoints){
 const text=fs.readFileSync(row.file,'utf8');const ast=ts.createSourceFile(row.file,text,ts.ScriptTarget.Latest,true);let decl;
 for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const candidate of statement.declarationList.declarations) if (candidate.name.getText(ast)===row.path.split(':')[1]) decl=candidate;
 const config=decl?.initializer?.arguments?.[0]; const handler=config?.properties?.find(p=>p.name?.getText(ast)==='handler'); const body=handler?.initializer?.body;
 rows.push({path:row.path,visibility:row.visibility,file:row.file,line:row.line,entry:body?.getText(ast).slice(0,650)??null});
}
if(rows.length!==259||rows.some(r=>r.entry===null))throw Error('Incomplete handler AST');
fs.writeFileSync('work/resume/current-foundation-c10-aggregate-review/guard-entries.json',JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify({entries:rows.length,public:rows.filter(x=>x.visibility==='public').length,internal:rows.filter(x=>x.visibility==='internal').length}));
