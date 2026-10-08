"""Independent Root R6 CODE/HOST review; no Source or service release."""
import ast,contextlib,difflib,hashlib,io,json,os,stat,sys,time,traceback,types
from pathlib import Path
J=Path("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-phase-repair6-independent-review4/prospective-document-epoch2")
R=Path("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion")
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
A=P/'task03-f2-close-fence-repair6'
K=P/'task03-phase-partition-independent-review3'
ORIGINAL=P/'task03-f2-phase-partition-repair4'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
MAX_FD=4096;MAX_BYTES=67108864;MAX_FILE=16777216
RESERVES=4194304+1048576+2097152
owned=[];rows=[];body={};close_receipts=[];failures=[];events=[];data={};mods={}
start=time.monotonic();MAX_REVIEW_SECONDS=1200
def identity(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def fail(stage,e):failures.append({'stage':stage,'type':type(e).__name__,'message':str(e)})
def fd_take(pin):
 path=pin['path'];s=os.lstat(path);n=identity(s)
 assert str(Path(path))==str(Path(path).absolute()) and Path(path).resolve()==Path(path),'path_alias'
 assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20,'file_identity'
 assert n==pin['PRE9'],'original_nine_changed'
 age=time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns)
 assert age>=240000000000,('current_source_maturity',path,age)
 assert s.st_size==pin['bytes']<=MAX_FILE
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:owned.append((fd,path))
 except BaseException as e:
  fail('owner_registration',e)
  try:os.close(fd);close_receipts.append({'path':path,'attempt':1,'error':None,'fallback':True})
  except BaseException as c:fail('fallback_close_unknown',c);close_receipts.append({'path':path,'attempt':1,'error':type(c).__name__,'fallback':True})
  raise
 row={'path':path,'fd':fd,'expectedSha256':pin['sha256'],'expectedBytes':pin['bytes'],'PRE9':n,'OPEN9':identity(os.fstat(fd)),'firstCaptureMinimumAgeNs':str(age)}
 rows.append(row)
 assert row['OPEN9']==n and identity(os.lstat(path))==n
 return row
def full_read(row,final=False):
 out=bytearray();offset=0
 while True:
  b=os.pread(row['fd'],65536,offset)
  if not b:break
  offset+=len(b);out.extend(b);assert len(out)<=MAX_FILE
 assert len(out)==row['expectedBytes'] and hashlib.sha256(out).hexdigest()==row['expectedSha256'],'fullEOF_hash_size'
 assert identity(os.fstat(row['fd']))==row['PRE9']==identity(os.lstat(row['path'])),'held_nine_changed'
 row['fullEOF']=True;row['bytes']=len(out);row['sha256']=hashlib.sha256(out).hexdigest()
 if final:row['FINAL9']=identity(os.fstat(row['fd']));row['pathFINAL9']=identity(os.lstat(row['path']));row['finalFullEOFHashSize']=True
 else:row['POST9']=identity(os.fstat(row['fd']))
 return bytes(out)
def fence():
 errs=[]
 for row in rows:
  try:full_read(row,True)
  except BaseException as e:fail('final_fence',e);errs.append(row['path'])
 assert not errs,errs
def output(value):
 s=json.dumps(value,sort_keys=True);assert len(s.encode())<=262144
 print(s,flush=True)
def compile_mod(name,path):
 m=types.ModuleType(name);m.__file__=str(path);sys.modules[name]=m
 exec(compile(body[str(path)],str(path),'exec'),m.__dict__);return m
def controls():
 assert not mods
 m=compile_mod('independent_review4_phase',A/'phase_partition4.py');mods['phase_candidate']=m
 data['original_phase2']=body[str(ORIGINAL/'phase_partition2.py')]
 data['original_controls2']=body[str(ORIGINAL/'partition_controls2.py')]
 data['partition_controls2.py']=data['original_controls2']
 summaries=[];stdout=io.StringIO()
 for code_name,var in [('independent_cases1.py','summary'),('independent_additional_cases1.py','result'),('independent_close_fence_cases1.py','result')]:
  ns={'mods':mods,'data':data,'D':J,'A':A,'ORIGINAL':ORIGINAL,'json':json,'Path':Path}
  with contextlib.redirect_stdout(stdout):
   exec(compile(body[str(K/code_name)],str(K/code_name),'exec'),ns)
  val=ns[var];summaries.append(val)
 raw=stdout.getvalue();assert len(raw.encode())<=262144
 (J/'independent-control-stdout1.txt').write_text(raw)
 initial=summaries[0];original=initial['original97']
 observed=original['discovered']+initial['discovered']-1+sum(x['discovered']for x in summaries[1:])
 failed=original['failed']+initial['failed']+sum(x['failed']for x in summaries[1:])
 aggregate={'scope':'INDEPENDENT_ROOT_REPAIR6_CODE_HOST_ONLY','original97':original,'independentBlocks':summaries,
  'discovered':observed,'executed':observed,'passed':observed-failed,'failed':failed,'skipped':0,
  'exactPreparedControlBytes':True,'adaptation':'D fixture and output binding to reviewer-owned J only; no assertion edits',
  'candidateSourceHash':hashlib.sha256(body[str(A/'phase_partition4.py')]).hexdigest(),
  'allCandidateFDsHeld':True,'SourceEligibility':False,'functionalTask03Accepted':False,
  'effects':0,'python':sys.version,'sourceContextDeadlineSeconds':MAX_REVIEW_SECONDS}
 (J/'independent-control-results1.json').write_text(json.dumps(aggregate,indent=2,sort_keys=True)+'\n')
 fence()
 return {k:v for k,v in aggregate.items()if k not in ('original97','independentBlocks')}
