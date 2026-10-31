"""Independent finite controls: public AST only; every external/private effect blocked."""
import ast,copy,hashlib,json,os,pathlib,stat,time,types
R=pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=QA/'task03-local-native-attempt6-2026-10-06';OLD=QA/'task03-local-native-attempt5-2026-10-06'
J=QA/'local-resume-2026-10-05/task03-attempt6-integrated-source-review1';P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-preparation'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');cap={x['path']:x for x in json.loads((J/'first-prospective-current-input-manifest.json').read_bytes())['files']};reads=[];controls=[];unsafe=[]
def ident(st):return {k:str(getattr(st,'st_'+k)) for k in FIELDS}
def public(path):
 assert path.is_relative_to(R) and path.resolve()==path
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);before=ident(os.fstat(fd));parts=[]
 try:
  assert stat.S_ISREG(int(before['mode'])) and before['nlink']=='1'
  while b:=os.read(fd,262144):parts.append(b)
  raw=b''.join(parts);assert len(raw)==int(before['size']) and before==ident(os.fstat(fd))==ident(os.lstat(path))
  rel=str(path.relative_to(R));prior=cap.get(rel)
  if prior is not None:assert before==prior['PRE']
  reads.append({'path':rel,'PRE':before,'POST':ident(os.fstat(fd)),'pathPOST':ident(os.lstat(path)),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'fullEOF':True,'currentWithinReadNine':'PASS','firstProspectiveReviewerPRE':prior is not None})
  return raw
 finally:os.close(fd)
def modules(path,names,extra=None):
 raw=public(path);tree=ast.parse(raw);by={n.name:n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))};env=dict(extra or {})
 exec(compile(ast.Module(body=[by[n] for n in names],type_ignores=[]),str(path),'exec',dont_inherit=True),env);return env,tree

def control(name,fn,deny=False):
 try:fn()
 except (AssertionError,ValueError,TimeoutError,RuntimeError):
  assert deny,name+': expected acceptance but was denied'
  controls.append({'id':name,'observed':'DENIED_BEFORE_EFFECT','status':'PASS','effects':'ALL_SUBSTITUTED'});return
 assert not deny,name+': unsafe case was unexpectedly accepted'
 controls.append({'id':name,'observed':'NAMED_OUTCOME_ASSERTION_PASSED','status':'PASS','effects':'ALL_SUBSTITUTED'})
def witness(name,fn,detail):
 fn();unsafe.append({'id':name,'observed':'UNSAFE_ACCEPTANCE_REPRODUCED','sourceDefect':detail,'effects':'ALL_SUBSTITUTED'});controls.append({'id':name,'observed':'UNSAFE_ACCEPTANCE_REPRODUCED','status':'PASS_WITNESS_ONLY','effects':'ALL_SUBSTITUTED'})

OP='c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f';V='cortex-task03-attempt6-fixture-20261006-c9fbaa34';IMAGE='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3';FREEZE='115e417419ab7b55e9fdbad97e51513f9f24a8e523c7b344168a63c92d8e968c'
pe,pt=modules(Q/'integrated/private-coordinate.py',['strict_json','inspect_owned','assert_recipe'],{'json':json,'OP':OP,'VOLUME':V,'IMAGE':IMAGE,'OWNED_NAMES':('receiver','selector'),'OWNED_IDS':{'receiver':'a'*64,'selector':'b'*64}})
base={'Name':'/receiver','Config':{'Labels':{'cortex.operation':OP},'Image':IMAGE,'User':'501:20','Cmd':['REVIEWED_RECEIVER'],'Entrypoint':None},'Image':IMAGE,'Id':'a'*64,'Platform':'linux','State':{'Running':False,'Pid':0,'OOMKilled':False},'HostConfig':{'ReadonlyRootfs':True,'NetworkMode':'none','Memory':536870912,'MemorySwap':536870912,'PidsLimit':64,'NanoCpus':2000000000,'Privileged':False,'Mounts':[{'Type':'volume','Source':V,'Target':'/owned','VolumeOptions':{'NoCopy':True}},{'Type':'volume','Source':V,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}}]},'Mounts':[{'Type':'volume','Name':V,'Destination':'/owned','RW':True,'Source':'/var/lib/docker/volumes/'+V+'/_data','Driver':'local'},{'Type':'volume','Name':V,'Destination':'/prep','RW':False,'Source':'/var/lib/docker/volumes/'+V+'/_data','Driver':'local'}]}
def changed(path,value):
 out=copy.deepcopy(base);node=out
 for k in path[:-1]:node=node[k]
 node[path[-1]]=value;return out
