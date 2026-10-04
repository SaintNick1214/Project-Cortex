import json,hashlib,pathlib,datetime,subprocess,sys
R=pathlib.Path('/workspace/Project-Cortex'); Q=R/'_goals/convex-backend-runtime-2026-10-02/qa'; O=Q/'task04-terminal-capture-parent-inputs-c9-restoration-review'
def sha(b): return hashlib.sha256(b).hexdigest()
def read(p): return json.loads(p.read_bytes())
def snapshot(p): return {str(x.relative_to(p)):{'bytes':len(x.read_bytes()),'sha256':sha(x.read_bytes())} for x in sorted(p.rglob('*')) if x.is_file()}
def verify(p):
 m=read(p/'qa-manifest.json'); actual=snapshot(p); actual.pop('qa-manifest.json'); expected={x['path']:{'bytes':x['bytes'],'sha256':x['sha256']} for x in m['files']}; assert len(expected)==len(m['files']); assert actual==expected,(str(p),set(actual)^set(expected),[k for k in expected if actual.get(k)!=expected[k]]);return {'rows':len(expected),'manifestSHA256':sha((p/'qa-manifest.json').read_bytes()),'reportSHA256':sha((p/'report.md').read_bytes()) if (p/'report.md').exists() else None}
S=Q/'task04-terminal-capture-parent-inputs-c9-preparation'; V=Q/'task04-terminal-capture-parent-inputs-c9-review'; C=Q/'task04-terminal-capture-native-profiles-c4-review';roots=[S,V,C,Q/'task04-terminal-capture-native-extension-preparation-c4',Q/'task04-terminal-capture-native-extension-preparation-c4/regression'];pre={str(p.relative_to(R)):snapshot(p) for p in roots}; checks={str(p.relative_to(R)):verify(p) for p in roots}
assert checks[str(S.relative_to(R))]['rows']==207
assert checks[str(V.relative_to(R))]['rows']==92
assert checks[str(C.relative_to(R))]['rows']==74
assert checks[str(S.relative_to(R))]['manifestSHA256']=='595e47df66c1b685607545a32776a0fe175a5a1260a3865e834b0192d4b154e5'
assert checks[str(S.relative_to(R))]['reportSHA256']=='4c0bc4e8affd302d941c5155b06ac4353f5e51cf858f9f0d20957966fc0ac441'
# Parse complete execution and discovery records, with no harness execution.
execution=read(S/'execution.json'); oldexec=read(V/'executions.json'); discovery=read(V/'DUMMY-discovery.json'); incident=read(V/'subject-post-isolation-error.json'); restoration=read(Q/'task04-c9-exact-receipt-restoration.json'); recovery=read(R/'work/resume/task04-c9-exact-receipt-recovery/recovery.json'); preold=read(V/'subject-pre.json'); assert preold['bad']==[]
recovered=[]
for profile in ['extension','regression']:
 name='effect-matrix-'+profile+'.json'; original=(S/name).read_bytes(); overwritten=(Q/('task04-c9-reviewer-overwrite-'+profile+'.json')).read_bytes(); old=read(V/('review-isolation-error-'+name)); assert json.loads(overwritten)==old
 d=json.loads(original); w=json.loads(overwritten); assert {k:v for k,v in d.items() if k not in ['argv','utc']}=={k:v for k,v in w.items() if k not in ['argv','utc']}
 row=next(x for x in read(S/'qa-manifest.json')['files'] if x['path']==name); cmd=next(x for x in execution['commands'] if any(str(a).endswith('/effect-matrix-'+profile+'.mjs') for a in x['argv'])); match=next(x for x in recovery['matches'] if x['profile']==profile); candidate=(R/match['candidate']).read_bytes();assert candidate==original
 assert d['argv'][1]==cmd['argv'][-1]; assert d['cwd']=='/workspace/Project-Cortex'
 start=datetime.datetime.fromisoformat(cmd['startedAt']); end=datetime.datetime.fromisoformat(cmd['endedAt']); low=int(start.timestamp()*1000); high=int(end.timestamp()*1000)
 assert [low,high]==match['rangeMs']
 # Independent exhaustive search of timestamp only, preserving original body, insertion order and original argv.
 found=[]
 for ms in range(low,high+1):
  w['argv']=d['argv'];w['utc']=datetime.datetime.fromtimestamp(ms/1000,datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z'); b=(json.dumps(w,indent=2,ensure_ascii=False)+'\n').encode()
  if len(b)==row['bytes'] and sha(b)==row['sha256']: found.append({'utc':w['utc'],'sha256':sha(b),'bytes':len(b)}); assert b==original
 assert len(found)==1,(profile,found)
 bad=next(x for x in incident['bad'] if x['path']==name); assert sha(overwritten)==bad['actualSHA256'];assert len(overwritten)==bad['actualBytes'];assert row==bad['expected'];assert sha(original)==row['sha256']
 recovered.append({'profile':profile,'recordedCommand':{k:cmd[k] for k in ['argv','cwd','startedAt','endedAt'] if k in cmd},'candidatesExamined':high-low+1,'uniqueExactByteMatch':found[0],'outcomesUnchanged':True,'overwriteSHA256':sha(overwritten),'candidateEqualsSubject':True})
# Read every helper/harness/preimage/raw stream: inspect source bytes, validate manifest-backed raw and result collections.
inputs=[]
for directory in [S,V]:
 for p in sorted(directory.rglob('*')):
  if p.is_file(): b=p.read_bytes();inputs.append({'path':str(p.relative_to(R)),'bytes':len(b),'sha256':sha(b)})
technical=[]
for n,key,count in [('results-extension.json','checks',84),('results-regression.json','checks',84),('effect-matrix-extension.json','outcomes',38),('effect-matrix-regression.json','outcomes',38),('real-chain-extension.json','results',114),('real-chain-regression.json','results',114),('actual-guard-controls.json','checks',72),('actual-phase-controls.json','checks',22),('fresh-primitive-results.json','results',16)]:
 d=read(V/n);assert len(d[key])==count,(n,len(d[key]));assert d.get('failed',0)==0;assert d.get('skipped',0)==0;technical.append({'file':n,'checks':count,'sha256':sha((V/n).read_bytes()),'coverage':'inherited unchanged observed outcomes; not rerun'})
assert sum(x['checks'] for x in technical)==582
# Remaining twenty shared C9 compliance outcomes are in immutable captured stdout.
for profile in ['extension','regression']:
 green=(V/('shared-c9-'+profile+'.stdout')).read_text(); red=(V/('shared-c8-'+profile+'.stdout')).read_text(); assert green and red
 for phase in ['parent-inputs','current-inputs']:
  p=S/(phase+'-'+profile+'.mjs'); assert p.read_bytes(); syntax=subprocess.run(['node','--check',str(p)],cwd=R,capture_output=True,text=True);assert syntax.returncode==0;technical.append({'file':str(p.relative_to(R)),'argv':syntax.args,'exit':syntax.returncode,'stdout':syntax.stdout,'stderr':syntax.stderr,'sourceSHA256':sha(p.read_bytes())})
post={str(p.relative_to(R)):snapshot(p) for p in roots};assert pre==post
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':sys.argv,'cwd':str(R),'scope':'independent restoration and preserved technical-evidence acceptance only','closure':checks,'custody':recovered,'technicalInheritance':technical,'oldExecutions':oldexec,'DUMMYDiscovery':{'instances':discovery['instances'],'unique':discovery['unique'],'skipped':discovery['skipped']},'pre':pre,'post':post,'protectedRootsUnchanged':True,'inputs':inputs,'skips':['No behavioral harness rerun: prior independently observed 602 checks inherited only after complete immutable92 review and subject207 integrity verification.','No native/private/key/sign/network/RPC/paid/UI/full task/goal gate executed.'],'actualEffects':{'privateReads':0,'signatures':0,'network':0,'nativeIssuance':0}}
with (O/'audit.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps({'closure':checks,'recovery':recovered,'protectedRootsUnchanged':True}))
