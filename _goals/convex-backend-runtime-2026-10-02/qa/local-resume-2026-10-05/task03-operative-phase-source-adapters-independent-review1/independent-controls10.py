"""Isolate collector-nine alias and guard ordering with real held Source bytes."""
import copy,hashlib,json,os,stat,sys,time,types
from pathlib import Path

def module(name,path,raw):
 m=types.ModuleType(name);m.__file__=path;sys.modules[name]=m;exec(compile(raw,path,'exec',dont_inherit=True),m.__dict__);return m

def run(bodies,paths,review_dir):
 J=Path(review_dir);A=module('isolate_adapters10',paths['adapter'],bodies[paths['adapter']]);P=module('isolate_exact_phase10',paths['api'],bodies[paths['api']]);O=module('isolate_observer10',str(J/'reviewer-fd-observer2.py'),bodies[str(J/'reviewer-fd-observer2.py')]);results=[];details={}
 rows=[]
 for name in ('reviewer-fixture-module1.py','reviewer-fixture-data1.json'):
  raw=bodies[str(J/name)];rows.append({'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nine':O.nine(os.lstat(J/name)),'roles':['program'] if name.endswith('.py') else ['document'],'nineBasis':'STRICT_REVIEWER_FIXTURE'})
 caller=P.admission_id(rows[0]);adapter=hashlib.sha256(bodies[paths['adapter']]).hexdigest()
 def check(x):
  if not x:raise AssertionError('INDEPENDENT_ISOLATION_CHECK_FAILED')
 def view(items):
  return A.SourceView({'futureDATA':[],'bodyUseEdges':[{'caller':caller,'target':P.admission_id(r),'operation':op} for r in items for op in ('read','hash','control')],'programApprovals':{}},tuple(copy.deepcopy(items)),(),'a'*64,'b'*64,(),object())
 def permit(v,h,l):return A.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256)
 class LexicalPath(type(Path())):
  def resolve(self,*a,**k):return self
 class VIO:
  O_RDONLY=os.O_RDONLY;O_NOFOLLOW=os.O_NOFOLLOW
  def __init__(self,items):self.items=items;self.fds={};self.events=[];self.next=61000
  def st(self,row):return types.SimpleNamespace(**{'st_'+k:int(v) for k,v in row['nine'].items()})
  def lstat(self,path):
   path=str(path)
   if path=='/isolation-virtual-headers':return types.SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
   check(path in self.items);return self.st(self.items[path][0])
  def open(self,path,flags):self.next+=1;self.fds[self.next]=str(path);self.events.append(['OPEN',str(path),self.next]);return self.next
  def fstat(self,fd):return self.st(self.items[self.fds[fd]][0])
  def pread(self,fd,n,offset):self.events.append(['PREAD',self.fds[fd],offset]);return self.items[self.fds[fd]][1][offset:offset+n]
  def close(self,fd):self.events.append(['CLOSE',self.fds.pop(fd),fd])
 def probe(detach):
  l=P.Ledger();io=O.Observer([J/r['path'] for r in rows]);stop=max(max(int(r['nine']['mtime_ns']),int(r['nine']['ctime_ns'])) for r in rows)+1
  s=A.SourceSession(P,J,view(rows),l,stop,adapter,permit,io=io);h=None;old=A.Path;calls=[];out={}
  try:
   s.open_all(caller);mf=A.collector_manifest(s,caller);original=copy.deepcopy(s.rows[rows[0]['path']]['nine']);member=mf['files'][0]
   alias={'PRE9':member['PRE9'] is s.rows[rows[0]['path']]['nine'],'OPEN9':member['OPEN9'] is s.rows[rows[0]['path']]['nine'],'POST9':member['POST9'] is s.rows[rows[0]['path']]['nine']}
   if detach:mf=copy.deepcopy(mf)
   mf['files'][0]['OPEN9']['ctime_ns']=str(int(original['ctime_ns'])+1)
   source_expected=copy.deepcopy(s.rows[rows[0]['path']]['nine']);physical=O.nine(os.lstat(J/rows[0]['path']));check(physical==original)
   docs={'plan':{'sourceViewSha256':s.view.view_sha256,'sourceMemberPaths':[r['path'] for r in rows]},'mf':mf,'approval':{'scope':'SOURCE_MOCK_NO_AUTHORITY'}};hrows=[];items={}
   for i,(name,doc) in enumerate(docs.items()):
    raw=json.dumps(doc,sort_keys=True,separators=(',',':')).encode();row={'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nine':dict(zip(P.FIELDS,map(str,(6,710+i,33152,501,20,1,len(raw),1,1)))),'roles':['header']};hrows.append(row);items['/isolation-virtual-headers/'+name]=(row,raw)
   vio=VIO(items);A.Path=LexicalPath;h=A.SourceSession(P,'/isolation-virtual-headers',view(hrows),l,2,adapter,permit,io=vio);h.open_all(caller);lease=h.borrow(caller)
   def approval(*args):calls.append('EXTERNAL_APPROVAL_CALLED');return True
   value=None;error=None
   try:value=A.guard_source_contract(s,caller,lease,'plan','mf','approval',approval)
   except BaseException as e:error={'type':type(e).__name__,'error':str(e)}
   seal_error=None
   try:s._seal()
   except BaseException as e:seal_error=str(e)
   if detach:check(value is None and error is not None and calls==[] and source_expected==physical)
   else:check(value is not None and value['guardSourceOnly'] and calls==['EXTERNAL_APPROVAL_CALLED'] and source_expected!=physical and seal_error is not None)
   lease.release();check(len(vio.fds)==3);h.final(caller)
   if detach:s.final(caller)
   out={'collectorNinesAliasSessionRows':alias,'detachedManifestControl':detach,'strictActualPhysicalNine':physical,'SourceExpectedNineAfterManifestMutation':source_expected,'guardResult':value,'guardDenial':error,'externalApprovalCalls':calls,'laterExplicitSessionSealDenial':seal_error,'virtualHeaderEvents':vio.events,'actualFixtureEvents':io.events,'originalTupleWrongAtGuard':source_expected!=physical,'borrowReleaseKeepsOwnerFDs':True,'protectedEffects':False}
   return out
  finally:
   A.Path=old
   if h is not None and not h.closed:h.close()
   if not s.closed:s.close()
   check(io.emergency_close_owned()==[]);O.assert_once_closes(io.events,[J/r['path'] for r in rows]);check(not l.owned_fds)
   if h is not None:check(not h.io.fds)
 for detach,name in ((False,'OBSERVATION_collector_alias_changes_expected_nine_G_calls_approval_before_seal'),(True,'detached_manifest_wrong_nine_denies_before_external_approval')):
  try:details[name]=probe(detach);results.append({'name':name,'status':'PASS'})
  except BaseException as e:results.append({'name':name,'status':'FAIL','type':type(e).__name__,'error':str(e)})
 return {'scope':'INDEPENDENT_ISOLATED_CODE_BEHAVIOR_COUNTEREXAMPLE','conditions':results,'details':details,'passed':sum(r['status']=='PASS' for r in results),'failed':sum(r['status']=='FAIL' for r in results),'phaseAPI':'INJECTED_REJECTED_A5_NO_ADOPTION','sourceEligibility':False,'functionalAcceptance':False,'DockerEffects':0,'serviceEffects':0,'privateReads':0}
