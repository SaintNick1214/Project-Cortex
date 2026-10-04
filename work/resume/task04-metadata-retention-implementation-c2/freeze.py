from pathlib import Path
import subprocess,json,hashlib,datetime,sys
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c2';w=r/'work/resume/task04-metadata-retention-implementation-c2'
files=[str(p.relative_to(r)) for p in [w/'freeze.py',w/'freeze-check.py',w/'capture.py',q/'report.md',q/'requirements-outcomes.json',q/'verification.json',q/'candidate-installation.json']]
x=subprocess.run(['python3',str((w/'capture.py').relative_to(r)),'freeze-check',json.dumps(files),'python3',str((w/'freeze-check.py').relative_to(r))],cwd=r)
if x.returncode:sys.exit(x.returncode)
h=lambda b:hashlib.sha256(b).hexdigest();summary={}
for base,name in [(q,'qa-seal.json'),(w,'scratch-seal.json')]:
 assert not (base/name).exists()
 rows=[]
 for p in sorted(base.rglob('*')):
  assert not p.is_symlink()
  if p.is_file():
   assert p.stat().st_nlink==1
   b=p.read_bytes();rows.append({'path':str(p.relative_to(base)),'sha256':h(b),'bytes':len(b),'mode':oct(p.stat().st_mode&0o777),'nlink':1})
 obj={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':str(base.relative_to(r)),'exactSelfExcluded':name,'recursive':True,'files':rows,'directories':[str(p.relative_to(base)) for p in sorted(base.rglob('*')) if p.is_dir()],'noAcceptance':'Independent implementation gate required; actual EMPTY/null/uninstalled'}
 (base/name).write_text(json.dumps(obj,indent=2)+'\n')
 summary[name]={'rows':len(rows),'sha256':h((base/name).read_bytes()),'bytes':(base/name).stat().st_size}
print(json.dumps({'frozen':True,'reportSha256':h((q/'report.md').read_bytes()),'seals':summary,'actual':'EMPTY/null/uninstalled','gate':'fresh independent implementation'}))
