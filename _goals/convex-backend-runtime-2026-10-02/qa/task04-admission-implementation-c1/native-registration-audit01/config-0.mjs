import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const root=process.cwd();const require=createRequire(path.join(root,"package.json"));const ts=require("typescript");
const file="convex-dev/runtimeModelPolicy.ts";const source=fs.readFileSync(file,"utf8");const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
const rows=[];
for(const statement of ast.statements){
 if(!ts.isVariableStatement(statement)||!statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))continue;
 for(const declaration of statement.declarationList.declarations){
  if(!declaration.initializer||!ts.isCallExpression(declaration.initializer))continue;
  const builder=declaration.initializer.expression.getText(ast);
  if(!["internalMutation","internalQuery","action","query","mutation","internalAction"].includes(builder))continue;
  assert.ok(builder.startsWith("internal"));rows.push({path:"runtimeModelPolicy:"+declaration.name.getText(ast),kind:builder==="internalQuery"?"query":"mutation",visibility:"internal"});
 }
}
assert.equal(rows.length,13);assert.equal(new Set(rows.map(row=>row.path)).size,13);assert.ok(!/v\.any\s*\(/.test(source));
const candidates=["convex-dev/runtimePolicySchema.ts","convex-dev/runtimeModelPolicyBootstrap.ts","convex-dev/runtimeModelPolicy.ts"];
const forbidden=[];
for(const target of candidates){const text=fs.readFileSync(target,"utf8");assert.ok(!/from\s+["'](?:ai|@convex-dev\/ai-sdk-provider|openai|@anthropic-ai)/.test(text));assert.ok(!/getServiceToken|globalThis\.fetch|ConvexClient/.test(text));}
fs.writeFileSync(process.argv[2],JSON.stringify({status:"PASS_OFFLINE_SOURCE_ONLY",newRegistrations:rows,publicAliases:forbidden,actualPublication:"NOT_RUN",allCurrentFoundationInventory:"requires parent fresh refresh"},null,2)+"\n",{flag:"wx"});console.log("13 exact internal registrations; no provider/token/network/public builder imports; actual publication NOT_RUN");
