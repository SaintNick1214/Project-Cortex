import pathlib,json,hashlib,datetime,subprocess,difflib,re,os
R=pathlib.Path('/workspace/Project-Cortex')
G='_goals/convex-backend-runtime-2026-10-02/'
Q=R/G/'qa/task05-current-seam-refresh-c1'
W=R/'work/resume/task05-current-seam-refresh-c1'
P=R/G/'qa/task05-runtime-contract-lock-preparation-c3'
utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(b): return hashlib.sha256(b).hexdigest()
def write(p,v): p.write_text(json.dumps(v,indent=2)+'\n')
def fingerprint(p):
 b=p.read_bytes();return {'path':str(p.relative_to(R)),'bytes':len(b),'sha256':digest(b)}
def snapshot(paths,folder):
 folder.mkdir(exist_ok=True);rows=[]
 for p in sorted(set(paths)):
  b=p.read_bytes();dest=folder/str(p.relative_to(R)).replace('/','--');dest.write_bytes(b)
  rows.append({**fingerprint(p),'archive':str(dest.relative_to(R)),'capturedUTC':utc()})
 return rows
manifest=json.loads((P/'evidence-manifest.json').read_text())
sources=[]
for row in manifest['artifacts']:
 p=row['path'];pre=str(P.relative_to(R))+'/preimages/'
 if p.startswith(pre):
  original=p[len(pre):].replace('--','/')
  if not original.startswith(('_goals/','_research/','work/')) and (R/original).is_file(): sources.append(R/original)
extra=['convex-dev/runtimeGateway.ts','convex-dev/runtimeModelPolicyBootstrap.ts','convex-dev/runtimeMemoryServices.ts','convex-dev/runtimeMemory.ts','convex-dev/runtimeAuthSchema.ts','convex-dev/convex.config.ts','src/domain/contracts.ts','src/domain/profile.ts','src/domain/clock.ts','node_modules/@convex-dev/agent/src/vercel/client/saveInputMessages.ts','node_modules/@convex-dev/agent/src/vercel/client/streaming.ts','node_modules/@convex-dev/agent/src/vercel/client/streamText.ts','node_modules/@convex-dev/agent/src/vercel/client/types.ts','node_modules/@convex-dev/agent/src/component/streams.ts','node_modules/@convex-dev/agent/dist/vercel/client/saveInputMessages.js','node_modules/@convex-dev/agent/dist/vercel/client/streaming.js','node_modules/@convex-dev/agent/dist/component/streams.js','node_modules/typescript/package.json']
missing=[]
for path in extra:
 if (R/path).is_file(): sources.append(R/path)
 else: missing.append(path)
authorities=[R/p for p in ['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/implementation-executor.md','.agents/skills/feature-orchestrator/SKILL.md','_research/convex-ai-gateway-2026-10-02/decision-gates.md','_research/convex-ai-gateway-2026-10-02/architecture.md',G+'goal.md',G+'qa/task01/contracts.md',G+'qa/task05-runtime-contract-lock-preparation-c3/report.md',G+'qa/task05-runtime-contract-lock-preparation-c3-review/report.md',G+'qa/task05-runtime-contract-lock-c3-coordinator-acceptance.json',G+'qa/task05-canonical-transcript-preparation/report.md',G+'qa/task05-consumed-contract-preparation-review/report.md',G+'qa/task05-consumed-contract-preparation-acceptance.json']]
authorities += sorted((R/G/'tasks').glob('0[2-9]-*.md'))
before=snapshot(sources+authorities+[W/'capture.py'],Q/'preimages')
write(Q/'preimages.json',{'utc':utc(),'classification':'full current permitted public source/config/authority bytes captured BEFORE controls','artifacts':before,'missing':missing,'initialInteractiveTiming':'NOT_CAPTURED'})
pins={row['path']:row['archive'] for row in before}
delta=[]
for p in sorted(set(sources)):
 old=P/'preimages'/str(p.relative_to(R)).replace('/','--')
 new=Q/'preimages'/str(p.relative_to(R)).replace('/','--')
 if old.is_file():
  a=old.read_bytes();b=new.read_bytes();same=a==b
  row={'path':str(p.relative_to(R)),'oldArchive':str(old.relative_to(R)),'currentArchive':str(new.relative_to(R)),'oldSHA256':digest(a),'currentSHA256':digest(b),'equal':same}
  if not same:
   dest=Q/(str(p.relative_to(R)).replace('/','--')+'.diff');dest.write_text(''.join(difflib.unified_diff(a.decode().splitlines(True),b.decode().splitlines(True),fromfile=str(old),tofile=str(new))));row['diff']=str(dest.relative_to(R))
  delta.append(row)
 else: delta.append({'path':str(p.relative_to(R)),'oldArchive':'NOT_CAPTURED_IN_C3','currentArchive':str(new.relative_to(R)),'currentSHA256':digest(new.read_bytes()),'equal':None})
