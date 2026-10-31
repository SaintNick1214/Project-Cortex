"""Independent in-memory FS for exact bootstrap and prospective all-descriptor gates."""
import ast,copy,hashlib,json,os,pathlib,stat,types
R=pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';F=QA/'local-resume-2026-10-05/task03-attempt6-integrated-repair1';Q=QA/'task03-local-native-attempt6-2026-10-06';J=F.parent/'task03-attempt6-integrated-repair1-source-review2';FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');tests=[]
h=lambda b:hashlib.sha256(b).hexdigest();bt=ast.parse((F/'private-coordinate-final.py').read_bytes());fn=next(n for n in bt.body if isinstance(n,ast.FunctionDef)and n.name=='load_module');bc=compile(ast.Module(body=[fn],type_ignores=[]),'exact-bootstrap','exec');gc=compile((F/'source-gates-final.py').read_bytes(),'exact-source-gates','exec');SF=J/'MEMORY_ONLY_SOURCE.py';MP=F/'prospective-source-manifest-final.json';AP=F/'integrated-source-review.json';PP=F/'prospective-source-plan-final.json';SP=F/'source-writers-stopped-final.json';FP=Q/'candidate-freeze-attempt6.json';raw=b'MARKER="COMPILED_REVIEWED_BYTES"\n';freeze=b'PUBLIC_IN_MEMORY_FREEZE'
def case(kind,mutation=None):
 def row(p,b,i):return {'path':str(p.relative_to(R)),'sha256':h(b),'bytes':len(b),'PRE':{'dev':'1','ino':str(i),'mode':str(stat.S_IFREG|0o600),'uid':'501','gid':'20','nlink':'1','size':str(len(b)),'mtime_ns':'1','ctime_ns':'1'}}
 sr=row(SF,raw,1);fr=row(FP,freeze,2);plan={'scope':'TASK03_ATTEMPT6_REPAIR1_FINITE_SOURCE_PLAN_ONLY','historicalD101OriginalCustody':'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED','members':[{k:v for k,v in x.items()if k!='PRE'}for x in (sr,fr)]};pr=json.dumps(plan).encode();ppr=row(PP,pr,3);stop={'sourceWriters':'STOPPED','remainingSourceWrites':[],'stoppedUnixNs':'100000000000'}
 if mutation=='active-stop':stop['sourceWriters']='ACTIVE'
 if mutation=='pending-writes':stop['remainingSourceWrites']=['foreign.py']
 st=json.dumps(stop).encode();ss=row(SP,st,4);ss['PRE']['ctime_ns']='100000000001';manifest={'scope':'TASK03_ATTEMPT6_REPAIR1_NEW_PROSPECTIVE_SOURCE_CLOSURE_ONLY','status':'READY_FOR_FRESH_INDEPENDENT_REVIEW','sourceWriters':'STOPPED','historicalD101OriginalCustody':'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED','capturedUnixNs':'200000000000','sourcePlanSha256':h(pr),'sourceWritersStoppedSha256':h(st),'files':[sr,fr,ppr,ss]}
 if mutation=='immature-stop':manifest['capturedUnixNs']='100000000001'
 if mutation=='immature-input':sr['PRE']['ctime_ns']='190000000000'
 if mutation=='after-stop':sr['PRE']['ctime_ns']='120000000000'
 if mutation=='foreign-manifest-scope':manifest['scope']='historical'
 if mutation=='writers-active':manifest['sourceWriters']='ACTIVE'
 if mutation=='history-repaired':manifest['historicalD101OriginalCustody']='REPAIRED'
 if mutation=='duplicate':manifest['files'].append(copy.deepcopy(sr))
 if mutation=='missing-member':manifest['files'].pop(0)
 if mutation=='extra-member':manifest['files'].append(row(J/'FOREIGN.py',b'x',9))
 mr=json.dumps(manifest).encode();mrow=row(MP,mr,5);approval={'scope':'TASK03_ATTEMPT6_INTEGRATED_REPAIR1_SOURCE_ONLY','verdict':'PASS','independent':True,'candidateSha256':h(freeze),'sourceManifestSha256':h(mr),'sourceManifestOriginalNine':mrow['PRE'],'sourcePlanSha256':h(pr),'sources':{x['path']:x['sha256']for x in manifest['files']}}
 if mutation=='approval-scope':approval['scope']='old'
 if mutation=='approval-verdict':approval['verdict']='REJECT'
 if mutation=='approval-bool':approval['independent']=1
 if mutation=='approval-freeze':approval['candidateSha256']='wrong'
 if mutation=='approval-manifest':approval['sourceManifestSha256']='wrong'
 if mutation=='approval-plan':approval['sourcePlanSha256']='wrong'
 if mutation=='approval-source':approval['sources'][sr['path']]='wrong'
 if mutation=='approval-membership':approval['sources']['extra']='wrong'
 if mutation=='approval-nine':approval['sourceManifestOriginalNine']={**mrow['PRE'],'ctime_ns':'2'}
 files={SF:raw,FP:freeze,PP:pr,SP:st,MP:mr,AP:json.dumps(approval).encode()};pins={SF:sr['PRE'],FP:fr['PRE'],PP:ppr['PRE'],SP:ss['PRE'],MP:mrow['PRE'],AP:row(AP,files[AP],6)['PRE']};fds={};events=[];sequence=[0];compiled=[]
 if mutation in ('uid','gid','nlink','mtime','ctime','mode'):
  k={'mtime':'mtime_ns','ctime':'ctime_ns'}.get(mutation,mutation);pins[SF]={**pins[SF],k:str(int(pins[SF][k])+1)}
 if mutation=='wrong-content':files[SF]=b'x'*len(raw)
 def status(p):
  assert p in pins,p;return types.SimpleNamespace(**{'st_'+k:int(v)for k,v in pins[p].items()})
 def opened(p,flags):assert p in files;sequence[0]+=1;fds[sequence[0]]=[p,0];events.append(('open',p));return sequence[0]
 def read(fd,count):
  p,o=fds[fd];b=files[p][o:o+count];fds[fd][1]+=len(b);events.append(('read',p))
  if p==SF and kind=='complete':assert {v[0]for v in fds.values()}=={SF,FP,PP,SP}
  if p==SF and mutation=='late-identity':pins[SF]={**pins[SF],'ctime_ns':'999'}
  return b
 fake=types.SimpleNamespace(O_RDONLY=os.O_RDONLY,O_NOFOLLOW=os.O_NOFOLLOW,lstat=status,fstat=lambda fd:status(fds[fd][0]),open=opened,read=read,close=lambda fd:fds.pop(fd))
 def compiling(b,path,*a,**kw):assert any(x[0]==SF for x in fds.values());assert bytes(b)==raw;compiled.append(True);return compile(b,path,*a,**kw)
 accepted=False
 try:
  if kind=='bootstrap':
   env={'R':R,'P':F,'Q':Q,'APPROVAL':AP,'FREEZE':h(freeze),'os':fake,'stat':stat,'json':json,'hashlib':hashlib,'types':types,'strict_json':json.loads,'compile':compiling};exec(bc,env);out=env['load_module']('CONTROL_ONLY',SF);assert out.MARKER=='COMPILED_REVIEWED_BYTES'and compiled==[True]
  else:
   env={};exec(gc,env);env.update(os=fake,R=R,P=F,Q=Q);env['qualify_sources']();assert ('read',SF)in events
  accepted=True
 except (AssertionError,KeyError,ValueError):pass
 assert accepted is (mutation is None),(kind,mutation,accepted);assert not fds,(kind,mutation,'leaked descriptors')
 tests.append({'id':kind+'-'+str(mutation),'status':'PASS','accepted':accepted,'allDescriptorsClosed':True,'positiveAllDescriptorsBeforeContent':kind=='complete'and accepted,'positiveCompileWhileOriginalHeld':bool(compiled),'realEffects':0})
for kind in ('bootstrap','complete'):
 case(kind)
 for m in ('approval-scope','approval-verdict','approval-bool','approval-freeze','approval-manifest','approval-plan','approval-source','approval-membership','approval-nine','foreign-manifest-scope','writers-active','history-repaired','duplicate','missing-member','extra-member','active-stop','pending-writes','immature-stop','immature-input','after-stop','uid','gid','nlink','mtime','ctime','mode','wrong-content','late-identity'):case(kind,m)
with (J/'independent-loader-gate-results.json').open('x')as o:json.dump({'scope':'EXACT_BOOTSTRAP_COMPLETE_SOURCE_IN_MEMORY_ONLY','status':'PASS','count':len(tests),'rows':tests,'privateReads':0,'DockerCalls':0,'serviceCalls':0,'attestationAuthored':False},o,indent=2);o.write('\n')
print(json.dumps({'controls':len(tests),'status':'PASS','realEffects':0}))
