import sys,json,subprocess,hashlib,datetime
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex');QA=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c2'
label=sys.argv[1]; argv=sys.argv[2:]; folder=QA/'checks'/label;folder.mkdir(parents=True)
def snapshot():
 return [{'path':str(p.relative_to(ROOT)),'bytes':len(p.read_bytes()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted([f for folder in ['fixture','fixture-vm','scripts','regression'] for f in (QA/folder).rglob('*') if f.is_file()]+[QA/name for name in ['eslint.config.mjs','initial14-manifest.json','installed-pins.json']]+[ROOT/row['path'] for row in json.loads((QA/'source-pre.json').read_text())['sources']])]
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
pre=snapshot();(folder/'source-pre.json').write_text(json.dumps(pre,indent=2)+'\n');(folder/'preimages').mkdir()
for row in pre:
 p=ROOT/row['path']; dest=folder/'preimages'/p.relative_to(ROOT);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(p.read_bytes())
start=now();result=subprocess.run(argv,cwd=QA/'fixture',capture_output=True);end=now()
(folder/'stdout').write_bytes(result.stdout);(folder/'stderr').write_bytes(result.stderr)
(folder/'run.json').write_text(json.dumps({'argv':argv,'cwd':str(QA/'fixture'),'startUTC':start,'endUTC':end,'exit':result.returncode},indent=2)+'\n');(folder/'source-post.json').write_text(json.dumps(snapshot(),indent=2)+'\n')
print(label,result.returncode);print(result.stdout.decode());print(result.stderr.decode());sys.exit(result.returncode)
