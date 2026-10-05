import pathlib,json,os,stat,hashlib,re,datetime
R=pathlib.Path('/workspace/Project-Cortex');W=R/'work/resume/task04-native-c6-repair-preparation';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c6-repair-preparation';A=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-generated-producer-source-audit';C=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c5'
H=lambda b:hashlib.sha256(b.encode() if isinstance(b,str) else b).hexdigest()
def J(v):return json.dumps(v,separators=(',',':'),ensure_ascii=False)
def ident(s):return {k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']}
def held(p):
 s=os.lstat(p);assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert ident(s)==ident(os.fstat(fd));chunks=[]
  while True:
   b=os.read(fd,1048576)
   if not b:break
   chunks.append(b)
  b=b''.join(chunks);assert ident(s)==ident(os.fstat(fd))==ident(os.lstat(p))
 finally:os.close(fd)
 return b,{'path':str(p),'bytes':len(b),'sha256':H(b),'identity':ident(s)}
def put(p,v):p.write_text(json.dumps(v,indent=2)+'\n')
routes=json.loads((A/'per-id-source-routes.json').read_text());chains=json.loads((A/'parent-producer-chains.json').read_text());mp=json.loads((C/'mirror-source-transform-map.json').read_text());mapped={r['source']:r for r in mp['inputs']};pins={};evidence=[];out=[]
for x in routes:
 for ref in x['sourceReferenceClosure']:
  p=R/ref['source']['path']
  if str(p) in pins:continue
  b,pin=held(p);assert len(b)==ref['source']['bytes'] and H(b)==ref['source']['sha256'];pin['originalArchiveReference']=ref['source']['encodedPath'];pins[str(p)]=pin
  for i,l in enumerate(b.decode().splitlines(),1):
   if any(s in l for s in ['SourceTextModule','SyntheticModule','runInContext(','runInNewContext(','compileFunction(','new Script(','vm.Script','esbuild.build','await build(','globalThis','vmParentSource','dummyCorpus','dummySources','dummyIds','historicalSources=','historicalLocatorHashes=']):evidence.append({'path':str(p),'line':i,'exactLine':l,'lineSHA256':H(l)})
 out.append({'id':x['id'],'argv':x['exactArgv'],'entryPin':x['entryPin'],'parentTwoFieldActualBody':x['parentTwoFieldActualBody'],'directVMExpressions':x['directVMConstructorExpressions'],'sourceReferenceClosure':x['sourceReferenceClosure'],'requiredValidation':'EXACT_CALLSITE_SOURCE_RECIPE_AND_CONSUMER_BYTE_LEDGER; NO_GENERIC_OWNED_NAME_ADMISSION','coverage':'SOURCE_ONLY_REFERENCE_EDGES_NOT_EXHAUSTIVE_REACHABILITY_PROOF'})
for n in ['vm-port.cjs','composition-engine.mjs','generated-parent-port.mjs','parent-source-recipes.json','compiler-session.mjs','module-boundary.cjs','root-launcher.mjs','root-child-bootstrap.mjs','input-ledger.mjs','resource-owner.mjs','command-registry.mjs','mirror-source-transform-map.json']:
 b,p=held(C/n);pins[str(C/n)]=p
 if n.endswith(('.mjs','.cjs')):
  evidence.extend({'path':str(C/n),'line':i,'exactLine':l,'lineSHA256':H(l)} for i,l in enumerate(b.decode().splitlines(),1))
for p in [R/'AGENTS.md',R/'.agents/CODEX-RUNTIME.md',R/'.agents/PROJECT-PROFILE.md',R/'.agents/roles/implementation-executor.md',R/'work/resume/task04-c5-fresh-review-handoff.md',A/'report.md',A/'coverage.json',A/'parent-producer-chains.json',A/'per-id-source-routes.json',A/'selfseal.json']:
 b,pin=held(p);pins[str(p)]=pin
# Independently reconstruct fixed DUMMY corpus/locator fields, not evaluation of originals.
tables=['_storage','facts','governancePolicies','graphSyncQueue','memories','runtimeAuthGrants','runtimeAuthMemberships','runtimeAuthPrincipals','runtimeMemoryVectors'];ids={t:'DUMMY-'+t for t in tables};run='DUMMY-HISTORICAL-RUN'
corpus={'owned-foundation-29178d862bcf4a31926b4530c322efd4.json':J({'run':run,'files':[{'id':ids['_storage']},{'id':'DUMMY-unused-storage'}],'refs':[{'table':t,'id':ids[t]} for t in tables if t!='_storage']})+'\n','owned-journal-foundation-29178d862bcf4a31926b4530c322efd4.jsonl':''.join(J({'run':run,**({'files':[{'id':ids[t]}]} if t=='_storage' else {'refs':[{'table':t,'id':ids[t]}]})})+'\n' for t in tables),'qualify-325ff9b9-223e-47c5-b245-f50e5162b0cc.json':J({'status':'PASS','cleanupComplete':True,'counts':{'failed':0,'skipped':0,'blocked':0}})+'\n','target-retirement.json':J({'status':'PASS','deletionHttpStatus':200,'absentProjectHttpStatus':404,'projectId':3138249,'verifiedOnlyDevelopmentCloudDeployment':True,'managementCalls':5})+'\n'}
sources={n:{'sha256':H(b),'bytes':len(b.encode())} for n,b in corpus.items()};locators={t:H(ids[t]) for t in tables};recipes=[]
for x in chains:
 r=x['recipe'];assert sources==r['sources'] and locators==r['locatorHashes'];p=R/x['sourcePin']['path'];original=held(p)[0].decode();mirror=mapped[str(p)];mb,mpin=held(pathlib.Path(mirror['destination']));assert H(mb)==mirror['destinationSHA256'];pins[mpin['path']]=mpin
 values=[]
 for role,s in [('ORIGINAL',original),('FROZEN_MIRROR',mb.decode())]:
  g=s
  for name,v in [('historicalSources',sources),('historicalLocatorHashes',locators)]:
   pattern=r'export const '+name+r'=Object.freeze\(\{[\s\S]*?\}\);';assert len(list(re.finditer(pattern,g)))==1;g=re.sub(pattern,lambda m:'export const '+name+'=Object.freeze('+J(v)+');',g,count=1)
  if role=='ORIGINAL':assert H(g)==r['generatedSHA256'] and len(g.encode())==r['generatedBytes']
  values.append({'sourceRole':role,'sourceBytes':len(s.encode()),'sourceSHA256':H(s),'generatedBytes':len(g.encode()),'generatedSHA256':H(g),'twoFieldMatches':2})
 recipes.append({'profile':x['profile'],'actualIDs':x['originalActualIDs'],'recomputedValues':values,'sources':sources,'locatorHashes':locators,'evidence':'INDEPENDENT_PYTHON_TEXT_RECOMPUTATION_NOT_JS_OR_CANDIDATE_EXECUTION','frozenMirrorRow':mirror})
put(Q/'requirements-matrix.json',{'scope':'READONLY_C6_REPAIR_DESIGN_NOT_IMPLEMENTATION_OR_VERDICT','exact122':out,'parentRecipes':recipes})
put(Q/'source-evidence.json',{'rows':evidence,'inspectionUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()})
put(Q/'sourcepins.json',{'freshHeldRows':list(pins.values()),'originalUnion':130,'sourceReadOnly':True,'originalExecution':False,'candidateImport':False})
print('prepared',len(out),'IDs',len(pins),'pins',len(evidence),'source lines',flush=True)