control('private-receiver-exact-represented-recipe',lambda:pe['assert_recipe'](base,'receiver'))
for label,path,value in [('foreign-id',['Id'],'c'*64),('foreign-operation',['Config','Labels','cortex.operation'],'foreign'),('foreign-image',['Image'],'foreign'),('numeric-running-alias',['State','Running'],0),('boolean-pid-alias',['State','Pid'],False),('wrong-user',['Config','User'],'0:0'),('writable-prep',['HostConfig','Mounts',1,'ReadOnly'],False),('numeric-readonly-alias',['HostConfig','Mounts',1,'ReadOnly'],1),('numeric-nocopy-alias',['HostConfig','Mounts',0,'VolumeOptions','NoCopy'],1),('numeric-rw-alias',['Mounts',0,'RW'],1),('foreign-volume-name',['Mounts',0,'Name'],'foreign'),('foreign-network',['HostConfig','NetworkMode'],'bridge')]:
 control('private-deny-'+label,lambda path=path,value=value:pe['assert_recipe'](changed(path,value),'receiver'),True)
for label,path,value in [('cmd',['Config','Cmd'],['UNREVIEWED_EXECUTABLE']),('entrypoint',['Config','Entrypoint'],['UNREVIEWED_ENTRYPOINT']),('actual-source',['Mounts',0,'Source'],'/unrelated/native/source'),('actual-driver',['Mounts',0,'Driver'],'UNREVIEWED_DRIVER'),('platform',['Platform'],'windows'),('privileged',['HostConfig','Privileged'],True)]:
 witness('private-unsafe-'+label,lambda path=path,value=value:pe['assert_recipe'](changed(path,value),'receiver'),'private-coordinate.py:172-195 omits '+label+' validation before protected receiver/selector work')
for name,data in [('duplicate',b'{"a":1,"a":2}'),('nonfinite',b'{"a":NaN}')]:control('private-strict-json-'+name,lambda data=data:pe['strict_json'](data),True)

required=('nativeSourceOriginalNineFullEOFHashSize','destinationOriginalNineFullEOFHashSize','hostOriginalStageOriginalNineFullEOFHashSize','rsa2048','privateKeyMatchesFrozenSingleJWK','RS256SignVerify','changedMessageNegativeControl','environmentMatchesOwnedDevTarget','requestAndProvisionOwnership','freshIsolatedCloudDevelopmentTarget','originalSourceClosureAllNineFullEOFHashSize')
oe,ot=modules(Q/'integrated/official-dispatcher.py',['strict','owner','recipe','bind_crypto_gate','phase'],{'json':json,'OP':OP,'V':V,'IMAGE':IMAGE,'FREEZE':FREEZE})
crypto={'verdict':'PASS','independent':True,'scope':'ACTUAL_PRIVATE_CUSTODY_CRYPTO_ENV_TARGET_ONLY','operation':OP,'volume':V,'immutableImage':IMAGE,'candidateSha256':FREEZE,'sourceManifestSha256':'manifest','privateSourceApprovalSha256':'approval','actualObserverSha256':'observer','actualPrivateCustodyCryptoEnvTargetAccepted':True,'maximumPaidCalls':0,'productionSharedOrLocalTarget':False,**{k:'PASS'for k in required}}
control('crypto-exact-current-binding',lambda:oe['bind_crypto_gate'](crypto,'approval','manifest','observer'))
for field,value in [('operation','foreign'),('volume','foreign'),('immutableImage','foreign'),('candidateSha256','foreign'),('sourceManifestSha256','foreign'),('privateSourceApprovalSha256','foreign'),('actualObserverSha256','foreign'),('independent',False),('actualPrivateCustodyCryptoEnvTargetAccepted',False),('maximumPaidCalls',False),('productionSharedOrLocalTarget',True)]+[(f,'FAIL')for f in required]:
 control('crypto-deny-'+field,lambda field=field,value=value:oe['bind_crypto_gate']({**crypto,field:value},'approval','manifest','observer'),True)

