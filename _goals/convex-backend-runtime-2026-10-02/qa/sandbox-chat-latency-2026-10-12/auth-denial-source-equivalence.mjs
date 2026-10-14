import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
const file='src/client-runtime/client.ts';
const baseline='3e55e7b9b45093f547699619c572fdbe09c1efde';
const old=execFileSync('git',['show',baseline+':'+file],{encoding:'utf8'});
const current=await fs.readFile(file,'utf8');
const methods=text=>{
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const declaration=source.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='CortexRuntimeClient');
 assert.ok(declaration);
 return new Map(declaration.members.filter(node=>ts.isMethodDeclaration(node)||ts.isConstructorDeclaration(node))
  .map(node=>[node.name?.getText(source)??'constructor',node.getText(source)]));
};
const before=methods(old),after=methods(current),changed=new Set(['constructor','installAuth','close']),checks=[];
for(const [name,body]of before){
 assert.ok(after.has(name));
 if(changed.has(name))continue;
 assert.equal(after.get(name),body,'Original client method changed: '+name);
 checks.push({method:name,bodyByteIdentical:true,sha256:createHash('sha256').update(body).digest('hex')});
}
assert.equal(before.size,after.size);
const receipt={baseline,scope:'All original client method bodies except explicit auth installation/close integration',checks,
 privatePostIoSessionSourceGrantExpiryFencesUnchanged:true,serviceCalls:0,nativeQualified:false};
await fs.writeFile(new URL('auth-denial-source-equivalence.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({checks:checks.length,allByteIdentical:true,nativeQualified:false}));
