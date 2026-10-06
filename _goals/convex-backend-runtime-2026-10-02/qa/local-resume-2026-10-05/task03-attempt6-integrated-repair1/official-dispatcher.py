"""Dispatch unchanged reviewed official deployment/native programs; finite owned Docker phases."""
import datetime, hashlib, importlib.util, json, os, sys, time
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-repair1'
Q=P.parent.parent/'task03-local-native-attempt6-2026-10-06'
S=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt6-private-20261006')
OP='c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f'
V='cortex-task03-attempt6-fixture-20261006-c9fbaa34'
D='cortex-task03-deps-20261005-b681774e'
IMAGE='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
COMMON=Q/'integrated/coordinate-common.py'
LOG=S/'coordination'; rows=[]; owned={}; recipes={}; C=None; DEADLINE=None
FREEZE='115e417419ab7b55e9fdbad97e51513f9f24a8e523c7b344168a63c92d8e968c'
APPROVAL=P/'integrated-source-review.json'
SOURCE_MANIFEST=P/'prospective-source-manifest.json'
GATE=P/'actual-private-crypto-execution-release.json'
OFFICIAL_RESERVE=2050
CREATED=False
MODULE_LOADER=None
def strict(raw):
 def pairs(items):
  o={}
  for k,v in items:
   if k in o:raise ValueError('duplicate_json')
   o[k]=v
  return o
 return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda x:(_ for _ in ()).throw(ValueError('nonfinite_json')))
def run(label,args,timeout=30,required=True):
 start=time.monotonic()
 if DEADLINE is not None:assert start+timeout<=DEADLINE,'entire_command_window_not_admitted'
 row,_,_=C.run('official-'+label,args,LOG,timeout,{**os.environ,'CORTEX_COORDINATOR_CWD':str(R)},required=False);rows.append(row)
 assert time.monotonic()<=start+timeout,'command_terminal_deadline'
 if DEADLINE is not None:assert time.monotonic()<=DEADLINE,'whole_pipeline_deadline'
 assert row['terminal']is True and row['closeErrors']==[] and row['failureClass']is None
 if required:assert type(row['exitCode'])is int and row['exitCode']==0
 return row,(LOG/('official-'+label+'.stdout')).read_bytes(),(LOG/('official-'+label+'.stderr')).read_bytes()
def inspect(name,label):
 _,raw,_=run(label,['docker','inspect',name]);o=strict(raw);assert len(o)==1;return o[0]
def owner(o,name):
 assert o['Name']=='/'+name and o['Image']==o['Config']['Image']==IMAGE
 assert o['Config']['Labels']=={'cortex.operation':OP,'cortex.goal':'convex-backend-runtime-2026-10-02','cortex.scope':'official-current-foundation-execution'}
 assert type(o['Id'])is str and len(o['Id'])==64 and all(c in '0123456789abcdef'for c in o['Id'])
 assert o['Id']==owned[name] and type(o['State']['Running'])is bool
 assert type(o['State']['Pid'])is int