write(Q/'source-deltas.json',delta)
# Entire allowed sources are retained as authentic bytes; avoid printing their bodies.
context=Q/'full-consumed-source.txt'
with context.open('w') as f:
 for p in sorted(set(sources)):
  archive=R/pins[str(p.relative_to(R))];f.write('\nFILE '+str(p.relative_to(R))+' SHA256 '+digest(archive.read_bytes())+'\n');f.write(archive.read_text())
checks=['mapping-probe.mjs','hostile-probe.mjs','repaired-boundaries.mjs']
transforms=[]
for name in checks:
 original=R/'work/resume/task05-runtime-contract-lock-preparation-c3'/name
 text=original.read_text();updated=text
 # Redirect source reads to THIS run's genuine current immutable archives; assertions unchanged.
 for path,archive in sorted(pins.items(),key=lambda x:-len(x[0])):
  updated=updated.replace("'"+path+"'","'"+archive+"'")
 dest=W/name;dest.write_text(updated)
 transforms.append({'original':fingerprint(original),'copy':fingerprint(dest),'onlyChange':'literal source read paths to current captured bytes','assertionTailIdentical':text[text.index('const flat='):] == updated[updated.index('const flat='):] if name=='mapping-probe.mjs' else None})
write(Q/'probe-path-transformations.json',transforms)
def run(name,argv):
 inputs=sources+authorities+[W/'capture.py']+list(W.glob('*.mjs'))
 write(Q/(name+'.pre-execution.json'),{'utc':utc(),'argv':argv,'cwd':str(R),'fingerprints':[fingerprint(p) for p in sorted(set(inputs))]})
 start=utc();result=subprocess.run(argv,cwd=R,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={**os.environ,'PATH':str(R/'work/resume/toolchain-bin')+':'+os.environ['PATH']})
 (Q/(name+'.stdout')).write_bytes(result.stdout);(Q/(name+'.stderr')).write_bytes(result.stderr)
 groups=len(re.findall(rb'^PASS ',result.stdout,re.M)); receipt={'argv':argv,'cwd':str(R),'startUTC':start,'endUTC':utc(),'exitCode':result.returncode if result.returncode>=0 else None,'signal':-result.returncode if result.returncode<0 else None,'assertedOutcomeGroups':groups,'skips':[],'classification':'standalone OFFLINE source/reference control, NOT native/product acceptance'}
 write(Q/(name+'.receipt.json'),receipt);return receipt
receipts=[run('node',['node','--version']),run('npm',['npm','--version'])]
for name in checks: receipts.append(run(name.removesuffix('.mjs'),['node',str((W/name).relative_to(R))]))
verification=[]
for folder in ['task05-runtime-contract-lock-preparation','task05-runtime-contract-lock-review','task05-runtime-contract-lock-preparation-c2','task05-runtime-contract-lock-preparation-c2-review','task05-runtime-contract-lock-preparation-c3','task05-runtime-contract-lock-preparation-c3-review']:
 m=R/G/'qa'/folder/'evidence-manifest.json';data=json.loads(m.read_text());mismatches=[]
 for row in data['artifacts']:
  p=R/row['path'];b=p.read_bytes()
  if len(b)!=row['bytes'] or digest(b)!=row['sha256']: mismatches.append(row['path'])
 verification.append({'manifest':fingerprint(m),'verifiedRows':len(data['artifacts']),'mismatches':mismatches})
write(Q/'historical-manifest-verification.json',verification)
after=[]
for row in before:
 p=R/row['path'];now=fingerprint(p);after.append({**now,'beforeSHA256':row['sha256'],'equal':now['sha256']==row['sha256']})
write(Q/'postimages.json',{'utc':utc(),'artifacts':after,'drift':[row['path'] for row in after if not row['equal']]})
write(Q/'numerical-summary.json',{'utc':utc(),'sourceFiles':len(set(sources)),'capturedSourceAuthorityRunnerFiles':len(before),'c3ComparableFiles':sum(x['equal'] is not None for x in delta),'changedC3Files':sum(x['equal'] is False for x in delta),'unchangedC3Files':sum(x['equal'] is True for x in delta),'offlineGroups':sum(x['assertedOutcomeGroups'] for x in receipts),'receiptCount':len(receipts),'nonzeroExitCount':sum(x['exitCode']!=0 for x in receipts),'historicalManifestRows':sum(x['verifiedRows'] for x in verification),'historicalMismatches':sum(len(x['mismatches']) for x in verification),'sourceDriftCount':sum(not x['equal'] for x in after),'productWrites':0,'nativeRuns':0,'paidRuns':0,'skippedGroups':0,'Task05':'HELD_PENDING_TASK04_AND_CURRENT_SEAM_REFRESH','classification':'SOURCE_ONLY_PREPARATION_NO_GATE_SATISFACTION','missing':missing})
print(json.dumps(json.loads((Q/'numerical-summary.json').read_text()),indent=2))
