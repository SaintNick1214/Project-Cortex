"""Finite source-only controls; every Docker, private, CLI, account and service effect substituted."""
from pathlib import Path
import ast,copy,hashlib,importlib.util,json,os
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-preparation';Q=QA/'task03-local-native-attempt6-2026-10-06'
def module(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
D=module('inert_dispatcher_controls',Q/'integrated/official-dispatcher.py');G=module('inert_source_gates_controls',Q/'integrated/source-gates.py')
rows=[]
def check(name,fn):
 try:fn();rows.append({'name':name,'status':'PASS'})
 except BaseException as error:rows.append({'name':name,'status':'FAIL','failureClass':type(error).__name__})
def denial(fn):
 try:fn()
 except (AssertionError,ValueError,TimeoutError):return
 raise AssertionError('unsafe acceptance')
labels={'cortex.operation':D.OP,'cortex.goal':'convex-backend-runtime-2026-10-02','cortex.scope':'official-current-foundation-execution'}
name='cortex-task03-attempt6-deploy-'+D.OP[:8];cid='a'*64;D.owned[name]=cid
mounts=[{'Type':'bind','Source':str(R),'Target':str(R),'ReadOnly':True},{'Type':'volume','Source':D.D,'Target':str(R/'node_modules'),'ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'node_modules'}},{'Type':'volume','Source':D.V,'Target':str(Q),'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}},{'Type':'volume','Source':D.V,'Target':str(D.S),'VolumeOptions':{'NoCopy':True,'Subpath':'private'}}]
cmd=D.command_for('deploy')
def sample(prefix=''):
 requested=[{**x,'Source':prefix+x['Source']}if x['Type']=='bind'else copy.deepcopy(x)for x in mounts]
 actual=[{'Type':x['Type'],'Destination':x['Target'],'RW':not x.get('ReadOnly',False),**({'Source':prefix+x['Source']}if x['Type']=='bind'else{'Name':x['Source'],'Driver':'local','Source':'/var/lib/docker/volumes/'+x['Source']+'/_data'})}for x in mounts]
 return {'Name':'/'+name,'Id':cid,'Image':D.IMAGE,'Platform':'linux','Config':{'Image':D.IMAGE,'Labels':labels,'Cmd':cmd,'Entrypoint':None,'User':'501:20','WorkingDir':str(R)},'HostConfig':{'Memory':2147483648,'MemorySwap':2147483648,'PidsLimit':64,'NanoCpus':2000000000,'NetworkMode':'bridge','ReadonlyRootfs':True,'Privileged':False,'AutoRemove':False,'PublishAllPorts':False,'PortBindings':{},'CapAdd':None,'Devices':[],'Tmpfs':{'/tmp':'rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20'},'Mounts':requested},'Mounts':actual,'State':{'Running':False,'OOMKilled':False,'Pid':0}}
for prefix in ('','/host_mnt'):check('literal-mount-vector-'+(prefix or 'host'),lambda prefix=prefix:D.recipe(sample(prefix),name,cmd,mounts)==prefix or (_ for _ in ()).throw(AssertionError()))
for field in ('Memory','MemorySwap','PidsLimit','NanoCpus'):
 for val in (True,0):
  def f(field=field,val=val):o=sample();o['HostConfig'][field]=val;denial(lambda:D.recipe(o,name,cmd,mounts))
  check('typed-resource-denial-'+field+'-'+repr(val),f)
for field in ('ReadonlyRootfs','Privileged','AutoRemove','PublishAllPorts'):
 def f(field=field):o=sample();o['HostConfig'][field]=int(o['HostConfig'][field]);denial(lambda:D.recipe(o,name,cmd,mounts))
 check('typed-boolean-denial-'+field,f)
for field in ('Image','Id','Name'):
 def f(field=field):o=sample();o[field]='foreign';denial(lambda:D.recipe(o,name,cmd,mounts))
 check('foreign-container-denial-'+field,f)
for changed in ('source','subpath','rw','mixed','nocopy'):
 def f(changed=changed):
  o=sample()
  if changed=='source':o['Mounts'][0]['Source']+='/foreign'
  if changed=='subpath':o['HostConfig']['Mounts'][1]['VolumeOptions']['Subpath']='candidate'
  if changed=='rw':o['Mounts'][0]['RW']=0
  if changed=='mixed':o['HostConfig']['Mounts'][0]['Source']='/host_mnt'+str(R)
  if changed=='nocopy':o['HostConfig']['Mounts'][1]['VolumeOptions']['NoCopy']=1
  denial(lambda:D.recipe(o,name,cmd,mounts))
 check('exact-mount-denial-'+changed,f)
for raw in (b'{"a":1,"a":2}',b'{"a":NaN}',b'{"a":Infinity}'):
 check('strict-json-denial-'+repr(raw),lambda raw=raw:denial(lambda:D.strict(raw)))
