import pathlib,json,hashlib,datetime,subprocess,os,shutil
root=pathlib.Path('/workspace/Project-Cortex'); os.chdir(root)
qa=root/'_goals/convex-backend-runtime-2026-10-02/qa'; out=qa/'task05-runtime-contract-lock-preparation-c2-review'; work=root/'work/resume/task05-runtime-contract-lock-preparation-c2-review'; packet=qa/'task05-runtime-contract-lock-preparation-c2'
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def row(p):
 b=p.read_bytes();return dict(path=str(p.relative_to(root)),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def save(name,data): (out/name).write_text(json.dumps(data,indent=2)+'\n')
manifest=json.loads((packet/'evidence-manifest.json').read_text()); mismatches=[]
for r in manifest['artifacts']:
 actual=row(root/r['path'])
 if any(actual[k]!=r[k] for k in ['bytes','sha256']):mismatches.append({'expected':r,'actual':actual})
prior=qa/'task05-runtime-contract-lock-preparation/evidence-manifest.json'; pm=json.loads(prior.read_text())
prior_bad=[r for r in pm['artifacts'] if any(row(root/r['path'])[k]!=r[k] for k in ['bytes','sha256'])]
save('packet-verification.json',dict(utc=utc(),report=row(packet/'report.md'),manifest=row(packet/'evidence-manifest.json'),rows=len(manifest['artifacts']),mismatches=mismatches,priorManifest=row(prior),priorRows=len(pm['artifacts']),priorMismatches=prior_bad,oldReview=row(qa/'task05-runtime-contract-lock-review/report.md'),oldReviewManifest=row(qa/'task05-runtime-contract-lock-review/evidence-manifest.json')))
sources=set(r['path'] for r in json.loads((packet/'preimages.json').read_text())['sources'])
sources.update(str(p.relative_to(root)) for p in work.rglob('*') if p.is_file())
sources.update(r['path'] for r in manifest['artifacts']);sources.add(str((packet/'evidence-manifest.json').relative_to(root)))
before=[]
for s in sorted(sources):
 p=root/s;before.append(row(p));dest=out/'preimages'/s;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
save('preimages.json',dict(utc=utc(),sources=before))
env=dict(os.environ);env['PATH']=str(root/'work/resume/toolchain-bin')+':'+env['PATH']
commands=[('node',['node','--version'],0),('npm',['npm','--version'],0),('static-old-red',['node',str(work/'contract-check.mjs'),str(qa/'task05-runtime-contract-lock-preparation/report.md')],1),('static-c2',['node',str(work/'contract-check.mjs'),str(packet/'report.md')],0),('mapping11',['node',str(work/'mapping-probe.mjs')],0),('hostile13',['node',str(work/'hostile-probe.mjs')],0),('fresh-semantic',['node',str(work/'fresh-semantic.mjs')],0)]
for name,argv,expected in commands:
 start=utc();save(name+'.pre-execution.json',dict(argv=argv,cwd=str(root),startUTC=start,expectedExit=expected,classification='offline independent design/source probe'))
 result=subprocess.run(argv,cwd=root,env=env,capture_output=True)
 (out/(name+'.stdout')).write_bytes(result.stdout);(out/(name+'.stderr')).write_bytes(result.stderr)
 save(name+'.receipt.json',dict(argv=argv,cwd=str(root),startUTC=start,endUTC=utc(),exit=result.returncode,signal=-result.returncode if result.returncode<0 else None,expectedExit=expected,observedExpected=result.returncode==expected,skips=[],native='NOT_RUN'))
after=[row(root/r['path']) for r in before];save('postimages.json',dict(utc=utc(),sources=after,mismatches=[{'before':a,'after':b} for a,b in zip(before,after) if a!=b]))
