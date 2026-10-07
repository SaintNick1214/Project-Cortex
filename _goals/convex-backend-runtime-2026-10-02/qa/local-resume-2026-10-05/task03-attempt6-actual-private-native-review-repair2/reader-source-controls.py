"""Finite SOURCE/MOCK controls, no private FS, Docker, service, CLI, or native effects."""
import base64,copy,datetime,hashlib,json,types,zlib
from pathlib import Path
A=Path(__file__).parent
raw=(A/'audit-reader.py').read_bytes();M=types.ModuleType('source_mock_reader');M.__file__=str(A/'audit-reader.py');exec(compile(raw,M.__file__,'exec',dont_inherit=True),M.__dict__)
expect=json.loads(M.EXPECTED_CASE_DATA.read_bytes());controls=[]
M.IMAGE_ENV=['PATH=/usr/local/bin:/usr/bin:/bin'];M.RELEASED={'currentTransportBindingOriginalNine':{k:'1'for k in M.FIELDS}}
M.OWN_BODIES={'independent-private-observer.mjs':b'// SOURCE/MOCK inline crypto', 'native-evidence-collector.mjs':b'// SOURCE/MOCK inline collector'}
def test(name,fn,deny=False):
 try:fn()
 except (AssertionError,KeyError,ValueError,TypeError):
  assert deny,name+':unexpected denial';controls.append({'name':name,'result':'DENIED','scope':'SOURCE/MOCK'});return
 assert not deny,name+':unexpected acceptance';controls.append({'name':name,'result':'PASS','scope':'SOURCE/MOCK'})
def mutate(v,path,value):
 n=copy.deepcopy(v);cur=n
 for p in path[:-1]:cur=cur[p]
 cur[path[-1]]=value;return n

# Complete native evidence fixture is manufactured ONLY inside this source control.
t0=datetime.datetime(2050,1,1,tzinfo=datetime.timezone.utc);end=t0+datetime.timedelta(seconds=2400);observed=t0.isoformat();journal=[]
def row(id,paths,phase,**kw):return {'observedAt':observed,'id':id,'paths':paths,'phase':phase,'status':'PASS','noEffect':True,**kw}
for id,paths in expect['negative'].items():journal.append(row(id,paths,'authorization',identityAlias=id.split(':')[1],expectedCode='FORBIDDEN_OR_UNAUTHENTICATED',observedCode='FORBIDDEN',noEffect=False))
for name,phase,code in [('negativeSnapshots','authorization-effect-snapshot','NO_EFFECT'),('visibility','internal-visibility','INTERNAL_ONLY'),('closure','uniform-unavailability','CAPABILITY_UNAVAILABLE'),('functional','functional-family','ASSERTED_OWNED_OUTCOME'),('policy','current-policy-safe-control','FORBIDDEN'),('authority','authority-boundaries',None),('lifecycle','lifecycle',None)]:
 for id,paths in expect[name].items():journal.append(row(id,paths,phase,**({'observedCode':code}if code else{})))
journal.extend([row('policy-delta:current-authority-controls',['runtimeAuth:recheck'],'current-policy-authority'),row('policy-delta:revoked-current-grant',['runtimeModelPolicy:ensureBudget'],'current-policy-revocation',observedCode='FORBIDDEN')])
for _ in range(2):journal.append(row('current-policy-delta:rpc',['runtimeAuth:recheck'],'rpc-observation',status='OBSERVED',expectedCode='ASSERTED_BY_ENCLOSING_CASE',observedCode='SUCCESS'))
for path in ('runtimeMemory:remember','runtimeMemory:recall'):
 for _ in range(5):journal.append(row('mwd-domain-policy-intermediate:rpc',[path],'rpc-observation',status='OBSERVED',expectedCode='ASSERTED_BY_ENCLOSING_CASE',observedCode='CAPABILITY_UNAVAILABLE'))
