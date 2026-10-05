from pathlib import Path
import datetime,json,hashlib,sys
root=Path('/workspace/Project-Cortex');q=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-convex-money-public-c2-fresh-review';w=root/'work/resume/task04-convex-money-public-c2-fresh-review'
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
start=now();code=0;error=None
try:
 before=json.loads((q/'review-inputs-before.json').read_text());rows=before['files']
 for rec in rows:
  p=root/rec['path'];data=p.read_bytes();assert hashlib.sha256(data).hexdigest()==rec['sha256'] and len(data)==rec['bytes'],rec['path']
 (q/'review-inputs-after.json').write_text(json.dumps({'utc':now(),'files':rows,'unchanged':True},indent=2)+'\n')
except Exception as e:
 code=1;error={'type':type(e).__name__,'message':str(e)}
receipt={'preUTC':start,'postUTC':now(),'rawArgv':['python3',*sys.argv],'cwd':str(root),'exitCode':code,'error':error,'stdout':'Reviewed input hashes unchanged' if code==0 else '', 'stderr': '' if error is None else str(error)}
(q/'seal-command.json').write_text(json.dumps(receipt,indent=2)+'\n')
if code:sys.exit(code)
# Preserve own helper source bytes in review; scratch sealed separately.
for p in w.iterdir():
 if p.is_file() and p.name!='scratch-manifest.json':
  dest=q/'own-helper-sources'/p.name;dest.parent.mkdir(exist_ok=True);dest.write_bytes(p.read_bytes())
for directory,name in [(w,'scratch-manifest.json'),(q,'qa-manifest.json')]:
 files=[]
 for p in sorted(directory.rglob('*')):
  if p.is_file() and p!=directory/name:
   b=p.read_bytes();files.append({'path':str(p.relative_to(directory)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 manifest={'excludedExactSelf':name,'fileCount':len(files),'files':files};(directory/name).write_text(json.dumps(manifest,indent=2)+'\n')
 for rec in files:
  p=directory/rec['path'];b=p.read_bytes();assert len(b)==rec['bytes'] and hashlib.sha256(b).hexdigest()==rec['sha256']
 print(name,hashlib.sha256((directory/name).read_bytes()).hexdigest(),len(files))
print('report',hashlib.sha256((q/'report.md').read_bytes()).hexdigest())