v={'verdict':'PASS','independent':True,'scope':'ACTUAL_PRIVATE_CUSTODY_CRYPTO_ENV_TARGET_ONLY','operation':D.OP,'volume':D.V,'immutableImage':D.IMAGE,'candidateSha256':D.FREEZE,'sourceManifestSha256':'m','privateSourceApprovalSha256':'a','actualObserverSha256':'o','actualPrivateCustodyCryptoEnvTargetAccepted':True,'maximumPaidCalls':0,'productionSharedOrLocalTarget':False}
passfields=('nativeSourceOriginalNineFullEOFHashSize','destinationOriginalNineFullEOFHashSize','hostOriginalStageOriginalNineFullEOFHashSize','rsa2048','privateKeyMatchesFrozenSingleJWK','RS256SignVerify','changedMessageNegativeControl','environmentMatchesOwnedDevTarget','requestAndProvisionOwnership','freshIsolatedCloudDevelopmentTarget','originalSourceClosureAllNineFullEOFHashSize')
v.update({k:'PASS'for k in passfields});check('complete-current-crypto-positive',lambda:D.bind_crypto_gate(v,'a','m','o'))
for field in ('operation','volume','immutableImage','candidateSha256','sourceManifestSha256','privateSourceApprovalSha256','actualObserverSha256','scope','independent','maximumPaidCalls','productionSharedOrLocalTarget')+passfields:
 def f(field=field):o=copy.deepcopy(v);o[field]=False if field=='independent'else True if field in('maximumPaidCalls','productionSharedOrLocalTarget')else'FOREIGN';denial(lambda:D.bind_crypto_gate(o,'a','m','o'))
 check('bound-current-crypto-denial-'+field,f)
# Exact required whole-phase guards are executed from their AST with all clocks/commands replaced.
a=ast.parse((Q/'integrated/official-dispatcher.py').read_text());phase=next(x for x in a.body if isinstance(x,ast.FunctionDef)and x.name=='phase')
checks=[x for x in ast.walk(phase)if isinstance(x,ast.Assert)and any(isinstance(y,ast.Constant)and y.value=='original_driver_whole_phase_1260_deadline'for y in ast.walk(x))];assert len(checks)==1
code=compile(ast.Module(body=checks,type_ignores=[]),'<unchanged-terminal-deadline-assertion>','exec')
class Clock:
 def __init__(self,t):self.t=t
 def monotonic(self):return self.t
for t,accept in ((1259,True),(1260,True),(1260.001,False)):
 def f(t=t,accept=accept):
  env={'time':Clock(t),'phase_end':1260}
  if accept:exec(code,env)
  else:denial(lambda:exec(code,env))
 check('running-and-terminal-deadline-'+str(t),f)
# Failures remain failures; exact original native programs are preserved, rather than mirrored tests.
for name in ('deploy','driver','qualify','cleanup','native-engine','process-owner','process-terminal','lifecycle','policy-delta','auth-boundaries'):
 check('original-executable-conservation-'+name,lambda name=name:((Q/'scripts'/f'{name}.mjs').read_bytes()==(QA/'task03-local-native-attempt5-2026-10-06/scripts'/f'{name}.mjs').read_bytes())or(_ for _ in ()).throw(AssertionError()))
check('native-inner-original-deadlines',lambda:('120000' in(Q/'scripts/deploy.mjs').read_text()and'1260000'in(Q/'scripts/driver.mjs').read_text()and'1200000'in(Q/'scripts/native-engine.mjs').read_text())or(_ for _ in ()).throw(AssertionError()))
check('pipeline-minimum-budget-arithmetic',lambda:(D.OFFICIAL_RESERVE==30+310+1380+300+30 and D.OFFICIAL_RESERVE+240<=2400)or(_ for _ in ()).throw(AssertionError()))
check('no-module-level-dispatch',lambda:all(not(isinstance(x,ast.Expr)and isinstance(x.value,ast.Call))for x in a.body)or(_ for _ in ()).throw(AssertionError()))
for p in sorted((Q/'integrated').glob('*.py')):
 check('syntax-'+p.name,lambda p=p:ast.parse(p.read_text()))
result={'scope':'PUBLIC_SOURCE_EFFECT_SUBSTITUTED_CONTROLS_ONLY','status':'PASS'if all(x['status']=='PASS'for x in rows)else'FAIL','count':len(rows),'rows':rows,'DockerCalls':0,'privateReadsStatsOrCopies':0,'managementCalls':0,'nativeCases':0,'actualRuntimeCertified':False}
fd=os.open(P/'public-control-results2-final.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w')as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:result[k]for k in ('scope','status','count','privateReadsStatsOrCopies','actualRuntimeCertified')}))
if result['status']!='PASS':raise SystemExit(1)
