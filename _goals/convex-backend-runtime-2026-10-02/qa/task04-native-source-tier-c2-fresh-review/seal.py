import json,hashlib,datetime,sys,os
from pathlib import Path
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-native-source-tier-c2-fresh-review';O=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-source-tier-c2-fresh-review'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
r={'argv':sys.argv,'cwd':str(R),'utcPre':now(),'exitCode':0,'rawStreams':'final seal output in tool log; not retrospectively captured into a sealed file','referencePost':[]}
for x in json.loads((O/'audit-receipt.json').read_text())['referenceAfter']:
 p=R/x['path'];b=(p/'qa-manifest.json').read_bytes();assert sha(b)==x['manifestSha256'];m=json.loads(b);actual={f.relative_to(p).as_posix() for f in p.rglob('*') if f.is_file()};assert actual=={y['path'] for y in m['rows']}|{'qa-manifest.json'}
 assert not any(f.is_symlink() for f in p.rglob('*'))
 for y in m['rows']:
  b=(p/y['path']).read_bytes();assert len(b)==y['bytes'] and sha(b)==y['sha256']
 r['referencePost'].append(x)
for name in ['audit.py','context.py','seal.py']:(O/name).write_bytes((W/name).read_bytes())
def manifest(p):
 files=sorted(f for f in p.rglob('*') if f.is_file() and f!=p/'qa-manifest.json');assert not any(f.is_symlink() for f in p.rglob('*'));rows=[]
 for f in files:
  b=f.read_bytes();rows.append({'path':f.relative_to(p).as_posix(),'kind':'file','bytes':len(b),'sha256':sha(b)})
 payload={'utc':now(),'excludesOnly':'qa-manifest.json','links':'none; all regular files','rows':rows};b=(json.dumps(payload,indent=2)+'\n').encode();(p/'qa-manifest.json').write_bytes(b)
 assert {f.relative_to(p).as_posix() for f in p.rglob('*') if f.is_file()}=={x['path'] for x in rows}|{'qa-manifest.json'}
 for x in rows:
  b2=(p/x['path']).read_bytes();assert len(b2)==x['bytes'] and sha(b2)==x['sha256']
 return {'path':str(p.relative_to(R)),'manifestSha256':sha(b),'rows':len(rows),'filesIncludingSelf':len(rows)+1}
r['qa']=manifest(O);r['reportSha256']=sha((O/'report.md').read_bytes());r['utcPost']=now();r['scratchExpectedRows']=4;r['scratchExpectedFilesIncludingSelf']=5
(W/'seal-receipt.json').write_text(json.dumps(r,indent=2)+'\n');scratch=manifest(W);assert scratch['rows']==4 and scratch['filesIncludingSelf']==5
print(json.dumps({'verdict':'PASS DESIGN ONLY CONDITIONAL','reportSha256':r['reportSha256'],'qa':r['qa'],'scratch':scratch,'exitCode':0}))
