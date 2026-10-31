"""Source-only loader for the prepared reader, not an actual audit authorization.

Root must freshly hold/compile this stopped entry after maturity. This loader then
holds all finite reader inputs before compiling reader bytes at actual first use.
"""
import hashlib,json,os,stat,sys,time,types
from pathlib import Path
A=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-actual-private-native-review-repair2/bounded2')
fields=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {k:str(getattr(s,'st_'+k))for k in fields}
def read(row):
 p,fd,pin,limit=row;assert identity(os.fstat(fd))==identity(p.lstat())==pin
 b=bytearray();offset=0
 while data:=os.pread(fd,65536,offset):b.extend(data);offset+=len(data);assert len(b)<=limit and len(b)<=int(pin['size'])
 assert len(b)==int(pin['size'])and identity(os.fstat(fd))==identity(p.lstat())==pin;return bytes(b)
def hold(p,limit):
 assert p.is_absolute()and p.is_relative_to(Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion'))and p.resolve()==p;s=p.lstat();assert time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns)>=60000000000,'mature_before_first_qualifying_baseline';assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);pin=identity(s);assert identity(os.fstat(fd))==pin;return(p,fd,pin,limit)
class ReaderLease:
 def __init__(self,rows):self.rows=rows;self.closed=False
 def closecheck(self):
  assert not self.closed
  for row in self.rows:read(row)
  return True
 def close(self):
  if not self.closed:
   for row in self.rows:os.close(row[1])
   self.closed=True

def load_reader(plan_sha256):
 assert sys.dont_write_bytecode and type(plan_sha256)is str and len(plan_sha256)==64
 rows=[]
 try:
  planrow=hold(A/'audit-plan.json',2097152);stoprow=hold(A/'source-writers-stopped.json',65536);rows.extend([planrow,stoprow])
  planraw=read(planrow);assert hashlib.sha256(planraw).hexdigest()==plan_sha256;plan=json.loads(planraw);stop=json.loads(read(stoprow))
  assert stop['sourceWriters']=='STOPPED'and stop['remainingSourceWrites']==[]
  opened=[(e,hold(Path(e.get('path',str(A/e['name']))),e['limit']))for e in plan['readerInputs']];rows.extend(r for _,r in opened)
  assert len(rows)<=4096 and sum(int(r[2]['size'])for r in rows)+2097152<=67108864
  bodies={}
  for e,row in opened:
   raw=read(row);assert hashlib.sha256(raw).hexdigest()==e['sha256']and len(raw)==e['bytes']
   assert max(int(row[2]['ctime_ns']),int(row[2]['mtime_ns']))<=int(stop['stoppedUnixNs']);bodies[e['name']]=raw
  for row in rows:read(row)
  module=types.ModuleType('prepared_independent_actual_bounded_reader');module.__file__=str(A/'audit-reader.py');module.__package__=''
  exec(compile(bodies['audit-reader.py'],module.__file__,'exec',dont_inherit=True),module.__dict__);module.OWN_BODIES.update(bodies);module.OWN_BODIES['audit-plan.json']=planraw
  return module,ReaderLease(rows)
 except BaseException:
  for row in rows:os.close(row[1])
  raise

def main():
 assert sys.dont_write_bytecode and len(sys.argv)==5 and sys.argv[1]=='--plan-sha256'and sys.argv[3]=='--handoff'
 plan_sha=sys.argv[2];handoff=sys.argv[4];module,lease=load_reader(plan_sha)
 try:
  sys.argv=[module.__file__,'--handoff',handoff];result=module.main();lease.closecheck();return result
 finally:lease.close()
if __name__=='__main__':raise SystemExit(main())
