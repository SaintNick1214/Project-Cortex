"""Independent SOURCE/MOCK review; actual held lifetime AST, external FD oracle."""
import ast,base64,copy,gzip,hashlib,json,os,re,stat,sys,time,types,zlib,subprocess
from collections import Counter
from pathlib import Path
J=Path(REVIEW_DIR); U=J.parent/'task03-attempt6-actual-public-custody-readiness-repair3'; OLD=U.parent/'task03-attempt6-actual-public-custody-readiness-repair2'
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
FIELDS=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
oracle={};exec(compile(DATA[str(J/'fd_fault_oracle.py')],'<independent-oracle>','exec'),oracle)
Fault=oracle['InjectedFault'];controls=[];failures=[]
def note(name,fn):
 try:detail=fn();controls.append({'name':name,'status':'PASS','details':detail})
 except BaseException as e:failures.append({'name':name,'class':type(e).__name__,'reason':str(e)[:2000]});controls.append({'name':name,'status':'FAIL','class':type(e).__name__,'reason':str(e)[:2000]})
def selected(raw):
 tree=ast.parse(raw);names={'AGE','MAX','FIELDS','SOURCE_GRAPH_MAX_FILES','SOURCE_GRAPH_MAX_BYTES','SOURCE_GRAPH_MAX_FILE'}
 nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) or isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id in names for t in n.targets)]
 ns=dict(ast=ast,base64=base64,gzip=gzip,hashlib=hashlib,json=json,os=os,re=re,stat=stat,sys=sys,time=time,types=types,zlib=zlib,Path=Path,R=R)
 exec(compile(ast.fix_missing_locations(ast.Module(body=nodes,type_ignores=[])),'<held-actual-functions>','exec'),ns)
 return ns,tree
class LoggedOS:
 def __init__(self,c):self.c=c;self.opened=[];self.closes=[];self.errors=[];self.events=[];self.reads={};self.fstats={};self.reports=0
 def __getattr__(self,k):return getattr(os,k)
 def open(self,p,flags):
  i=len(self.events);self.events.append(str(p))
  if self.c.get('open_failure')==i:raise Fault('open:'+str(i))
  fd=os.open(p,flags);self.opened.append(fd);return fd
 def fstat(self,fd):
  self.fstats[fd]=self.fstats.get(fd,0)+1
  if self.c.get('fstat_failure')==self.opened.index(fd):raise Fault('fstat:'+str(fd))
  return os.fstat(fd)
 def read(self,fd,n):
  if self.c.get('primary')=='content-hash-assert':raise Fault('content-hash-assert')
  return os.read(fd,n)
 def close(self,fd):
  assert fd in self.opened and fd not in self.closes,'foreign-or-retry'
  self.closes.append(fd);os.close(fd)
  if self.opened.index(fd) in self.c.get('close_positions',[]):
   msg='close:'+str(fd);self.errors.append(msg);raise Fault(msg)
 def write(self,fd,b):
  assert fd==1
  self.reports+=1
  if self.c.get('publication'):raise Fault(self.c['publication'])
  return len(b)
def flatten(e):
 if isinstance(e,BaseExceptionGroup):return sum((flatten(x) for x in e.exceptions),[])
 return [str(e)] if e else []
