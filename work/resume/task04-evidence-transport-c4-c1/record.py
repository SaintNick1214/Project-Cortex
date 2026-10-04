import datetime,hashlib,json,os,subprocess,sys
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1')
S=Path('work/resume/task04-evidence-transport-c4-c1');tag=sys.argv[1];argv=sys.argv[2:]
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def state():
 out=[]
 for root in [Q,S]:
  for p in sorted(root.rglob('*')):
   if p.is_file() and not p.is_symlink():
    b=p.read_bytes();out.append({'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'mode':p.stat().st_mode & 0o7777,'nlink':p.stat().st_nlink})
 return out
pre=state();start=now()
with (Q/(tag+'.stdout')).open('xb') as out,(Q/(tag+'.stderr')).open('xb') as err:r=subprocess.run(argv,stdout=out,stderr=err)
receipt={'utcPRE':start,'utcPOST':now(),'argv':argv,'cwd':os.getcwd(),'exit':r.returncode,'pre':pre,'post':state(),'prebyteBacking':'Exact existing own bytes retained in history when modified; frozen source manifest closure is immutable backing; bootstrap exceptions explicitly NOT_CAPTURED'}
(Q/(tag+'.command.json')).write_text(json.dumps(receipt,indent=2)+'\n');sys.exit(r.returncode)