journal.append(row('qualification-final',[],'terminal',cleanupComplete=True))
outcomes=[{**r,'noEffect':True}if r['phase']=='authorization'else copy.deepcopy(r)for r in journal]
counts={'discovered':275,'public':200,'internal':75,'deltaVisibilityCases':32,'deltaNativeControls':16,'deltaHealthyAuthorityControls':2,'deltaRevokedNoEffectControls':1,'negativeCases':1400,'visibilityCases':150,'closureCases':262,'domainClosureCases':10,'functionalCases':130,'blocked':0,'failed':0,'skipped':0,'observedPublicPaths':200,'observedInternalPaths':75}
run='foundation-'+'0'*32;gen={n:b'public SOURCE/MOCK generated fixture'for n in ('api.d.ts','api.js','dataModel.d.ts','server.d.ts','server.js')}
files={
 'deploy':{'phase':'deploy','status':'PASS','exitCode':0,'failureClass':'none','elapsedMs':1,'startedAt':observed,'observedAt':observed,'counts':{'ownedGroupsRemaining':0,'verifiedTerminalGroups':1}},
 'driver':{'phase':'owned-current-foundation-driver','status':'PASS','exitCode':0,'failureClass':'none','elapsedMs':1,'startedAt':observed,'observedAt':observed,'cleanupComplete':True,'counts':{'cleanupRecoveryVerified':0,'childExitCodeNonnegative':0,'processesSpawned':1,'verifiedTerminalGroups':1,'remainingOwnedGroups':0}},
 'qualify':{'phase':'current-foundation-native-live','status':'PASS','elapsedMs':1,'cleanupComplete':True,'counts':counts},
 'codegen':{'operation':M.OP,'officialCodegen':True,'typecheck':'enable','status':'PASS','files':[{'path':'fixture/convex/_generated/'+n,'sha256':M.sha(b)}for n,b in gen.items()]},
 'caseJournal':journal,'caseOutcomes':{'scope':'CURRENT_NATIVE_LIVE','status':'PASS','evidence':outcomes},
 'owned':{'run':run,'refs':[],'files':[]},'ownedJournal':[{'run':run,'stage':'BEGIN'}],
 'pathLedger':{'counts':{'registered':275,'public':200,'internal':75},'cases':expect['ledgerCases']},
 'lifecycleCoverage':{'requiredFoundationCases':[{'id':id}for id in expect['lifecycle']]},
}
def evidence(value):
 rows=[]
 for kind,v in value.items():
  body=(b'\n'.join(json.dumps(x).encode()for x in v)+b'\n')if kind.endswith('Journal')else json.dumps(v).encode()
  rows.append({'kind':kind,'path':'/owned/private/SOURCE-MOCK-'+kind,'originalNine':{k:'1'for k in M.FIELDS},'sha256':M.sha(body),'bytes':len(body),'fullEOF':True,'bodyBase64':base64.b64encode(body).decode()})
 for n,b in gen.items():rows.append({'kind':'generated','path':'/prep/managed-fixture/fixture/convex/_generated/'+n,'originalNine':{k:'1'for k in M.FIELDS},'sha256':M.sha(b),'bytes':len(b),'fullEOF':True,'bodyBase64':base64.b64encode(b).decode()})
 return {'scope':'ACTUAL_CURRENT_NATIVE_READONLY_EVIDENCE_COLLECTION_ONLY','status':'PASS','operation':M.OP,'currentDescriptorsHeldThroughFinal':True,'secretFilesRead':0,'serviceCalls':0,'volumeWrites':0,'rows':rows}
v=evidence(files);test('complete_source_mock_native_contract',lambda:M.validate_native(v,expect,end,t0))
for name,path,value in [
 ('negative_missing',['caseJournal',0,'id'],'wrong'),('wrong_negative_code',['caseJournal',0,'observedCode'],'CAPABILITY_UNAVAILABLE'),('count_bool',['qualify','counts','deltaRevokedNoEffectControls'],True),
 ('functional_missing',['caseOutcomes','evidence',0,'status'],'FAIL'),('driver_recovery_cannot_make_success',['driver','counts','cleanupRecoveryVerified'],1),('driver_group_remaining',['driver','counts','remainingOwnedGroups'],1),
 ('official_codegen_false',['codegen','officialCodegen'],False),('codegen_hash_mismatch',['codegen','files',0,'sha256'],'0'*64),('qualification_cleanup_false',['qualify','cleanupComplete'],False),
 ('qualification_over_driver_ceiling',['qualify','elapsedMs'],1260001),('deployment_over_phase_ceiling',['deploy','elapsedMs'],190001),('native_late_terminal_stamp',['driver','observedAt'],end.isoformat()),
 ('original_wrong_public_ledger',['pathLedger','counts','public'],199),('storage_over_ceiling',['owned','files'],[{}, {}, {}]),('rows_over_ceiling',['owned','refs'],[{'table':'memories'}]*321),
 ('source_scope_claim',['caseOutcomes','scope'],'MOCK_CURRENT_NATIVE_LIVE')]:
 test(name,lambda p=path,x=value:M.validate_native(evidence(mutate(files,p,x)),expect,end,t0),True)
for name,phase,key,value in [('no_effect_snapshot_false','authorization-effect-snapshot','noEffect',False),('internal_wrong_code','internal-visibility','observedCode','FORBIDDEN'),('safe_closure_wrong_code','uniform-unavailability','observedCode','SUCCESS'),('functional_not_asserted','functional-family','observedCode','CAPABILITY_UNAVAILABLE'),('policy_wrong_code','current-policy-safe-control','observedCode','SUCCESS'),('lifecycle_skip','lifecycle','status','SKIPPED'),('authority_fail','authority-boundaries','status','FAIL'),('healthy_not_success','rpc-observation','observedCode','FORBIDDEN')]:
 i=next(i for i,r in enumerate(files['caseJournal'])if r['phase']==phase);test(name,lambda i=i,k=key,x=value:M.validate_native(evidence(mutate(files,['caseJournal',i,k],x)),expect,end,t0),True)
