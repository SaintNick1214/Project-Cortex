import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = process.cwd();
const builders = new Set(['query','mutation','action','httpAction','internalQuery','internalMutation','internalAction']);
const rows = [], anomalies = [];
const list = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.name === '_generated' ? [] : e.isDirectory() ? list(path.join(d,e.name)) : /\.[cm]?[jt]s$/.test(e.name) ? [path.join(d,e.name)] : []);
for (const file of list(path.join(root,'convex-dev')).sort()) {
  const body=fs.readFileSync(file,'utf8'), sf=ts.createSourceFile(file,body,ts.ScriptTarget.Latest,true);
  const imported = new Map(), namespaces = new Set(), registrations = new Map(), exports = new Map();
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s) && /(?:_generated\/server|convex\/server)$/.test(s.moduleSpecifier.text)) {
      const bindings=s.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const x of bindings.elements) if (builders.has(x.propertyName?.text ?? x.name.text)) imported.set(x.name.text,x.propertyName?.text ?? x.name.text);
      if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    }
    if (ts.isVariableStatement(s) && s.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)) for (const d of s.declarationList.declarations) if(ts.isIdentifier(d.name)) exports.set(d.name.text,d.name.text);
    if (ts.isExportDeclaration(s)) {
      if(s.moduleSpecifier) anomalies.push({file:path.relative(root,file),line:sf.getLineAndCharacterOfPosition(s.getStart()).line+1,kind:'external-reexport-needs-separate-review'});
      if(s.exportClause && ts.isNamedExports(s.exportClause)) for(const x of s.exportClause.elements) exports.set(x.propertyName?.text ?? x.name.text,x.name.text);
    }
  }
  const builder = n => ts.isIdentifier(n) ? imported.get(n.text) : ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && namespaces.has(n.expression.text) && builders.has(n.name.text) ? n.name.text : undefined;
  function visit(n) {
    if(ts.isCallExpression(n) && builder(n.expression)) {
      const b=builder(n.expression); let p=n.parent;
      while(p && !ts.isVariableDeclaration(p) && !ts.isSourceFile(p)) p=p.parent;
      const name=p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) ? p.name.text : null;
      const config=n.arguments[0];
      const handler=config && ts.isObjectLiteralExpression(config) ? config.properties.find(x=>ts.isPropertyAssignment(x) && x.name.getText(sf)==='handler')?.initializer : null;
      const calls=[];
      function hc(x) { if(ts.isCallExpression(x)) calls.push(x.expression.getText(sf)); ts.forEachChild(x,hc); }
      if(handler) hc(handler);
      const first=handler?.body && ts.isBlock(handler.body) ? handler.body.statements[0]?.getText(sf) : handler?.body?.getText(sf);
      const row={name,kind:b,visibility:b.startsWith('internal')?'internal':'public',file:path.relative(root,file),line:sf.getLineAndCharacterOfPosition(n.getStart()).line+1,firstStatement:first?.slice(0,250),calls:[...new Set(calls)]};
      if(name) registrations.set(name,row); else anomalies.push({...row,kind:'unbound-registration'});
    }
    ts.forEachChild(n,visit);
  }
  visit(sf);
  for(const [name,row] of registrations) { if(!exports.has(name)) anomalies.push({...row,kind:'unexported-registration'}); else rows.push({...row,endpoint:path.relative(path.join(root,'convex-dev'),file).replace(/\.[cm]?[jt]s$/,'')+':'+exports.get(name)}); }
}
const counts={}; for(const r of rows) counts[r.kind]=(counts[r.kind]??0)+1;
const modules={}; for(const r of rows) (modules[r.file]??={public:0,internal:0})[r.visibility]++;
const out={scope:'Current product AST registration inventory. Calls/first statements are observations, not proof of authorization.',at:new Date().toISOString(),registrationCount:rows.length,counts,modules,anomalies,rows};
fs.writeFileSync(new URL('./current-registration-inventory1.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({registrationCount:rows.length,counts,modules,anomalies},null,2));
