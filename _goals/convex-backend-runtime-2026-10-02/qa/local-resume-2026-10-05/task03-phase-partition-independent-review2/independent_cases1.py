import ast,copy,hashlib,types,time
from unittest.mock import patch
M=mods['phase_candidate'];results=[];control=None

def check(name,action,expected=True):
 try:
  actual=action();ok=actual==expected
  results.append({'name':name,'expected':expected,'actual':actual,'outcome':'PASS' if ok else 'FAIL'})
 except BaseException as e:results.append({'name':name,'expected':expected,'exception':type(e).__name__,'message':str(e),'outcome':'FAIL'})
def denied(action,fragment=None):
 try:action()
 except M.Denied as e:return fragment is None or fragment in str(e)
 return False
# These are exact original held source bytes; only loader source lines are omitted.
original_phase=ast.parse(data['original_phase2']);literals={}
for node in original_phase.body:
 if isinstance(node,ast.Assign):
  for target in node.targets:
   if isinstance(target,ast.Name) and target.id in ('CAPS','COUNTS','ASSERTIONS','FIELDS'):literals[target.id]=ast.literal_eval(node.value)
assert len(literals)==4
for name in literals:check('original_'+name+'_byte_contract_values',lambda name=name:getattr(M,name),literals[name])
raw_controls=data['original_controls2'];assert len(raw_controls)==18650 and hashlib.sha256(raw_controls).hexdigest()=='02a38a688e507b44ef049d57c94a038303bbb70546b7492dd2268a43568ea5dc'
tree=ast.parse(raw_controls);removed=[x for x in tree.body if x.lineno in (14,15)]
assert len(removed)==4 and all(isinstance(x,(ast.Assign,ast.Expr)) for x in removed)
tree.body=[x for x in tree.body if x not in removed]
C=types.ModuleType('review2_original_controls');C.__file__=str(ORIGINAL/'partition_controls2.py');C.M=M
exec(compile(tree,C.__file__,'exec'),C.__dict__);C.OWN=D

def author_regression():
 global control
 try:
  control=C.run_controls()
  return (control['discovered'],control['executed'],control['passed'],control['failed'],control['skipped'])
 finally:
  fixture=D/'controls-fixture1'
  if fixture.exists():
   for name in ('one','two','empty'):
    p=fixture/name
    if p.exists():p.unlink()
   fixture.rmdir()
check('original97_unchanged_outcome_regression',author_regression,(97,97,97,0,0))
r=C.fixture_recipe();receipt={'counts':dict(M.COUNTS),'assertions':list(M.ASSERTIONS),'originalProgramsUnchanged':True,'allProgramsIndependentlyApprovedBefore1914':True}
check('valid_original_finite_cohorts',lambda:len(M.validate_contract(r)),2155)
check('JSON_boolean_verdict_denied',lambda:denied(lambda:M.proof_of_nonuse(r,C.proof(r)),'review_verifier'))
check('mock_exact_no_Source_use_partition_preserved',lambda:len(M.proof_of_nonuse(r,C.proof(r),C.mock_review)[0]),2021)
check('no_proof_conserves_all_declarations',lambda:M.assemble(r)['sourceVersionAdmissions'],2155)
check('protected_action_remains_always_denied',lambda:denied(lambda:M.PhaseMachine(M.Ledger()).protected_action('private'),'never_releases'))

def immutable_admission():
 L=M.Ledger();item=C.row('one',7);key=L.admit(item,debt=True);before=copy.deepcopy(L.rows[key]);item['nine']['ctime_ns']='2';item['roles'].append('program')
 return (L.rows[key]==before,M.admission_id(L.rows[key])==key)
check('R1_original_input_mutation_cannot_rewrite_admitted_tuple',immutable_admission,(True,True))
def ledger_corruption_detected():
 L=M.Ledger();a=C.row('one');key=L.admit(a);L.rows[key]['nine']['ctime_ns']='8'
 return denied(lambda:L.approval_binding())
check('R1_stored_key_identity_corruption_denied_before_binding',ledger_corruption_detected)

