"""Prospective fresh N2 regressions. Imports occur only from held qualified bytes.
No implementation ownership, external service, Source approval or actual runtime.
"""
import copy,hashlib,os,sys,time,types
from pathlib import Path

def module(name,path,raw):
 m=types.ModuleType(name);m.__file__=path;sys.modules[name]=m
 try:exec(compile(raw,path,'exec',dont_inherit=True),m.__dict__)
 except BaseException:sys.modules.pop(name,None);raise
 return m

def run(bodies,paths,review_dir):
 J=Path(review_dir);A=module('N2_independent_adapter1',paths['adapter'],bodies[paths['adapter']]);P=module('N2_independent_injected_phase1',paths['api'],bodies[paths['api']]);O=module('N2_independent_observer1',str(J/'reviewer-fd-observer1.py'),bodies[str(J/'reviewer-fd-observer1.py')]);results=[];details={}
 items=[]
 for name in ('reviewer-module1.py','reviewer-data1.json'):
  raw=bodies[str(J/name)];items.append({'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nine':O.nine(os.lstat(J/name)),'roles':['program'] if name.endswith('.py') else ['document'],'nineBasis':'INDEPENDENT_CURRENT_REVIEWER_SOURCE'})
 caller=P.admission_id(items[0]);h=hashlib.sha256(bodies[paths['adapter']]).hexdigest();total=sum(r['bytes'] for r in items)
 def check(v,message='CONTROL_OUTCOME_ASSERTION'):
  if not v:raise AssertionError(message)
 def deny(fn):
  try:fn()
  except AssertionError:raise
  except BaseException as e:return e
  raise AssertionError('EXPECTED_PRE_EFFECT_DENIAL_ABSENT')
 def outcome(name,fn):
  try:details[name]=fn();results.append({'name':name,'status':'PASS'})
  except BaseException as e:results.append({'name':name,'status':'FAIL','type':type(e).__name__,'error':str(e)})
 def view():
  recipe={'futureDATA':[],'bodyUseEdges':[{'caller':caller,'target':P.admission_id(r),'operation':op} for r in items for op in ('read','hash','parse','compile','import','control')],'programApprovals':{caller:items[0]['sha256']}}
  return A.SourceView(recipe,tuple(copy.deepcopy(items)),(),'a'*64,'b'*64,(),object())
 def runtime(v,adapter,l):return A.RuntimePermit(object(),v.view_sha256,adapter,v.phase_sha256)
 def make(l=None,io=None,v=None,verify=runtime):
  l=P.Ledger() if l is None else l;io=O.Observer([J/r['path'] for r in items]) if io is None else io;v=view() if v is None else v
  stop=max(max(int(r['nine']['mtime_ns']),int(r['nine']['ctime_ns'])) for r in items)+1
  return A.SourceSession(P,J,v,l,stop,h,verify,io=io,clock=time.time_ns),io,l
 def finish(s,io):
  error=None
  try:
   if not s.closed:s.close()
  except BaseException as e:error=str(e)
  leaked=io.emergency_close_owned();check(not leaked,'CANDIDATE_LEFT_OWNED_ACTUAL_FD');return error
 def snap(s,io,l):return {'IOEvents':io.events,'candidateCloseAttempts':s.close_attempts,'remainingActualFDs':list(io.fds),'ledgerBytes':l.byte_count,'readDebtCount':len(l.read_debts),'ledgerOwnedFDCount':len(l.owned_fds),'stickyUnknown':l.unknown_close,'failures':[{'stage':k,'type':type(e).__name__,'error':str(e)} for k,e in s.failures]}
 def fake(name,size):
  return {'path':name,'bytes':size,'sha256':'0'*64,'nine':dict(zip(P.FIELDS,map(str,(1,2000+len(name),33152,501,20,1,size,1,1)))),'roles':['document'],'nineBasis':'TYPED_VIRTUAL_ROOT_DEBT_NO_ACTUAL_FILE'}
 def positive():
  s,io,l=make();got={}
  try:
   def action(owner):
    check(owner is s and owner.ledger is l);lease=owner.borrow(caller);check(lease.ownerToken is s and lease.ledger is l)
    check(set(lease.lookup(items[0]['path']))=={'path','bytes','sha256','nine','roles','nineBasis'});check(lease.read(lease.lookup(items[0]['path']))==bodies[str(J/items[0]['path'])])
    compiled=A.root_compile(s,caller,items[0]['path']);check(compiled.co_filename==items[0]['path']);lease.release();check(len(io.fds)==2 and len(l.owned_fds)==2);deny(lambda:lease.read(lease.rows[0]));got['MF']=A.collector_manifest(owner,caller);return 'INDEPENDENT_SOURCE_ONLY'
   check(s.run(caller,action)=='INDEPENDENT_SOURCE_ONLY');check(s.final_checked);check(l.byte_count==total);check(len(l.read_debts)==2);check(not l.owned_fds);O.assert_group_open_before_body(io.events,[J/r['path'] for r in items]);O.assert_once_closes(io.events,[J/r['path'] for r in items]);return snap(s,io,l)|{'MF':got['MF'],'compiledOnlyNeverExecuted':True,'borrowDidNotCloseOwner':True}
  finally:finish(s,io)
 outcome('actual_positive_two_FD_collector_read_compile_borrow_owner_closure',positive)
 def initial_over_union():
  l=P.Ledger()
  for i in range(4):l.admit(fake('prior-root-code-'+str(i),16777216-1),debt=True)
  io=O.Observer([J/r['path'] for r in items]);error=deny(lambda:make(l,io));check(not io.events);check(l.byte_count>=67108860);return {'denial':str(error),'retainedBytes':l.byte_count,'events':io.events,'noRefund':True}
 outcome('P1_initial_union_original_reserves_before_IO',initial_over_union)
 def late_union(stage,over):
  s,io,l=make();callbacks=[]
  try:
   if stage=='after-open':s.open_all(caller)
   sizes=[16777216,16777216,16777216,12582912] if over else [7]
   for i,size in enumerate(sizes):l.admit(fake('late-current-import-'+str(i),size),debt=True)
   charged=l.byte_count;before=sum(e['event'].startswith('BODY_') for e in io.events)
   if stage=='before-open':error=deny(lambda:s.run(caller,lambda _:callbacks.append('UNEXPECTED_PAYLOAD')));check(not any(e['event']=='OPEN' for e in io.events))
   else:error=deny(lambda:s.read(caller,items[0]['path'],'compile'));check(sum(e['event'].startswith('BODY_') for e in io.events)==before)
   check(not callbacks);check(l.byte_count==charged);close=finish(s,io);check(not l.owned_fds)
   return snap(s,io,l)|{'denial':str(error),'lateOverReserve':over,'unionWithOriginalReserves':charged+7340032,'payloadCallbacks':callbacks,'closeError':close,'noRefund':True}
  finally:finish(s,io)
 for stage in ('before-open','after-open'):
  for over in (False,True):outcome('P1_late_union_'+stage+('_over_reserves' if over else '_changed_exact_union_below_cap'),lambda stage=stage,over=over:late_union(stage,over))
 def debt_removed():
  s,io,l=make();s.open_all(caller)
  try:
   # Ensure this is a true change in a charged read debt, not a no-op removal.
   key=P.admission_id(items[0]);check(key in l.read_debts);l.read_debts.remove(key);before=sum(e['event'].startswith('BODY_') for e in io.events);error=deny(lambda:s.read(caller,items[0]['path']));check(sum(e['event'].startswith('BODY_') for e in io.events)==before);return snap(s,io,l)|{'denial':str(error)}
  finally:finish(s,io)
 outcome('P1_removed_existing_read_debt_before_body',debt_removed)
 def detached_identity(which):
  s,io,l=make()
  try:
   s.open_all(caller);mf=A.collector_manifest(s,caller);before=copy.deepcopy(s.rows);original=copy.deepcopy(mf['files'][0]);mf['files'][0][which]['ctime_ns']=str(int(original[which]['ctime_ns'])+1)
   check(s.rows==before,'P3_MANIFEST_CHANGED_MAIN_EXPECTED_NINE');check(mf['files'][0][which]!=original[which]);other=[k for k in ('PRE9','OPEN9','POST9') if k!=which];check(all(mf['files'][0][k]==original[k] for k in other),'P3_MANIFEST_IDENTITY_FIELDS_ALIAS_EACH_OTHER');check(s.read(caller,items[0]['path'])==bodies[str(J/items[0]['path'])]);s.final(caller);return snap(s,io,l)|{'mutatedExport':which,'mainRowsUnchanged':True,'otherTupleFieldsUnchanged':True}
  finally:finish(s,io)
 for which in ('PRE9','OPEN9','POST9'):outcome('P3_collector_detached_'+which,lambda which=which:detached_identity(which))
 def injected_lexical_only():
  old=A.Path;attempts=[]
  class NoResolve(type(Path())):
   def resolve(self,*args,**kwargs):attempts.append(str(self));raise AssertionError('P2_ORDINARY_PATH_RESOLVE_ATTEMPT')
  A.Path=NoResolve;s=None;io=O.Observer([J/r['path'] for r in items])
  try:
   s,io,l=make(io=io);check(s.run(caller,lambda owner:owner.read(caller,items[0]['path']))==bodies[str(J/items[0]['path'])]);check(not attempts);check(any(e['event']=='LSTAT' for e in io.events));return snap(s,io,l)|{'ordinaryResolveAttempts':attempts}
  finally:
   A.Path=old
   if s is not None:finish(s,io)
 outcome('P2_actual_positive_lexical_injected_metadata_no_ordinary_resolve',injected_lexical_only)
 def runtime_mutation(mode):
  io=O.Observer([J/r['path'] for r in items]);l=P.Ledger();calls=[]
  def verify(v,adapter,ledger):
   calls.append('externalRuntimeVerifier')
   if mode=='unknown':ledger.unknown_close=True
   elif mode=='debt':ledger.admit(fake('during-external-runtime-callback',3),debt=True)
   elif mode=='view':v.recipe['programApprovals'][caller]='0'*64
   return runtime(v,adapter,ledger)
  error=deny(lambda:make(l,io,verify=verify));check(not io.events);return {'denial':str(error),'callbacks':calls,'IOEvents':io.events,'retainedBytes':l.byte_count,'unknownClose':l.unknown_close}
 for mode in ('unknown','debt','view'):outcome('runtime_verifier_mutation_'+mode+'_denies_before_IO',lambda mode=mode:runtime_mutation(mode))
 def compound_closes():
  io=O.Observer([J/r['path'] for r in items],close_failure_numbers=(1,2));s,io,l=make(io=io)
  try:
   def primary(_):raise SystemExit(0)
   error=deny(lambda:s.run(caller,primary));check(any(isinstance(e,SystemExit) and e.code==0 for stage,e in error.failures));check(sum(stage.startswith('owned_close:') for stage,e in error.failures)==2);check(l.unknown_close and not l.owned_fds);check(not io.fds);O.assert_once_closes(io.events,[J/r['path'] for r in items]);return snap(s,io,l)|{'retainedSystemExit0':True,'retainedTwoCloseFailures':True}
  finally:finish(s,io)
 outcome('actual_SystemExit0_and_two_reported_close_failures_root_all_owned_once',compound_closes)
 return {'scope':'INDEPENDENT_N2_BASE_REGRESSIONS_CODE_HOST_ONLY','conditions':results,'details':details,'passed':sum(r['status']=='PASS' for r in results),'failed':sum(r['status']=='FAIL' for r in results),'SourceEligibility':False,'functionalAcceptance':False,'candidateAuthorship':False,'networkDockerServicePrivateEffects':0,'additionalG_callback_classification_checks':'SEPARATE_REQUIRED_CONTROLS_PENDING_EXACT_MATURE_INTERFACE_DISCOVERY'}
