"""Exact new bootstrap/complete-source consumer controls with in-memory filesystem only."""
from pathlib import Path
import ast,copy,hashlib,json,os,stat,types
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-repair1';Q=QA/'task03-local-native-attempt6-2026-10-06';source=P/'CONTROL_ONLY_NONEXISTENT_SOURCE.py';mfpath=P/'prospective-source-manifest.json';apath=P/'integrated-source-review.json';planpath=P/'prospective-source-plan.json';stoppath=P/'source-writers-stopped.json';freezepath=Q/'candidate-freeze-attempt6.json';fields=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');rows=[]
bootstrap=ast.parse((P/'private-coordinate.py').read_bytes());fn=next(n for n in bootstrap.body if isinstance(n,ast.FunctionDef)and n.name=='load_module');loadcode=compile(ast.Module(body=[fn],type_ignores=[]),'exact-initial-held-bootstrap','exec')
gate=ast.parse((P/'source-gates.py').read_bytes());gatecode=compile(gate,'exact-complete-prospective-source-consumer','exec')
raw=b"marker='CURRENT_REVIEWED_HELD_SOURCE_BYTES'\n";freeze=b'PUBLIC_FAKE_FREEZE_FOR_MEMORY_CONTROL_ONLY';FREEZE=hashlib.sha256(freeze).hexdigest()
def sha(data):return hashlib.sha256(data).hexdigest()
def case(name,change=None,consumer=False,accepted=True):
 def row(path,data,ino):return {'path':str(path.relative_to(R)),'bytes':len(data),'sha256':sha(data),'PRE':{'dev':'44','ino':str(ino),'mode':str(stat.S_IFREG|0o600),'uid':'501','gid':'20','nlink':'1','size':str(len(data)),'mtime_ns':'1','ctime_ns':'2'}}
 sr=row(source,raw,100);fr=row(freezepath,freeze,101)
 plan={'scope':'TASK03_ATTEMPT6_REPAIR1_FINITE_SOURCE_PLAN_ONLY','historicalD101OriginalCustody':'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED','members':[{k:v for k,v in item.items()if k!='PRE'}for item in (sr,fr)]};planraw=json.dumps(plan).encode();pr=row(planpath,planraw,102)
 stop={'sourceWriters':'STOPPED','remainingSourceWrites':[],'stoppedUnixNs':'10000'}
 if change=='activewriters':stop['sourceWriters']='ACTIVE'
 if change=='immature':stop['stoppedUnixNs']='1'
 stopraw=json.dumps(stop).encode();tr=row(stoppath,stopraw,103)
 mf={'scope':'TASK03_ATTEMPT6_REPAIR1_NEW_PROSPECTIVE_SOURCE_CLOSURE_ONLY','status':'READY_FOR_FRESH_INDEPENDENT_REVIEW','sourceWriters':'STOPPED','historicalD101OriginalCustody':'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED','sourcePlanSha256':sha(planraw),'sourceWritersStoppedSha256':sha(stopraw),'files':[sr,fr,pr,tr]}
 if change=='oldscope':mf['scope']='FIRST_PROSPECTIVE_COMPLETE_OPERATIVE_SOURCE_CLOSURE_ONLY'
 if change=='historicalrepair':mf['historicalD101OriginalCustody']='REPAIRED'
 if change=='duplicate':mf['files'].append(copy.deepcopy(sr))
 if change=='incomplete':mf['files'].pop(0)
 if change=='foreignmember':mf['files'][0]['path']=str((P/'FOREIGN_SOURCE.py').relative_to(R))
 mraw=json.dumps(mf).encode();mr=row(mfpath,mraw,104)
 approval={'scope':'TASK03_ATTEMPT6_INTEGRATED_REPAIR1_SOURCE_ONLY','verdict':'PASS','independent':True,'candidateSha256':FREEZE,'sourceManifestSha256':sha(mraw),'sourceManifestOriginalNine':mr['PRE'],'sourcePlanSha256':sha(planraw),'sources':{item['path']:item['sha256']for item in mf['files']}}
 if change=='approvalscope':approval['scope']='TASK03_ATTEMPT6_INTEGRATED_SOURCE_ONLY'
 if change=='independent':approval['independent']=False
 if change=='candidate':approval['candidateSha256']='foreign'
 if change=='manifesthash':approval['sourceManifestSha256']='foreign'
 if change=='manifestnine':approval['sourceManifestOriginalNine']={**mr['PRE'],'ctime_ns':'3'}
 if change=='sourcehash':approval['sources'][sr['path']]='foreign'
 if change=='planhash':approval['sourcePlanSha256']='foreign'
 if change=='missinghash':approval['sources'].pop(sr['path'])
 files={source:raw,freezepath:freeze,planpath:planraw,stoppath:stopraw,mfpath:mraw,apath:json.dumps(approval).encode()}
 pins={path:row(path,data,200+i)['PRE']for i,(path,data)in enumerate(files.items())};pins[source]=sr['PRE'];pins[freezepath]=fr['PRE'];pins[planpath]=pr['PRE'];pins[stoppath]=tr['PRE'];pins[mfpath]=mr['PRE']
 if change in ('uid','gid','nlink','ctime'):pins[source]={**pins[source],{'ctime':'ctime_ns'}.get(change,change):str(int(pins[source][{'ctime':'ctime_ns'}.get(change,change)])+1)}
 if change=='content':files[source]=b'x'*len(raw)
 fds={};nextfd=0;reads=[];compiled=[];full_closure_captured_before_read=False
 def status(path):return types.SimpleNamespace(**{'st_'+f:int(v)for f,v in pins[path].items()})
 def opened(path,flags):
  nonlocal nextfd
  assert path in files;nextfd+=1;fds[nextfd]=[path,0];return nextfd
 def read(fd,size):
  nonlocal full_closure_captured_before_read
  path,offset=fds[fd];block=files[path][offset:offset+size];fds[fd][1]+=len(block);reads.append(path)
  if consumer and path==source:
   assert {item[0]for item in fds.values()}=={source,freezepath,planpath,stoppath};full_closure_captured_before_read=True
  if change=='latectime'and path==source:pins[source]={**pins[source],'ctime_ns':'3'}
  return block
 fake=types.SimpleNamespace(O_RDONLY=os.O_RDONLY,O_NOFOLLOW=os.O_NOFOLLOW,lstat=status,open=opened,read=read,fstat=lambda fd:status(fds[fd][0]),close=lambda fd:fds.pop(fd))
 def compiling(*args,**kwargs):assert any(item[0]==source for item in fds.values());compiled.append(True);return compile(*args,**kwargs)
 ns={'R':R,'P':P,'Q':Q,'APPROVAL':apath,'FREEZE':FREEZE,'os':fake,'stat':stat,'types':types,'hashlib':hashlib,'json':json,'strict_json':json.loads,'compile':compiling};observed=False
 try:
  if consumer:
   # Execute exact declarations with real imports first, then substitute ALL fs.
   env={};exec(gatecode,env);env.update({'R':R,'P':P,'Q':Q,'os':fake});env['qualify_sources']();observed=True
  else:exec(loadcode,ns);module=ns['load_module']('PUBLIC_MEMORY_CONTROL',source);observed=module.marker=='CURRENT_REVIEWED_HELD_SOURCE_BYTES'
 except (AssertionError,KeyError,ValueError):pass
 assert observed is accepted and fds=={},(name,observed,accepted,fds)
 if observed and consumer:assert full_closure_captured_before_read
 if observed and not consumer:assert compiled==[True]
 rows.append({'id':name,'status':'PASS','observedAccepted':observed,'allFDsClosed':True,'completeClosureCapturedBeforeContent':full_closure_captured_before_read,'sourceCompiledWhileHeld':bool(compiled),'privateAccess':0,'realFilesystemEffects':0})