bad=copy.deepcopy(files);bad['caseJournal'].pop(-1);test('terminal_missing',lambda:M.validate_native(evidence(bad),expect,end,t0),True)
test('duplicate_json_denied',lambda:M.strict(b'{"a":1,"a":2}'),True);test('nonfinite_json_denied',lambda:M.strict(b'{"a":NaN}'),True)
body=json.dumps({'finite':'SOURCE/MOCK'}).encode();zipper=zlib.compressobj(wbits=16+zlib.MAX_WBITS);zipped=zipper.compress(body)+zipper.flush();envelope={'encoding':'gzip+base64','decodedBytes':len(body),'decodedSha256':M.sha(body),'body':base64.b64encode(zipped).decode()}
test('bounded_envelope_positive',lambda:M.compressed(json.dumps(envelope).encode()))
for k,x in [('decodedBytes',True),('decodedBytes',25165825),('decodedSha256','0'*64),('encoding','raw'),('body',base64.b64encode(zipped+b'trailing').decode())]:test('envelope_'+k+'_'+str(x)[:18],lambda k=k,x=x:M.compressed(json.dumps({**envelope,k:x}).encode()),True)

spec=M.prepare_specs()['crypto'];cid='a'*64
o={'Name':'/'+spec['name'],'Id':cid,'Image':M.IMAGE,'Platform':'linux','Config':{'Labels':M.LABELS,'Image':M.IMAGE,'Env':M.IMAGE_ENV,'User':'501:20','WorkingDir':'/tmp','Entrypoint':None,'Cmd':spec['cmd'],'Tty':False,'OpenStdin':False,'StdinOnce':False},'State':{'Running':False,'Pid':0,'OOMKilled':False,'ExitCode':0,'Error':'','Status':'created'},'HostConfig':{'NetworkMode':'none','Binds':None,'PortBindings':{},'VolumesFrom':None,'CapAdd':None,'CapDrop':None,'Devices':[],'SecurityOpt':None,'Memory':536870912,'MemorySwap':536870912,'PidsLimit':64,'NanoCpus':2000000000,'ReadonlyRootfs':True,'Privileged':False,'AutoRemove':False,'PublishAllPorts':False,'Tmpfs':{'/tmp':'rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20'},'Mounts':spec['mounts']},'Mounts':[{'Destination':m['Target'],'Type':m['Type'],'Source':m['Source']if m['Type']=='bind'else'/var/lib/docker/volumes/'+m['Source']+'/_data','RW':False,**({}if m['Type']=='bind'else{'Name':m['Source'],'Driver':'local'})}for m in spec['mounts']]}
test('exact_readonly_owned_recipe_positive',lambda:M.exact_recipe(o,spec,cid))
for path,x in [(('Platform',),'darwin'),(('Id',),'b'*64),(('Config','Cmd'),['unsafe']),(('Config','Entrypoint'),[]),(('Config','User'),'0:0'),(('Config','OpenStdin'),0),(('Config','Labels'),{}),(('HostConfig','NetworkMode'),'bridge'),(('HostConfig','Memory'),True),(('HostConfig','Privileged'),True),(('HostConfig','ReadonlyRootfs'),1),(('HostConfig','Devices'),[{}]),(('HostConfig','SecurityOpt'),['seccomp=unconfined']),(('HostConfig','Mounts',1,'ReadOnly'),1),(('HostConfig','Mounts',1,'VolumeOptions','NoCopy'),1),(('HostConfig','Mounts',2,'VolumeOptions','Subpath'),'private'),(('Mounts',0,'RW'),0),(('Mounts',1,'Driver'),'other'),(('Mounts',1,'Source'),'/unsafe'),(('State','Running'),True),(('State','ExitCode'),True),(('State','OOMKilled'),True)]:test('recipe_'+'_'.join(map(str,path)),lambda p=path,x=x:M.exact_recipe(mutate(o,p,x),spec,cid),True)

class FakeTime:
 def __init__(self,values):self.values=iter(values)
 def monotonic(self):return next(self.values)
class FakeC:
 def __init__(self):self.calls=0
 def run(self,*args,**kw):
  self.calls+=1;return {'terminal':True,'failureClass':None,'closeErrors':[],'ownedGroup':{'absenceObserved':True},'exitCode':0},b'',b''
real_time=M.time
def command_clock(times,end,deny):
 C=FakeC();M.time=FakeTime(times)
 try:runner=M.Runner(C,A,end);runner.run('finite-source-mock',['NO_EFFECT'],30)
 finally:M.time=real_time
 return C.calls
