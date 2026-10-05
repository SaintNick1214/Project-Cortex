from pathlib import Path
import subprocess,json,hashlib,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';D=Q/'task04-default-native-driver-implementation-c2/design-clarification-c3'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
paths=[D/n for n in ['proposal.md','money-domain.md','dummy-model.mjs','requirements-map.md','run.py']]+[p for p in (D/'history').rglob('*') if p.is_file()]+[R/row['path'] for row in json.loads((Q/'task04-default-native-driver-implementation-c2/source-pre.json').read_text())['sources']]+[p for p in (Q/'task04-default-native-driver-implementation-c2/fixture/convex').glob('*.ts')]
def snap():return [{'path':str(p.relative_to(R)),'bytes':len(p.read_bytes()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(set(paths))]
pre=snap();(D/'source-pre.json').write_text(json.dumps({'utc':now(),'sources':pre},indent=2)+'\n')
for row in pre:
 p=R/row['path'];f=D/'preimages'/p.relative_to(R);f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(p.read_bytes())
argv=['node',str(D/'dummy-model.mjs')];start=now();run=subprocess.run(argv,cwd=R,capture_output=True);end=now();(D/'dummy.stdout').write_bytes(run.stdout);(D/'dummy.stderr').write_bytes(run.stderr);(D/'dummy-run.json').write_text(json.dumps({'argv':argv,'cwd':str(R),'startUTC':start,'endUTC':end,'exit':run.returncode,'scope':'DUMMY design model only, no target key/native/Convex verification'},indent=2)+'\n')
post=snap();(D/'source-post.json').write_text(json.dumps({'utc':now(),'sources':post},indent=2)+'\n');assert pre==post
print(run.stdout.decode());print(run.stderr.decode());raise SystemExit(run.returncode)
