"""Independent finite original-conservation, source/runtime contract and JS rerun."""
import ast,base64,copy,hashlib,json,os,re,stat,sys,time,types,zlib,subprocess
from pathlib import Path
J=Path(REVIEW_DIR);U=J.parent/'task03-attempt6-actual-public-custody-readiness-repair3';OLD=U.parent/'task03-attempt6-actual-public-custody-readiness-repair2'
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa'
source=DATA[str(U/'run-actual-review.py')];tree=ast.parse(source)
functions=[n for n in tree.body if isinstance(n,ast.FunctionDef)]
ns=dict(base64=base64,hashlib=hashlib,json=json,os=os,re=re,stat=stat,sys=sys,time=time,types=types,zlib=zlib,Path=Path)
exec(compile(ast.fix_missing_locations(ast.Module(body=functions,type_ignores=[])),'<held-actual-contract-functions>','exec'),ns)
checks=[];failures=[]
def check(name,fn):
 try:d=fn();checks.append({'name':name,'status':'PASS','details':d})
 except BaseException as e:checks.append({'name':name,'status':'FAIL','class':type(e).__name__,'reason':str(e)});failures.append({'name':name,'class':type(e).__name__,'reason':str(e)})
def deny(fn):
 try:fn()
 except (AssertionError,ValueError):return True
 raise AssertionError('negative accepted')
def common_conservation():
 original=DATA[str(QA/'task03-local-native-attempt6-2026-10-06/integrated/coordinate-common.py')].decode();current=DATA[str(OLD/'coordinate-common-highfd.py')].decode()
 helper="def control_readable(control, wait):\n    with selectors.DefaultSelector() as readiness:\n        readiness.register(control, selectors.EVENT_READ)\n        return bool(readiness.select(wait))\n\n"
 assert current.count(helper)==1
 reconstructed=current.replace(helper,'').replace('control_readable(control,0.02)','select.select([control],[],[],0.02)[0]').replace('control_readable(control,wait)','select.select([control],[],[],wait)[0]').replace('control_readable(control,max(0,ready_deadline-time.monotonic()))','select.select([control],[],[],max(0,ready_deadline-time.monotonic()))[0]')
 assert reconstructed==original,'entire original Common byte equality outside exactly three readiness substitutions'
 return {'originalBytes':len(original.encode()),'currentBytes':len(current.encode()),'exactThreeWaitSubstitutions':True,'noOriginalAssertionOrBodyChanges':True,'originalSha256':hashlib.sha256(original.encode()).hexdigest()}
check('Common:full-original-byte-conservation',common_conservation)
def historical():
 rawpaths=sorted(p for p in DATA if p.startswith(str(OLD/'highfd-controls1')) and p.endswith('.receipt.json'))
 assert len(rawpaths)==11
 summary=[]
 for p in rawpaths:
  row=json.loads(DATA[p]);base=p[:-len('.receipt.json')]
  for suffix in ('stdout','stderr'):
   raw=DATA[base+'.'+suffix];assert hashlib.sha256(raw).hexdigest()==row[suffix+'Sha256'];assert row['streamByteCounts'][suffix]>=len(raw)
  assert row['closeErrors']==[] and row['ownedGroup']['absenceObserved'] is True
  summary.append({'name':Path(base).name,'exit':row['exitCode'],'failure':row['failureClass'],'terminal':row['terminal']})
 author=json.loads(DATA[str(U/'source-fault-controls3.stdout')]);assert author['count']==len(author['controls'])==97
 for n in (1,2):
  assert DATA[str(U/('source-fault-controls'+str(n)+'.stdout'))]==b''
  assert DATA[str(U/('source-fault-controls'+str(n)+'.stderr'))]
 verdict=json.loads(DATA[str(J.parent/'task03-attempt6-highfd-public-repair2-independent-source-review1/verdict5.json')]);assert verdict['verdict']=='REJECT'
 return {'original11RawFullyHashed':summary,'author97Only':True,'priorTwoAuthorFailuresRetained':True,'U2REJECTRetained':True}
check('History:original11-and-rejections-preserved',historical)
template={'terminal':True,'closeErrors':[],'failureClass':None,'exitCode':0}
def command_case(label,patch=None,count=0,timeout=190,complete=True):
 row=dict(template);row.update(patch or {});calls=[]
 def run(*a,**k):calls.append(a);return row,b'',b''
 ns.update(C=types.SimpleNamespace(run=run),source_graph_complete=complete,records=[{}]*count,RAW=J,ENV={})
 negative=patch is not None or count==48 or timeout in (0,191) or not complete
 if negative:deny(lambda:ns['command']('mock',[],timeout))
 else:ns['command']('mock',[],timeout)
 if not complete or count==48 or timeout in (0,191):assert not calls,'pre-dispatch denial'
 return {'mockCalls':len(calls),'negativeDenied':negative,'recordBudget':48,'seconds':timeout}