test('original_window_command_admitted',lambda:command_clock([0,29,29],30,False))
test('whole_window_insufficient_before_effect',lambda:command_clock([1],30,True),True)
test('late_terminal_denied_even_exit0',lambda:command_clock([0,31],100,True),True)
test('late_original_whole_window_denied',lambda:command_clock([0,29,101],100,True),True)

# New operative binding, old rejected binding remains immutable by reference only.
request_raw=(M.Q/'project-request.json').read_bytes();binding_raw=M.CURRENT_BINDING_PATH.read_bytes()
bodies={str((M.Q/'project-request.json').relative_to(M.R)):request_raw,str(M.CURRENT_BINDING_PATH.relative_to(M.R)):binding_raw}
test('new_canonical_six_binding_positive',lambda:M.source_binding_consistency(bodies))
old=(M.Q/'transport-prep/transport-binding.json').read_bytes();test('old_binding_denied_before_private',lambda:M.source_binding_consistency({**bodies,str(M.CURRENT_BINDING_PATH.relative_to(M.R)):old}),True)
for key in M.SIX:
 changed=json.loads(binding_raw);changed[key]=True if key=='teamId'else'wrong'
 test('new_binding_changed_'+key,lambda changed=changed:M.source_binding_consistency({**bodies,str(M.CURRENT_BINDING_PATH.relative_to(M.R)):json.dumps(changed).encode()}),True)
test('image_default_env_changed_denied',lambda:M.exact_recipe(mutate(o,['Config','Env'],['NODE_OPTIONS=--unsafe']),spec,cid),True)
test('separate_binding_mount_changed_denied',lambda:M.exact_recipe(mutate(o,['HostConfig','Mounts',3,'Target'],'/prep/transport-prep/transport-binding.json'),spec,cid),True)
test('clearenv_inline_source_first_use',lambda:(_ for _ in()).throw(AssertionError())if '--input-type=module'not in spec['cmd']or spec['cmd'][:2]!=['/usr/bin/env','-i']else None)
# Unknown cleanup cannot authorize a removal, even with a remembered label/name.
class UnknownRecipeRunner(M.Runner):
 def inspect(self,*a):raise AssertionError('recipe_unknown')
 def run(self,*a,**kw):raise AssertionError('blind_removal_forbidden')
def cleanup_unknown():
 r=UnknownRecipeRunner(FakeC(),A,100);r.owned={'crypto':{**spec,'containerId':cid,'mapping':''}};r.cleanup();assert len(r.cleanup_errors)==1 and r.owned
 test_result=r.cleanup_errors[0];assert test_result
 return True
test('unknown_recipe_cleanup_sticky_no_blind_remove',cleanup_unknown)
def source_budget_positive():
 c=M.Cohort();c.reserve_source(16777216);c.reserve_source(16777216);c.reserve_source(16777216);c.reserve_source(14680064);c.reserve_source(2097152,True);assert c.source_bytes+2097152==67108864
 return True
def source_budget_over():
 c=M.Cohort()
 for size in (16777216,16777216,16777216,14680064):c.reserve_source(size)
 c.reserve_source(1)
def source_fd_over():
 c=M.Cohort()
 for _ in range(4097):c.reserve_source(0)
def data_budget_over():
 c=M.Cohort();c.reserve_source(1048576,True);c.reserve_source(1048577,True)
test('one_nonresetting_source_budget_positive',source_budget_positive)
test('aggregate_source_plus_data_one_byte_excess_denied',source_budget_over,True)
test('aggregate_source_fd_4097_denied',source_fd_over,True)
test('single_data_reservation_no_subgraph_reset',data_budget_over,True)
test('per_source_file_limit_not_exempt_metadata',lambda:M.Cohort().reserve_source(16777217),True)
test('private_stat_before_public_source_gate_denied',lambda:M.Cohort().open(M.S/'SOURCE-MOCK-NOT-TO-BE-ACCESSED',65536,True),True)
result={'scope':'FINITE_READER_SOURCE_MOCK_CONTROLS_ONLY_NOT_ACTUAL_ACCEPTANCE','status':'PASS','controls':controls,'count':len(controls),'privateReads':0,'DockerCalls':0,'serviceCalls':0,'actualNativeOutcomes':0,'currentPrivatePipeline':'SOURCE_ONLY_WAITING_FRESH_ROOT_SOURCE_ACCEPTANCE_AND_ACTUAL_HANDOFF'}
with (A/'reader-source-control-results.json').open('x')as f:f.write(json.dumps(result,indent=2)+'\n');print(json.dumps({'scope':result['scope'],'count':len(controls),'status':'PASS','currentPrivatePipeline':result['currentPrivatePipeline']}))
