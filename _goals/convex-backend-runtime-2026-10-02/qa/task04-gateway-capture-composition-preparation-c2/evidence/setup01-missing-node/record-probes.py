from pathlib import Path
import subprocess,os,json,hashlib,datetime,shutil
root=Path('/workspace/Project-Cortex')
work=root/'work/resume/task04-gateway-capture-composition-preparation-c2'
qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-capture-composition-preparation-c2'
env={'PATH':'/workspace/Project-Cortex/work/resume/toolchain-bin:/usr/local/bin:/usr/bin:/bin','TMPDIR':str(work/'tmp'),'NO_COLOR':'1'}
(work/'tmp').mkdir(exist_ok=True)
sources=json.loads((qa/'source-evidence.json').read_text())['sources']
extra=['work/resume/task04-gateway-capture-composition-preparation-c2/boundary-probe.mjs','work/resume/task04-gateway-capture-composition-preparation-c2/record-probes.py','node_modules/typescript/lib/typescript.js','node_modules/typescript/package.json','node_modules/zod/package.json']
def fingerprint(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
for name in extra:
 p=root/name; dest=qa/'preimages'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
 sources.append({'path':name,**fingerprint(p),'snapshot':str(dest.relative_to(qa))})
commands=[('node-version',['node','--version'],0),('npm-version',['npm','--version'],0),('c1-criterion-red',['node',str(work/'boundary-probe.mjs'),'--c1-red'],1),('c2-boundaries',['node',str(work/'boundary-probe.mjs')],0)]
receipts=[]
for label,argv,expected in commands:
 dest=qa/'evidence'/label;dest.mkdir(parents=True)
 pre={s['path']:fingerprint(root/s['path']) for s in sources}
 (dest/'pre-execution.json').write_text(json.dumps({'argv':argv,'cwd':str(root),'startedAtUTC':now(),'environment':env,'preimages':pre},indent=2)+'\n')
 result=subprocess.run(argv,cwd=root,env=env,capture_output=True,timeout=60)
 (dest/'stdout.txt').write_bytes(result.stdout);(dest/'stderr.txt').write_bytes(result.stderr)
 post={s['path']:fingerprint(root/s['path']) for s in sources}
 row={'argv':argv,'cwd':str(root),'finishedAtUTC':now(),'exitCode':result.returncode,'expectedExitCode':expected,'expectedDisposition':result.returncode==expected,'sourcePostimages':post,'allSourcesStable':pre==post,'stderrRetained':True}
 (dest/'result.json').write_text(json.dumps(row,indent=2)+'\n');receipts.append({'label':label,**row})
 print(json.dumps({'label':label,'exitCode':result.returncode,'expectedDisposition':result.returncode==expected,'allSourcesStable':pre==post}))
 if result.returncode!=expected:break
assert all(r['expectedDisposition'] and r['allSourcesStable'] for r in receipts)
assert len(receipts)==4
assert (qa/'evidence/node-version/stdout.txt').read_text().startswith('v24.')
assert (qa/'evidence/npm-version/stdout.txt').read_text().strip()=='12.2.0'
assert 'Missing expected exception' in (qa/'evidence/c1-criterion-red/stderr.txt').read_text()
results=json.loads((qa/'boundary-results.json').read_text())
report=qa/'report.md';text=report.read_text().replace('No tests were executed for this preparation.','No application or Gateway tests execute in this preparation; only the explicitly labeled offline boundary probes below.')
text=text.replace('See boundary-results.json and evidence/ receipts for actual counts/outcomes,',f'Observed {results["count"]}/{results["count"]} C2 boundary outcomes PASS, zero skipped/pending; original C1 revision0 criterion RED is preserved with expected exit1 (not counted as a C2 success). Node24.19.0/npm12.2.0 observed. See boundary-results.json and evidence/ receipts for')
report.write_text(text)
(qa/'source-evidence.json').write_text(json.dumps({'observedAtUTC':now(),'sources':sources,'finalPostimages':{s['path']:fingerprint(root/s['path']) for s in sources},'allSourcesStable':all(fingerprint(root/s['path'])['sha256']==s['sha256'] for s in sources),'checks':receipts},indent=2)+'\n')
for p in sorted(work.rglob('*')):
 if p.is_file():
  dest=qa/'probe-artifacts'/p.relative_to(work);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
manifest=[]
for p in sorted(qa.rglob('*')):
 if p.is_file() and p.name!='manifest.json':manifest.append({'path':str(p.relative_to(qa)),**fingerprint(p)})
(qa/'manifest.json').write_text(json.dumps({'files':manifest,'manifestExcludesItself':True},indent=2)+'\n')
print(json.dumps({'boundaryOutcomes':results['count'],'qaManifestRows':len(manifest),'reportSha256':fingerprint(report)['sha256'],'manifestSha256':fingerprint(qa/'manifest.json')['sha256']}))
