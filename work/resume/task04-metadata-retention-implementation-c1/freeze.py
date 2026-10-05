from pathlib import Path
import json,hashlib,subprocess,datetime,sys
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c1';w=r/'work/resume/task04-metadata-retention-implementation-c1'
files=[str(p.relative_to(r)) for p in [w/'freeze.py',w/'freeze-check.py',w/'capture-store.py',q/'report.md',q/'requirements-outcomes.json',q/'verification.json',q/'candidate-installation.json']]
argv=['python3',str((w/'capture-store.py').relative_to(r)),'freeze-input-check-03',json.dumps(files),'python3',str((w/'freeze-check.py').relative_to(r))]
x=subprocess.run(argv,cwd=r)
if x.returncode:sys.exit(x.returncode)
h=lambda b:hashlib.sha256(b).hexdigest()
summary={}
for base,name in [(q,'qa-seal.json'),(w,'scratch-seal.json')]:
 own=base/name;assert not own.exists()
 rows=[]
 for p in sorted(base.rglob('*')):
  assert not p.is_symlink(),p
  if p.is_file():
   assert p.stat().st_nlink==1,p
   b=p.read_bytes();rows.append({'path':str(p.relative_to(base)),'bytes':len(b),'sha256':h(b),'mode':oct(p.stat().st_mode&0o777),'nlink':1})
 closure={'scope':str(base.relative_to(r)),'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exactSelfExcluded':name,'recursive':True,'files':rows,'directories':[str(p.relative_to(base)) for p in sorted(base.rglob('*')) if p.is_dir()],'history':'historical hardlink dedup action retained; archives subsequently restored nlink1, no original inode/metadata restoration claimed'}
 own.write_text(json.dumps(closure,indent=2)+'\n')
 summary[name]={'rows':len(rows),'sha256':h(own.read_bytes()),'bytes':own.stat().st_size}
print(json.dumps({'frozen':True,'reportSha256':h((q/'report.md').read_bytes()),'seals':summary,'actual':'EMPTY/null/uninstalled; fresh independent judge required'}))