def run_python(kind,case):
 raw=DATA[str(U/('run-actual-review.py' if kind=='runner' else 'linux-public-observer.py'))]
 ns,tree=selected(raw);fos=LoggedOS(case);writes=[]
 def durable(p,data):
  writes.append({'path':str(p),'data':data})
  if case.get('publication'):raise Fault(case['publication'])
 ns.update(os=fos,time=types.SimpleNamespace(time_ns=time.time_ns),all_pins=[],held=[],unique_pins={},source_graph_members={},source_graph_bytes=0,cleanup_errors=[],failure=None,failure_chain=[],close_errors=[],primary_error=None,output_bytes=0,
  C=types.SimpleNamespace(durable_json=durable) if kind=='runner' else None,RAW=J,OUT=J,NAMES={},results={'custody':'PASS','dependencies':'PASS','readiness':'PASS'},records=[],MF_SHA=None,OP='test',REVIEW_OP='test',VOLUME='none',DEPS='none',public_transfer_sha=None,control_rows={},SOURCE_GRAPH_MAX_FILES=4096,SOURCE_GRAPH_MAX_BYTES=67108864,SOURCE_GRAPH_MAX_FILE=16777216,DOCKER='/mock/never-dispatched',MAX_EXPORT=4194304)
 ns['command']=lambda *a,**kw:({'exitCode':0},b'',b'')
 ns['canonical']=lambda *a,**kw:None
 fixtures=[U/'fixtures'/('owned-source-'+str(i)+'.json') for i in range(case['owned'])]
 def body():
  if case['name']=='early-before-open':raise Fault('setup-before-open')
  for p in fixtures:
   pin=ns['capture'](p,'review-fixture') if kind=='runner' else ns['capture'](p,U,'review-fixture')
  pins=ns['all_pins'] if kind=='runner' else ns['held']
  for pin in pins:
   row,b=ns['qualify'](pin,collect=True);ns['strict'](b)
  if case.get('primary'):raise Fault(case['primary'])
  if kind=='python':ns['emit']({'status':'PASS','scope':'MOCK_ONLY'})
 ns['_independent_body']=body
 outer=copy.deepcopy(next(n for n in tree.body if isinstance(n,ast.Try)))
 outer.body=ast.parse('_independent_body()').body
 nodes=[outer]
 if kind=='python':
  index=next(i for i,n in enumerate(tree.body) if isinstance(n,ast.Try));nodes+=tree.body[index+1:]
 error=None
 try:exec(compile(ast.fix_missing_locations(ast.Module(body=nodes,type_ignores=[])),'<actual-whole-lifetime>','exec'),ns)
 except BaseException as e:error=e
 assert Counter(fos.opened)==Counter(fos.closes),{'opened':fos.opened,'closes':fos.closes}
 pins=ns['all_pins'] if kind=='runner' else ns['held'];assert all(p['closeAttempted'] for p in pins)
 old=list(fos.closes);ns['close_owned_inputs']();assert old==fos.closes,'retry'
 errors=[x['reason'] for x in ns['failure_chain']] if kind=='runner' else flatten(error)
 accepted=(ns['failure'] is None and not ns['cleanup_errors']) if kind=='runner' else error is None
 expected=[]
 if case['name']=='early-before-open':expected.append('setup-before-open')
 if case.get('primary'):expected.append(case['primary'])
 if case.get('publication') and (kind=='runner' or not case.get('primary')):expected.append(case['publication'])
 expected+=fos.errors
 for x in expected:assert x in errors,(x,errors)
 if expected or case.get('open_failure') is not None or case.get('fstat_failure') is not None:assert not accepted,'fault accepted'
 else:assert accepted,'complete baseline denied'
 if kind=='runner' and case.get('primary'):assert ns['failure']['reason']==case['primary'],'primary replaced'
 if kind=='python' and case.get('primary'):assert errors[0]==case['primary'],'primary replaced'
 return {'opened':len(fos.opened),'allCloseAttempts':len(fos.closes),'accepted':accepted,'errors':errors,'reportWrites':len(writes),'externalOracleExactOnce':True,'actualOuterExceptFinally':True}
for kind in ('runner','python'):
 for case in oracle['fault_matrix']():note(kind+':'+case['name'],lambda kind=kind,case=case:run_python(kind,case))
