"""Independent Task04 whole graph owner; source-only, no candidate entry execution."""
import os,stat,sys,time,hashlib,json,resource,traceback
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
J=P/'task04-r3-c5-independent-source-review1';A=P/'task04-current-producer-native-public-repair3';B=P/'task04-current-producer-native-public-consumer-repair3'
F=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns');pins={};total=0;closed=False
MAXFD=4096;MAXBYTES=67108864;MAXFILE=16777216

def nine(s):return {k:str(getattr(s,'st_'+k))for k in F}
def sha(b):return hashlib.sha256(b).hexdigest()
def strict(b):
 def pairs(items):
  d={}
  for k,v in items:
   if k in d:raise ValueError('duplicate key')
   d[k]=v
  return d
 return json.loads(b,object_pairs_hook=pairs,parse_constant=lambda x:(_ for _ in()).throw(ValueError('nonfinite')))
def capture(p):
 global total
 p=Path(p);assert p.is_absolute()and p.resolve()==p
 if str(p)in pins:return pins[str(p)]
 s=p.lstat();assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20
 assert 0<=s.st_size<=MAXFILE and len(pins)+1<=MAXFD and total+s.st_size<=MAXBYTES
 assert time.time_ns()>=max(s.st_mtime_ns,s.st_ctime_ns)+60_000_000_000,'immature:'+str(p)
 assert p.name not in ('.env','.env.local','.env.test'),'private input forbidden'
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);pin={'path':str(p),'fd':fd,'PRE9':nine(s),'capturedUnixNs':str(time.time_ns()),'closeAttempted':False};pins[str(p)]=pin;total+=s.st_size
 assert nine(os.fstat(fd))==pin['PRE9'];return pin

def qualify(pin,expected=None,collect=False):
 assert nine(os.fstat(pin['fd']))==pin['PRE9'];os.lseek(pin['fd'],0,0);digest=hashlib.sha256();length=0;chunks=[]
 while b:=os.read(pin['fd'],65536):
  length+=len(b);assert length<=int(pin['PRE9']['size']);digest.update(b)
  if collect:chunks.append(b)
 assert length==int(pin['PRE9']['size'])and nine(os.fstat(pin['fd']))==nine(Path(pin['path']).lstat())==pin['PRE9']
 pin.update(sha256=digest.hexdigest(),bytes=length,fullEOF=True)
 if expected is not None:
  assert pin['sha256']==expected['sha256']and length==expected['bytes'],'expected_source_bytes:'+pin['path']
 return b''.join(chunks)

def closeall():
 global closed
 errors=[]
 for pin in pins.values():
  if pin['closeAttempted']:continue
  pin['closeAttempted']=True
  try:os.close(pin['fd'])
  except BaseException as e:errors.append({'path':pin['path'],'class':type(e).__name__,'reason':str(e)})
 closed=True;return errors

def emit(d):print(json.dumps(d,separators=(',',':')),flush=True)
def initialize():
 soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
 if soft<8192:resource.setrlimit(resource.RLIMIT_NOFILE,(min(hard,8192),hard))
 controls=[P/'root-task04-r3-c5-independent-source-review-handoff.json',P/'root-task04-r3-c5-mature-readback2.json',B/'final-current-combined-closure.json',R/'_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md',R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-full-partial-review/report.md',R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-recorder-v6-review/review.md',J/'held-review-reader.py',J/'reader-author-writer-stop.json',J/'bootstrap1-failure.json',J/'held-review-reader2.py',J/'reader2-author-writer-stop.json',J/'holder1-failure.json']
 for p in controls:capture(p)
 handoff=strict(qualify(pins[str(controls[0])],collect=True));assert handoff['forbiddenEffects']and handoff['fullTask04Accepted']is False
 root=strict(qualify(pins[str(controls[1])],{'sha256':'f4015c8892013f97dd68321495686dde66ebd75012d8c333c93fa0d63a2b8d10','bytes':138703},True));rootby={r['path']:r for r in root['files']};assert len(rootby)==197
 raw=qualify(pins[str(controls[2])],{'sha256':'4433be69064ecb94694fa7243040e2c466ad739396b16b128ef6ba9c56419e9d','bytes':2502349},True);mf=strict(raw)
 emit({'stage':'CONTROL_HEADERS','MFkeys':list(mf),'files':len(pins),'bytes':total})
 # No candidate executable/manifest member content is read until every declared graph member FD is held.
 rows=mf.get('files',mf.get('members',mf.get('entries')));assert isinstance(rows,list),'unknown combined closure row schema'
 for row in rows:
  p=row.get('path',row.get('absolutePath'));assert isinstance(p,str);capture(p)
 for path in rootby:capture(path)
 assert len(rows)==1535,'declared1535'
 for row in rows:
  p=row.get('path',row.get('absolutePath'));pin=pins[p];qualify(pin,row)
  for key in ('PRE9','PRE','originalNine','identityDecimal'):
   if key in row and isinstance(row[key],dict)and set(row[key])==set(F):assert pin['PRE9']==row[key],'declared_original_nine:'+p
 for path,row in rootby.items():
  pin=pins[path];assert pin['PRE9']==row['PRE9'];qualify(pin,row)
 for p in controls:qualify(pins[str(p)])
 publish={'scope':'TASK04_INDEPENDENT_WHOLE_SOURCE_GRAPH_INITIAL_HELD','status':'HELD_SOURCE_ONLY','sourceRows':len(rows),'uniqueInputPaths':len(pins),'bytes':total,'limits':{'files':MAXFD,'bytes':MAXBYTES,'perFileBytes':MAXFILE},'allGraphFDsBeforeMemberBody':True,'allRoot197OriginalPinsConserved':True,'pins':[{k:v for k,v in r.items()if k!='fd'}for r in pins.values()],'actualEffects':False}
 out=J/'initial-held-source2.json';assert not out.exists();out.write_text(json.dumps(publish,indent=2)+'\n')
 emit({'stage':'HELD','sourceRows':len(rows),'uniquePaths':len(pins),'bytes':total,'remainingBytes':MAXBYTES-total})

