import pathlib,json,hashlib,os,datetime,sys,shutil
R=pathlib.Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';O=Q/'task04-actual-catalog-root-c1-fresh-review';W=R/'work/resume/task04-actual-catalog-root-c1-fresh-review';C=Q/'task04-current-catalog-release-c4';A=Q/'task04-current-catalog-root-execution-c1';start=datetime.datetime.now(datetime.timezone.utc).isoformat()
def h(b):return hashlib.sha256(b).hexdigest()
def row(p,base):
 b=os.readlink(p).encode() if p.is_symlink() else p.read_bytes();return dict(path=str(p.relative_to(base)),bytes=len(b),sha256=h(b))
def dump(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n')
paths={R/x['path'] for x in json.loads((C/'source-runtime.json').read_text())['sources']};paths.update([A/'qa-manifest.json',C/'qa-manifest.json',A/'report.md',C/'source-runtime.json',O/'report.md']);paths.update(p for p in W.glob('*') if p.is_file());before=[row(p,R) for p in sorted(paths)];dump('freeze-source-before.json',before)
for x in before:
 p=O/'source-pre'/x['sha256']
 if not p.exists():p.write_bytes((R/x['path']).read_bytes())
for q,count in [(A,2036),(C,2025)]:
 m=json.loads((q/'qa-manifest.json').read_text());expected=m.get('files',m.get('rows'));actual={x['path']:x for x in [row(p,q) for p in q.rglob('*') if p.is_file() or p.is_symlink()] if x['path']!='qa-manifest.json'};assert len(expected)==count and set(actual)=={x['path'] for x in expected}
 for x in expected:assert actual[x['path']]=={k:x[k] for k in ['path','bytes','sha256']}
for x in json.loads((C/'source-runtime.json').read_text())['sources']:assert row(R/x['path'],R)==x
checks=O/'checks';checks.mkdir(exist_ok=True)
for p in W.glob('*'):
 if p.is_file():shutil.copyfile(p,checks/p.name)
after=[row(p,R) for p in sorted(paths)];assert before==after;dump('freeze-source-after.json',after);dump('freeze-receipt.json',dict(argv=[sys.executable,__file__],cwd=str(R),start=start,end=datetime.datetime.now(datetime.timezone.utc).isoformat(),exit=0,sourceStable=True,actualClosureRows=2036,releaseClosureRows=2025,liveRuntimeRows=136))
rows=[row(p,O) for p in O.rglob('*') if p.is_file() and p.name!='qa-manifest.json'];dump('qa-manifest.json',dict(version=1,excludedExactSelf='qa-manifest.json',files=sorted(rows,key=lambda x:x['path'])))
print(json.dumps(dict(verdict='PASS',average=4.2,report=str(O/'report.md'),reportSHA256=h((O/'report.md').read_bytes()),manifestSHA256=h((O/'qa-manifest.json').read_bytes()),manifestRows=len(rows))))
