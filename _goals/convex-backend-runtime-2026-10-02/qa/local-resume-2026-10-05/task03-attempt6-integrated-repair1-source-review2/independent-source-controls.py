"""Fresh independent exact-AST outcome controls; external effects substituted; own fixtures only."""
import ast,copy,hashlib,json,os,pathlib,stat,time,types,importlib.util,importlib._bootstrap_external,sys
R=pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=QA/'task03-local-native-attempt6-2026-10-06';F=QA/'local-resume-2026-10-05/task03-attempt6-integrated-repair1';J=F.parent/'task03-attempt6-integrated-repair1-source-review2'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');cap={x['path']:x for x in json.loads((J/'first-prospective-input-capture.json').read_bytes())['files']};reads=[];rows=[]
def h(b):return hashlib.sha256(b).hexdigest()
def nine(s):return{k:str(getattr(s,'st_'+k))for k in FIELDS}
def public(p):
 rel=str(p.relative_to(R));assert rel in cap
 pre=nine(os.lstat(p));fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert pre==nine(os.fstat(fd))==cap[rel]['PRE'];parts=[]
  while b:=os.read(fd,262144):parts.append(b)
  b=b''.join(parts);assert len(b)==int(pre['size']);assert pre==nine(os.fstat(fd))==nine(os.lstat(p));reads.append({'path':rel,'PRE':pre,'POST':nine(os.fstat(fd)),'pathPOST':nine(os.lstat(p)),'sha256':h(b),'bytes':len(b),'fullEOF':True});return b
 finally:os.close(fd)
def funcs(p,names,env):
 t=ast.parse(public(p));by={x.name:x for x in t.body if isinstance(x,ast.FunctionDef)};exec(compile(ast.Module(body=[by[x]for x in names],type_ignores=[]),str(p),'exec'),env);return env,t
def test(name,fn,deny=False):
 accepted=True
 try:fn()
 except (AssertionError,ValueError,KeyError,TimeoutError,RuntimeError):accepted=False
 assert accepted is (not deny),(name,'unexpected acceptance'if accepted else'unexpected denial');rows.append({'id':name,'status':'PASS','expected':'DENY'if deny else'NAMED_POSITIVE','observedAccepted':accepted,'effects':'SUBSTITUTED_OR_OWN_FINITE_FIXTURE_ONLY'})