def recipe(o,name,cmd,mounts,mapping=None):
 owner(o,name);h=o['HostConfig'];assert o['Config']['Cmd']==cmd and o['Config']['Entrypoint']is None
 assert o['Config']['User']=='501:20'and o['Config']['WorkingDir']==str(R)and o['Platform']=='linux'
 for field,value in [('Memory',2147483648),('MemorySwap',2147483648),('PidsLimit',64),('NanoCpus',2000000000)]:assert type(h[field])is int and h[field]==value
 for f in ('ReadonlyRootfs','Privileged','AutoRemove','PublishAllPorts'):assert type(h[f])is bool
 assert h['NetworkMode']=='bridge'and h['ReadonlyRootfs']is True and h['Privileged']is False and h['AutoRemove']is False
 assert h['PublishAllPorts']is False and h['PortBindings']=={} and not h['CapAdd']and not h['Devices']
 assert h['Tmpfs']=={'/tmp':'rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20'}
 for m in h['Mounts']:
  if 'ReadOnly'in m:assert type(m['ReadOnly'])is bool
  if m['Type']=='volume':assert type(m['VolumeOptions']['NoCopy'])is bool and m['VolumeOptions']['NoCopy']is True
 choices=[]
 for prefix in ('','/host_mnt'):
  expected=[{**m,'Source':prefix+m['Source']}if m['Type']=='bind'else m for m in mounts]
  if h['Mounts']==expected:choices.append(prefix)
 assert len(choices)==1
 selected=choices[0]
 if mapping is not None:assert selected==mapping
 actual={m['Destination']:m for m in o['Mounts']};assert len(actual)==len(o['Mounts'])==len(mounts)
 for m in mounts:
  a=actual[m['Target']];assert a['Type']==m['Type']and type(a['RW'])is bool and a['RW']is (not m.get('ReadOnly',False))
  if m['Type']=='bind':assert a['Source']==selected+m['Source']
  else:assert a['Name']==m['Source']and a['Driver']=='local'and a['Source']=='/var/lib/docker/volumes/'+m['Source']+'/_data'
 assert type(o['State']['OOMKilled'])is bool and o['State']['OOMKilled']is False
 return selected

def source_gate():
 assert MODULE_LOADER is not None
 g=MODULE_LOADER('attempt6_source_gate',P/'source-gates.py')
 return g.qualify_public_release()

def absence(name,label):
 row,raw,err=run(label,['docker','inspect',name],required=False)
 assert type(row['exitCode'])is int and row['exitCode']==1 and raw==b'[]\n'
 assert err.strip().lower()==('error: no such object: '+name).encode()

def command_for(key):
 env=['/usr/bin/env','-i','PATH=/usr/local/bin:/usr/bin:/bin','HOME=/tmp','LANG=C.UTF-8','CI=1','NO_COLOR=1','TMPDIR=/tmp','CORTEX_FOUNDATION_TARGET_RECEIPT='+str(S/'target.json'),'CORTEX_FOUNDATION_DEPLOY_ENV='+str(S/'deploy.env'),'/usr/local/bin/node']
 if key=='deploy':return [*env,str(Q/'scripts/deploy.mjs'),'deploy']
 assert key=='driver'
 selector="import assert from 'node:assert/strict';import{readdirSync}from'node:fs';const s="+json.dumps(str(S))+";const names=readdirSync(s).filter(n=>/^codegen-[a-f0-9-]+\\.json$/.test(n));assert.equal(names.length,1);process.env.CORTEX_FOUNDATION_CODEGEN_RECEIPT=s+'/'+names[0];await import("+json.dumps(str(Q/'scripts/driver.mjs'))+");"
 return [*env,'--input-type=module','-e',selector]