class Clock:
 def __init__(self,t=0):self.now=t
 def monotonic(self):return self.now
 def sleep(self,t):self.now+=t
class FinishFile:
 def __init__(self,clock,finish,value):self.clock=clock;self.finish=finish;self.value=value
 def exists(self):return True
 def read_bytes(self):self.clock.now=self.finish;return json.dumps(self.value).encode()
class FinishLog:
 def __init__(self,file):self.file=file
 def __truediv__(self,name):return self.file
main=next(n for n in pt.body if isinstance(n,ast.FunctionDef)and n.name=='main');loop=next(n for n in ast.walk(main)if isinstance(n,ast.While)and n.lineno==356)
code=compile(ast.Module(body=[loop],type_ignores=[]),'exact-native-finish-loop','exec')
def finish_case(begin,end,overrides=None,expect=True):
 clock=Clock(begin);value={'operation':OP,'finish':True,'candidateSha256':FREEZE,'actualNativeOutcomeIndependentlyReviewed':True,**(overrides or {})};env={'time':clock,'deadline':2400,'LOG':FinishLog(FinishFile(clock,end,value)),'OP':OP,'FREEZE':FREEZE,'completed':False,'strict_json':pe['strict_json']};exec(code,env);assert env['completed']is expect
control('finish-accepted-inside-original-window',lambda:finish_case(2000,2001))
control('finish-not-entered-after-original-window',lambda:finish_case(2401,2401,expect=False))
for field,value in [('operation','foreign'),('candidateSha256','foreign'),('finish',False),('actualNativeOutcomeIndependentlyReviewed',False)]:control('finish-deny-'+field,lambda field=field,value=value:finish_case(2300,2301,{field:value}),True)
witness('finish-unsafe-read-completed-after-2400',lambda:finish_case(2399,2401),'private-coordinate.py:356-363 lacks an after-read/terminal deadline assertion; late read sets completed=True')

# Exact outer native phase AST with all command/metadata/log/clock effects replaced.
def outer_phase(observed_at,running=False,start=0,deadline=3000):
 clock=Clock(start);calls=[];cid='d'*64;spec={'name':'driver','containerId':cid,'cmd':['pinned-driver'],'requestedMounts':[],'selectedLiteralMapping':''}
 def inspect(cid,label):
  calls.append(['inspect',label]);clock.now=observed_at if '-poll-'in label else clock.now
  return {'State':{'Running':running if '-poll-'in label else False,'Status':'created'if '-pre-start'in label else'exited','Pid':0,'Error':'','ExitCode':0}}
 def run(label,args,*a,**k):calls.append(['run',label]);return {'exitCode':0},b'{"status":"PASS","cleanupComplete":true}',b''
 oe.update({'recipes':{'driver':spec},'owned':{'driver':cid},'DEADLINE':deadline,'time':clock,'inspect':inspect,'owner':lambda *a:None,'recipe':lambda *a:None,'run':run,'absence':lambda *a:None})
 return oe['phase']('driver'),calls
control('native-outer-on-time-terminal-accepted',lambda:outer_phase(100))
control('native-outer-late-terminal-denied',lambda:outer_phase(1261),True)
control('native-outer-late-running-denied',lambda:outer_phase(1261,True),True)
control('native-outer-terminal-insufficient-log-window-denied',lambda:outer_phase(1201),True)
control('native-outer-complete-future-window-denied',lambda:outer_phase(100,deadline=1709),True)

