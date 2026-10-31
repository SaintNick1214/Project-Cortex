import ast,copy,hashlib,types,time,traceback
from unittest.mock import patch
M=mods['phase_candidate']
results=[]
def check(name, action, expected=True):
 try:
  actual=action(); good=(actual==expected)
  results.append({'name':name,'expected':expected,'actual':actual,'outcome':'PASS' if good else 'FAIL'})
 except BaseException as e:
  results.append({'name':name,'expected':expected,'exception':type(e).__name__,'message':str(e),'outcome':'FAIL'})
def denies(action, fragment=None):
 try:action()
 except M.Denied as e:return fragment is None or fragment in str(e)
 return False
# Retained exact controls body: replace only its direct filesystem module-loader
# bootstrap with the already captured candidate module. No assertion is changed.
tree=ast.parse(data['partition_controls2.py'])
removed=[n for n in tree.body if n.lineno in (14,15)]
assert len(removed)==4 and all(isinstance(n,(ast.Assign,ast.Expr)) for n in removed)
tree.body=[n for n in tree.body if n not in removed]
C=types.ModuleType('independent_controls_replay');C.__file__=str(A/'partition_controls2.py');C.M=M
exec(compile(tree,C.__file__,'exec'),C.__dict__);C.OWN=D
control=C.run_controls()
check('author97_retained_body_replay_no_assertion_edits',lambda:(control['discovered'],control['executed'],control['passed'],control['failed'],control['skipped']),(97,97,97,0,0))
r=C.fixture_recipe();recipe=json.loads(data['prospective-partition-recipe4.json'])
check('actual_recipe_validate_finite3177',lambda:len(M.validate_contract(recipe)),3177)
check('actual_recipe_no_closed_nonuse_authority',lambda:denies(lambda:M.proof_of_nonuse(recipe,{'recipeSha256':M.digest(recipe)}),'unknown_inputs'))
check('JSON_verdict_is_not_authority',lambda:denies(lambda:M.proof_of_nonuse(r,C.proof(r)),'review_verifier'))
check('protected_action_always_denied',lambda:denies(lambda:M.PhaseMachine(M.Ledger()).protected_action('private'),'never_releases'))
check('hidden_hash_denies_before_read',lambda:denies(lambda:M.Ledger().authorize_use(C.row('one'),'unknown','hash',[]),'hidden_body'))
check('actual_phase_cannot_launder_enabling_read',lambda:denies(lambda:M.Ledger().authorize_use(C.row('one'),'c','read',[],'ACTUAL1914'),'laundering'))
check('refund_API_denied',lambda:denies(lambda:M.Ledger().refund('x'),'refund'))
check('reset_API_denied',lambda:denies(lambda:M.Ledger().clone_for_new_phase(),'reset'))
def exact_dedup():
 L=M.Ledger();a=C.row('a',7);L.admit(a,debt=True);L.admit(copy.deepcopy(a),debt=True);return (len(L.rows),L.byte_count,len(L.read_debts))
check('exact_tuple_dedup',exact_dedup,(1,7,1))
def changed_tuple():
 L=M.Ledger();a=C.row('a',7);L.admit(a,debt=True);b=copy.deepcopy(a);b['nine']['ino']='2';L.admit(b,debt=True);return (len(L.rows),L.byte_count,len(L.read_debts),denies(L.preflight,'same_path'))
check('changed_tuple_distinct_debt_then_preflight_denial',changed_tuple,(2,14,2,True))
def mutation_conservation():
 L=M.Ledger();a=C.row('one',7);key=L.admit(a,debt=True);before=copy.deepcopy(L.rows[key]);a['nine']['ctime_ns']='2'
 return (L.rows[key]==before,M.admission_id(L.rows[key])==key)
check('caller_mutation_cannot_rewrite_admitted_literal9',mutation_conservation,(True,True))
def aggregate_FD_limit():
 root=D/'mock_descriptor_root';now=time.time_ns();stop=now-241000000000
 def pin(i,mode=33188):return {k:str({'dev':1,'ino':i,'mode':mode,'uid':1,'gid':1,'nlink':1,'size':0,'mtime_ns':1,'ctime_ns':1}[k]) for k in M.FIELDS}
 rs=[{'path':'p'+str(i),'bytes':0,'sha256':hashlib.sha256(b'').hexdigest(),'nine':pin(i+2)} for i in range(4096)]
 bypath={str(root/x['path']):x for x in rs};held={};closed=[];opened=[]
 def fake_stat(p):
  v=bypath[str(p)]['nine'] if str(p) in bypath else pin(1,16877)
  return types.SimpleNamespace(**{'st_'+k:int(v[k]) for k in M.FIELDS})
 def fake_open(p,*_args):
  fd=100+len(opened);opened.append(str(p));held[fd]=str(p);return fd
 def fake_fstat(fd):return fake_stat(held[fd])
 def fake_close(fd):closed.append(fd);held.pop(fd)
 L=M.Ledger();edges=[{'caller':'c','target':M.admission_id(x),'operation':'read'} for x in rs]
 B1=M.HeldBroker(root,rs,L,edges,'c',stop);B2=M.HeldBroker(root,rs,L,edges,'c',stop)
 denied=False
 with patch.object(M.os,'lstat',side_effect=fake_stat),patch.object(M.os,'open',side_effect=fake_open),patch.object(M.os,'fstat',side_effect=fake_fstat),patch.object(M.os,'close',side_effect=fake_close):
  try:
   B1.open_all()
   try:B2.open_all()
   except M.Denied:denied=True
   peak=len(held)
  finally:B2.close();B1.close()
 return {'secondBrokerDenied':denied,'peakOwnedDescriptors':peak,'uniqueLedgerPaths':len(L.paths),'allMockFDsClosedOnce':len(closed)==len(set(closed))==len(opened)}
