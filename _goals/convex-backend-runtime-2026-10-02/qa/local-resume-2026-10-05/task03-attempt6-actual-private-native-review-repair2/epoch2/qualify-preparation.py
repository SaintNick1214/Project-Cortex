"""Finite held SOURCE/MOCK executor and source publisher. No actual authority or effects.

Root holds/loads this entry after source stop and actual 60-second maturity. Its
own outputs are exclusive and excluded from this first source cohort; a later
mature Root reader must qualify them. No pyc/module cache is an authority.
"""
import hashlib,json,os,stat,sys,time,types,subprocess,datetime,ast
from pathlib import Path
A=Path(__file__).parent;R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
NODE=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node')
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def digest(b):return hashlib.sha256(b).hexdigest()
def exclusive(name,value):
 b=(json.dumps(value,indent=2)+'\n').encode();p=A/name
 with p.open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
 return {'path':str(p),'sha256':digest(b),'bytes':len(b)}
def hold(p,expected=None):
 assert p.is_absolute()and p.is_relative_to(R)and p.resolve()==p
 s=p.lstat();assert time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns)>=60000000000,'maturity_before_first_qualified_baseline'
 assert stat.S_ISREG(s.st_mode)and s.st_uid==501 and s.st_gid==20 and s.st_nlink==1 and 0<=s.st_size<=16777216
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);pin=ident(s);assert ident(os.fstat(fd))==pin
 return {'path':str(p),'fd':fd,'PRE':pin,'expected':expected}
def read(row):
 p=Path(row['path']);assert ident(p.lstat())==ident(os.fstat(row['fd']))==row['PRE'];raw=bytearray();o=0
 while b:=os.pread(row['fd'],65536,o):raw.extend(b);o+=len(b);assert len(raw)<=int(row['PRE']['size'])
 assert len(raw)==int(row['PRE']['size'])and ident(p.lstat())==ident(os.fstat(row['fd']))==row['PRE']
 b=bytes(raw);h=digest(b)
 if row['expected']is not None:assert h==row['expected']['sha256']and len(b)==row['expected']['bytes']
 if 'sha256'in row:assert h==row['sha256']and len(b)==row['bytes']
 row.update(OPEN=ident(os.fstat(row['fd'])),POST=ident(os.fstat(row['fd'])),pathPOST=ident(p.lstat()),sha256=h,bytes=len(b),fullEOF=True)
 return b
def main():
 assert sys.dont_write_bytecode is True;held=[];commands=[]
 try:
  planrow=hold(A/'source-inputs-plan.json');stoprow=hold(A/'source-writers-stopped.json');held.extend([planrow,stoprow])
  plan=json.loads(read(planrow));stop=json.loads(read(stoprow));assert stop['sourceWriters']=='STOPPED'and stop['remainingSourceWrites']==[]
  assert time.time_ns()>=int(stop['stoppedUnixNs'])+60000000000
  opened=[hold(Path(e['path']),e)for e in plan['members']];held.extend(opened)
  assert len(held)==len({r['path']for r in held})<=4096
  assert sum(int(r['PRE']['size'])for r in held)+2097152<=67108864
  for r in opened:assert max(int(r['PRE']['ctime_ns']),int(r['PRE']['mtime_ns']))<=int(stop['stoppedUnixNs'])
  bodies={r['path']:read(r)for r in opened}
  version=subprocess.run([str(NODE),'--version'],capture_output=True,timeout=12,check=True);assert version.stdout.strip()==b'v24.15.0'
  syntax=[]
  for name in ('audit-reader.py','audit-launcher.py','reader-source-controls.py','qualify-preparation.py'):
   ast.parse(bodies[str(A/name)],filename=str(A/name));syntax.append({'path':str(A/name),'kind':'AST','status':'PASS'})
  for name in ('independent-private-observer.mjs','native-evidence-collector.mjs','collector-source-controls.mjs','observer-source-controls.mjs'):
   p=subprocess.run([str(NODE),'--check',str(A/name)],capture_output=True,timeout=12)
   assert p.returncode==0;syntax.append({'path':str(A/name),'kind':'NODE_SYNTAX','status':'PASS'})
  receipts=exclusive('syntax-source-controls.json',{'scope':'HELD_MATURE_SOURCE_SYNTAX_ONLY','status':'PASS','node':str(NODE),'nodeVersion':version.stdout.decode().strip(),'npmCalls':0,'checks':syntax})
  raw=bodies[str(A/'reader-source-controls.py')];m=types.ModuleType('finite_source_controls');m.__file__=str(A/'reader-source-controls.py');m.__package__=''
  begin=time.monotonic();exec(compile(raw,m.__file__,'exec',dont_inherit=True),m.__dict__);commands.append({'name':'reader-source-controls','status':'PASS','elapsedMs':int((time.monotonic()-begin)*1000),'SOURCE_MOCK':True})
  for name in ('collector-source-controls.mjs','observer-source-controls.mjs'):
   p=subprocess.run([str(NODE),str(A/name)],capture_output=True,timeout=12)
   rawout=exclusive(name+'.raw-command.json',{'sourcePath':str(A/name),'node':str(NODE),'nodeVersion':'v24.15.0','argv':[str(NODE),str(A/name)],'exitCode':p.returncode,'stdout':p.stdout.decode(),'stderr':p.stderr.decode(),'timeoutSeconds':12,'scope':'SOURCE_MOCK_ONLY'})
   commands.append(rawout);assert p.returncode==0
  for r in held:read(r)
  fields=('path','PRE','OPEN','POST','pathPOST','sha256','bytes','fullEOF')
  manifest=exclusive('prepared-source-manifest.json',{'scope':'ACTUAL_PRIVATE_NATIVE_AUDIT_REPAIR2_PREPARATION_SOURCE_ONLY_NOT_REVIEW','status':'CLOSED_SOURCE_MOCK_PASS_NOT_ACTUAL','capturedUnixNs':str(time.time_ns()),'sourceWriters':'STOPPED','sourceStopSha256':stoprow['sha256'],'files':[{k:r[k]for k in fields}for r in held],'sourceCount':len(held),'sourceBytes':sum(r['bytes']for r in held),'futureDataReserveBytes':2097152,'sourceBudget4096_64MiB_16MiB':True,'outputsSelfExcluded':True,'actualPrivateAccepted':False,'actualNativeAccepted':False,'fullTask03':False,'goalAccepted':False})
  exclusive('preparation-commands.json',{'scope':'SOURCE_MOCK_ONLY_NOT_ACTUAL','status':'PASS','nodeVersion':'v24.15.0','nodeOrigin':str(NODE),'npmCalls':0,'commands':commands,'syntaxReceipt':receipts,'manifest':manifest,'privateReads':0,'DockerCommands':0,'CLICommands':0,'networkCalls':0,'targetEffects':0})
  print(json.dumps({'status':'CLOSED_SOURCE_MOCK_PASS_NOT_ACTUAL','manifest':manifest}));return 0
 except BaseException as e:
  exclusive('preparation-failure.json',{'scope':'IMMUTABLE_PREPARATION_FAILURE_NO_REPIN','status':'FAIL','failureClass':type(e).__name__,'commands':commands,'actualPrivateAccepted':False,'actualNativeAccepted':False});raise
 finally:
  for r in held:os.close(r['fd'])
if __name__=='__main__':raise SystemExit(main())
