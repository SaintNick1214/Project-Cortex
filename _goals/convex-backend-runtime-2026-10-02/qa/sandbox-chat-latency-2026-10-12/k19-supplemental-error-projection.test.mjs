import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createHash} from 'node:crypto';
const source=fs.readFileSync(new URL('./service-log-snapshot-k19-supplemental-error-classification.mjs',import.meta.url),'utf8');
const parsed=ts.createSourceFile('collector.mjs',source,ts.ScriptTarget.Latest,true);
const variable=name=>parsed.statements.find(statement=>ts.isVariableStatement(statement)&&statement.declarationList.declarations.some(declaration=>declaration.name.getText(parsed)===name)).getText(parsed);
const fn=parsed.statements.find(statement=>ts.isFunctionDeclaration(statement)&&statement.name.text==='consoleErrorMetadata').getText(parsed);
function project(messages,entry={requestId:'0f4e339b907200c3',executionId:'ff0df6bf-c687-4a97-9d4a-d78c0c53d2d6',identifier:'runtimeAgent:turnStepV5',timestamp:123}){
  const hash=text=>createHash('sha256').update(text).digest('hex');
  return new Function('hash','messages','entry','const consoleErrors=[];'+variable('errorClasses')+fn+';consoleErrorMetadata(messages,entry);return consoleErrors;')(hash,messages,entry);
}
test('actual collector recognizes joined tool-result error without retaining private text',()=>{
  const secret='PRIVATE_PROMPT JWT_SECRET PRIVATE_TOOL_PAYLOAD';
  const result=project(['onError','AI_MissingToolResultsError: Tool results are missing. '+secret]);
  assert.equal(result.length,1);assert.equal(result[0].classifications.missingToolResults,true);
  assert.ok(!JSON.stringify(result).includes(secret));assert.match(result[0].sha256,/^[a-f0-9]{64}$/);
});
test('unrelated requests are excluded even when they contain a recognized error',()=>{
  assert.deepEqual(project(['onError','InvalidPromptError: PRIVATE_DATA'],{requestId:'unrelated',executionId:'unrelated'}),[]);
});
test('unrecognized error remains bounded hash metadata, not a fabricated classification',()=>{
  const result=project(['onError','PRIVATE_UNKNOWN_ERROR']);assert.equal(result.length,1);
  assert.ok(Object.values(result[0].classifications).every(value=>value===false));assert.ok(!JSON.stringify(result).includes('PRIVATE_UNKNOWN_ERROR'));
});
test('trusted source locations are bounded and arbitrary private paths are rejected',()=>{
  const messages=['onError','InvalidPromptError\n at PRIVATE_SECRET_FILE.ts:42:1\n'+Array(20).fill(' at ../../node_modules/ai/src/prompt/convert-to-language-model-prompt.ts:160:11').join('\n')];
  const result=project(messages);assert.equal(result[0].sourceLocations.length,12);
  assert.ok(!JSON.stringify(result).includes('PRIVATE_SECRET_FILE'));assert.equal(result[0].classifications.invalidPrompt,true);
});
test('non-error payloads and arbitrary object fields are never projected',()=>{
  assert.deepEqual(project(['private prompt, not an exception']),[]);
  assert.deepEqual(project([{token:'SECRET_TOKEN',error:'SECRET_ERROR'}]),[]);
});
