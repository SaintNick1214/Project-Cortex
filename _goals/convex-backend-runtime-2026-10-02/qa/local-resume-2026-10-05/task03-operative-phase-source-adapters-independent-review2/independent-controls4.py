"""Focused public-lifetime sticky read regression and corrected safe-copy control."""
import hashlib,os,sys,time,types,copy
from pathlib import Path

def mod(name,path,raw):
 m=types.ModuleType(name);m.__file__=path;sys.modules[name]=m;exec(compile(raw,path,'exec',dont_inherit=True),m.__dict__);return m

def run(bodies,paths,review_dir):
 J=Path(review_dir);A=mod('N2_isolate_adapter4',paths['adapter'],bodies[paths['adapter']]);P=mod('N2_isolate_actual_R6_4',paths['api'],bodies[paths['api']]);O=mod('N2_isolate_observer4',str(J/'reviewer-fd-observer2.py'),bodies[str(J/'reviewer-fd-observer2.py')]);rows=[];outcomes=[];details={}
 for name in ('reviewer-module1.py','reviewer-data1.json'):
  raw=bodies[str(J/name)];rows.append({'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nine':O.nine(os.lstat(J/name)),'roles':['program'] if name.endswith('.py') else ['document'],'nineBasis':'STRICT_MATURE_REVIEWER_FIXTURE'})
 caller=P.admission_id(rows[0]);adapter=hashlib.sha256(bodies[paths['adapter']]).hexdigest()
 def check(x):
  if not x:raise AssertionError('ISOLATION_OUTCOME_ASSERTION')
 def case(name,fn):
  try:details[name]=fn();outcomes.append({'name':name,'status':'PASS'})
  except BaseException as e:outcomes.append({'name':name,'status':'FAIL','type':type(e).__name__,'error':str(e)})
 def make(verifier=None):
  l=P.Ledger();io=O.Observer([J/r['path'] for r in rows]);recipe={'futureDATA':[],'bodyUseEdges':[{'caller':caller,'target':P.admission_id(r),'operation':op} for r in rows for op in ('read','hash','compile')],'programApprovals':{caller:rows[0]['sha256']}}
  v=A.SourceView(recipe,tuple(copy.deepcopy(rows)),(),'a'*64,'b'*64,(),object())
  if verifier is None:verifier=lambda view,h,ledger:A.RuntimePermit(object(),view.view_sha256,h,view.phase_sha256)
  stop=max(max(int(r['nine']['mtime_ns']),int(r['nine']['ctime_ns'])) for r in rows)+1
  return A.SourceSession(P,J,v,l,stop,adapter,verifier,io=io),io,l
 def finish(s,io):
  if not s.closed:
   try:s.close()
   except BaseException:pass
  check(io.emergency_close_owned()==[]);O.assert_once_closes(io.events,[J/r['path'] for r in rows]);check(not s.ledger.owned_fds)
 def public_run(caught):
  s,io,l=make();first=[];compiled=[];published=[];value=None;error=None
  def action(owner):
   original=io.pread
   def fault(*args):raise OSError('ISOLATED_SOURCE_PREAD_FAILURE_ON_OWNED_FD')
   io.pread=fault
   try:
    try:owner.read(caller,rows[0]['path'])
    except OSError as e:
     first.append(str(e))
     if not caught:raise
   finally:io.pread=original
   code=A.root_compile(owner,caller,rows[0]['path']);compiled.append(code.co_filename);return 'AFTER_FAILED_SOURCE_READ_COMPILED'
  try:
   try:value=s.run(caller,action,lambda result:published.append(result))
   except BaseException as e:error={'type':type(e).__name__,'error':str(e)}
   if caught:
    check(first==['ISOLATED_SOURCE_PREAD_FAILURE_ON_OWNED_FD']);check(compiled==[rows[0]['path']]);check(value=='AFTER_FAILED_SOURCE_READ_COMPILED');check(error is None);check(s.failures==[]);check(s.final_checked)
   else:
    check(first==['ISOLATED_SOURCE_PREAD_FAILURE_ON_OWNED_FD']);check(not compiled);check(value is None and error is not None);check(any(stage=='primary' and isinstance(e,OSError) for stage,e in s.failures))
   return {'caughtInsideAction':caught,'firstInjectedReadError':first,'laterCompiledCodeFilenames':compiled,'runReturned':value,'runError':error,'finalChecked':s.final_checked,'retainedSessionFailures':[{'stage':k,'type':type(e).__name__,'error':str(e)} for k,e in s.failures],'publicationCalls':published,'actualFixtureIO':io.events,'closeAttempts':s.close_attempts,'codeNeverExecuted':True,'protectedEffects':False}
  finally:finish(s,io)
 case('OBSERVATION_public_run_catches_Source_read_failure_then_compiles_and_returns_success',lambda:public_run(True))
 case('uncaught_same_Source_read_failure_is_retained_by_public_run_and_no_compile',lambda:public_run(False))
 def safe_copy():
  changed=[]
  def verifier(view,h,ledger):
   view.recipe['programApprovals'][caller]='0'*64;changed.append(view.recipe['programApprovals'][caller]);return A.RuntimePermit(object(),view.view_sha256,h,view.phase_sha256)
  s,io,l=make(verifier)
  try:
   check(changed==['0'*64]);check(s.view.recipe['programApprovals'][caller]==rows[0]['sha256']);result=s.run(caller,lambda owner:A.root_compile(owner,caller,rows[0]['path']).co_filename);check(result==rows[0]['path']);return {'externalCopyMutated':True,'mainRecipeOriginalHashUnchanged':True,'runReturned':result,'actualFixtureIO':io.events,'closeAttempts':s.close_attempts,'codeNeverExecuted':True,'oldPreparedViewDenialFailure':'Reviewer expectation mismatch, not candidate defect.'}
  finally:finish(s,io)
 case('corrected_runtime_verifier_deepcopy_mutation_safe_positive',safe_copy)
 return {'scope':'FOCUSED_INDEPENDENT_N2_CODE_BEHAVIOR_HOST_SOURCE','conditions':outcomes,'details':details,'passed':sum(r['status']=='PASS' for r in outcomes),'failed':sum(r['status']=='FAIL' for r in outcomes),'SourceEligibility':False,'functionalAcceptance':False,'underlyingR6':'REJECTED_INJECTION_ONLY','networkDockerPrivateServiceEffects':0}