check('shared4096_simultaneous_descriptor_cap',aggregate_FD_limit,{'secondBrokerDenied':True,'peakOwnedDescriptors':4096,'uniqueLedgerPaths':4096,'allMockFDsClosedOnce':True})
def late_source_phase():
 L=M.Ledger();P=M.PhaseMachine(L);rc={'counts':dict(M.COUNTS),'assertions':list(M.ASSERTIONS),'originalProgramsUnchanged':True,'allProgramsIndependentlyApprovedBefore1914':True}
 P.advance('SOURCE_APPROVED',rc,lambda *_:True)
 for i in range(4):L.admit(C.row('late'+str(i),M.CAPS['file']),debt=True)
 late_total=L.byte_count+M.CAPS['MF']+M.CAPS['approval']+M.CAPS['DATA']
 denied=denies(lambda:P.advance('ACTUAL1914',rc,lambda *_:True))
 return {'lateUnionAboveCap':late_total>M.CAPS['bytes'],'actualAdvanceDenied':denied,'phase':P.phase}
check('late_enabling_admission_invalidates_Source_approval',late_source_phase,{'lateUnionAboveCap':True,'actualAdvanceDenied':True,'phase':'SOURCE_APPROVED'})
def samepath_role_version():
 x=copy.deepcopy(r);f=x['members'][0];old=copy.deepcopy(f);old['nine']['ino']='2';old['roles']=['control'];oldkey=M.admission_id(old)
 x['members'].append(old);x['actualReadDebts']=[oldkey]
 return denies(lambda:M.proof_of_nonuse(x,C.proof(x),C.mock_review),'mixed_role') or denies(lambda:M.proof_of_nonuse(x,C.proof(x),C.mock_review),'same_path')
check('same_path_changed_version_control_cannot_defer',samepath_role_version)
check('mixed_role_same_admission_stays_Source',lambda:denies(lambda:M.proof_of_nonuse(dict(r,members=[dict(r['members'][0],roles=['candidateCustody','control'])]+r['members'][1:]),C.proof(dict(r,members=[dict(r['members'][0],roles=['candidateCustody','control'])]+r['members'][1:])),C.mock_review),'mixed_role'))
check('missing_review_independent_authority_denied',lambda:denies(lambda:M.proof_of_nonuse(r,C.proof(r),lambda *_:M.ReviewWitness('f'*64,'f'*64,'f'*64,'f'*64,'f'*64,None)),'witness'))
check('original_phase_order_denies_early_actual',lambda:denies(lambda:M.PhaseMachine(M.Ledger()).advance('ACTUAL1914',{},lambda *_:True),'phase_order'))
check('one_DATA_cannot_shrink',lambda:denies(lambda:M.Ledger().preflight(data=1),'oneDATA'))
check('changed_caps_rejected',lambda:denies(lambda:M.validate_contract(dict(r,caps=dict(M.CAPS,bytes=67108865))),'counts_or_caps'))
summary={'scope':'FRESH_INDEPENDENT_SOURCE_MOCK_CONSERVATION_REVIEW_ONLY','discovered':len(results),'executed':len(results),'passed':sum(x['outcome']=='PASS' for x in results),'failed':sum(x['outcome']=='FAIL' for x in results),'skipped':0,'authorControlsReplay':control,'independentCases':results,'all_fixture_writes_owned_review_directory':True,'productionAdaptersExecuted':False,'SourceEligibility':False,'actualClocksStarted':False,'effects':0}
(D/'independent-controls-raw1.json').write_text(json.dumps(summary,indent=2,sort_keys=True)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ('authorControlsReplay','independentCases')},sort_keys=True))
print(json.dumps([x for x in results if x['outcome']=='FAIL'],indent=2,sort_keys=True))
