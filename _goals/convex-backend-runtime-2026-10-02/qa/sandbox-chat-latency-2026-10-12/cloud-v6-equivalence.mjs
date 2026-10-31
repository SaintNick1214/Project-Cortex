import ts from 'typescript';import fs from 'node:fs';import cp from 'node:child_process';import crypto from 'node:crypto';import path from 'node:path';
const Q=path.dirname(new URL(import.meta.url).pathname),file='convex-dev/runtimeAgent.ts';
const old=cp.execFileSync('git',['show','f7c906b2888a410deb81c6a181e4863ca148e43c:'+file],{encoding:'utf8'}),next=fs.readFileSync(file,'utf8');
const parse=s=>ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true),a=parse(old),b=parse(next),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const declaration=(sf,name)=>sf.statements.find(x=>ts.isVariableStatement(x)&&x.declarationList.declarations.some(d=>d.name.getText(sf)===name)||ts.isFunctionDeclaration(x)&&x.name?.text===name);
const checks=[];
for(const name of ['executePreparedModelStep','resolveModelOperationHandler','executeTurn','executeTurnV2','executeTurnV3','executeTurnV4','executeTurnV5','turnStepV5Handler','onWorkflowComplete','onInitialWorkflowComplete','prepareTurnModelHandler','prepareResolvedModelOperationHandler','admitPreparedModelOperationHandler','admitModelOperationHandler','freshWorkflow','freshWorkflowComplete']){
 const before=declaration(a,name)?.getText(a),after=declaration(b,name)?.getText(b);if(!before||!after||before!==after)throw Error('Historical declaration changed: '+name);checks.push({name,beforeHash:hash(before),afterHash:hash(after),byteIdentical:true});
}
for(const name of ['startContext','contextBarrier','endInterrupted']){
 const decl=declaration(a,name).declarationList.declarations[0],obj=decl.initializer.arguments[0],arrow=obj.properties.find(p=>p.name.getText(a)==='handler').initializer;
 const after=declaration(b,name+'Handler').body.getText(b),before=arrow.body.getText(a);if(before!==after)throw Error('Original helper body changed: '+name);checks.push({name: name+' original body extraction',beforeHash:hash(before),afterHash:hash(after),byteIdentical:true});
}
const beforeCtx=declaration(a,'executionContext').body.getText(a),afterCtx=declaration(b,'executionContext').body.getText(b);if(beforeCtx!==afterCtx)throw Error('executionContext changed');checks.push({name:'executionContext export seam',beforeHash:hash(beforeCtx),afterHash:hash(afterCtx),byteIdentical:true});
const output={baseline:'f7c906b2888a410deb81c6a181e4863ca148e43c',sourceSha256:hash(next),checks,passed:true,scope:'Literal historical registered bodies and original helper predicates; new V6 branches require behavioral tests.'};fs.writeFileSync(path.join(Q,'cloud-v6-equivalence.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,sourceSha256:output.sourceSha256}));
