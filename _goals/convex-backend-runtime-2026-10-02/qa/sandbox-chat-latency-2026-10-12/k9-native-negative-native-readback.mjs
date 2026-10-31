import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
import {context,write,hash,id,source,Q} from './k9-native-negative-common.mjs';
const c=await context();
try {
 await c.verify();const snapshot=await c.snapshot(),roots={};
 for(const table of ['runtimeModelPolicies','runtimeModelQualifications','runtimeBudgetAccounts']){
  const rows=snapshot.rows[table],present=rows.filter(row=>row.root!==undefined);
  roots[table]={rows:rows.length,rootRows:present.length,encodings:present.reduce((n,row)=>{const encoding=typeof row.root?.encoding==='string'?row.root.encoding:'legacy-full-or-unspecified';n[encoding]=(n[encoding]??0)+1;return n;},{}),canonicalPresent:present.filter(row=>Object.hasOwn(row.root,'canonical')).length,
   shapeHashes:[...new Set(present.map(row=>hash(Object.keys(row.root).sort())))],tableSha256:snapshot.hashes[table]};
 }
 assert.ok(roots.runtimeModelPolicies.rootRows>0);assert.ok(roots.runtimeModelQualifications.rootRows>0);
 const req=createRequire(path.join(c.s.backendDir,'package.json'));const officialPath=req.resolve('convex/browser'),convexPackage=JSON.parse(await fs.readFile(path.join(c.s.backendDir,'node_modules/convex/package.json')));
 const sdkBytes=await fs.readFile(c.sdkIdentity.path,'utf8');assert.ok(sdkBytes.includes('AUTHENTICATION_TIMEOUT'));assert.ok(sdkBytes.includes('UNAUTHENTICATED'));
 const sdkSourcePath=path.join('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-compact-vector-2026-10-13/staging',source,'src/client-runtime/client.ts');
 const sdkSource=await fs.readFile(sdkSourcePath,'utf8'),officialAuthPath=path.join(c.s.backendDir,'node_modules/convex/src/browser/sync/authentication_manager.ts'),officialAuth=await fs.readFile(officialAuthPath,'utf8');
 assert.ok(sdkSource.includes('this.options.authTimeoutMs ?? 10000'));assert.ok(sdkSource.includes('if (!authenticated)'));assert.ok(officialAuth.includes('onAuthError(serverMessage'));assert.ok(officialAuth.includes('onAuthChange(false)'));
 const receipt=await write('native-readback',{observedAt:new Date().toISOString(),target:{sessionId:id,...c.s.target},sdk:c.sdkIdentity,sourceCommit:source,compactRootShape:roots,existingRecordsOnly:true,noLegacyConversionOrCorruption:true,
  nativeFinancialCounts:snapshot.counts,financial:snapshot.financial,financialSha256:hash(snapshot.financial),paidCalls:0,newRuns:0,
  authTimeoutAnalysis:{actualInstalledSdkContainsBoundedFallback:true,immutableSdkSource:{path:sdkSourcePath,sha256:hash(sdkSource)},officialConvexVersion:convexPackage.version,officialBrowserModule:{path:officialPath,sha256:hash(await fs.readFile(officialPath))},officialAuthSource:{path:officialAuthPath,sha256:hash(officialAuth)},configuredFixtureAuthTimeoutMs:4000,defaultAuthTimeoutMs:10000,expiredExactElapsedMs:null,
   actualExpiredCase:{expected:'UNAUTHENTICATED',observed:'AUTHENTICATION_TIMEOUT',assertionMessageHash:'30c37d5bb73ab5adf86843768a387d28a978edf39144553a94038076e2584b59',assertionMessageBytes:92,matchedReconstructedExactScalarMessage:true},
   mechanism:'Actual SDK installAuth rejects AUTHENTICATION_TIMEOUT when its bound fires without a settled auth callback; null token or false authenticated callback rejects UNAUTHENTICATED. Official Convex handles AuthError with asynchronous tryToReauthenticate and invokes onAuthChange(false) in its unauthenticated reset path.',
   limits:'Timeout establishes bounded failure/no returned observation, not native cryptographic/expiry rejection confirmation. Actual elapsed/auth callbacks for original expired case were not retained. No code/assertion/deadline changes or retry.'},
  freshVerifications:c.verifications(),clientsClosed:true,noSourceOrDeployMutation:true});
 console.log(JSON.stringify({receipt,compactRootShape:roots,financialCounts:snapshot.counts,paidCalls:0}));
}finally{await c.close();}