case('bootstrap-positive-source-compiled-while-original-fd-held')
for name in ('approvalscope','independent','candidate','manifesthash','manifestnine','sourcehash','planhash','missinghash','oldscope','historicalrepair','duplicate','incomplete','activewriters','immature','uid','gid','nlink','ctime','content','latectime'):case('bootstrap-deny-'+name,name,accepted=False)
case('complete-source-consumer-positive-all-descriptors-before-content',consumer=True)
for name in ('approvalscope','independent','candidate','manifesthash','manifestnine','sourcehash','planhash','missinghash','oldscope','historicalrepair','duplicate','incomplete','foreignmember','activewriters','immature','uid','gid','nlink','ctime','content','latectime'):case('complete-source-consumer-deny-'+name,name,consumer=True,accepted=False)
result={'scope':'EXACT_REPAIR1_BOOTSTRAP_AND_COMPLETE_SOURCE_CONSUMER_IN_MEMORY_ONLY','status':'PASS','count':len(rows),'rows':rows,'privateAccess':0,'realFilesystemEffects':0,'sourceEnablingApprovalAuthored':False,'actualRuntimeAccepted':False}
fd=os.open(P/'consumer-control-results.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
with os.fdopen(fd,'w')as f:json.dump(result,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
print(json.dumps({'count':len(rows),'status':'PASS_SOURCE_MEMORY_CONTROLS_ONLY','privateAccess':0,'realEffects':0}))
