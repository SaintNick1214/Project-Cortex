from pathlib import Path
import json,hashlib,subprocess,datetime,os,shutil
r=Path('/workspace/Project-Cortex'); b=r/'_goals/convex-backend-runtime-2026-10-02/qa';q=b/'task04-default-experiment-guard-implementation-c2';w=r/'work/resume/task04-default-experiment-guard-implementation-c2'
hash=lambda x:hashlib.sha256(x).hexdigest()
def file(p):data=p.read_bytes();return {'path':str(p.relative_to(r)),'bytes':len(data),'sha256':hash(data)}
def packets():
 out=[]
 for name in ['task04-default-experiment-guard-implementation-c1','task04-default-experiment-guard-c1-review']:
  p=b/name;m=json.loads((p/'qa-manifest.json').read_text());rows=m['rows'];actual={str(x.relative_to(p)) for x in p.rglob('*') if x.is_file() and str(x.relative_to(p))!='qa-manifest.json'};errors=[]
  for x in rows:
   d=(p/x['path']).read_bytes()
   if len(d)!=x['bytes'] or hash(d)!=x['sha256']:errors.append(x['path'])
  assert not errors and actual=={x['path'] for x in rows}
  out.append({'packet':name,'rows':len(rows),'manifest':file(p/'qa-manifest.json'),'report':file(p/'report.md'),'allRowsMatch':True,'completeFileSet':True})
 return out
(q/'frozen-inputs-pre.json').write_text(json.dumps(packets(),indent=2)+'\n')
source=json.loads((q/'source-evidence.json').read_text());pre=[file(r/x['path']) for x in source['files']];(q/'current-reference-pre.json').write_text(json.dumps(pre,indent=2)+'\n')
history=json.loads((b/'task04-default-model-qualification-preparation/source-evidence.json').read_text());print(history.keys())
rows=history['sources'];lineage=[]
for x in rows:
 now=file(r/x['path']);lineage.append({'path':x['path'],'historicalBytes':x['bytes'],'historicalSHA256':x['sha256'],'current':now,'matchesHistorical':x['sha256']==now['sha256'],'mutableCoordinatorProgress':x['path'].endswith('execution-progress.md')})
(q/'historical-reference-lineage.json').write_text(json.dumps(lineage,indent=2)+'\n')
# C1 fixture clone, exact fresh judge assertions, deliberate path binding through same layout.
red=w/'c1-red';shutil.copytree(b/'task04-default-experiment-guard-implementation-c1/fixture',red/'fixture',dirs_exist_ok=True);(red/'scripts').mkdir(exist_ok=True);shutil.copy2(q/'scripts/hostile.mjs',red/'scripts/hostile.mjs')
env={**os.environ,'PATH':str(r/'work/resume/toolchain-bin')+':'+os.environ['PATH']};node=shutil.which('node',path=env['PATH']);receipts=[]
for name,argv,expected in [('c1-hostile6-red',[node,'--experimental-strip-types',str(red/'scripts/hostile.mjs')],1),('c2-hostile6-green',[node,'--experimental-strip-types',str(q/'scripts/hostile.mjs')],0),('c2-refinement4-green',[node,'--experimental-strip-types',str(q/'scripts/refinement-check.mjs')],0)]:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();result=subprocess.run(argv,cwd=r,env=env,capture_output=True);end=datetime.datetime.now(datetime.timezone.utc).isoformat()
 for stream in ['stdout','stderr']:(q/f'raw/{name}.{stream}').write_bytes(getattr(result,stream))
 receipts.append({'name':name,'argv':argv,'cwd':str(r),'utcStart':start,'utcEnd':end,'exit':result.returncode,'expectedExit':expected,'stdoutSHA256':hash(result.stdout),'stderrSHA256':hash(result.stderr)})
 (q/'repair-command-receipts.json').write_text(json.dumps(receipts,indent=2)+'\n')
 assert result.returncode==expected,(name,result.stderr.decode())
print(json.dumps(receipts,indent=2))
post=[file(r/x['path']) for x in source['files']];assert pre==post
(q/'current-reference-post.json').write_text(json.dumps(post,indent=2)+'\n');(q/'frozen-inputs-post.json').write_text(json.dumps(packets(),indent=2)+'\n')
assert (q/'scripts/offline-check.mjs').read_bytes()==(b/'task04-default-experiment-guard-implementation-c1/scripts/offline-check.mjs').read_bytes()
assert (q/'scripts/hostile.mjs').read_bytes()==(b/'task04-default-experiment-guard-c1-review/review-execution-preimages/scripts/hostile.mjs').read_bytes()