def samepath_case(role,body_debt):
 x=copy.deepcopy(r);old=copy.deepcopy(x['members'][0]);old['nine']['ino']='2';old['roles']=[role];oldkey=M.admission_id(old);x['members'].append(old)
 if body_debt:x['actualReadDebts']=[oldkey]
 if role=='program':x['programApprovals'][oldkey]=old['sha256']
 return denied(lambda:M.proof_of_nonuse(x,C.proof(x),C.mock_review))
check('R4_samepath_changed_tuple_actual_control_cannot_defer',lambda:samepath_case('control',True))
check('R4_samepath_changed_tuple_Source_role_cannot_defer',lambda:samepath_case('header',False))
check('R4_samepath_changed_tuple_program_cannot_defer',lambda:samepath_case('program',False))

def late_source(size,count):
 L=M.Ledger();P=M.PhaseMachine(L);P.advance('SOURCE_APPROVED',copy.deepcopy(receipt),lambda *_:True)
 for i in range(count):L.admit(C.row('late'+str(i),size),debt=True)
 return (denied(lambda:P.advance('ACTUAL1914',copy.deepcopy(receipt),lambda *_:True)),P.phase)
check('R3_late_64MiB_union_plus_reserves_denies_old_approval',lambda:late_source(M.CAPS['file'],4),(True,'SOURCE_APPROVED'))
check('R3_late_small_distinct_program_corpus_denies_old_approval',lambda:late_source(1,1),(True,'SOURCE_APPROVED'))
def duplicate_approval():
 L=M.Ledger();a=C.row('one');L.admit(a,debt=True);P=M.PhaseMachine(L);P.advance('SOURCE_APPROVED',copy.deepcopy(receipt),lambda *_:True);L.admit(copy.deepcopy(a),debt=True)
 for phase in M.PhaseMachine.ORDER[2:]:P.advance(phase,copy.deepcopy(receipt),lambda *_:True)
 return (P.phase,len(L.rows),L.byte_count)
check('exact_duplicate_conserves_approval_and_all_original_phase_order',duplicate_approval,('ACTUAL_READY',1,1))
def unchanged_phase_order():
 P=M.PhaseMachine(M.Ledger())
 for phase in M.PhaseMachine.ORDER[1:]:P.advance(phase,copy.deepcopy(receipt),lambda *_:True)
 return P.phase
check('valid_conserved_readiness_order',unchanged_phase_order,'ACTUAL_READY')
check('early_actual_phase_denied',lambda:denied(lambda:M.PhaseMachine(M.Ledger()).advance('ACTUAL1914',receipt,lambda *_:True),'phase_order'))
check('unverified_Source_receipt_denied',lambda:denied(lambda:M.PhaseMachine(M.Ledger()).advance('SOURCE_APPROVED',receipt),'verifier'))

