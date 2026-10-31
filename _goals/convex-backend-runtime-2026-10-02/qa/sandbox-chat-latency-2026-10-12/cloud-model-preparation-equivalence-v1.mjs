import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import ts from '../../../../../node_modules/typescript/lib/typescript.js';
const root=new URL('../../../../../',import.meta.url), q=new URL('./',import.meta.url);
const before=await fs.readFile(new URL('cloud-model-preparation-preimage.ts',q),'utf8');
const after=await fs.readFile(new URL('convex-dev/runtimeAgent.ts',root),'utf8');
const parse=text=>ts.createSourceFile('runtimeAgent.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const old=parse(before), current=parse(after), printer=ts.createPrinter({removeComments:true});
const print=(node,source)=>printer.printNode(ts.EmitHint.Unspecified,node,source);
const digest=text=>createHash('sha256').update(text).digest('hex');
const variables=source=>new Map(source.statements.filter(ts.isVariableStatement).flatMap(statement=>statement.declarationList.declarations.map(declaration=>[declaration.name.getText(source),declaration])));
const functions=source=>new Map(source.statements.filter(ts.isFunctionDeclaration).map(node=>[node.name.text,node]));
const oldVariables=variables(old), newVariables=variables(current), oldFunctions=functions(old), newFunctions=functions(current), checks=[];
function equal(name,original,node,originalSource=old,newSource=current){const a=print(original,originalSource), b=print(node,newSource);assert.equal(b,a,name);checks.push({name,passed:true,normalizedSha256:digest(a)});}
const property=(declaration,name)=>declaration.initializer.arguments[0].properties.find(node=>node.name?.getText()==name);
for(const name of ['beginOperation','completedModelStep','startOperation']){
  const original=oldVariables.get(name), replacement=newVariables.get(name);
  equal(name+' original handler body',property(original,'handler').initializer.body,newFunctions.get(name+'Handler').body);
  equal(name+' original native args',property(original,'args'),property(replacement,'args'));
  equal(name+' original registration kind',original.initializer.expression,replacement.initializer.expression);
}
for(const [name,node]of oldFunctions)if(name!=='modelStepHandler')equal(name+' original body',node.body,newFunctions.get(name).body);
for(const [name,node]of oldVariables)if(!['refs','beginOperation','completedModelStep','startOperation'].includes(name))equal(name+' unchanged registration/value',node,newVariables.get(name));
const originalRefs=oldVariables.get('refs').initializer.properties, changedRefs=newVariables.get('refs').initializer.properties;
for(const node of originalRefs)equal('refs.'+node.name.getText(old),node,changedRefs.find(item=>item.name.getText(current)===node.name.getText(old)));
const suffix=(node,source)=>node.body.statements.slice(node.body.statements.findIndex(statement=>statement.getText(source).startsWith('const base = createBackendGatewayComposition'))).map(statement=>print(statement,source)).join('\n');
assert.equal(suffix(newFunctions.get('modelStepHandler'),current),suffix(oldFunctions.get('modelStepHandler'),old));
checks.push({name:'complete modelStep suffix from Gateway construction through finally',passed:true,normalizedSha256:digest(suffix(oldFunctions.get('modelStepHandler'),old))});
const newEndpoint=newVariables.get('prepareModelOperation');
assert.equal(newEndpoint.initializer.expression.getText(current),'internalMutation');
assert.equal(property(newEndpoint,'args').initializer.getText(current),'{ ...agentAttempt, ordinal: v.number() }');
checks.push({name:'new endpoint internal-only and original Attempt+ordinal inputs',passed:true});
await fs.writeFile(new URL('cloud-model-preparation-equivalence.json',q),JSON.stringify({beforeSha256:digest(before),afterSha256:digest(after),checks,passed:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,checks:checks.length,beforeSha256:digest(before),afterSha256:digest(after)}));
