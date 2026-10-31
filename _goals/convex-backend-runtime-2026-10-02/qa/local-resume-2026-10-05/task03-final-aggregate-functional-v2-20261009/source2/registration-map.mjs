// Read-only product analysis. Writes only this source2 evidence directory.
import ts from 'typescript';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const output = path.join(root, '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-final-aggregate-functional-v2-20261009/source2');
const roots = (await readdir(path.join(root, 'convex-dev'))).filter(n => n.endsWith('.ts')).map(n => path.join(root, 'convex-dev', n));
const program = ts.createProgram(roots, { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true, skipLibCheck: true, noEmit: true });
const checker = program.getTypeChecker();
const builders = new Set(['query','mutation','action','httpAction','internalQuery','internalMutation','internalAction']);
const rel = filename => path.relative(root, filename).replaceAll(path.sep, '/');
const location = node => ({ file: rel(node.getSourceFile().fileName), line: node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1 });
const local = node => /^(convex-dev|src)\//.test(rel(node.getSourceFile().fileName)) && !rel(node.getSourceFile().fileName).includes('/node_modules/');
function unalias(symbol) { const seen = new Set(); while (symbol && symbol.flags & ts.SymbolFlags.Alias && !seen.has(symbol)) { seen.add(symbol); symbol = checker.getAliasedSymbol(symbol); } return symbol; }
function symbolAt(node) { return unalias(checker.getSymbolAtLocation(node)); }
function peel(node) { while (node && (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression; return node; }
function declarations(node) { const symbol = symbolAt(node); return symbol?.getDeclarations() ?? []; }
function callable(node) {
  for (const decl of declarations(node)) {
    if (!local(decl)) continue;
    if ((ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl) || ts.isConstructorDeclaration(decl)) && decl.body) return decl;
    if ((ts.isVariableDeclaration(decl) || ts.isPropertyAssignment(decl)) && decl.initializer) {
      const init = peel(decl.initializer);
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return init;
    }
  }
}
function resolveRegistration(symbol, seen = new Set()) {
  symbol = unalias(symbol); if (!symbol || seen.has(symbol)) return; seen.add(symbol);
  for (const decl of symbol.getDeclarations() ?? []) {
    if (!ts.isVariableDeclaration(decl) || !decl.initializer) continue;
    const init = peel(decl.initializer);
    if (ts.isIdentifier(init) || ts.isPropertyAccessExpression(init)) { const resolved = resolveRegistration(symbolAt(init), seen); if (resolved) return resolved; }
    if (!ts.isCallExpression(init)) continue;
    const imported = symbolAt(init.expression);
    const builder = imported?.getName();
    if (builders.has(builder) && imported.getDeclarations()?.some(d => /convex-dev\/_generated\/server\.(?:d\.)?ts$/.test(rel(d.getSourceFile().fileName)))) {
      const origin = `${path.basename(decl.getSourceFile().fileName, '.ts')}:${decl.name.getText()}`;
      let handler = init.arguments[0];
      if (handler && ts.isObjectLiteralExpression(handler)) handler = handler.properties.find(p => p.name?.getText() === 'handler');
      if (handler && ts.isPropertyAssignment(handler)) handler = peel(handler.initializer);
      if (handler && (ts.isIdentifier(handler) || ts.isPropertyAccessExpression(handler))) handler = callable(handler);
      return { kind: builder, origin, registration: init, handler };
    }
  }
}
const registered = new Map();
for (const file of roots) {
  const sf = program.getSourceFile(file); const symbol = checker.getSymbolAtLocation(sf); if (!symbol) continue;
  for (const exported of checker.getExportsOfModule(symbol)) {
    const result = resolveRegistration(exported); if (!result) continue;
    const endpoint = `${path.basename(file, '.ts')}:${exported.getName()}`;
    registered.set(endpoint, { endpoint, ...result, visibility: result.kind.startsWith('internal') ? 'internal' : 'public', alias: endpoint !== result.origin });
  }
}
function staticStrings(node, env = new Map(), seen = new Set()) {
  node=peel(node); if(!node||seen.has(node))return [];seen=new Set(seen);seen.add(node);
  if(ts.isStringLiteralLike(node))return [node.text];
  if(ts.isIdentifier(node)&&env.has(node.text))return env.get(node.text);
  if(ts.isConditionalExpression(node))return [...new Set([...staticStrings(node.whenTrue,env,seen),...staticStrings(node.whenFalse,env,seen)])];
  if(ts.isTemplateExpression(node)) {
    let values=[node.head.text];
    for(const span of node.templateSpans){const parts=staticStrings(span.expression,env,seen);if(!parts.length)return [];values=values.flatMap(value=>parts.map(part=>value+part+span.literal.text));}
    return values;
  }
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken)return staticStrings(node.left,env,seen).flatMap(a=>staticStrings(node.right,env,seen).map(b=>a+b));
  if(ts.isCallExpression(node)) {
    if(symbolAt(node.expression)?.getName()==='makeFunctionReference')return staticStrings(node.arguments[0],env,seen);
    const fn=callable(node.expression);
    if(fn){const bindings=new Map(env);fn.parameters.forEach((parameter,i)=>{if(ts.isIdentifier(parameter.name))bindings.set(parameter.name.text,staticStrings(node.arguments[i],env,seen));});
      const returns=[];if(fn.body&&ts.isBlock(fn.body)){for(const item of fn.body.statements)if(ts.isReturnStatement(item)&&item.expression)returns.push(item.expression);}else if(fn.body)returns.push(fn.body);
      return [...new Set(returns.flatMap(value=>staticStrings(value,bindings,seen)))];}
  }
  for(const decl of declarations(node))if((ts.isVariableDeclaration(decl)||ts.isPropertyAssignment(decl)||ts.isParameter(decl))&&decl.initializer){const values=staticStrings(decl.initializer,env,seen);if(values.length)return values;}
  return [];
}
function rpcReference(node, seen = new Set()) {
  node = peel(node); if (!node || seen.has(node)) return; seen.add(node);
  const values=staticStrings(node).filter(value=>/^[A-Za-z0-9_]+:[A-Za-z0-9_]+$/.test(value));if(values.length===1)return values[0];
  if (ts.isCallExpression(node) && symbolAt(node.expression)?.getName() === 'makeFunctionReference' && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) return node.arguments[0].text;
  if (ts.isPropertyAccessExpression(node)) {
    const match = node.getText().match(/^(?:internal|api)\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)$/);
    if (match) return `${match[1]}:${match[2]}`;
  }
  for (const decl of declarations(node)) if ((ts.isVariableDeclaration(decl) || ts.isPropertyAssignment(decl)) && decl.initializer) { const value = rpcReference(decl.initializer, seen); if (value) return value; }
}
function nameOf(node) {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    const prefix = ts.isClassDeclaration(node.parent) ? `${node.parent.name?.text}.` : '';
    return prefix + node.name?.getText();
  }
  if (ts.isVariableDeclaration(node.parent) || ts.isPropertyAssignment(node.parent)) return node.parent.name.getText();
  return `anonymous@${location(node).line}`;
}
const guards = new Map();
function guard(file, names, classification) { for (const name of names) guards.set(`${file}:${name}`, classification); }
guard('convex-dev/runtimeAuth.ts', ['requireAuthority','recheckAuthority','resolveAuthority','resolveAuthorityReference','assertResourceScope'], 'verified identity/current reference + capability/scope/resource');
guard('convex-dev/runtimeDataAuth.ts', ['requireDataAuthority','recheckDataAuthority','requireActionDataAuthority','recheckActionDataAuthority','assertOwnedResource','assertDataRow','assertDataLinks','managedConversationAccess','managedSourceIsCurrent','finalizeDataRead','finalizeDataReadDelivery','finalizeMutationRowsRead'], 'scoped data/source/share/currentness');
guard('convex-dev/runtimeRegistryAuth.ts', ['requireRegistryAuthority','RegistryAccess.open','RegistryAccess.admit','RegistryAccess.fence','RegistryAccess.fenceRetiredSpace'], 'registry actor/resource capability + final OCC fence');
guard('convex-dev/runtimeMetadataAuth.ts', ['authority','check','finalChecks','fresh','readResourceAuthority','response'], 'metadata scoped authority/resource + final fence');
guard('convex-dev/runtimeUnavailableAuth.ts', ['runtimeUnavailable'], 'authorized always-denying unavailable');
guard('convex-dev/runtimeAssetUnavailableAuth.ts', ['runtimeAssetUnavailable'], 'authorized always-denying unavailable asset');
guard('convex-dev/runtimeRegistryStats.ts', ['statisticsUnavailable'], 'authorized always-denying statistics');
guard('convex-dev/runtimeArtifactAuth.ts', ['ArtifactOperation.open','ArtifactOperation.checkManagedLink','ArtifactOperation.fence'], 'artifact resource/link/history/current-version fence');
guard('convex-dev/runtimeArtifactContext.ts', ['readArtifactContext','checkArtifactContextWitnesses'], 'consumed artifact/version/linked-message provenance');
guard('convex-dev/runtimeDelivery.ts', ['deliveryExpiresAt'], 'fresh current server grant + consumed resource deadline');
guard('convex-dev/runtimeTranscript.ts', ['readConversation','verifyMessage','readSource','checkNativeMediaReferences','checkNativeArtifactReferences','reviseMessage'], 'canonical transcript resource/revision + derived provenance');
guard('convex-dev/runtimeContextWitness.ts', ['checkContextSourceWitnesses'], 'consumed fact/memory source permissions');
guard('convex-dev/runtimeAgentFence.ts', ['guardAgentRunBudget'], 'active Agent attempt/lease/definition/budget/source fence');
guard('convex-dev/runtimeIngestion.ts', ['requireStageLease','guardIngestionRunBudget','assertIngestionPolicyPin'], 'current source/revision/stage lease/account/policy pin');
guard('convex-dev/runtimeMediaFence.ts', ['checkMediaJob','allowMediaCompletion'], 'current media resource/input/parent/account publication');
guard('convex-dev/runtimeContentFence.ts', ['checkContentJob','guardContentRunBudget','assertContentPolicyPin'], 'content transcript/artifact/parent/account publication');
guard('convex-dev/runtimeAssetCatalog.ts', ['authorizeAsset','addAssetReference','releaseAssetReferences'], 'immutable asset/private owner reference lifecycle');
guard('convex-dev/runtimeWorkerAuth.ts', ['workerAuthority','canonicalFact','canonicalJob','assertMaintenanceTable','assertDeletionSupported'], 'internal captured worker reference/current source or safe maintenance table');
guard('convex-dev/runtimeGraph.ts', ['worker','requireJob','currentRead','expansionLease','currentSource'], 'verified graph service + connector/lease/epoch/source/profile fence');
guard('convex-dev/runtimeAgent.ts', ['executionContext','observeHandler','currentToolPermission','checkWitnesses'], 'Agent current run/resource/source/tool/media observation');
guard('convex-dev/runs.ts', ['currentRun','currentControlRun','activeAttempt'], 'current run scope/resource or active attempt fence');
guard('convex-dev/runtimeModelPolicy.ts', ['currentOperation','resolveCurrent','runAccount','admitHandler'], 'model native interface/qualification/current snapshot/account/reservation');
guard('convex-dev/agentDefinitions.ts', ['readCurrentExecutableDefinition','checkRow'], 'current closed executable definition/hash');
const visitedSources = new Map(roots.map(file => [rel(file), program.getSourceFile(file).text]));
const cache = new Map();
function scan(node) {
  if (!node) return { calls:[], rpcs:[], effects:[] };
  const key = `${node.getSourceFile().fileName}:${node.pos}:${node.end}`; if (cache.has(key)) return cache.get(key);
  visitedSources.set(rel(node.getSourceFile().fileName), node.getSourceFile().text);
  const result = { calls:[], rpcs:[], effects:[], externalGuards:[] };
  function walk(item) {
    if (ts.isCallExpression(item) || ts.isNewExpression(item)) {
      const fn = callable(item.expression); if (fn) result.calls.push(fn);
      if(symbolAt(item.expression)?.getName()==='verifyVideoWebhook')result.externalGuards.push({symbol:'@convex-dev/ai-sdk-provider:verifyVideoWebhook',...location(item),classification:'official raw-body HMAC signature + per-job secret + 300-second freshness; operation/inference IDs checked by handler'});
      const text = item.expression.getText();
      if (ts.isPropertyAccessExpression(item.expression)) {
        const method = item.expression.name.text;
        if (['runQuery','runMutation','runAction'].includes(method)) {
          const target = rpcReference(item.arguments?.[0]); result.rpcs.push({ kind: method.slice(3).toLowerCase(), endpoint: target ?? null, expression: item.arguments?.[0]?.getText(), ...location(item) });
        }
        if (method === 'runAfter' || method === 'runAt') { const target = rpcReference(item.arguments?.[1]); result.rpcs.push({ kind:'scheduled', endpoint:target ?? null, expression:item.arguments?.[1]?.getText(), ...location(item) }); }
      }
      if (/\.db\.(insert|patch|replace|delete)$|\.storage\.(store|delete|get|getUrl|generateUploadUrl)$|\.scheduler\.(runAfter|runAt|cancel)$|\.do(Generate|Stream|Embed|Start|Poll|Download)$|(?:^|\.)fetch$/.test(text)) result.effects.push({ call:text, ...location(item) });
    }
    ts.forEachChild(item,walk);
  }
  walk(node.body ?? node); cache.set(key,result); return result;
}
const rows=[];
for (const item of [...registered.values()].sort((a,b)=>a.endpoint.localeCompare(b.endpoint))) {
  const queue=[{node:item.handler,path:[item.endpoint],depth:0}]; const seen=new Set(), proofs=new Map(), effects=new Map(), rpcs=new Map();
  while(queue.length) {
    const held=queue.shift(); const node=held.node; if(!node)continue;
    const loc=location(node); const key=`${loc.file}:${node.pos}:${node.end}`; if(seen.has(key))continue;seen.add(key);
    const scanResult=scan(node);
    for(const external of scanResult.externalGuards??[])proofs.set(external.symbol,{...external,path:[...held.path,external.symbol]});
    for(const effect of scanResult.effects) effects.set(`${effect.file}:${effect.line}:${effect.call}`,effect);
    for(const rpc of scanResult.rpcs) {
      const target=rpc.endpoint ? registered.get(rpc.endpoint) : undefined;
      rpcs.set(`${rpc.file}:${rpc.line}:${rpc.expression}`,{...rpc,targetVisibility:target?.visibility??'unresolved',targetKind:target?.kind??null});
      if(target && held.depth<12) queue.push({node:target.handler,path:[...held.path,`RPC ${rpc.kind} ${rpc.endpoint}`],depth:held.depth+1});
    }
    for(const fn of scanResult.calls) {
      const fl=location(fn),name=nameOf(fn),symbol=`${fl.file}:${name}`;const classification=guards.get(symbol);
      if(classification) proofs.set(symbol,{symbol,...fl,classification,path:[...held.path,symbol]});
      // Guard entrypoints are recorded and their implementation inspected separately.
      else if(held.depth<12)queue.push({node:fn,path:[...held.path,symbol],depth:held.depth+1});
    }
  }
  rows.push({endpoint:item.endpoint,kind:item.kind,visibility:item.visibility,origin:item.origin,alias:item.alias,...location(item.registration),handler:item.handler?{...location(item.handler),name:nameOf(item.handler)}:null,
    guardProvenance:[...proofs.values()],rpcReferences:[...rpcs.values()],effectBoundaries:[...effects.values()],provenanceMeaning:'Import/type-symbol-resolved reachable call paths; not a proof of branch ordering or an actual runtime outcome.'});
}
const http=program.getSourceFile(path.join(root,'convex-dev/http.ts'));const routes=[];
function routeWalk(node){if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='route'&&ts.isObjectLiteralExpression(node.arguments[0])){const properties=new Map(node.arguments[0].properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(),p.initializer]));routes.push({path:properties.get('path')?.text,pathPrefix:properties.get('pathPrefix')?.text,method:properties.get('method')?.text,handler:resolveRegistration(symbolAt(properties.get('handler')))?.origin??null,...location(node)});}ts.forEachChild(node,routeWalk);}
routeWalk(http);
const sources=[...visitedSources].sort(([a],[b])=>a.localeCompare(b)).map(([file,text])=>({path:file,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')}));
const value={version:2,recordedAtUtc:new Date().toISOString(),evidenceClass:'STATIC SOURCE MAPPING ONLY; no services, installs, inference or acceptance',sourceDigest:createHash('sha256').update(JSON.stringify(sources)).digest('hex'),sourceDigestAlgorithm:'sha256(JSON.stringify(sorted path/bytes/sha256 source rows))',sources,counts:{total:rows.length,public:rows.filter(x=>x.visibility==='public').length,internal:rows.filter(x=>x.visibility==='internal').length,httpRoutes:routes.length},rows,httpRoutes:routes,guardDefinitions:[...guards].map(([symbol,classification])=>({symbol,classification})),limits:['Reachable guard calls can be conditional; manual endpoint classification is required.','Unresolved interface/dynamic function calls are recorded, never treated as ungated evidence.','HTTP webhook uses provider HMAC rather than host JWT; OPTIONS is public empty CORS metadata.','Historical source fingerprints do not prove current changed paths; actual outcomes remain separately scoped.']};
await writeFile(path.join(output,'registration-map.json'),JSON.stringify(value,null,2)+'\n');
await writeFile(path.join(output,'registration-rows.jsonl'),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({counts:value.counts,sourceDigest:value.sourceDigest,guardlessPublic:rows.filter(x=>x.visibility==='public'&&!x.guardProvenance.length).map(x=>x.endpoint),unresolvedPublicHandlers:rows.filter(x=>x.visibility==='public'&&!x.handler).map(x=>x.endpoint)}));