class FakeFS:
 def __init__(self,nfiles=3,rootname='mock',values=None):
  self.root=D/rootname;self.values=values or {('p'+str(i)):b'' for i in range(nfiles)};self.rows=[];self.now=time.time_ns();self.stop=self.now-241000000000
  for i,(p,b) in enumerate(self.values.items()):
   self.rows.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'nine':{k:str({'dev':1,'ino':i+2,'mode':33188,'uid':1,'gid':1,'nlink':1,'size':len(b),'mtime_ns':1,'ctime_ns':1}[k])for k in M.FIELDS}})
  self.by={str(self.root/x['path']):copy.deepcopy(x) for x in self.rows};self.opened=[];self.held={};self.close_calls=[];self.close_fail=set();self.close_after=False;self.open_fail=set();self.bad_fstat=set();self.peak=0
 def stat(self,path):
  pin=self.by[str(path)]['nine'] if str(path) in self.by else {k:str({'dev':1,'ino':1,'mode':16877,'uid':1,'gid':1,'nlink':1,'size':0,'mtime_ns':1,'ctime_ns':1}[k])for k in M.FIELDS}
  return types.SimpleNamespace(**{'st_'+k:int(v)for k,v in pin.items()})
 def open(self,path,*_args):
  index=len(self.opened)
  if index in self.open_fail:raise OSError('owned mock open failure')
  fd=100+index;self.opened.append(str(path));self.held[fd]=str(path);self.peak=max(self.peak,len(self.held));return fd
 def fstat(self,fd):
  value=self.stat(self.held[fd])
  if fd in self.bad_fstat:value.st_ino+=100
  return value
 def pread(self,fd,size,offset):return self.values[Path(self.held[fd]).name][offset:offset+size]
 def close(self,fd):
  index=fd-100;self.close_calls.append(fd)
  if index in self.close_fail:
   if self.close_after:self.held.pop(fd)
   raise OSError('owned mock unknown close')
  self.held.pop(fd)
 def patches(self):
  return [patch.object(M.os,'lstat',side_effect=self.stat),patch.object(M.os,'open',side_effect=self.open),patch.object(M.os,'fstat',side_effect=self.fstat),patch.object(M.os,'pread',side_effect=self.pread),patch.object(M.os,'close',side_effect=self.close)]
 def edges(self):return [{'caller':'c','target':M.admission_id(x),'operation':'read'}for x in self.rows]
 def broker(self,L=None,rows=None,edges=None):return M.HeldBroker(self.root,self.rows if rows is None else rows,M.Ledger()if L is None else L,self.edges()if edges is None else edges,'c',self.stop)
 def once(self):return len(self.close_calls)==len(set(self.close_calls))==len(self.opened)

from contextlib import ExitStack

def shared_descriptor_limit():
 F=FakeFS(4096,'fd4096');L=M.Ledger();B1=F.broker(L);B2=F.broker(L)
 with ExitStack()as stack:
  for p in F.patches():stack.enter_context(p)
  try:
   B1.open_all();second_denied=denied(B2.open_all);peak=F.peak;B2.close();B1.close()
   B3=F.broker(L);B3.open_all();B3.close()
  finally:
   for b in (B1,B2):
    if not b.closed:b.close()
 return {'secondBrokerDenied':second_denied,'peakSimultaneous':peak,'sourceUniquePaths':len(L.paths),'reopenAfterRelease':len(F.opened)==8192,'onceClose':F.once(),'remainingMockFDs':len(F.held)}
check('R2_shared4096_limit_and_successful_release_reuse',shared_descriptor_limit,{'secondBrokerDenied':True,'peakSimultaneous':4096,'sourceUniquePaths':4096,'reopenAfterRelease':True,'onceClose':True,'remainingMockFDs':0})

def valid_broker_and_input_freeze():
 F=FakeFS(rootname='freeze',values={'one':b'alpha','two':b'beta','empty':b''});L=M.Ledger();source_rows=copy.deepcopy(F.rows);source_edges=F.edges();B=F.broker(L,source_rows,source_edges)
 source_rows[0]['nine']['ino']='999';source_rows[0]['sha256']='d'*64;source_rows[0]['bytes']=0;source_edges.clear()
 with ExitStack()as stack:
  for p in F.patches():stack.enter_context(p)
  try:
   B.open_all();values={p:B.read(p) for p in F.values};B.final_check();retained=len(B.held)
  finally:B.close()
 return (values==F.values,retained,len(F.held),F.once(),L.byte_count,len(L.read_debts))
check('R1_broker_copies_rows_edges_and_holds_fullEOF_final',valid_broker_and_input_freeze,(True,3,0,True,9,3))

def close_failure(indices,after=False):
 F=FakeFS(rootname='close'+str(indices)+str(after));L=M.Ledger();B=F.broker(L);F.close_fail=set(indices);F.close_after=after
 with ExitStack()as stack:
  for p in F.patches():stack.enter_context(p)
  B.open_all();close_denied=denied(B.close);attempts=copy.deepcopy(B.close_attempts);calls=F.close_calls[:];before=len(F.opened)
  B2=F.broker(L);subsequent_denied=denied(B2.open_all);after_open=len(F.opened);B2.close();double_denied=denied(B.close)
 return {'closeDenied':close_denied,'attempts':[x['attempt']for x in attempts],'errorCount':sum(x['error']is not None for x in attempts),'allCloseCallsOnce':calls==[100,101,102]and len(F.close_calls)==3,'subsequentUnknownLeaseDeniedBeforeOpen':subsequent_denied and before==after_open,'doubleCloseDenied':double_denied}