def inspect():
 old=body[str(P/'task03-f2-phase-contract-repair5/phase_partition3.py')].decode()
 new=body[str(A/'phase_partition4.py')].decode()
 delta=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='immutable_A5',tofile='Root_R6'))
 code=ast.parse(new);o=ast.parse(old)
 def defs(t):
  return {(c.name,x.name):ast.dump(x,include_attributes=False)for c in t.body if isinstance(c,ast.ClassDef)for x in c.body if isinstance(x,(ast.FunctionDef,ast.AsyncFunctionDef))}
 od,nd=defs(o),defs(code)
 changed=sorted(k for k in set(od)|set(nd)if od.get(k)!=nd.get(k))
 assert changed==[('Ledger','approval_binding'),('Ledger','preflight'),('PhaseMachine','advance')],changed
 witness={'semanticMethodChanges':changed,'fullTextDiff':delta,'otherASTUnchanged':
  ast.dump(ast.Module(body=[x for x in o.body if not isinstance(x,ast.ClassDef)],type_ignores=[]),include_attributes=False)==ast.dump(ast.Module(body=[x for x in code.body if not isinstance(x,ast.ClassDef)],type_ignores=[]),include_attributes=False)}
 (J/'candidate-semantic-delta1.json').write_text(json.dumps(witness,indent=2,sort_keys=True)+'\n')
 return {'witness':witness,'currentCode':new}
def finish():
 fence()
 return {'allRowsFinalExact':True,'heldRows':len(rows),'heldBytes':sum(x['bytes']for x in rows),'minimumFirstCaptureAgeNs':min(int(x['firstCaptureMinimumAgeNs'])for x in rows)}
try:
 # Own immutable bootstrap source/header pins are supplied by the native review invocation.
 arg=json.loads(sys.argv[1]);own_pins=arg['own']
 assert len(own_pins)==3
 own_rows=[fd_take(x)for x in own_pins]
 for row in own_rows:body[row['path']]=full_read(row)
 assert body[str(Path(__file__))]==body[own_pins[0]['path']]
 plan=json.loads(body[str(J/'review-source-inputs-plan1.json')]);stop=json.loads(body[str(J/'review-writers-stopped1.json')])
 assert stop['state']=='STOPPED'and stop['remainingWrites']==[]
 assert hashlib.sha256(body[str(J/'review-source-inputs-plan1.json')]).hexdigest()==stop['sourcePlanSha256']
 pins=plan['members'];by={}
 for pin in own_pins+pins:
  if pin['path']in by:
   assert pin==by[pin['path']],'conflicting_duplicate_before_member_IO'
  else:by[pin['path']]=pin
 assert len(by)<=MAX_FD and sum(x['bytes']for x in by.values())+RESERVES+plan['priorAdmissionDebtBytes']<=MAX_BYTES,'one_cumulative_source_budget'
 assert not set(x['path']for x in own_pins)&set(x['path']for x in pins)
 member_rows=[fd_take(x)for x in pins]
 events.append({'event':'ALL_MEMBER_FDS_HELD_BEFORE_FIRST_MEMBER_BODY','count':len(member_rows)})
 for row in member_rows:body[row['path']]=full_read(row)
 fence()
 output({'state':'WHOLE_SOURCE_HELD','count':len(rows),'bytes':sum(x['bytes']for x in rows),'allOriginalNinesMatched':True,'allFDsBeforeMemberBodies':True,'minimumFirstCaptureAgeNs':min(int(x['firstCaptureMinimumAgeNs'])for x in rows),'SourceEligibility':False})
 for line in sys.stdin:
  assert time.monotonic()-start<MAX_REVIEW_SECONDS,'independent_source_review_deadline'
  assert len(line.encode())<=327692
  request=json.loads(line)
  if request['op']=='inspect':output(inspect())
  elif request['op']=='controls':output(controls())
  elif request['op']=='fence':output(finish())
  elif request['op']=='finish':output(finish());break
  else:raise ValueError('unknown_control_operation')
 else:raise RuntimeError('review_pipe_closed_without_explicit_finish')
except BaseException as e:
 fail('primary',e);traceback.print_exc()
finally:
 # Sticky primary/final/report failures never bypass the complete detached once-close loop.
 for fd,path in owned:
  rec={'path':path,'attempt':1,'error':None}
  try:os.close(fd)
  except BaseException as e:rec['error']={'type':type(e).__name__,'message':str(e)};fail('close_unknown',e)
  close_receipts.append(rec)
 result={'scope':'INDEPENDENT_ROOT_REPAIR6_SOURCE_CUSTODY_NOT_WHOLE_SOURCE_ACCEPTANCE',
  'rows':[{k:v for k,v in r.items()if k!='fd'}for r in rows],'events':events,'FDCloses':close_receipts,'failures':failures,
  'allOwnedFDsAttemptedExactlyOnce':len(close_receipts)==len(owned),
  'simultaneousActualFDPeak':len(owned),'SourceEligibility':False,'effects':0}
 try:(J/'review-held-source-FDclosure1.json').write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
 except BaseException as e:fail('publication',e);traceback.print_exc()
 output({'state':'CLOSED','rows':len(rows),'closeAttempts':len(close_receipts),'failures':failures,'SourceEligibility':False})
 if failures:sys.exit(1)

