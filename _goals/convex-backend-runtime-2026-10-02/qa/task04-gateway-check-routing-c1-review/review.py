import pathlib,json,hashlib,subprocess,datetime,os
R=pathlib.Path('/workspace/Project-Cortex'); Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-check-routing-c1-review'; S=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-check-routing-repair-c1'; W=R/'work/resume/task04-gateway-check-routing-c1-review'
def h(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def out(p,v): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2)+'\n')
def manifest(d):
 m=json.loads((d/'manifest.json').read_text()); rows=m['files']; actual={str(p.relative_to(d)) for p in d.rglob('*') if p.is_file()}; expected={r['path'] for r in rows}|{'manifest.json'}; assert actual==expected,(actual-expected,expected-actual)
 for r in rows:
  p=d/r['path'];assert not p.is_symlink();assert h(p)==r['sha256'];assert p.stat().st_size==r['bytes']
 return {'directory':str(d.relative_to(R)),'rows':len(rows),'filesIncludingSelfExcludedManifest':len(actual),'manifestSha256':h(d/'manifest.json'),'exactInventory':True,'allHashesAndSizesMatch':True}
assert h(S/'report.md')=='1071397327672bc24364de06cb776652f39d2cce00e98e18d4505ecd401a3668'
assert h(S/'manifest.json')=='d08bddddc5fedf20c165c93f3d0a8c963755fd31b174b7c350962af83120e861'
subject=manifest(S)
# Read every subject file, plus full mandated context. Record read hashes, not summaries.
context=['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md','.agents/skills/feature-orchestrator/SKILL.md','_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md','_goals/convex-backend-runtime-2026-10-02/implementation-prompt.md','_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-capture-composition-c2-design-review/report.md','package.json']
context += [r['path'] for r in json.loads((S/'inherited-historical-authority.json').read_text())['files']]
contextRead=[{'path':p,'bytes':len((R/p).read_bytes()),'sha256':h(R/p)} for p in context]
for r in json.loads((S/'inherited-historical-authority.json').read_text())['files']: assert h(R/r['path'])==r['sha256']
inherited=[manifest(R/'_goals/convex-backend-runtime-2026-10-02/qa'/n) for n in ['task04-gateway-historical-catalog-preparation-c1','task04-gateway-historical-catalog-c1-review']]
frozen=json.loads((S/'completion.json').read_text())['sourceFreeze']; sources={r['path']:r['sha256'] for r in frozen}
for p,v in sources.items():assert h(R/p)==v
receipts=[]
for p in sorted((S/'evidence').rglob('receipt.json')):
 r=json.loads(p.read_text());assert r['cwd']==str(R);assert r['sourcePre']==r['sourcePost'];assert r['sourceUnchanged'];assert r['startedAt']<=r['endedAt']; receipts.append({'path':str(p.relative_to(S)),'argv':r['argv'],'exitCode':r['exitCode'],'stableSource':True})
b=json.loads((S/'evidence/discovery-before/stdout.txt').read_text());a=json.loads((S/'evidence/discovery-after/stdout.txt').read_text());old='tests/unit/runtime/gateway-dispatch.test.ts';new='tests/unit/runtime/convex-schema-test-types.d.ts'
assert set(b['typeFiles'])-set(a['typeFiles'])=={old};assert set(a['typeFiles'])-set(b['typeFiles'])=={new};assert a['unitFiles']==b['unitFiles'];assert b['eslintIgnoredUnit']==[];assert a['eslintIgnoredUnit']==[old]
jb=json.loads((S/'evidence/jest-discovery-before/stdout.txt').read_text());ja=json.loads((S/'evidence/jest-discovery-after/stdout.txt').read_text());assert set(jb)-set(ja)=={str(R/old)};assert not set(ja)-set(jb)
out(Q/'integrity.json',{'subject':subject,'inheritedManifestVerification':inherited,'contextRead':contextRead,'receipts':receipts,'sourceFreeze':sources,'discovery':{'tsBefore':len(b['typeFiles']),'tsAfter':len(a['typeFiles']),'jestBefore':len(jb),'jestAfter':len(ja),'onlyOldRemoved':old,'onlyTypeAdded':new,'filesystemUnchanged':True},'testBodyExecution':False})
env={'PATH':str(R/'work/resume/toolchain-bin')+':/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin','TMPDIR':str(W),'NO_COLOR':'1'}
def record(name,args):
 d=Q/'evidence'/name;d.mkdir(parents=True,exist_ok=True); pre={p:h(R/p) for p in sources};protect={str(p.relative_to(S)):h(p) for p in S.rglob('*') if p.is_file()}; start=datetime.datetime.now(datetime.timezone.utc).isoformat();r=subprocess.run(args,cwd=R,env=env,capture_output=True);end=datetime.datetime.now(datetime.timezone.utc).isoformat();(d/'stdout.txt').write_bytes(r.stdout);(d/'stderr.txt').write_bytes(r.stderr);post={p:h(R/p) for p in sources}; after={str(p.relative_to(S)):h(p) for p in S.rglob('*') if p.is_file()};out(d/'receipt.json',{'argv':args,'cwd':str(R),'environment':env,'startedAt':start,'endedAt':end,'exitCode':r.returncode,'sourcePre':pre,'sourcePost':post,'sourceUnchanged':pre==post,'protectedSubjectPre':protect,'protectedSubjectPost':after,'protectedSubjectUnchanged':protect==after,'testBodyExecution':False});assert pre==post and protect==after;return r
for name,args in [('node-version',['node','--version']),('npm-version',['npm','--version']),('independent-boundaries',['node',str(W/'boundaries.mjs')]),('jest-discovery',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--testPathPatterns=tests/unit','--listTests','--json','--runInBand','--no-cache'])]:
 r=record(name,args); print(name,r.returncode);assert r.returncode==0
 if name=='jest-discovery': assert set(json.loads(r.stdout))==set(ja)
print('SUBJECT_AND_INHERITED_INTEGRITY_PASS')
