from pathlib import Path
import os, stat, hashlib, json, datetime
B=Path('/workspace/Project-Cortex')
roots=[(B/'work/resume/task04-c4-incident-recovery-fresh-review','work-manifest.json'),(B/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c4-incident-recovery-fresh-review','qa-manifest.json')]
def inventory(root,selfname):
 rows=[];stack=[root]
 while stack:
  p=stack.pop()
  for e in os.scandir(p):
   ep=Path(e.path);rel=str(ep.relative_to(root));s=ep.lstat()
   if stat.S_ISDIR(s.st_mode):stack.append(ep);continue
   if rel==selfname:continue
   assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
   b=ep.read_bytes();rows.append({'path':rel,'kind':'file','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 return sorted(rows,key=lambda r:r['path'])
for root,name in roots:
 rows=inventory(root,name)
 d={'root':str(root),'excludeONLY':name,'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':rows,'native':'NOT_RUN','scope':'Independent C4 recovery review only'}
 p=root/name;assert not p.exists();p.write_text(json.dumps(d,indent=2)+'\n')
 assert json.loads(p.read_bytes())['files']==inventory(root,name)
 print(json.dumps({'path':str(p.relative_to(B)),'rows':len(rows),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'exactSelfOnly':True}))
original=B/'work/resume/task04-model-drift-native-preparation-c4/work-manifest.json'
assert hashlib.sha256(original.read_bytes()).hexdigest()=='0e3575cdb2978556896a4fa41e78a370d417d2b3352367717ad0a274b81e1901'