# Independently run actual entry main over the immutable harmless author fixture.
def entry_case(label):
 raw=DATA[str(U/'actual-entry.py')];ns,tree=selected(raw);case={}
 if label=='open':case['open_failure']=0
 if label=='fstat':case['fstat_failure']=0
 if label=='close':case['close_positions']=[0]
 if label=='content':case['primary']='content-hash-assert'
 fos=LoggedOS(case);p=U/'fixtures/owned-entry-3.py';b=DATA[str(p)];pre=p.lstat();nine=ns['nine'](pre)
 expected={'PRE9':nine,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
 if label=='wrong-hash':expected['sha256']='0'*64
 if label=='wrong-nine':expected['PRE9']=dict(nine,ino='0')
 ns.update(os=fos,sys=types.SimpleNamespace(argv=['entry',str(p),json.dumps(expected),'/never-consumed-handoff'],dont_write_bytecode=True),time=types.SimpleNamespace(time_ns=(lambda:0) if label=='maturity' else time.time_ns))
 if label=='early-argv':ns['sys'].argv=[]
 e=None;status=None
 try:status=ns['main']()
 except BaseException as x:e=x
 assert Counter(fos.opened)==Counter(fos.closes)
 assert (status==0 and e is None)==(label=='positive')
 for msg in fos.errors:assert msg in flatten(e)
 return {'opened':len(fos.opened),'closeAttempts':len(fos.closes),'accepted':e is None,'errors':flatten(e)}
for label in ('positive','early-argv','open','fstat','close','content','wrong-hash','wrong-nine','maturity'):note('entry:'+label,lambda label=label:entry_case(label))
# Every original assertion is conserved, with only declared namespace/scope changes.
def conservation(name,allowed):
 old=ast.parse(DATA[str(OLD/name)]);new=ast.parse(DATA[str(U/name)])
 for node in ast.walk(old):
  if isinstance(node,ast.Constant) and isinstance(node.value,str):node.value=node.value.replace('TASK03_ATTEMPT6_REPAIR2_ACTUAL_PUBLIC_REVIEW_HANDOFF','TASK03_ATTEMPT6_REPAIR3_ACTUAL_PUBLIC_REVIEW_HANDOFF').replace('TASK03_ATTEMPT6_PUBLIC_REVIEW_REPAIR2_NAMED_SOURCE_ACCEPTANCE','TASK03_ATTEMPT6_PUBLIC_REVIEW_REPAIR3_NAMED_SOURCE_ACCEPTANCE')
 a=Counter(ast.dump(n,include_attributes=False) for n in ast.walk(old) if isinstance(n,ast.Assert));b=Counter(ast.dump(n,include_attributes=False) for n in ast.walk(new) if isinstance(n,ast.Assert));assert not a-b,list((a-b).elements())
 oldf={n.name:ast.dump(n,include_attributes=False) for n in old.body if isinstance(n,ast.FunctionDef)};newf={n.name:ast.dump(n,include_attributes=False) for n in new.body if isinstance(n,ast.FunctionDef)}
 for name,dump in oldf.items():
  if name not in allowed:assert dump==newf[name],name
 return {'originalAssertions':sum(a.values()),'noneRemoved':True,'unaffectedFunctionsByteSemanticEqual':True}
note('runner:original-assertions',lambda:conservation('run-actual-review.py',{'capture','retain_error','close_owned_inputs'}))
note('python:original-assertions',lambda:conservation('linux-public-observer.py',{'capture','close_owned_inputs'}))
def budget():
 ns,_=selected(DATA[str(U/'run-actual-review.py')]);ns.update(source_graph_members={},source_graph_bytes=0)
 for i in range(4096):ns['reserve_source_graph']('/virtual/'+str(i),0)
 try:ns['reserve_source_graph']('/virtual/extra',0)
 except AssertionError:pass
 else:raise AssertionError('4097 permitted')
 assert len(ns['source_graph_members'])==4096
 return {'4096accepted':True,'4097denied':True,'nonReset':True}
note('ledger:FD4096',budget)
def bytes_budget():
 ns,_=selected(DATA[str(U/'run-actual-review.py')]);ns.update(source_graph_members={},source_graph_bytes=0)
 for i in range(4):ns['reserve_source_graph']('/virtual/'+str(i),16777216)
 ns['reserve_source_graph']('/virtual/0',16777216)
 for p,n in [('/v/aggregate',1),('/v/file',16777217),('/v/bool',True),('/v/negative',-1),('/virtual/0',16777215)]:
  try:ns['reserve_source_graph'](p,n)
  except AssertionError:pass
  else:raise AssertionError((p,n))
  assert ns['source_graph_bytes']==67108864
 return {'64MiBaccepted':True,'aggregatePerFileBoolNegativeDuplicateDriftDenied':True,'nonReset':True}
note('ledger:byte-boundaries',bytes_budget)
def strict_types():
 ns,_=selected(DATA[str(U/'run-actual-review.py')]);cases=['NaN','Infinity','-Infinity','{"a":1,"a":2}']
 for raw in cases:
  try:ns['strict'](raw.encode())
  except (ValueError,AssertionError):pass
  else:raise AssertionError(raw)
 x=ns['strict'](b'{"decodedBytes":1e309}');assert x['decodedBytes']==float('inf')
 # Actual inflated function's exact int guard rejects this reachable controlling field.
 import inspect
 ns['MAX_EXPORT']=4194304
 malformed={'encoding':'gzip+base64','decodedBytes':float('inf'),'body':'','decodedSha256':'0'*64}
 try:ns['compressed'](json.dumps(malformed).replace('Infinity','1e309').encode())
 except AssertionError:pass
 else:raise AssertionError('overflow controlling export size accepted')
 return {'specialConstantsAndDuplicatesDenied':True,'overflowParsedAsInfinity':True,'controllingDecodedSizeRequiresExactInt':True,'noClaimOfUniversalFiniteJSON':True}
note('strict:overflow-reachability',strict_types)
# Copy only exact Common bytes for a later independently mature local-host exercise.
common=DATA[str(OLD/'coordinate-common-highfd.py')]
assert hashlib.sha256(common).hexdigest()=='3b7d195b905465275b081b32f0a934af4c232f7dafb76281c044d50e8b03dc8f'
fixture=J/'common-host-fixture1.py'
js_source=DATA[str(J/'independent-js-controls1.mjs')]
payload={'source':DATA[str(U/'linux-dependency-observer.mjs')].decode(),'old':DATA[str(OLD/'linux-dependency-observer.mjs')].decode(),'fixtures':[str(U/'fixtures'/('owned-source-'+str(i)+'.json')) for i in range(3)]}
proc=subprocess.run(['/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node','--input-type=module','-e',js_source.decode()],input=json.dumps(payload).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30,env={'HOME':'/Users/SaintNick','PATH':'/usr/bin:/bin','LANG':'C.UTF-8'})
(J/'independent-js-controls1.stdout').write_bytes(proc.stdout);(J/'independent-js-controls1.stderr').write_bytes(proc.stderr)
assert proc.returncode==0,proc.stderr.decode()
js=json.loads(proc.stdout);controls.extend(js['controls']);failures.extend(js['failures'])
RESULT={'scope':'INDEPENDENT_U3_SOURCE_MOCK_LIFETIME_CONTROLS','sourceEligibility':False,'controls':controls,'PASS':sum(x['status']=='PASS' for x in controls),'FAIL':len(failures),'failures':failures,'commonFixture':str(fixture),'candidateSourceInputsHeld':len(OWNERS),'actualEffects':{'Docker':0,'network':0,'credentials':0,'private':0,'service':0},'fullTask03':False,'fullGoal':False}