# Actual public byte conservation, without historical custody or runtime claims.
frozen=json.loads(public(Q/'candidate-freeze-attempt6.json'));oldfreeze=json.loads(public(Q/'ancestry/q5-candidate-freeze.json'));newrows={x['path']:x for x in frozen['files']};oldrows={x['path']:x for x in oldfreeze['files']};changed_names={n for n in oldrows if newrows[n]['sha256']!=oldrows[n]['sha256']or newrows[n]['bytes']!=oldrows[n]['bytes']}
assert len(oldrows)==1905 and len(newrows)==1907;assert set(newrows)-set(oldrows)=={'ancestry/q5-candidate-freeze.json','ancestry/q5-independent-preparation-review.json'};assert changed_names=={'scripts/guard.mjs','project-request.json','transport-prep/transport-binding.json','fresh-identity-public.json'}
controls.append({'id':'all-original-1905-member-conservation','status':'PASS','byteExactOriginal':1901,'declaredDeltas':sorted(changed_names),'twoNamedAncestryAdditions':True,'runtime':False})
keyfiles=['scripts/deploy.mjs','scripts/driver.mjs','scripts/qualify.mjs','scripts/cleanup.mjs','scripts/process-owner.mjs','scripts/native-engine.mjs','scripts/child-toolchain.mjs','scripts/auth-boundaries.mjs','scripts/lifecycle.mjs','scripts/policy-delta.mjs','scripts/reactive-transport.mjs','transport-prep/private-transport.py','attempt5/source-acquisition.py']
for name in keyfiles:
 a=public(Q/name);b=public(OLD/name);assert a==b;controls.append({'id':'byte-exact-original-'+name,'status':'PASS','sha256':hashlib.sha256(a).hexdigest(),'bytes':len(a),'runtime':False})
assert (frozen['currentProductRegistered'],frozen['public'],frozen['internal'],frozen['fixtureOnlyInternal'],frozen['expectedActualNativePublished'])==(275,200,75,12,287)
assert hashlib.sha256(public(Q/'candidate-freeze-attempt6.json')).hexdigest()==FREEZE
controls.append({'id':'exact-discovery-registration-counts-preserved','status':'PASS','product':275,'public':200,'internal':75,'fixtureOnlyInternal':12,'published':287,'runtime':False})
for path in [Q/'integrated'/n for n in ('coordinate-common.py','official-dispatcher.py','private-coordinate.py','retire-selector.py','reuse-private-key.py','source-gates.py')]+[Q/'coordinate-source'/n for n in ('task03-attempt5-coordinate-common.py','task03-attempt5-public-coordinate.py','task03-attempt5-linux-public-transfer.py')]:
 ast.parse(public(path));controls.append({'id':'python-parse-'+path.name,'status':'PASS','scope':'SYNTAX_ONLY'})

result={'scope':'INDEPENDENT_PUBLIC_SOURCE_AST_AND_BYTE_CONTROLS_ONLY','status':'REVIEW_CONTROLS_COMPLETE_WITH_CANDIDATE_DEFECTS','controlCount':len(controls),'unsafeAcceptanceWitnessCount':len(unsafe),'controls':controls,'unsafeWitnesses':unsafe,'originalAggregateCustodyGate':'FAILED_UNKNOWN_PRESERVED','privateReads':0,'DockerCalls':0,'serviceCalls':0,'CLIExecuted':False,'nativeQualificationExecuted':False,'functionalTask03Accepted':False,'goalAccepted':False}
for name,value in [('source-controls.json',result),('review-public-read-receipts.json',{'scope':'CURRENT_WITHIN_READ_FULL_EOF_NINE_PUBLIC_BYTES_ONLY','reads':reads,'readCount':len(reads),'privateReads':0})]:
 fd=os.open(J/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w')as f:json.dump(value,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
print(json.dumps({'scope':result['scope'],'controls':len(controls),'unsafeWitnesses':len(unsafe),'privateReads':0,'runtimeEffects':0}))
