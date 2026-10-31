import fs from 'node:fs';
const file='verify-packed-backend-export-closure.mjs';
let s=fs.readFileSync(file,'utf8');
s=s.replace("'convex-dev/agentDefinitions.ts'","'convex-dev/runtimeTranscript.ts'");
s=s.replace("const paths=",`function declarationsOf(text,name) {
 const ast=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const names=[]; const endpoints=[];
 for(const statement of ast.statements) {
  if(statement.name&&ts.isIdentifier(statement.name))names.push(statement.name.text);
  if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations) {
   if(!ts.isIdentifier(d.name))continue; names.push(d.name.text);
   if(d.initializer&&ts.isCallExpression(d.initializer)) {
    const called=d.initializer.expression.getText(ast);
    if(['query','mutation','action','internalQuery','internalMutation','internalAction','httpAction','workflow.define'].includes(called))endpoints.push({name:d.name.text,registeredAs:called});
   }
  }
 }
 return {ast,names,endpoints};
}
const paths=`);
s=s.replace("if(sourcePath==='convex-dev/runtimeAuth.ts') for",`const current=declarationsOf(committed.toString(),sourcePath),packedDeclarations=declarationsOf(packed.toString(),row.path);
 assert.deepEqual(packedDeclarations.endpoints,current.endpoints);
 const historical=execFileSync('git',['show','2c8689fac3aca2acf1fb1f46d8b10a87388e95cd:'+sourcePath],{cwd:r,maxBuffer:2*1024*1024});
 assert.deepEqual(current.endpoints,declarationsOf(historical.toString(),sourcePath).endpoints);
 if(sourcePath==='convex-dev/runtimeAuth.ts') {
  for(const name of ['readNativeTranscriptMessages','freshNativeTranscriptReads','NATIVE_TRANSCRIPT_READ_SCOPE_MAX_ENTRIES','NATIVE_TRANSCRIPT_READ_SCOPE_MAX_BYTES'])assert(names.includes(name),name);
  assert(packedDeclarations.names.includes('createNativeTranscriptReader'));
  for(const [name,value] of [['NATIVE_TRANSCRIPT_READ_SCOPE_MAX_ENTRIES',16],['NATIVE_TRANSCRIPT_READ_SCOPE_MAX_BYTES',250000]]) {
   let initializer;
   for(const statement of packedDeclarations.ast.statements)if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)if(d.name.getText()===name)initializer=d.initializer;
   assert(initializer&&ts.isNumericLiteral(initializer));assert.equal(Number(initializer.text),value);
  }
 }
 if(sourcePath==='convex-dev/runtimeAuth.ts') for`);
s=s.replace("exactCommittedExportsPreserved:true", "exactCommittedExportsPreserved:true,registeredEndpoints:current.endpoints,registeredEndpointsUnchangedFromV5:true");
s=s.replace("actualFreshSdkArchive:true", "actualFreshSdkArchive:true,actualTranscriptReaderExportsAndPrivateFactoryPresent:true,transcriptReaderBounds:{entries:16,bytes:250000},registeredEndpointSetsUnchanged:true");
fs.writeFileSync(file,s);