def request(d):
 op=d['op']
 if op=='read':
  p=d['path'];assert p in pins;raw=qualify(pins[p],collect=True);assert len(raw)<=262144
  emit({'path':p,'sha256':sha(raw),'bytes':len(raw),'text':raw.decode()})
 elif op=='add':
  paths=d['paths']
  for p in paths:capture(p)
  for p in paths:qualify(pins[p])
  emit({'stage':'ADDED','paths':len(paths),'totalFiles':len(pins),'totalBytes':total,'remainingBytes':MAXBYTES-total})
 elif op=='exec':
  p=d['path'];assert p in pins and Path(p).is_relative_to(J);raw=qualify(pins[p],collect=True)
  ns={'__name__':'held_independent_control','__file__':p,'__package__':None,'held_source':lambda q:qualify(pins[str(q)],collect=True),'cohort_pins':pins,'cohort_qualify':qualify,'source_ledger':lambda:{'files':len(pins),'bytes':total,'remainingBytes':MAXBYTES-total}}
  exec(compile(raw,p,'exec',dont_inherit=True),ns);result=ns['main']();emit({'stage':'CONTROL_RESULT','result':result})
 elif op=='final':
  for pin in pins.values():qualify(pin)
  proof={'scope':'TASK04_INDEPENDENT_HELD_FINAL_SOURCE_NINE_EOF_HASH','pins':[{k:v for k,v in p.items()if k!='fd'}for p in pins.values()],'allHeldFinal':True,'uniquePaths':len(pins),'bytes':total,'actualEffects':False}
  out=J/'final-held-source.json';assert not out.exists();out.write_text(json.dumps(proof,indent=2)+'\n');emit({'stage':'FINAL_HELD','files':len(pins),'bytes':total})
 elif op=='close':
  errors=closeall();proof={'scope':'TASK04_INDEPENDENT_ALL_OWNED_SOURCE_CLOSE_ATTEMPTS','attempts':len(pins),'closeErrors':errors,'allAttemptedExactlyOnce':all(p['closeAttempted']for p in pins.values()),'unknownRetry':False,'actualEffects':False};out=J/'source-FDclosure.json';assert not out.exists();out.write_text(json.dumps(proof,indent=2)+'\n');emit({'stage':'CLOSED',**proof});return False
 else:raise ValueError('unknown read-only operation')
 return True
try:
 initialize()
 for line in sys.stdin:
  try:
   if not request(strict(line)):break
  except BaseException as e:emit({'stage':'REQUEST_FAILURE','class':type(e).__name__,'reason':str(e),'trace':traceback.format_exc()})
except BaseException as e:
 errors=closeall();p=J/'holder2-failure.json';assert not p.exists();p.write_text(json.dumps({'scope':'TASK04_INDEPENDENT_HOLDER_FAILED_NOT_REPAIRED','class':type(e).__name__,'reason':str(e),'trace':traceback.format_exc(),'pins':[{k:v for k,v in r.items()if k!='fd'}for r in pins.values()],'closeErrors':errors,'actualEffects':False},indent=2)+'\n');emit({'stage':'HOLDER_FAILURE','class':type(e).__name__,'reason':str(e),'explicitCloses':len(pins),'closeErrors':errors});raise
finally:
 if not closed:closeall()
