import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const root=process.cwd(),base='53421e78165fb12a16a11faa19db9372fa8ddfd4',q='_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const previous=p=>execFileSync('git',['show',`${base}:${p}`],{cwd:root,encoding:'utf8'});
const current=p=>fs.readFileSync(p,'utf8');
const parse=s=>ts.createSourceFile('input.ts',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
function tokens(text){const s=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text),out=[];let k;while((k=s.scan())!==ts.SyntaxKind.EndOfFileToken)out.push([k,s.getTokenText()]);return JSON.stringify(out);}
function declaration(s,name){const file=parse(s);for(const st of file.statements){if(st.name?.text===name)return st.getText(file);if(ts.isVariableStatement(st))for(const d of st.declarationList.declarations)if(d.name.getText(file)===name)return d.initializer.getText(file);}throw Error('Missing declaration '+name);}
function method(s,c,name){const file=parse(s),cls=file.statements.find(st=>ts.isClassDeclaration(st)&&st.name?.text===c),m=cls?.members.find(m=>m.name?.getText(file)===name);if(!m?.body)throw Error('Missing method');return {body:m.body.getText(file),statements:m.body.statements.map(st=>st.getText(file))};}
const rows=[];
function compare(label,oldText,newText){const before=tokens(oldText),after=tokens(newText);if(before!==after)throw Error('Equivalence failed: '+label);rows.push({label,equal:true,beforeTokenSha256:hash(before),afterTokenSha256:hash(after)});}
const memory='convex-dev/runtimeMemory.ts';compare('Original explicit single-text remember Action remains identical',declaration(previous(memory),'remember'),declaration(current(memory),'remember'));
const api='src/memory/index.ts',oldMethod=method(previous(api),'MemoryAPI','remember'),newMethod=method(current(api),'MemoryAPI','remember');
if(!newMethod.statements[0].includes('managedRemember'))throw Error('Missing intentional ordinary dispatch');
compare('Original explicit operator remember body is retained after the new ordinary dispatch',oldMethod.statements.join('\n'),newMethod.statements.slice(1).join('\n'));
const repo='convex-dev/runtimeMemoryRepository.ts';compare('Every original finalDelivery loop predicate/order remains; only final authority context is deliberately original-unscoped',method(previous(repo),'ConvexMemoryRepository','checkDelivery').body.replace('deliveryExpiresAt(this.ctx, this.reference, deadlines)','deliveryExpiresAt(finalAuthorityCtx, this.reference, deadlines)'),method(current(repo),'ConvexMemoryRepository','checkDelivery').body);
const origin=previous('convex-dev/runtimeAgentQueryEmbedding.ts'),refusal=current('convex-dev/runtimeMemoryRefusal.ts');for(const name of ['Refusal','boundedRefusal','throwRefusal'])compare('Pure '+name+' is extracted unchanged',declaration(origin,name),declaration(refusal,name));
const schema='convex-dev/runtimeMemorySchema.ts',oldFile=parse(previous(schema)),newFile=parse(current(schema));
function props(file){const st=file.statements.find(st=>ts.isVariableStatement(st)&&st.declarationList.declarations.some(d=>d.name.getText(file)==='runtimeMemoryTables'));return st.declarationList.declarations.find(d=>d.name.getText(file)==='runtimeMemoryTables').initializer.properties;}
const oldProps=props(oldFile),newProps=props(newFile),additions=newProps.filter(p=>!oldProps.some(o=>o.name.getText(oldFile)===p.name.getText(newFile))).map(p=>p.name.getText(newFile));
if(JSON.stringify(additions)!==JSON.stringify(['runtimeMemoryCaptureConversations','runtimeMemoryCaptures','runtimeMemoryCaptureMessages']))throw Error('Unexpected schema additions');
for(const old of oldProps){const item=newProps.find(p=>p.name.getText(newFile)===old.name.getText(oldFile));compare('Existing memory schema '+old.name.getText(oldFile)+' retained',old.getText(oldFile),item.getText(newFile));}
const freeze=JSON.parse(fs.readFileSync(`${q}/ordinary-memory-source-freeze.json`,'utf8'));
for(const file of freeze.files)if(hash(fs.readFileSync(file.path))!==file.sha256)throw Error('Freeze drift '+file.path);
const result={baseline:base,comparisons:rows,comparisonsPassed:rows.length,addedTables:additions,files:freeze.files,nativeClaims:false};fs.writeFileSync(`${q}/ordinary-memory-equivalence.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:rows.length,addedTables:additions,receiptSha256:hash(fs.readFileSync(`${q}/ordinary-memory-equivalence.json`))}));