check('Command:positive190',lambda:command_case('positive'))
for label,kw in [('source-incomplete',{'complete':False}),('48commands',{'count':48}),('timeout0',{'timeout':0}),('timeout191',{'timeout':191}),('nonterminal',{'patch':{'terminal':False}}),('closeerror',{'patch':{'closeErrors':['OSError']}}),('failure',{'patch':{'failureClass':'TimeoutError'}}),('false-exit',{'patch':{'exitCode':False}}),('string-exit',{'patch':{'exitCode':'0'}}),('nonzero',{'patch':{'exitCode':1}})]:check('Command:'+label,lambda label=label,kw=kw:command_case(label,**kw))
MEM=2147483648;cid='a'*64;image='sha256:'+'b'*64;k='custody';argv=['/usr/bin/env','-i','/usr/bin/python3','-B','observer']
mount={'Type':'bind','Source':'/review-source','Target':'/source','ReadOnly':True};labels={'operation':'source-mock'}
obj={'Name':'/mock-custody','Id':cid,'Image':image,'Platform':'linux','Config':{'Labels':labels,'Image':image,'User':'501:20','WorkingDir':str(R),'Cmd':argv,'Entrypoint':None,'Env':['PATH=/usr/bin:/bin']},'State':{'Running':False,'OOMKilled':False,'ExitCode':0,'Error':'','Status':'exited'},'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'Privileged':False,'AutoRemove':False,'PortBindings':{},'PublishAllPorts':False,'CapDrop':['ALL'],'SecurityOpt':['no-new-privileges'],'Memory':MEM,'MemorySwap':MEM,'PidsLimit':64,'NanoCpus':2000000000,'Tmpfs':{'/tmp':'rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20'},'Mounts':[mount]},'Mounts':[{'Type':'bind','Destination':'/source','Source':'/review-source','RW':False}]}
ns.update(NAMES={k:'mock-custody'},LABELS=labels,owners={k:cid},IMAGE=image,R=R,image_env=['PATH=/usr/bin:/bin'],MEM=MEM,recipes={})
def recipe_case(changes):
 value=copy.deepcopy(obj)
 for keys,val in changes:
  target=value
  for key in keys[:-1]:target=target[key]
  target[keys[-1]]=val
 if changes:deny(lambda:ns['recipe'](value,k,argv,[mount]))
 else:assert ns['recipe'](value,k,argv,[mount])=='literal'
 return {'negativeDenied':bool(changes),'noDockerCalls':True}
check('Recipe:complete-positive',lambda:recipe_case([]))
for field in ('Memory','MemorySwap','PidsLimit','NanoCpus'):
 for value in (False,'2147483648',0):check('Recipe:'+field+':'+repr(value),lambda field=field,value=value:recipe_case([(['HostConfig',field],value)]))
for label,keys,value in [('network',['HostConfig','NetworkMode'],'bridge'),('readOnly',['HostConfig','ReadonlyRootfs'],False),('privileged',['HostConfig','Privileged'],True),('ports',['HostConfig','PortBindings'],{'80/tcp':[{}]}),('fullCID',['Id'],'abc'),('foreignCID',['Id'],'c'*64),('image',['Image'],'sha256:'+'c'*64),('user',['Config','User'],'0:0'),('entrypoint',['Config','Entrypoint'],['bash']),('heap-env',['Config','Env'],['PATH=/usr/bin:/bin','NODE_OPTIONS=--max-old-space-size=4096']),('mount-writable',['Mounts',0,'RW'],True),('OOM',['State','OOMKilled'],True),('false-exit',['State','ExitCode'],False)]:check('Recipe:'+label,lambda keys=keys,value=value:recipe_case([(keys,value)]))
def finite_export():
 ns['MAX_EXPORT']=4194304
 valid=b'{"finite":[1.25,-2e10]}'
 import gzip
 env={'encoding':'gzip+base64','decodedBytes':len(valid),'decodedSha256':hashlib.sha256(valid).hexdigest(),'body':base64.b64encode(gzip.compress(valid)).decode()}
 assert ns['compressed'](json.dumps(env).encode())=={'finite':[1.25,-2e10]}
 for alias in (False,'25',float('inf'),float('-inf')):
  bad=dict(env,decodedBytes=alias);raw=json.dumps(bad).replace('Infinity','1e309').encode();deny(lambda:ns['compressed'](raw))
 bad=dict(env,decodedSha256='0'*64);deny(lambda:ns['compressed'](json.dumps(bad).encode()))
 deny(lambda:ns['compressed'](b'X'*262145))
 return {'validFiniteValuesPreserved':True,'overflowAndNegativeOverflowControllingSizeDenied':True,'boolStringHashPipeNegativeDenied':True}
check('Export:positive-and-reachable-size-negatives',finite_export)
js=DATA[str(J/'independent-js-controls2.mjs')]
payload={'source':DATA[str(U/'linux-dependency-observer.mjs')].decode(),'old':DATA[str(OLD/'linux-dependency-observer.mjs')].decode(),'fixtures':[str(U/'fixtures'/('owned-source-'+str(i)+'.json')) for i in range(3)]}
proc=subprocess.run(['/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node','--input-type=module','-e',js.decode()],input=json.dumps(payload).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30,env={'HOME':'/Users/SaintNick','PATH':'/usr/bin:/bin','LANG':'C.UTF-8'})
(J/'independent-js-controls3.stdout').write_bytes(proc.stdout);(J/'independent-js-controls3.stderr').write_bytes(proc.stderr)
assert proc.returncode==0,proc.stderr.decode();jr=json.loads(proc.stdout);checks.extend(jr['controls']);failures.extend(jr['failures'])
RESULT={'scope':'INDEPENDENT_U3_CONTRACT_AND_CORRECTED_JS_SOURCE_MOCK','sourceEligibility':False,'controls':checks,'PASS':sum(r['status']=='PASS' for r in checks),'FAIL':len(failures),'failures':failures,'candidateSourceInputsHeld':len(OWNERS),'actualEffects':{'Docker':0,'network':0,'credentials':0,'private':0,'service':0},'fullTask03':False,'fullGoal':False}