def create_phase(key):
 name='cortex-task03-attempt6-'+key+'-'+OP[:8];absence(name,key+'-absence')
 mounts=[{'Type':'bind','Source':str(R),'Target':str(R),'ReadOnly':True},
 {'Type':'volume','Source':D,'Target':str(R/'node_modules'),'ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'node_modules'}},
 {'Type':'volume','Source':V,'Target':str(Q),'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}},
 {'Type':'volume','Source':V,'Target':str(S),'VolumeOptions':{'NoCopy':True,'Subpath':'private'}}]
 cmd=command_for(key)
 args=['docker','create','--name',name,'--platform','linux/amd64','--network','bridge','--memory','2147483648','--memory-swap','2147483648','--cpus','2','--pids-limit','64','--read-only','--user','501:20','--workdir',str(R),'--tmpfs','/tmp:rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20']
 for k,v in {'cortex.operation':OP,'cortex.goal':'convex-backend-runtime-2026-10-02','cortex.scope':'official-current-foundation-execution'}.items():args+=['--label',k+'='+v]
 for m in mounts:
  value='type='+m['Type']+',source='+m['Source']+',target='+m['Target']
  if m.get('ReadOnly'):value+=',readonly'
  if m['Type']=='volume':value+=',volume-nocopy,volume-subpath='+m['VolumeOptions']['Subpath']
  args+=['--mount',value]
 _,raw,_=run(key+'-create',args+[IMAGE,*cmd]);cid=raw.decode().strip();assert len(cid)==64 and all(c in '0123456789abcdef'for c in cid);owned[name]=cid
 o=inspect(cid,key+'-initial-inspect');selected=recipe(o,name,cmd,mounts)
 assert o['State']['Running']is False and o['State']['Status']=='created'and type(o['State']['Pid'])is int and o['State']['Pid']==0
 recipes[key]={'name':name,'containerId':cid,'requestedMounts':mounts,'selectedLiteralMapping':selected,'cmd':cmd}
 C.durable_json(LOG/('official-'+key+'-prepared-recipe.json'),recipes[key])


def crypto_recipe(o,spec):
 owner(o,spec['name']);h=o['HostConfig']
 assert o['Config']['Cmd']==spec['cmd']and o['Config']['Entrypoint']is None and o['Config']['User']=='501:20'and o['Platform']=='linux'
 for f,value in [('Memory',536870912),('MemorySwap',536870912),('PidsLimit',64),('NanoCpus',2000000000)]:assert type(h[f])is int and h[f]==value
 for f,value in [('ReadonlyRootfs',True),('Privileged',False),('AutoRemove',False),('PublishAllPorts',False)]:assert type(h[f])is bool and h[f]is value
 assert h['NetworkMode']=='none'and h['PortBindings']=={} and not h['CapAdd']and not h['Devices']
 assert h['Tmpfs']=={'/tmp':'rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20'}
 expected=spec['mounts'];choices=[]
 for prefix in ('','/host_mnt'):
  mapped=[{**m,'Source':prefix+m['Source']}if m['Type']=='bind'else m for m in expected]
  if h['Mounts']==mapped:choices.append(prefix)
 assert len(choices)==1
 for m in h['Mounts']:
  assert type(m['ReadOnly'])is bool and m['ReadOnly']is True
  if m['Type']=='volume':assert type(m['VolumeOptions']['NoCopy'])is bool and m['VolumeOptions']['NoCopy']is True
 actual={m['Destination']:m for m in o['Mounts']};assert len(actual)==len(o['Mounts'])==len(expected)
 for m in expected:
  a=actual[m['Target']];assert a['Type']==m['Type']and type(a['RW'])is bool and a['RW']is False
  if m['Type']=='bind':assert a['Source']==choices[0]+m['Source']
  else:assert a['Name']==V and a['Driver']=='local'and a['Source']=='/var/lib/docker/volumes/'+V+'/_data'
 assert type(o['State']['OOMKilled'])is bool and o['State']['OOMKilled']is False
 if 'mapping'in spec:assert choices[0]==spec['mapping']
 return choices[0]

def create_crypto():
 name='cortex-task03-attempt6-crypto-'+OP[:8];absence(name,'crypto-absence')
 mounts=[{'Type':'volume','Source':V,'Target':'/owned','ReadOnly':True,'VolumeOptions':{'NoCopy':True}}, {'Type':'volume','Source':V,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}}, {'Type':'bind','Source':str(Q/'integrated'),'Target':'/control','ReadOnly':True}]
 cmd=['/usr/bin/env','-i','PATH=/usr/local/bin:/usr/bin:/bin','HOME=/tmp','TMPDIR=/tmp','LANG=C.UTF-8','CI=1','NO_COLOR=1','/usr/local/bin/node','/control/linux-private-custody-crypto-observer.mjs']
 argv=['docker','create','--name',name,'--platform','linux/amd64','--network','none','--memory','536870912','--memory-swap','536870912','--cpus','2','--pids-limit','64','--read-only','--user','501:20','--tmpfs','/tmp:rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20']
 for k,v in {'cortex.operation':OP,'cortex.goal':'convex-backend-runtime-2026-10-02','cortex.scope':'official-current-foundation-execution'}.items():argv+=['--label',k+'='+v]
 for m in mounts:
  mount='type='+m['Type']+',source='+m['Source']+',target='+m['Target']+',readonly'
  if m['Type']=='volume':
   mount+=',volume-nocopy'
   if 'Subpath'in m['VolumeOptions']:mount+=',volume-subpath='+m['VolumeOptions']['Subpath']
  argv+=['--mount',mount]
 _,raw,_=run('crypto-create',argv+[IMAGE,*cmd]);cid=raw.decode().strip();assert len(cid)==64 and all(c in '0123456789abcdef'for c in cid);owned[name]=cid
 spec={'name':name,'containerId':cid,'mounts':mounts,'cmd':cmd};initial=inspect(cid,'crypto-prepared-inspect');spec['mapping']=crypto_recipe(initial,spec)
 assert initial['State']['Running']is False and initial['State']['Status']=='created'and initial['State']['Pid']==0
 recipes['crypto']=spec;C.durable_json(LOG/'crypto-prepared-recipe.json',spec)

def observe_crypto(end):
 global DEADLINE
 assert DEADLINE is None and end-time.monotonic()>=OFFICIAL_RESERVE+240,'crypto_full_120_observer_and_metadata_windows_not_admitted'
 DEADLINE=end;spec=recipes['crypto'];cid=spec['containerId'];name=spec['name']
 initial=inspect(cid,'crypto-pre-start');crypto_recipe(initial,spec);assert initial['State']['Running']is False and initial['State']['Status']=='created'
 command,raw,err=run('crypto-run',['docker','start','--attach',cid],120)
 terminal=inspect(cid,'crypto-terminal');crypto_recipe(terminal,spec)
 assert terminal['State']['Running']is False and terminal['State']['Status']=='exited'and terminal['State']['Pid']==0 and type(terminal['State']['ExitCode'])is int and terminal['State']['ExitCode']==0 and terminal['State']['Error']==''and err==b''
 result=strict(raw);assert result['scope']=='ACTUAL_PRIVATE_CUSTODY_CRYPTO_ENV_TARGET_ONLY'and result['status']=='PASS'and result['operation']==OP and result['maximumPaidCalls']==0 and result['privateBytesPrinted']is False
 run('crypto-remove',['docker','rm',cid]);absence(cid,'crypto-removed-absence');del owned[name]
 # This is an actual observation, not an independent verdict or an enabling approval.
 runtime=P/'runtime';assert runtime.is_dir()and not runtime.is_symlink()
 C.durable_json(runtime/'actual-private-crypto-observation.json',result)
 return hashlib.sha256((Q/'integrated/linux-private-custody-crypto-observer.mjs').read_bytes()).hexdigest()

def prepare(common):
 global C,CREATED
 assert C is None and CREATED is False;C=common
 source_gate()
 _,raw,_=run('daemon-resource-preflight',['docker','info','--format','{{json .}}']);daemon=strict(raw)
 assert daemon['OSType']=='linux'and type(daemon['MemTotal'])is int and daemon['MemTotal']>=2147483648+134217728
 _,idle,_=run('running-preflight',['docker','ps','--quiet']);assert idle.strip()==b''
 _,raw,_=run('image-preflight',['docker','image','inspect',IMAGE]);image=strict(raw)[0];assert image['Id']==IMAGE and image['Os']=='linux'and image['Architecture']=='amd64'
 for volume in (V,D):
  _,raw,_=run('volume-'+volume,['docker','volume','inspect',volume]);o=strict(raw)[0];assert o['Name']==volume and o['Driver']=='local'and o['Scope']=='local'and not o['Options']
  if volume==V:assert o['Labels']['cortex.operation']==OP and o['Labels']['cortex.goal']=='convex-backend-runtime-2026-10-02'
  else:assert o['CreatedAt']=='2026-10-06T04:10:52Z'and o['Labels']is None
 create_crypto();create_phase('deploy');create_phase('driver');CREATED=True
 C.durable_json(LOG/'official-pre-provision-preparation.json',{'operation':OP,'volume':V,'freezeSha256':FREEZE,'status':'PREPARED_NOT_STARTED','sourceReleased':True,'recipes':recipes,'privateReads':0,'targetProvisioned':False})

def bind_crypto_gate(v,approval,manifest_sha,observer_sha):
 assert type(v)is dict and v['verdict']=='PASS'and v['independent']is True
 assert v['scope']=='ACTUAL_PRIVATE_CUSTODY_CRYPTO_ENV_TARGET_ONLY'
 assert v['operation']==OP and v['volume']==V and v['immutableImage']==IMAGE and v['candidateSha256']==FREEZE
 assert v['sourceManifestSha256']==manifest_sha and v['privateSourceApprovalSha256']==approval
 assert v['actualObserverSha256']==observer_sha
 assert v['actualPrivateCustodyCryptoEnvTargetAccepted']is True
 assert type(v['maximumPaidCalls'])is int and v['maximumPaidCalls']==0 and v['productionSharedOrLocalTarget']is False
 for f in ('nativeSourceOriginalNineFullEOFHashSize','destinationOriginalNineFullEOFHashSize','hostOriginalStageOriginalNineFullEOFHashSize','rsa2048','privateKeyMatchesFrozenSingleJWK','RS256SignVerify','changedMessageNegativeControl','environmentMatchesOwnedDevTarget','requestAndProvisionOwnership','freshIsolatedCloudDevelopmentTarget','originalSourceClosureAllNineFullEOFHashSize'):assert v[f]=='PASS'

def wait_crypto_gate(end,observer_sha):
 # Digest is parent-published DATA after the independent actual verdict, never live source editing.
 gate_deadline=end-OFFICIAL_RESERVE
 while time.monotonic()<gate_deadline:
  if GATE.exists():
   g=MODULE_LOADER('current_crypto_release_read',P/'source-gates.py')
   value=strict(g.read(GATE));assert set(value)=={'operation','volume','candidateSha256','decisionPath','decisionSha256','sourceManifestSha256','sourceApprovalSha256','actualObserverSha256'}
   assert value['operation']==OP and value['volume']==V and value['candidateSha256']==FREEZE and value['actualObserverSha256']==observer_sha
   manifest_sha=hashlib.sha256(SOURCE_MANIFEST.read_bytes()).hexdigest();approval_sha=hashlib.sha256(APPROVAL.read_bytes()).hexdigest()
   assert value['sourceManifestSha256']==manifest_sha and value['sourceApprovalSha256']==approval_sha
   path=Path(value['decisionPath']);assert path.is_absolute()and path.is_relative_to(P)and path.resolve()==path
   raw=g.read(path);assert hashlib.sha256(raw).hexdigest()==value['decisionSha256']
   bind_crypto_gate(strict(raw),approval_sha,manifest_sha,observer_sha);source_gate()
   current=strict(g.read(P/'runtime/coordinator-status.json'))
   assert current['phase']=='ACTUAL_PRIVATE_TRANSFER_AWAITING_INDEPENDENT_REVIEW'and current['status']=='HELD'
   assert current['operation']==OP and current['volume']==V and current['candidateSha256']==FREEZE
   assert current['cliDispatched']is False and current['nativeFoundationAccepted']is False
   assert end-time.monotonic()>=OFFICIAL_RESERVE,'complete_official_windows_not_admitted'
   return value
  time.sleep(0.25)
 raise TimeoutError('independent_crypto_gate_not_admitted_with_complete_original_windows')

def phase(key):
 spec=recipes[key];name=spec['name'];cid=spec['containerId'];cmd=spec['cmd'];mounts=spec['requestedMounts'];mapping=spec['selectedLiteralMapping']
 # Full worst-case future native, cleanup and terminal windows are admitted before the first deployment.
 required=2020 if key=='deploy'else 1710
 assert DEADLINE-time.monotonic()>=required,'complete_phase_and_cleanup_windows_not_admitted'
 current=inspect(cid,key+'-pre-start');recipe(current,name,cmd,mounts,mapping)
 assert current['State']['Running']is False and current['State']['Status']=='created'and current['State']['Pid']==0
 phase_start=time.monotonic();phase_end=min(DEADLINE,phase_start+(190 if key=='deploy'else 1260))
 if key=='deploy':
  command,out,err=run(key+'-run',['docker','start','--attach',cid],190,required=False)
 else:
  run(key+'-start',['docker','start',cid]);polls=0
  while True:
   # A late terminal poll is FAIL as well as a late Running poll.
   assert time.monotonic()+30<=phase_end,'full_terminal_poll_window_not_admitted'
   current=inspect(cid,key+'-poll-'+str(polls));owner(current,name);polls+=1
   assert time.monotonic()<=phase_end,'original_driver_whole_phase_1260_deadline'
   if current['State']['Running']is False:break
   time.sleep(min(0.5,max(0,phase_end-time.monotonic())))
  assert time.monotonic()+60<=phase_end,'complete_logs_and_terminal_window_not_admitted'
  command,out,err=run(key+'-logs',['docker','logs',cid],30,required=False)
 terminal=inspect(cid,key+'-terminal');recipe(terminal,name,cmd,mounts,mapping)
 assert time.monotonic()<=phase_end,'whole_phase_terminal_verification_deadline'
 assert terminal['State']['Running']is False and terminal['State']['Status']=='exited'and type(terminal['State']['Pid'])is int and terminal['State']['Pid']==0 and terminal['State']['Error']==''
 assert type(terminal['State']['ExitCode'])is int and terminal['State']['ExitCode']==0 and command['exitCode']==0 and err==b''
 outcome=strict(out);assert outcome['status']=='PASS'
 if key=='deploy':assert set(outcome)=={'phase','status'}and outcome['phase']=='deploy'
 else:assert outcome['cleanupComplete']is True
 run(key+'-remove',['docker','rm',cid]);absence(cid,key+'-removed-absence');del owned[name]
 return outcome

def cleanup():
 errors=[]
 for name,cid in list(owned.items()):
  try:
   o=inspect(cid,name+'-cleanup-before');owner(o,name)
   if o['State']['Running']:run(name+'-cleanup-kill',['docker','kill',cid])
   o=inspect(cid,name+'-cleanup-terminal');owner(o,name)
   assert o['State']['Running']is False and type(o['State']['Pid'])is int and o['State']['Pid']==0
   run(name+'-cleanup-remove',['docker','rm',cid]);absence(cid,name+'-cleanup-absence');del owned[name]
  except BaseException as e:errors.append({'name':name,'failureClass':type(e).__name__})
 return errors

def execute(end,observer_sha):
 global DEADLINE
 assert CREATED is True and C is not None and DEADLINE==end;outcomes={};failure=None
 try:
  release=wait_crypto_gate(end,observer_sha)
  _,idle,_=run('running-current-preflight',['docker','ps','--quiet']);assert idle.strip()==b''
  outcomes['deploy']=phase('deploy');outcomes['native']=phase('driver')
 except BaseException as e:failure=type(e).__name__
 finally:
  errors=cleanup()
  result={'scope':'OFFICIAL_CLI_AND_CURRENT_FOUNDATION_NATIVE_OUTCOME_ONLY','operation':OP,'volume':V,'candidateSha256':FREEZE,'status':'PASS'if failure is None and not errors and len(outcomes)==2 else'FAIL','outcomes':outcomes,'failureClass':failure,'cleanupErrors':errors,'ownedContainersRemaining':list(owned),'commands':rows,'recipes':recipes,'privateContentsPrinted':False,'physicalRetirement':'REQUIRED_COORDINATOR_UNCONDITIONAL_FINAL_FENCE','fullTask03':False,'goalAccepted':False}
  C.durable_json(LOG/'official-execution-terminal.json',result)
 return result
