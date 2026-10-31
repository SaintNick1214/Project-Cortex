"""Fresh exact-interface G callback/classification and sticky read regressions."""
import copy,hashlib,json,os,stat,types
from pathlib import Path

def run(bodies,paths,review_dir):
 J=Path(review_dir);ns={};exec(compile(bodies[str(J/'independent-controls2.py')],str(J/'independent-controls2.py'),'exec',dont_inherit=True),ns);result=ns['run'](bodies,paths,review_dir)
 A=ns['module']('N2_independent_G3',paths['adapter'],bodies[paths['adapter']]);P=ns['module']('N2_independent_phase_G3',paths['api'],bodies[paths['api']]);O=ns['module']('N2_independent_obs_G3',str(J/'reviewer-fd-observer2.py'),bodies[str(J/'reviewer-fd-observer2.py')]);rows=[]
 for name in ('reviewer-module1.py','reviewer-data1.json'):
  raw=bodies[str(J/name)];rows.append({'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nine':O.nine(os.lstat(J/name)),'roles':['program'] if name.endswith('.py') else ['document'],'nineBasis':'STRICT_REVIEWER_CURRENT'})
 caller=P.admission_id(rows[0]);adapter=hashlib.sha256(bodies[paths['adapter']]).hexdigest()
 def check(v,label='FRESH_G_ASSERTION'):
  if not v:raise AssertionError(label)
 def denial(fn):
  try:fn()
  except AssertionError:raise
  except BaseException as e:return {'type':type(e).__name__,'error':str(e)}
  raise AssertionError('EXPECTED_DENIAL_ABSENT')
 def case(name,fn):
  try:result['details'][name]=fn();result['conditions'].append({'name':name,'status':'PASS'})
  except BaseException as e:result['conditions'].append({'name':name,'status':'FAIL','type':type(e).__name__,'error':str(e)})
 def view(items):return A.SourceView({'futureDATA':[],'bodyUseEdges':[{'caller':caller,'target':P.admission_id(r),'operation':op} for r in items for op in ('read','hash','control','compile')],'programApprovals':{caller:rows[0]['sha256']}},tuple(copy.deepcopy(items)),(),'a'*64,'b'*64,(),object())
 def permit(v,h,l):return A.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256)
 def owner(l,io=None):
  io=O.Observer([J/r['path'] for r in rows]) if io is None else io;stop=max(max(int(r['nine']['mtime_ns']),int(r['nine']['ctime_ns'])) for r in rows)+1
  return A.SourceSession(P,J,view(rows),l,stop,adapter,permit,io=io),io
 class VirtualIO:
  O_RDONLY=os.O_RDONLY;O_NOFOLLOW=os.O_NOFOLLOW
  def __init__(self,items):self.items=items;self.fds={};self.events=[];self.next=64000
  def stat(self,row):return types.SimpleNamespace(**{'st_'+k:int(v) for k,v in row['nine'].items()})
  def lstat(self,path):
   path=str(path);self.events.append(['LSTAT',path])
   if path in ('/','/independent-N2-headers'):return types.SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
   check(path in self.items,'VIRTUAL_UNDECLARED_PATH');return self.stat(self.items[path][0])
  def open(self,path,flags):path=str(path);check(path in self.items);self.next+=1;self.fds[self.next]=path;self.events.append(['OPEN',path,self.next]);return self.next
  def fstat(self,fd):return self.stat(self.items[self.fds[fd]][0])
  def pread(self,fd,n,offset):self.events.append(['PREAD',self.fds[fd],offset]);return self.items[self.fds[fd]][1][offset:offset+n]
  def close(self,fd):self.events.append(['CLOSE',self.fds.pop(fd),fd])
 def guard(mode):
  l=P.Ledger();s,io=owner(l);h=None;calls=[];cleanup=[]
  try:
   s.open_all(caller);mf=A.collector_manifest(s,caller);plan={'sourceViewSha256':s.view.view_sha256,'sourceMemberPaths':[r['path'] for r in rows]}
   if mode=='bad-nine':mf['files'][0]['OPEN9']['ctime_ns']=str(int(mf['files'][0]['OPEN9']['ctime_ns'])+1)
   if mode=='duplicate':mf['files'][1]=copy.deepcopy(mf['files'][0])
   docs={'plan':plan,'mf':mf,'approval':{'claim':'OWN_JSON_PASS_IS_NO_AUTHORITY'}};hr=[];items={}
   for i,(name,doc) in enumerate(docs.items()):
    raw=json.dumps(doc,sort_keys=True,separators=(',',':')).encode();r={'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nine':dict(zip(P.FIELDS,map(str,(5,800+i,33152,501,20,1,len(raw),1,1)))),'roles':['header']};hr.append(r);items['/independent-N2-headers/'+name]=(r,raw)
   vio=VirtualIO(items);h=A.SourceSession(P,'/independent-N2-headers',view(hr),l,2,adapter,permit,io=vio);h.open_all(caller);lease=h.borrow(caller);before=sum(e[0]=='PREAD' for e in vio.events)
   if mode=='pre-row':s.rows[rows[0]['path']]['nine']['ctime_ns']=str(int(s.rows[rows[0]['path']]['nine']['ctime_ns'])+1)
   if mode=='pre-edge':s.view.recipe['bodyUseEdges']=[]
   if mode=='pre-program':s.view.recipe['programApprovals'][caller]='0'*64
   if mode=='forged-owner':lease.ownerToken=object()
   def approve(docs_copy,view_copy,ledger):
    calls.append('EXTERNAL_APPROVAL')
    if mode=='post-row':s.rows[rows[0]['path']]['sha256']='0'*64
    if mode=='post-edge':s.view.recipe['bodyUseEdges']=[]
    if mode=='post-program':s.view.recipe['programApprovals'][caller]='0'*64
    if mode=='post-unknown':ledger.unknown_close=True
    if mode=='post-cap':
     for i,size in enumerate((16777216,16777216,16777216,12582912)):
      r={'path':'post-approval-debt-'+str(i),'bytes':size,'sha256':'0'*64,'nine':dict(zip(P.FIELDS,map(str,(2,1200+i,33152,501,20,1,size,1,1)))),'roles':['document']};ledger.admit(r,debt=True)
    if mode=='copy-safe':docs_copy.clear();view_copy.recipe['bodyUseEdges']=[]
    return False if mode=='stale' else True
   fn=lambda:A.guard_source_contract(s,caller,lease,'plan','mf','approval',approve)
   if mode in ('positive','copy-safe'):
    value=fn();check(value['guardSourceOnly'] and not value['protectedEffects']);check(calls==['EXTERNAL_APPROVAL']);detail={'result':value,'externalCallbackCopyMutationsSafe':mode=='copy-safe'}
   else:
    error=denial(fn);check(calls==(['EXTERNAL_APPROVAL'] if mode.startswith('post-') or mode=='stale' else []));detail={'denial':error}
    if mode.startswith('pre-') or mode=='forged-owner':check(sum(e[0]=='PREAD' for e in vio.events)==before)
   lease.release();check(len(vio.fds)==3);return detail|{'approvalCallbacks':calls,'virtualHeaderIO':vio.events,'actualFixtureIO':io.events,'borrowReleaseKeptAllOwnerFDs':True,'noRawFDProjection':True}
  finally:
   for current in (h,s):
    if current is not None and not current.closed:
     try:current.close()
     except BaseException as e:cleanup.append(str(e))
   check(io.emergency_close_owned()==[]);O.assert_once_closes(io.events,[J/r['path'] for r in rows]);check(not l.owned_fds)
   if h is not None:check(not h.io.fds)
 for mode in ('positive','copy-safe','bad-nine','duplicate','pre-row','pre-edge','pre-program','forged-owner','post-row','post-edge','post-program','post-unknown','post-cap','stale'):
  case('G_fresh_'+mode+'_callback_order_and_owner_closure',lambda mode=mode:guard(mode))
 def sticky_read_observation():
  l=P.Ledger();s,io=owner(l);errors=[];compile_result=None
  try:
   s.open_all(caller);original=io.pread
   def fail_once(*args):raise OSError('INDEPENDENT_SOURCE_PREAD_FAILURE')
   io.pread=fail_once;first=denial(lambda:s.read(caller,rows[0]['path']));io.pread=original
   failures_before=[{'stage':k,'error':str(e)} for k,e in s.failures]
   try:compile_result=A.root_compile(s,caller,rows[0]['path'])
   except BaseException as e:errors.append({'type':type(e).__name__,'error':str(e)})
   return {'firstBodyFailure':first,'failureStateAfterFirstFailedRead':failures_before,'laterCompileReturnedCode':compile_result is not None,'laterCompileErrors':errors,'IOEvents':io.events,'grading':'OBSERVATION_STICKY_SOURCE_FAILURE_NOT_G1_ADOPTION','protectedEffects':False,'compiledCodeNeverExecuted':True}
  finally:
   try:
    if not s.closed:s.close()
   except BaseException:pass
   check(io.emergency_close_owned()==[]);O.assert_once_closes(io.events,[J/r['path'] for r in rows])
 case('OBSERVATION_caught_direct_Source_read_error_before_later_Root_compile',sticky_read_observation)
 def classify(mode):
  l=P.Ledger();bootstrap={};base={};texts=(b'{"futureDATA":[],"independentRecipe":true}',b'{"independentProof":true}',b'MOCK_PHASE_ONLY')
  for i,(name,raw) in enumerate(zip(('recipe','proof','phase'),texts)):
   row={'path':name+'.source','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nine':dict(zip(P.FIELDS,map(str,(3,950+i,33152,501,20,1,len(raw),1,1)))),'roles':['header' if name!='phase' else 'program']};bootstrap[name]=A.Bootstrap(row,raw);l.admit(row,debt=True);base[P.admission_id(row)]=row
  custody={P.admission_id(bootstrap['phase'].row)} if mode=='bootstrap-custody' else set();calls=[]
  if mode=='uncharged':l.read_debts.remove(P.admission_id(bootstrap['proof'].row))
  if mode=='hidden-debt':l.admit(copy.deepcopy(rows[0]),debt=True)
  witness=types.SimpleNamespace(review_receipt_sha256='d'*64)
  def proof(recipe,proof,verify):
   calls.append('partitionBoundary');verify(recipe,proof)
   return custody,witness
  class API:
   CAPS=P.CAPS;admission_id=staticmethod(P.admission_id);digest=staticmethod(P.digest);validate_contract=staticmethod(lambda recipe:base);proof_of_nonuse=staticmethod(proof)
  def partition(recipe,proof):
   if mode=='partition-mutation':recipe['futureDATA'].append({'path':'late-source'})
   return True
  def held(name,body,key,ledger):
   calls.append(name)
   if mode=='held-row-mutation' and name=='recipe':body.row['sha256']='0'*64
   return False if mode=='stale-held' else True
  fn=lambda:A.source_view(API,l,bootstrap,partition,held)
  if mode=='positive':value=fn();check(len(value.rows)==3 and set(value.bootstrap_admissions)==l.read_debts);return {'threeBootstrapMembersAndDebtExact':True,'actualBodyIO':0,'boundaryMockNotPhaseValidation':True}
  return {'denial':denial(fn),'calls':calls,'actualBodyIO':0,'boundaryMockNotPhaseValidation':True}
 for mode in ('positive','bootstrap-custody','uncharged','hidden-debt','held-row-mutation','partition-mutation','stale-held'):
  case('source_view_fresh_'+mode+'_boundary_mock',lambda mode=mode:classify(mode))
 result['passed']=sum(r['status']=='PASS' for r in result['conditions']);result['failed']=sum(r['status']=='FAIL' for r in result['conditions']);result['additionalG_callback_classification_checks']='EXECUTED_FRESH_SCOPED_CONTROLS_NO_PHASE_OR_SOURCE_ADOPTION';return result
