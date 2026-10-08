# Source of successful supplementary stdin execution, preserved without re-execution.
import datetime,json,subprocess,sys,gzip
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex');W=ROOT/'work/resume/task04-transport30-fresh-review';OUT=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-transport30-fresh-review';PACK=OUT.parent/'task04-evidence-transport-30'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
(OUT/'reviewer-fixture-setup-failure.json').write_text(json.dumps({'utcPre':'2026-10-04T13:31:14Z','utcPost':'2026-10-04T13:31:14Z','argv':['python3','-B','-'],'exitCode':1,'failure':'FileExistsError at path.parent.mkdir(parents=True) because first row is in already-created target root. Only reviewer-owned empty fixtures created; no subject-helper execution reached. Corrected with exist_ok=True and new fixture root.','rawStderr':'Traceback (most recent call last):\n  File "<stdin>", line 8, in <module>\n  File "/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/pathlib.py", line 1311, in mkdir\n    os.mkdir(self, mode)\nFileExistsError: [Errno 17] File exists: \'/workspace/Project-Cortex/work/resume/task04-transport30-fresh-review/main-negative/mismatch\'\n'},indent=2)+'\n')
r={'argv':sys.argv,'utcPre':now(),'checks':[]};A=W/'main-negative2';A.mkdir()
def rejects(name,helper,target):
 argv=[sys.executable,str(helper),'--target',str(target),'--materialize'];pre=now();p=subprocess.run(argv,cwd=ROOT,capture_output=True);post=now();(OUT/(name+'.stdout')).write_bytes(p.stdout);(OUT/(name+'.stderr')).write_bytes(p.stderr);r['checks'].append({'name':name,'argv':argv,'utcPre':pre,'utcPost':post,'exitCode':p.returncode,'expectedNonzero':True});assert p.returncode!=0
m=json.loads(gzip.decompress((PACK/'transport-map.json.gz').read_bytes()));mismatch=A/'mismatch';mismatch.mkdir();path=mismatch/m['files'][0][0];path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b'foreign-existing-mismatch');rejects('main-existing-mismatch',PACK/'materialize.py',mismatch);assert path.read_bytes()==b'foreign-existing-mismatch' and len([p for p in mismatch.rglob('*') if p.is_file()])==1
outside=A/'outside';outside.mkdir();link=A/'link';link.symlink_to(outside,target_is_directory=True);rejects('main-target-symlink',PACK/'materialize.py',link/'child');assert not list(outside.iterdir())
for name,mutate_map in [('main-map-corruption',True),('main-chunk-corruption',False)]:
 base=A/name;base.mkdir();(base/'materialize.py').write_bytes((PACK/'materialize.py').read_bytes());packed=(PACK/'transport-map.json.gz').read_bytes();(base/'transport-map.json.gz').write_bytes(packed+b'x' if mutate_map else packed)
 if not mutate_map:
  c=m['chunks'][0];dest=base/c['path'];dest.parent.mkdir();b=bytearray((PACK/c['path']).read_bytes());b[100]^=1;dest.write_bytes(b)
 target=base/'target';rejects(name,base/'materialize.py',target);assert not target.exists()
r['utcPost']=now();r['exitCode']=0;(OUT/'main-negative-receipt.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
