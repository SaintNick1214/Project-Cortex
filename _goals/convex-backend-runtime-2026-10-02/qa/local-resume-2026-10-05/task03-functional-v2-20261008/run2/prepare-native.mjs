import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const N=path.dirname(fileURLToPath(import.meta.url)), loc=JSON.parse(fs.readFileSync(path.join(N,'fixture-locator.json')));
const {fixture,scratch,repo}=loc;
const name='anonymous-'+path.basename(fixture);
for(const p of [path.join(fixture,'.convex'),path.join(fixture,'.env.local'),path.join(process.env.HOME,'.convex/anonymous-convex-backend-state',name)]) {
  if(fs.existsSync(p))throw new Error('Disposable local target would reuse existing state');
}
const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
fs.writeFileSync(path.join(scratch,'jwt-private.pem'),pair.privateKey.export({format:'pem',type:'pkcs8'}),{flag:'wx',mode:0o600});
const jwk={...pair.publicKey.export({format:'jwk'}),kid:'functional-v2-rs256',alg:'RS256',use:'sig'};
const jwks='data:text/plain;charset=utf-8;base64,'+Buffer.from(JSON.stringify({keys:[jwk]})).toString('base64');
fs.writeFileSync(path.join(fixture,'convex/auth.config.ts'),`import type { AuthConfig } from 'convex/server';\nexport default {providers:[{type:'customJwt',applicationID:'cortex-task01',issuer:'https://cortex-qualification.invalid',jwks:${JSON.stringify(jwks)},algorithm:'RS256'}]} satisfies AuthConfig;\n`);
const builders=new Set(['query','mutation','action','internalQuery','internalMutation','internalAction','httpAction']);
const files=fs.readdirSync(path.join(repo,'convex-dev')).filter(x=>x.endsWith('.ts')).sort();
const cases=[];
for(const filename of files){
 const body=fs.readFileSync(path.join(repo,'convex-dev',filename),'utf8'),ast=ts.createSourceFile(filename,body,ts.ScriptTarget.Latest,true),aliases=new Map();
 for(const n of ast.statements)if(ts.isImportDeclaration(n)&&/(?:_generated\/server|convex\/server)$/.test(n.moduleSpecifier.text)){
  const b=n.importClause?.namedBindings;if(b&&ts.isNamedImports(b))for(const item of b.elements){const original=item.propertyName?.text??item.name.text;if(builders.has(original))aliases.set(item.name.text,original);}
 }
 for(const n of ast.statements)if(ts.isVariableStatement(n)&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))for(const d of n.declarationList.declarations){
  if(!ts.isIdentifier(d.name)||!d.initializer||!ts.isCallExpression(d.initializer)||!ts.isIdentifier(d.initializer.expression))continue;
  const b=aliases.get(d.initializer.expression.text);if(!b)continue;if(b==='httpAction')throw new Error('Unexpected HTTP action requires separate inventory');
  cases.push({path:filename.slice(0,-3)+':'+d.name.text,kind:b.replace(/^internal/,'').toLowerCase(),visibility:b.startsWith('internal')?'internal':'public',source:'convex-dev/'+filename,line:ast.getLineAndCharacterOfPosition(d.getStart()).line+1});
 }
}
if(cases.length<200||new Set(cases.map(x=>x.path)).size!==cases.length)throw new Error('Current endpoint inventory incomplete');
fs.writeFileSync(path.join(N,'path-ledger.json'),JSON.stringify({cases},null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(N,'fresh-target-preflight.json'),JSON.stringify({status:'PASS',fixture,name,newProjectLocalState:true,legacySameNameAbsent:true,freshRSA:true,privateKeyMode:'0600',production:false,sourceCandidateDigest:loc.candidateDigest,endpointCount:cases.length,public:cases.filter(x=>x.visibility==='public').length,internal:cases.filter(x=>x.visibility==='internal').length},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({stage:'prepared',name,endpointCount:cases.length,privateKeyPublished:false}));