OP='c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f';V='cortex-task03-attempt6-fixture-20261006-c9fbaa34';IMG='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3';FREEZE='115e417419ab7b55e9fdbad97e51513f9f24a8e523c7b344168a63c92d8e968c';N='receiver';SN='selector';cmds={N:['python','held-reviewed-receiver'],SN:['python','held-reviewed-selector']}
e,t=funcs(F/'private-coordinate-final.py',['strict_json','inspect_owned','assert_recipe','docker_create'],{'json':json,'OP':OP,'VOLUME':V,'IMAGE':IMG,'OWNED_NAMES':(N,SN),'SELECTOR_NAME':SN,'OWNED_IDS':{N:'a'*64,SN:'b'*64},'OWNED_COMMANDS':copy.deepcopy(cmds)})
def recipe(name):
 sel=name==SN;requested=[{'Type':'volume','Source':V,'Target':'/owned','VolumeOptions':{'NoCopy':True}}]
 if not sel:requested.append({'Type':'volume','Source':V,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}})
 return {'Name':'/'+name,'Id':e['OWNED_IDS'][name],'Platform':'linux','Image':IMG,'Config':{'Labels':{'cortex.operation':OP},'Image':IMG,'User':'501:20','WorkingDir':'/tmp','Entrypoint':None,'Cmd':cmds[name],'Tty':False,'OpenStdin':True,'StdinOnce':False},'State':{'Running':False,'Pid':0,'Status':'created','OOMKilled':False,'Error':'','ExitCode':0},'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'Privileged':False,'AutoRemove':False,'PublishAllPorts':False,'Memory':536870912,'MemorySwap':536870912,'PidsLimit':64,'NanoCpus':2000000000,'Binds':None,'PortBindings':{},'CapAdd':None,'CapDrop':None,'Devices':[],'SecurityOpt':None,'VolumesFrom':None,'Tmpfs':{'/tmp':'rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20'},'Mounts':requested},'Mounts':[{'Type':'volume','Name':V,'Destination':r['Target'],'Source':'/var/lib/docker/volumes/'+V+'/_data','Driver':'local','RW':not r.get('ReadOnly',False)}for r in requested]}
def mutate(o,path,v):
 o=copy.deepcopy(o);n=o
 for k in path[:-1]:n=n[k]
 n[path[-1]]=v;return o
bad=[('Id','f'*64),('Platform','windows'),('Image','foreign'),('Config.Image','foreign'),('Config.Labels',{'cortex.operation':OP,'other':'foreign'}),('Config.Cmd',['unreviewed']),('Config.Cmd',('python','held-reviewed-receiver')),('Config.Entrypoint',['unreviewed']),('Config.User','0:0'),('Config.WorkingDir','/foreign'),('Config.Tty',0),('Config.OpenStdin',1),('Config.StdinOnce',0),('State.Running',0),('State.Pid',False),('State.Pid',-1),('State.OOMKilled',0),('State.ExitCode',False),('State.Error',False),('State.Status','exited'),('HostConfig.Privileged',1),('HostConfig.Privileged',True),('HostConfig.ReadonlyRootfs',1),('HostConfig.AutoRemove',True),('HostConfig.PublishAllPorts',True),('HostConfig.Memory',True),('HostConfig.MemorySwap',False),('HostConfig.PidsLimit',True),('HostConfig.NanoCpus',True),('HostConfig.Binds',['foreign']),('HostConfig.PortBindings',{'x':'foreign'}),('HostConfig.CapAdd',['SYS_ADMIN']),('HostConfig.CapDrop',['CHOWN']),('HostConfig.Devices',['foreign']),('HostConfig.SecurityOpt',['seccomp=unconfined']),('HostConfig.VolumesFrom',['foreign']),('HostConfig.Tmpfs',{}),('Mounts.0.Source','/foreign'),('Mounts.0.Driver','foreign'),('Mounts.0.RW',1),('Mounts.0.Name','foreign'),('HostConfig.Mounts.0.VolumeOptions.NoCopy',1)]
for name in (N,SN):
 b=recipe(name);test(name+'-exact-complete-recipe',lambda b=b,name=name:e['assert_recipe'](b,name,selector=name==SN))
 for i,(path,v)in enumerate(bad):
  parts=[int(x)if x.isdecimal()else x for x in path.split('.')];test(name+'-deny-'+str(i)+'-'+path,lambda b=b,name=name,parts=parts,v=v:e['assert_recipe'](mutate(b,parts,v),name,selector=name==SN),True)
 for label,change in [('extra-mount',lambda b:b['Mounts'].append(copy.deepcopy(b['Mounts'][0]))),('requested-numeric-readonly',lambda b:b['HostConfig']['Mounts'][0].update(ReadOnly=0))]:
  m=copy.deepcopy(b);change(m);test(name+'-deny-'+label,lambda m=m,name=name:e['assert_recipe'](m,name,selector=name==SN),True)
for label,b in [('duplicate',b'{"a":1,"a":2}'),('nonfinite',b'{"a":Infinity}')]:test('strict-json-'+label,lambda b=b:e['strict_json'](b),True)
main=next(x for x in t.body if isinstance(x,ast.FunctionDef)and x.name=='main');loop=next(x for x in ast.walk(main)if isinstance(x,ast.While)and any(isinstance(c,ast.Name)and c.id=='completed'for c in ast.walk(x)))
finishcode=compile(ast.Module(body=[loop],type_ignores=[]),'exact-original-2400-loop','exec')
class Clock:
 def __init__(self,start):self.now=start
 def monotonic(self):return self.now
 def sleep(self,s):self.now+=s
class File:
 def __init__(self,c,end,v):self.c,self.end,self.v=c,end,v
 def exists(self):return True
 def read_bytes(self):self.c.now=self.end;return self.v
class Dir:
 def __init__(self,f):self.f=f
 def __truediv__(self,n):return self.f
def finish(start,end,validation_end=None,changes=None):
 c=Clock(start);v={'operation':OP,'finish':True,'candidateSha256':FREEZE,'actualNativeOutcomeIndependentlyReviewed':True,**(changes or{})}
 class Validation(dict):
  def __getitem__(self,k):
   value=super().__getitem__(k)
   if k=='actualNativeOutcomeIndependentlyReviewed'and validation_end is not None:c.now=validation_end
   return value
 env={'time':c,'deadline':2400,'LOG':Dir(File(c,end,v)),'strict_json':lambda raw:Validation(raw),'completed':False,'OP':OP,'FREEZE':FREEZE};exec(finishcode,env);assert env['completed']is True
for start,end,val in [(2300,2301,2302),(2399,2399.5,2399.9)]:test('finish-inside-'+str(end),lambda start=start,end=end,val=val:finish(start,end,val))
for label,start,end,val in [('late-read',2399,2401,None),('exact-deadline-read',2399,2400,None),('validation-overrun',2399,2399.1,2401),('exact-validation-boundary',2399,2399.1,2400),('late-initial',2401,2401,None)]:test('finish-deny-'+label,lambda start=start,end=end,val=val:finish(start,end,val),True)
for k,v in [('operation','foreign'),('finish',1),('candidateSha256','foreign'),('actualNativeOutcomeIndependentlyReviewed',1)]:test('finish-deny-'+k,lambda k=k,v=v:finish(2300,2301,changes={k:v}),True)
o,ot=funcs(F/'official-dispatcher-final.py',['strict','bind_crypto_gate','phase','run','cleanup'],{'json':json,'OP':OP,'V':V,'IMAGE':IMG,'FREEZE':FREEZE,'os':os,'R':R,'LOG':J,'rows':[]})
required=('nativeSourceOriginalNineFullEOFHashSize','destinationOriginalNineFullEOFHashSize','hostOriginalStageOriginalNineFullEOFHashSize','rsa2048','privateKeyMatchesFrozenSingleJWK','RS256SignVerify','changedMessageNegativeControl','environmentMatchesOwnedDevTarget','requestAndProvisionOwnership','freshIsolatedCloudDevelopmentTarget','originalSourceClosureAllNineFullEOFHashSize')
cv={'verdict':'PASS','independent':True,'scope':'ACTUAL_PRIVATE_CUSTODY_CRYPTO_ENV_TARGET_ONLY','operation':OP,'volume':V,'immutableImage':IMG,'candidateSha256':FREEZE,'sourceManifestSha256':'manifest','privateSourceApprovalSha256':'approval','actualObserverSha256':'observer','actualPrivateCustodyCryptoEnvTargetAccepted':True,'maximumPaidCalls':0,'productionSharedOrLocalTarget':False,**{k:'PASS'for k in required}}
test('crypto-exact-named-semantics',lambda:o['bind_crypto_gate'](cv,'approval','manifest','observer'))
for k,v in [(k,'foreign')for k in ('verdict','scope','operation','volume','immutableImage','candidateSha256','sourceManifestSha256','privateSourceApprovalSha256','actualObserverSha256')]+[('independent',1),('actualPrivateCustodyCryptoEnvTargetAccepted',1),('maximumPaidCalls',False),('productionSharedOrLocalTarget',0)]+[(k,'STATIC_ONLY')for k in required]:test('crypto-deny-'+k,lambda k=k,v=v:o['bind_crypto_gate']({**cv,k:v},'approval','manifest','observer'),True)
def phase(observation,deadline=3000,running=False):
 c=Clock(0);calls=[];cid='c'*64;spec={'name':'driver','containerId':cid,'cmd':['reviewed'],'requestedMounts':[],'selectedLiteralMapping':''}
 def inspect(cid,label):
  if '-poll-'in label:c.now=observation
  calls.append(label);return {'State':{'Running':running if '-poll-'in label else False,'Status':'created'if '-pre-start'in label else'exited','Pid':0,'Error':'','ExitCode':0}}
 def run(label,args,*a,**kw):calls.append(label);return {'exitCode':0},b'{"status":"PASS","cleanupComplete":true}',b''
 o.update({'recipes':{'driver':spec},'owned':{'driver':cid},'DEADLINE':deadline,'time':c,'inspect':inspect,'owner':lambda *a:None,'recipe':lambda *a:None,'run':run,'absence':lambda *a:None});result=o['phase']('driver');assert result['status']=='PASS';assert 'driver-logs'in calls
for label,tm,dl,run in [('on-time',100,3000,False),('terminal-late',1261,3000,False),('running-late',1261,3000,True),('logs-not-admitted',1201,3000,False),('future-reserve-not-admitted',100,1709,False)]:test('official-phase-'+label,lambda tm=tm,dl=dl,run=run:phase(tm,dl,run),label!='on-time')
# New adapter independently exercised with the unchanged original executable bytes in own public fixtures.
a_bytes=public(Q/'attempt5/source-acquisition.py');t_bytes=public(Q/'transport-prep/private-transport.py');adapter=types.ModuleType('independent_adapter');exec(compile(public(F/'held-acquisition.py'),str(F/'held-acquisition.py'),'exec'),adapter.__dict__)
def put(p,b):
 p.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
 with p.open('xb')as out:out.write(b);out.flush();os.fsync(out.fileno())
 os.chmod(p,0o600)
def cached(p):
 s=p.stat();code=compile("UNREVIEWED_CACHE_EXECUTED=True\nNAMES=('evil',)\nMANIFEST='evil'\n",str(p),'exec');b=importlib._bootstrap_external._code_to_timestamp_pyc(code,int(s.st_mtime),s.st_size);pc=pathlib.Path(importlib.util.cache_from_source(str(p)));pc.parent.mkdir(exist_ok=True);pc.write_bytes(b)
def acquire_case(label,cache_mode=None,mutation=None):
 fixture=J/('fixture-'+label);fixture.mkdir(mode=0o700);a=fixture/'attempt5/source-acquisition.py';tp=fixture/'transport-prep/private-transport.py';put(a,a_bytes);put(tp,t_bytes)
 def pin(p,b):return {'PRE':nine(p.stat()),'bytes':len(b),'sha256':h(b)}
 ap,tpin=pin(a,a_bytes),pin(tp,t_bytes)
 if cache_mode=='before':cached(tp)
 if mutation=='hash':tpin['sha256']='f'*64
 if mutation=='bool-size':tpin['bytes']=True
 if mutation=='nine':tpin['PRE']['ctime_ns']=str(int(tpin['PRE']['ctime_ns'])+1)
 original=adapter.VerifiedDependencyLoader.exec_module
 def at_use(self,module):
  if cache_mode=='at-use':cached(tp)
  if mutation=='late-change':os.utime(tp,ns=(tp.stat().st_atime_ns,tp.stat().st_mtime_ns+1))
  return original(self,module)
 adapter.VerifiedDependencyLoader.exec_module=at_use
 try:
  m=adapter.load_acquisition(a,tp,ap,tpin,fixture);assert m.T.NAMES==('jwt-private.pem','target.json','deploy.env') and not getattr(m.T,'UNREVIEWED_CACHE_EXECUTED',False);assert a.read_bytes()==a_bytes and tp.read_bytes()==t_bytes
 finally:adapter.VerifiedDependencyLoader.exec_module=original
for label,mode,mut,deny in [('original',None,None,False),('cache-before','before',None,False),('cache-at-first-use','at-use',None,False),('wrong-hash',None,'hash',True),('bool-size',None,'bool-size',True),('wrong-nine',None,'nine',True),('late-change',None,'late-change',True)]:test('held-adapter-'+label,lambda label=label,mode=mode,mut=mut:acquire_case(label,mode,mut),deny)
# Reuse bindings are public bytes only; native first-use source derivation tested without private stdin/access.
nt=ast.parse(public(F/'held-acquisition.py'));nf=next(x for x in nt.body if isinstance(x,ast.FunctionDef)and x.name=='native_main');ncode=compile(ast.Module(body=[nf],type_ignores=[]),'exact-native-first-use','exec')
def native_case(change=None):
 names=('attempt5/source-acquisition.py','transport-prep/private-transport.py');sources={names[0]:{'sha256':h(a_bytes),'bytes':len(a_bytes)},names[1]:{'sha256':h(t_bytes),'bytes':len(t_bytes)}}
 identity={f:'1'for f in ('st_'+f for f in FIELDS)};rs=[{'path':name,**sources[name],'destinationIdentityDecimal':identity}for name in names]+[{'path':'other-'+str(i)}for i in range(1912)];receipt={'scope':'NEW_PROSPECTIVE_LINUX_PUBLIC_CANDIDATE_CUSTODY_ONLY','sourceFreezeSha256':FREEZE,'files':rs,'actualServiceRequests':0,'privateBytesCopied':False}
 argv=['/prep/attempt5/source-acquisition.py','receive-copy','/owned/native','source-'+OP,'/owned/private','/prep/transport-prep/transport-binding.json','/owned/receipts'];cfg={'operation':OP,'candidateSha256':FREEZE,'publicTransferReceiptSha256':'c'*64,'sources':sources,'argv':argv}
 if change=='op':cfg['operation']='foreign'
 if change=='receipt-count':receipt['files'].pop()
 if change=='duplicate':receipt['files'][-1]={'path':names[0]}
 if change=='paid':receipt['actualServiceRequests']=True
 if change=='bytes':receipt['files'][0]['bytes']=True
 if change=='pin':receipt['files'][0]['destinationIdentityDecimal']={'st_dev':'1'}
 if change=='freeze':receipt['sourceFreezeSha256']='foreign'
 calls=[]
 class HS:
  def __init__(self,*args):calls.append('receipt-open')
  def content(self):return receipt
  def verify(self):calls.append('receipt-verify')
  def close(self):calls.append('receipt-close')
 def load(a,tp,ap,tpp,root,**kw):
  assert a==pathlib.Path('/prep')/names[0]and tp==pathlib.Path('/prep')/names[1];assert ap['sha256']==h(a_bytes)and tpp['sha256']==h(t_bytes);assert set(ap['PRE'])==set(FIELDS);assert kw=={'as_main':True,'argv':argv};calls.append('exact-held-load');return 'FIRST_USE_BOUND'
 fakeos=types.SimpleNamespace(lstat=lambda p:types.SimpleNamespace(st_size=1));env={'Path':pathlib.Path,'os':fakeos,'identity':lambda v:{f:'1'for f in FIELDS},'HeldSource':HS,'strict':lambda v:v,'FIELDS':FIELDS,'load_acquisition':load};exec(ncode,env);out=env['native_main'](cfg);assert out=='FIRST_USE_BOUND'and calls.index('exact-held-load')>calls.index('receipt-verify')and calls[-1]=='receipt-close'
for label in [None,'op','receipt-count','duplicate','paid','bytes','pin','freeze']:test('native-first-use-'+str(label),lambda label=label:native_case(label),label is not None)
# Exact current public release consumer, with ALL decisions and reads replaced by named in-memory data.
g,gt=funcs(F/'source-gates-final.py',['qualify_public_release'],{'P':F,'Q':Q,'json':json,'hashlib':hashlib,'strict':json.loads,'digest':h})
basebinding=json.loads(public(F/'prospective-binding-final.json'));request=json.loads(public(Q/'project-request.json'));freeze_bytes=public(Q/'candidate-freeze-attempt6.json');transport=json.loads(public(Q/'transport-prep/transport-binding.json'))
def public_gate(change=None):
 custody={'scope':'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY','verdict':'PASS','independent':True,'operation':OP,'volume':V,'candidateSha256':FREEZE,'prospectiveSourceManifestSha256':'mf','sourceApprovalSha256':'approval','immutableImage':IMG,'publicFiles':1914,'allCurrentDestinationIdentities':'PASS_ALL9','currentSourceDestinationFullContent':'PASS','publicRecipeBindingSha256':h(b'recipe'),'publicSourceManifestSha256':h(b'public-mf'),'publicTransferReceiptSha256':'a'*64}
 prep={'scope':'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION','verdict':'PASS','independent':True,'candidateSha256':FREEZE,'candidateMembers':1907};mg={'scope':'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY','verdict':'PASS','independent':True,'managementSourceSha256':h(b'mgmt'),'requestSha256':basebinding['requestSha256']}
 if change:
  group,key,val=change;{'custody':custody,'prep':prep,'management':mg}[group][key]=val
 files={F/'prospective-binding-final.json':json.dumps(basebinding).encode(),Q/'candidate-freeze-attempt6.json':freeze_bytes,Q/'project-request.json':json.dumps(request).encode(),Q/'transport-prep/transport-binding.json':json.dumps(transport).encode(),F/'independent-preparation-review.json':json.dumps(prep).encode(),F/'task03-attempt6-management-review.json':json.dumps(mg).encode(),F/'target-management.mjs':b'mgmt',F/'task03-attempt6-linux-public-custody-review.json':json.dumps(custody).encode(),F/'public-recipe-binding-final.json':b'recipe',F/'public-source-receipt-manifest-final.json':b'public-mf'}
 g.update(read=lambda p:files[p],qualify_sources=lambda:({'candidateSha256':FREEZE},'approval','mf'));out=g['qualify_public_release']();assert out['publicTransferReceiptSha256']=='a'*64
changes=[('custody',k,'foreign')for k in ('scope','verdict','operation','volume','candidateSha256','prospectiveSourceManifestSha256','sourceApprovalSha256','immutableImage','allCurrentDestinationIdentities','currentSourceDestinationFullContent','publicRecipeBindingSha256','publicSourceManifestSha256')]+[('custody','publicFiles',True),('custody','independent',1),('custody','publicTransferReceiptSha256','G'*64),('prep','candidateMembers',True),('prep','candidateSha256','foreign'),('prep','independent',1),('management','managementSourceSha256','foreign'),('management','requestSha256','foreign'),('management','scope','foreign')]
test('public-gate-exact-current-binding',public_gate)
for group,key,v in changes:test('public-gate-deny-'+group+'-'+key,lambda group=group,key=key,v=v:public_gate((group,key,v)),True)
# Exact conservation and complete source reference receipt arithmetic.
freeze=json.loads(freeze_bytes);old=json.loads(public(Q/'ancestry/q5-candidate-freeze.json'));newrows={x['path']:x for x in freeze['files']};oldrows={x['path']:x for x in old['files']};deltas={n for n in oldrows if newrows[n]['sha256']!=oldrows[n]['sha256']or newrows[n]['bytes']!=oldrows[n]['bytes']}
assert len(oldrows)==1905 and len(newrows)==1907 and deltas=={'scripts/guard.mjs','project-request.json','transport-prep/transport-binding.json','fresh-identity-public.json'} and set(newrows)-set(oldrows)=={'ancestry/q5-candidate-freeze.json','ancestry/q5-independent-preparation-review.json'};test('candidate-1905-to1907-only-declared-deltas',lambda:None)
assert (freeze['currentProductRegistered'],freeze['public'],freeze['internal'],freeze['fixtureOnlyInternal'],freeze['expectedActualNativePublished'])==(275,200,75,12,287)
for name in ['scripts/deploy.mjs','scripts/driver.mjs','scripts/qualify.mjs','scripts/cleanup.mjs','scripts/process-owner.mjs','scripts/native-engine.mjs','scripts/child-toolchain.mjs','scripts/auth-boundaries.mjs','scripts/lifecycle.mjs','scripts/policy-delta.mjs','scripts/reactive-transport.mjs','attempt5/source-acquisition.py','transport-prep/private-transport.py']:
 b=public(Q/name);assert h(b)==oldrows[name]['sha256']and len(b)==oldrows[name]['bytes'];test('unchanged-original-'+name,lambda:None)
# Inspect every actual operative mapped program/binding in full; save all read receipts, no unreviewed effect execution.
mp=json.loads(public(F/'operative-repair-map-final.json'))
for x in mp['files']:
 b=public(R/x['path']);assert h(b)==x['sha256']and len(b)==x['bytes']
 if x['path'].endswith('.py'):ast.parse(b)
# Exact topological placement of changed recipe / source gates before provision and protected start.
source=public(F/'private-coordinate-final.py').decode();assert source.index('prepare_linux_selector()\n        G.qualify_sources()\n        provision_attempted = True')<source.index("run('provision'");assert source.index("run('private-receiver-current-inspect'")<source.index('receiver_attempted = True')<source.index("run('private-receiver',");assert 'deadline = time.monotonic()+2400'in source and source.count('assert time.monotonic() < deadline')==2
test('pre-provision-pre-start-complete-exact-source-order',lambda:None)
result={'scope':'FRESH_INDEPENDENT_SOURCE_CONTROLS_ONLY','status':'PASS','count':len(rows),'rows':rows,'privateReads':0,'DockerCalls':0,'serviceCalls':0,'CLI':False,'native':False,'sourceEnablingAttestationAuthored':False,'fullTask03Accepted':False,'goalAccepted':False}
for name,value in [('independent-source-control-results.json',result),('independent-public-read-receipts.json',{'scope':'CURRENT_FIRST_CAPTURE_NINE_FULL_EOF_READS','reads':reads,'count':len(reads),'privateReads':0})]:
 with (J/name).open('x')as out:json.dump(value,out,indent=2);out.write('\n')
print(json.dumps({'controls':len(rows),'reads':len(reads),'status':'PASS_SOURCE_ONLY','effects':0}))