for label,indices,after in [('first',[0],False),('last',[2],False),('all',[0,1,2],False),('after_actual_mock_release',[0],True)]:
 check('close_failure_'+label+'_all_attempted_once_sticky_unknown',lambda indices=indices,after=after:close_failure(indices,after),{'closeDenied':True,'attempts':[1,1,1],'errorCount':len(indices),'allCloseCallsOnce':True,'subsequentUnknownLeaseDeniedBeforeOpen':True,'doubleCloseDenied':True})

def partial_open_failure(index):
 F=FakeFS(rootname='openfail'+str(index));L=M.Ledger();B=F.broker(L);F.open_fail={index}
 with ExitStack()as stack:
  for p in F.patches():stack.enter_context(p)
  failed=False
  try:B.open_all()
  except (OSError,M.Denied):failed=True
  body_denied=denied(lambda:B.read('p0'));B.close();F.open_fail=set();B2=F.broker(L);B2.open_all();B2.close()
 return (failed,body_denied,F.once(),len(F.held),len(L.rows),len(L.read_debts))
for index in (0,1,2):check('open_failure_'+str(index)+'_owned_partial_cleanup_no_phantom_FDs',lambda index=index:partial_open_failure(index),(True,True,True,0,3,3))

def postopen_tuple_failure():
 F=FakeFS(rootname='postopen');L=M.Ledger();B=F.broker(L);F.bad_fstat={100}
 with ExitStack()as stack:
  for p in F.patches():stack.enter_context(p)
  error=denied(B.open_all);B.close();F.bad_fstat=set();B2=F.broker(L);B2.open_all();B2.close()
 return (error,F.once(),len(F.held),len(L.rows))
check('postopen_tuple_failure_cleans_registered_owned_FD',postopen_tuple_failure,(True,True,0,3))

def hidden_before_open():
 F=FakeFS(rootname='hidden');B=F.broker(edges=[])
 with ExitStack()as stack:
  for p in F.patches():stack.enter_context(p)
  error=denied(B.open_all,'hidden_body');B.close()
 return (error,len(F.opened),len(F.close_calls))
check('hidden_read_edge_denied_before_any_mock_open',hidden_before_open,(True,0,0))
check('oneDATA_reserve_cannot_shrink',lambda:denied(lambda:M.Ledger().preflight(data=1),'oneDATA'))
check('graph_reset_API_denied',lambda:denied(lambda:M.Ledger().clone_for_new_phase(),'reset'))
check('read_debt_refund_API_denied',lambda:denied(lambda:M.Ledger().refund('x'),'refund'))
check('owned_original_fixture_removed',lambda:not(D/'controls-fixture1').exists())
summary={'scope':'FRESH_SUCCESSOR5_INDEPENDENT_SOURCE_MOCK_CODE_CONSERVATION_ONLY','discovered':len(results),'executed':len(results),'passed':sum(x['outcome']=='PASS'for x in results),'failed':sum(x['outcome']=='FAIL'for x in results),'skipped':0,'cases':results,'original97':control,'originalAssertionEdits':False,'mockFDsOnly':True,'allFixtureWritesOwned':True,'productionAdaptersExecuted':False,'SourceEligibility':False,'actualClocksStarted':False,'effects':0}
(D/'independent-controls-raw1.json').write_text(json.dumps(summary,indent=2,sort_keys=True)+'\n')
print(json.dumps({k:v for k,v in summary.items()if k not in ('cases','original97')},sort_keys=True));print(json.dumps([x for x in results if x['outcome']=='FAIL'],indent=2))
