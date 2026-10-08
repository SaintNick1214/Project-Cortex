"""SOURCE_AID_ONLY execution recorder, independent stdlib, own microcontrols only."""
from pathlib import Path
import os,json,hashlib,subprocess,datetime,sys
W=Path('/workspace/Project-Cortex/work/resume/task04-c7-exact-identity-source-aid')
N=Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node')
fields=['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']
def capture(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  ident=lambda s:{k:str(getattr(s,'st_'+k)) for k in fields}
  a=ident(os.fstat(fd));h=hashlib.sha256();size=0
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b);size+=len(b)
  z=ident(os.fstat(fd));l=ident(os.lstat(p));assert a==z==l
  return dict(path=str(p),PRE=a,POST=z,pathPOST=l,bytes=size,sha256=h.hexdigest())
 finally:os.close(fd)
paths=[N,Path(sys.executable).resolve(),W/'microcontrols.mjs',W/'own-fixture.txt',Path(__file__)]
pre=[capture(p)for p in paths];argv=[str(N),str(W/'microcontrols.mjs')];utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
record=dict(label='SOURCE_AID_ONLY',argv=argv,cwd=str(W),utcPRE=utc(),sourcePRE=pre,timeoutSeconds=20)
(W/'microcontrol-before.json').write_text(json.dumps(record,indent=2)+'\n')
run=subprocess.run(argv,cwd=W,env={'PATH':str(N.parent)+':/usr/bin:/bin','TMPDIR':str(W)},capture_output=True,timeout=20)
(W/'microcontrol.stdout').write_bytes(run.stdout);(W/'microcontrol.stderr').write_bytes(run.stderr)
record.update(utcPOST=utc(),exitCode=run.returncode,sourcePOST=[capture(p)for p in paths],raws=[capture(W/'microcontrol.stdout'),capture(W/'microcontrol.stderr')])
record['sourceEqual']=record['sourcePRE']==record['sourcePOST']
(W/'microcontrol-receipt.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(dict(label=record['label'],exitCode=run.returncode,sourceEqual=record['sourceEqual'],stdoutBytes=len(run.stdout),stderrBytes=len(run.stderr))))
