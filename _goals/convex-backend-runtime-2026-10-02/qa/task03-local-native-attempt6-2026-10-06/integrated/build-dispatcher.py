from pathlib import Path
import json,os
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');qa=R/'_goals/convex-backend-runtime-2026-10-02/qa';P=qa/'local-resume-2026-10-05/task03-attempt6-integrated-preparation';Q=qa/'task03-local-native-attempt6-2026-10-06';b=json.loads((P/'prospective-binding.json').read_text())
old=(P.parent/'task03-attempt5-repair3-private-release-source-baseline1/root-official-execution1.py').read_text()
# Preserve exact strict/ownership/recipe/cleanup functions, replacing only literal namespace bindings.
prefix=old[:old.index('def phase(')]
prefix=prefix.replace("P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'", "P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-preparation'")
prefix=prefix.replace("Q=P.parent/'task03-local-native-attempt5-2026-10-06'", "Q=P.parent.parent/'task03-local-native-attempt6-2026-10-06'")
prefix=prefix.replace('cortex-runtime-task03-attempt5-private-20261006','cortex-runtime-task03-attempt6-private-20261006').replace('ba2253a8-26a7-4db5-b503-9bca6710471c',b['operation']).replace('cortex-task03-attempt5-fixture-20261006-ba2253a8-r3',b['volume']).replace("COMMON=Q/'coordinate-source/repair3/task03-attempt5-coordinate-common.py'", "COMMON=Q/'integrated/coordinate-common.py'")
# Make import inert: all Docker effects are functions called only by the reviewed coordinator.
prefix=prefix.replace('LOG=S/\'coordination\'; rows=[]; owned={}; recipes={}', "LOG=S/'coordination'; rows=[]; owned={}; recipes={}; C=None; DEADLINE=None\nFREEZE="+repr(b['freezeSha256'])+"\nAPPROVAL=P/'integrated-source-review.json'\nSOURCE_MANIFEST=P/'operative-source-manifest.json'\nGATE=P/'actual-private-crypto-execution-release.json'\nOFFICIAL_RESERVE=2050\nCREATED=False")
prefix=prefix.replace("row,_,_=C.run('official-'+label,args,LOG,timeout,os.environ,required=False);rows.append(row)","start=time.monotonic()\n if DEADLINE is not None:assert start+timeout<=DEADLINE,'entire_command_window_not_admitted'\n row,_,_=C.run('official-'+label,args,LOG,timeout,{**os.environ,'CORTEX_COORDINATOR_CWD':str(R)},required=False);rows.append(row)\n assert time.monotonic()<=start+timeout,'command_terminal_deadline'\n if DEADLINE is not None:assert time.monotonic()<=DEADLINE,'whole_pipeline_deadline'")
# Type-check all boolean fields before equality, including aliases absent from the old wrapper.
prefix=prefix.replace("assert h['NetworkMode']=='bridge'and h['ReadonlyRootfs']is True", "for f in ('ReadonlyRootfs','Privileged','AutoRemove','PublishAllPorts'):assert type(h[f])is bool\n assert h['NetworkMode']=='bridge'and h['ReadonlyRootfs']is True")
prefix=prefix.replace("if m['Type']=='volume':assert m['VolumeOptions']['NoCopy']is True", "if m['Type']=='volume':assert type(m['VolumeOptions']['NoCopy'])is bool and m['VolumeOptions']['NoCopy']is True")
body=r'''
def source_gate():
 from importlib.util import spec_from_file_location,module_from_spec
 spec=spec_from_file_location('attempt6_source_gate',Q/'integrated/source-gates.py');g=module_from_spec(spec);spec.loader.exec_module(g)
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
 create_phase('deploy');create_phase('driver');CREATED=True
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
   value=strict(GATE.read_bytes());assert set(value)=={'operation','volume','candidateSha256','decisionPath','decisionSha256','sourceManifestSha256','sourceApprovalSha256','actualObserverSha256'}
   assert value['operation']==OP and value['volume']==V and value['candidateSha256']==FREEZE and value['actualObserverSha256']==observer_sha
   manifest_sha=hashlib.sha256(SOURCE_MANIFEST.read_bytes()).hexdigest();approval_sha=hashlib.sha256(APPROVAL.read_bytes()).hexdigest()
   assert value['sourceManifestSha256']==manifest_sha and value['sourceApprovalSha256']==approval_sha
   path=Path(value['decisionPath']);assert path.is_absolute()and path.is_relative_to(R)and path.resolve()==path
   raw=path.read_bytes();assert hashlib.sha256(raw).hexdigest()==value['decisionSha256']
   bind_crypto_gate(strict(raw),approval_sha,manifest_sha,observer_sha);source_gate()
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
 assert CREATED is True and C is not None and DEADLINE is None
 DEADLINE=end;outcomes={};failure=None
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
'''
path=Q/'integrated/official-dispatcher.py';fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:f.write(prefix+body);f.flush();os.fsync(f.fileno())
