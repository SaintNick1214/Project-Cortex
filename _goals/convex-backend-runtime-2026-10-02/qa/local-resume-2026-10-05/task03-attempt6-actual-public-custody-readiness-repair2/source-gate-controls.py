"""Pure source-gate accounting and syntax controls; never executes public entry."""
import ast,hashlib,json,os,stat,subprocess,sys,time
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
N=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-actual-public-custody-readiness-repair2'
fields=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns');nine=lambda s:{k:str(getattr(s,'st_'+k))for k in fields}
expected={'run-actual-review.py':('015ec6b15448db9963f182dd086ca301e8680ee19a3ab9262d2875f68f829e42',29033),'coordinate-common-highfd.py':('3b7d195b905465275b081b32f0a934af4c232f7dafb76281c044d50e8b03dc8f',21476),'linux-public-observer.py':('67ec0fd3169bad4cd001c73f4835f965c1f73dfe14e8ede9d8acd59b1de42eb7',9465),'linux-dependency-observer.mjs':('55341dc2614d90505ba25a26a6d37348e7af04c8d61f0e35ef7ba6fa02282f08',10263)}
pins=[];body={};reports=[]
assert sys.dont_write_bytecode and Path.cwd()==R
for name,(sha,size)in expected.items():
 p=N/name;s=p.lstat();now=time.time_ns();assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and now-max(s.st_mtime_ns,s.st_ctime_ns)>=60000000000
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);pre=nine(s);assert nine(os.fstat(fd))==pre;pins.append({'path':str(p),'name':name,'PRE9':pre,'fd':fd,'capturedNs':str(now)})
try:
 for pin in pins:
  raw=bytearray()
  while block:=os.read(pin['fd'],65536):raw.extend(block);assert len(raw)<=int(pin['PRE9']['size'])
  sha,size=expected[pin['name']];assert len(raw)==size and hashlib.sha256(raw).hexdigest()==sha and nine(os.fstat(pin['fd']))==nine(Path(pin['path']).lstat())==pin['PRE9'];body[pin['name']]=bytes(raw)
  if pin['name'].endswith('.py'):ast.parse(raw,filename=pin['path'])
 tree=ast.parse(body['run-actual-review.py']);function=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='reserve_source_graph')
 scope={'source_graph_members':{},'source_graph_bytes':0,'SOURCE_GRAPH_MAX_FILES':4096,'SOURCE_GRAPH_MAX_BYTES':67108864,'SOURCE_GRAPH_MAX_FILE':16777216}
 exec(compile(ast.Module(body=[function],type_ignores=[]),'<isolated-original-ledger-function>','exec'),scope)
 reserve=scope['reserve_source_graph']
 def denial(label,path,size,reason):
  before=(dict(scope['source_graph_members']),scope['source_graph_bytes'])
  try:reserve(path,size)
  except AssertionError as e:assert str(e)==reason
  else:raise AssertionError(label+'did_not_deny')
  assert before==(scope['source_graph_members'],scope['source_graph_bytes']);reports.append({'control':label,'status':'PASS_DENIED','reason':reason})
 for i in range(4):reserve('/source/'+str(i),16777216)
 assert scope['source_graph_bytes']==67108864 and len(scope['source_graph_members'])==4
 reserve('/source/0',16777216);assert scope['source_graph_bytes']==67108864 and len(scope['source_graph_members'])==4
 denial('separate-control-data-input-no-reset','/controls/fifth-byte',1,'source_graph_aggregate_byte_ceiling')
 denial('perfile-ceiling','/source/too-big',16777217,'source_graph_file_ceiling')
 denial('duplicate-held-path-size-drift','/source/0',0,'source_graph_duplicate_path_size_drift')
 # Separate isolated boundary fixture, never a second runtime subgraph.
 countscope={k:v for k,v in scope.items()if k not in ('reserve_source_graph','source_graph_members','source_graph_bytes')}
 countscope.update(source_graph_members={},source_graph_bytes=0)
 exec(compile(ast.Module(body=[function],type_ignores=[]),'<separate-boundary-fixture>','exec'),countscope)
 for i in range(4096):countscope['reserve_source_graph']('/files/'+str(i),0)
 try:countscope['reserve_source_graph']('/files/4096',0)
 except AssertionError as e:assert str(e)=='source_graph_descriptor_ceiling'
 else:raise AssertionError('count_ceiling_not_denied')
 assert len(countscope['source_graph_members'])==4096
 reports.append({'control':'4096-descriptor-boundary','status':'PASS_DENIED'})
 # Arithmetic negative witness for the obsolete old2352-source recipe plus7required controls.
 assert 66622509+4114398>67108864
 reports.append({'control':'obsolete2352-source-plus-unique-controls','status':'PASS_DENIED_BY_ARITHMETIC','bytes':66622509+4114398,'duplicateExistingSourcePathsNotDoubleCounted':['publicRecipeBinding','publicSourceManifest'],'limit':67108864,'additionalNewInputsWouldOnlyIncrease':True})
 js=[ '/usr/local/bin/node','--check',str(N/'linux-dependency-observer.mjs') ]
 result=subprocess.run(js,cwd=R,env={'PATH':'/usr/local/bin:/usr/bin:/bin'},capture_output=True,timeout=10)
 assert result.returncode==0 and result.stdout==result.stderr==b''
 final=[]
 for pin in pins:
  os.lseek(pin['fd'],0,0);raw=bytearray()
  while block:=os.read(pin['fd'],65536):raw.extend(block)
  assert raw==body[pin['name']]and nine(os.fstat(pin['fd']))==nine(Path(pin['path']).lstat())==pin['PRE9'];final.append({k:v for k,v in pin.items()if k!='fd'}|{'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'fullEOF':True,'finalPathDescriptorNineEqual':True})
 OUT=N/'source-gate-controls1';OUT.mkdir(mode=0o700)
 value={'scope':'SOURCE_ONLY_LEDGER_AND_SYNTAX_CONTROLS','status':'PASS','controls':reports,'allFourSourceDescriptorsCapturedBeforeContent':True,'heldSources':final,'pythonASTSources':3,'javascriptSyntax':{'argv':js,'exitCode':result.returncode,'stdout':'','stderr':'','sourceExecuted':False},'noRuntimeSubgraphBudgetReset':True,'LinuxCustodyPhysicalPairAggregateCapped':False,'actualDockerCalls':0,'privateReads':0,'serviceCalls':0,'paidCalls':0,'publicEntryExecuted':False,'fullTask03':False,'fullGoal':False,'nativePrivate':False}
 for name,obj in [('controls-summary.json',value),('writers-stopped.json',{'scope':'SOURCE_GATE_CONTROLS_OUTPUT_WRITERS_STOPPED','remainingWrites':[],'stoppedNs':str(time.time_ns()),'firstQualifyingRead':'After max(mtime,ctime)>=60seconds'})]:
  fd=os.open(OUT/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600);os.write(fd,(json.dumps(obj,indent=2)+'\n').encode());os.fsync(fd);os.close(fd)
 print(json.dumps({'status':'PASS','controls':len(reports),'publicEntryExecuted':False,'dockerCalls':0,'output':str(OUT)}))
finally:
 for pin in pins:os.close(pin['fd'])
