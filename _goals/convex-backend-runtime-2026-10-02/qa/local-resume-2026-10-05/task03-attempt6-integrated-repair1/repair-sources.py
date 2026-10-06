from pathlib import Path
import os,hashlib,json,stat
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=QA/'task03-local-native-attempt6-2026-10-06';OLD=QA/'local-resume-2026-10-05/task03-attempt6-integrated-preparation';P=OLD.parent/'task03-attempt6-integrated-repair1'
old_manifest=json.loads((OLD/'operative-source-manifest.json').read_bytes());old_rows={str(R/r['path']):r for r in old_manifest['files']};reads=[]
def read(path):
 before=os.lstat(path);assert path.resolve()==path and stat.S_ISREG(before.st_mode)and before.st_nlink==1 and before.st_uid==501 and before.st_gid==20
 fields=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');ident=lambda s:{f:str(getattr(s,'st_'+f))for f in fields}
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  pin=ident(before);assert pin==ident(os.fstat(fd));data=bytearray()
  while block:=os.read(fd,65536):data.extend(block);assert len(data)<=before.st_size<=16777216
  assert len(data)==before.st_size and pin==ident(os.fstat(fd))==ident(os.lstat(path))
  digest=hashlib.sha256(data).hexdigest();original=old_rows[str(path)];assert digest==original['sha256']and len(data)==original['bytes']
  reads.append({'path':str(path.relative_to(R)),'sha256':digest,'bytes':len(data),'newCurrentWithinReadNine':pin,'fullEOF':True,'historicalOriginalNineMatched':pin==original['PRE'],'historicalCustodyRepaired':False});return bytes(data).decode()
 finally:os.close(fd)
def write(name,data):
 fd=os.open(P/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
 with os.fdopen(fd,'w')as f:f.write(data);f.flush();os.fsync(f.fileno())
def save(name,value):write(name,json.dumps(value,indent=2)+'\n')
private=read(Q/'integrated/private-coordinate.py');dispatcher=read(Q/'integrated/official-dispatcher.py');reuse=read(Q/'integrated/reuse-private-key.py');public=read(Q/'coordinate-source/task03-attempt5-public-coordinate.py');helper=read(Q/'coordinate-source/task03-attempt5-linux-public-transfer.py');management=read(OLD/'target-management.mjs');gate=read(Q/'integrated/source-gates.py')
# One common bootstrap is embedded in the three reviewed entry sources. It
# executes only verified source bytes while retaining the original source fd.
loader='''def load_module(name, path):
    fields = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
    identify = lambda value: {key: str(getattr(value, 'st_'+key)) for key in fields}
    def held_read(source, pin=None):
        assert source.is_absolute() and source.is_relative_to(R) and source.resolve() == source
        before = os.lstat(source)
        assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_uid == 501 and before.st_gid == 20 and 0 <= before.st_size <= 16777216
        fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            current = identify(before)
            assert current == identify(os.fstat(fd))
            if pin is not None: assert current == pin
            data = bytearray()
            while chunk := os.read(fd, 65536):
                data.extend(chunk); assert len(data) <= before.st_size
            assert len(data) == before.st_size
            assert current == identify(os.fstat(fd)) == identify(os.lstat(source))
            return bytes(data)
        finally: os.close(fd)
    approval = strict_json(held_read(APPROVAL))
    assert approval['scope'] == 'TASK03_ATTEMPT6_INTEGRATED_REPAIR1_SOURCE_ONLY' and approval['verdict'] == 'PASS' and approval['independent'] is True
    mfraw = held_read(P/'prospective-source-manifest.json', approval['sourceManifestOriginalNine'])
    assert hashlib.sha256(mfraw).hexdigest() == approval['sourceManifestSha256']
    manifest = strict_json(mfraw)
    assert manifest['scope'] == 'TASK03_ATTEMPT6_REPAIR1_NEW_PROSPECTIVE_SOURCE_CLOSURE_ONLY' and manifest['sourceWriters'] == 'STOPPED'
    assert manifest['historicalD101OriginalCustody'] == 'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED'
    assert len(manifest['files']) == len({row['path'] for row in manifest['files']})
    assert set(approval['sources']) == {row['path'] for row in manifest['files']}
    plan_path = P/'prospective-source-plan.json';stop_path=P/'source-writers-stopped.json'
    by_path={row['path']:row for row in manifest['files']}
    planraw=held_read(plan_path,by_path[str(plan_path.relative_to(R))]['PRE'])
    assert hashlib.sha256(planraw).hexdigest()==manifest['sourcePlanSha256']==approval['sourcePlanSha256']
    plan=strict_json(planraw)
    expected={row['path']for row in plan['members']}|{str(plan_path.relative_to(R)),str(stop_path.relative_to(R))}
    assert set(by_path)==expected and len(plan['members'])==len({row['path']for row in plan['members']})
    stopraw=held_read(stop_path,by_path[str(stop_path.relative_to(R))]['PRE']);stop=strict_json(stopraw)
    assert hashlib.sha256(stopraw).hexdigest()==manifest['sourceWritersStoppedSha256']
    assert stop['sourceWriters']=='STOPPED' and stop['remainingSourceWrites']==[]
    assert all(int(row['PRE']['ctime_ns'])<=int(stop['stoppedUnixNs']) for row in manifest['files'] if row['path']!=str(stop_path.relative_to(R)))
    freeze_rows=[item for item in manifest['files'] if item['path']==str((Q/'candidate-freeze-attempt6.json').relative_to(R))]
    assert len(freeze_rows)==1 and approval['candidateSha256']==freeze_rows[0]['sha256']==FREEZE
    row=by_path[str(path.relative_to(R))]
    before=os.lstat(path);fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        assert identify(before)==identify(os.fstat(fd))==row['PRE']
        assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_uid==501 and before.st_gid==20
        raw=bytearray()
        while block:=os.read(fd,65536):raw.extend(block);assert len(raw)<=row['bytes']<=16777216
        assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']==approval['sources'][row['path']]
        assert identify(os.fstat(fd))==identify(os.lstat(path))==row['PRE']
        module=types.ModuleType(name);module.__file__=str(path);module.__package__=''
        exec(compile(raw,str(path),'exec',dont_inherit=True),module.__dict__)
        assert identify(os.fstat(fd))==identify(os.lstat(path))==row['PRE']
        return module
    finally:os.close(fd)
'''
# Private entry: new consumers/outputs; immutable original A/T loaded by held adapter.
private=private.replace("task03-attempt6-integrated-preparation'","task03-attempt6-integrated-repair1'")
private=private.replace("COMMON = Q / 'integrated/coordinate-common.py'","COMMON = Q / 'integrated/coordinate-common.py'")
private=private.replace("Q/'integrated/source-gates.py'","P/'source-gates.py'").replace("Q/'integrated/official-dispatcher.py'","P/'official-dispatcher.py'")
start=private.index('def load_module(');end=private.index('\n\ndef preflight()',start);private=private[:start]+loader+private[end:]
private=private.replace("    A = load_module('prospective_native_source_acquisition', Q/'attempt5/source-acquisition.py')\n    T = A.T", "    G = load_module('repair1_source_gate', P/'source-gates.py')\n    H = load_module('repair1_held_acquisition', P/'held-acquisition.py')\n    a_pin, _ = G.reviewed_source(Q/'attempt5/source-acquisition.py')\n    t_pin, _ = G.reviewed_source(Q/'transport-prep/private-transport.py')\n    A = H.load_acquisition(Q/'attempt5/source-acquisition.py', Q/'transport-prep/private-transport.py', a_pin, t_pin, R)\n    T = A.T")
# Exact command ownership is registered before docker create, never learned from inspect.
private=private.replace('OWNED_IDS = {}','OWNED_IDS = {}\nOWNED_COMMANDS = {}')
start=private.index('def assert_recipe(');end=private.index('\n\ndef docker_create(',start)
private=private[:start]+'''def assert_recipe(obj, name, selector=False, *, initial=True, stopped=True):
    inspect_owned(obj, name)
    assert selector is (name == SELECTOR_NAME)
    assert obj['Platform'] == 'linux'
    assert obj['Config']['User'] == '501:20' and obj['Config']['WorkingDir'] == '/tmp'
    assert obj['Config']['Entrypoint'] is None
    assert type(obj['Config']['Cmd']) is list and obj['Config']['Cmd'] == OWNED_COMMANDS[name]
    assert all(type(value) is str for value in obj['Config']['Cmd'])
    for field, value in [('Tty',False),('OpenStdin',True),('StdinOnce',False)]:
        assert type(obj['Config'][field]) is bool and obj['Config'][field] is value
    assert type(obj['State']['OOMKilled']) is bool and obj['State']['OOMKilled'] is False
    assert type(obj['State']['ExitCode']) is int and type(obj['State']['Error']) is str
    if stopped: assert obj['State']['Running'] is False and obj['State']['Pid'] == 0
    if initial: assert obj['State']['Status'] == 'created' and obj['State']['ExitCode'] == 0 and obj['State']['Error'] == ''
    host = obj['HostConfig']
    assert host['NetworkMode'] == 'none'
    for field,value in [('ReadonlyRootfs',True),('Privileged',False),('AutoRemove',False),('PublishAllPorts',False)]:
        assert type(host[field]) is bool and host[field] is value
    for field,value in [('Memory',536870912),('MemorySwap',536870912),('PidsLimit',64),('NanoCpus',2000000000)]:
        assert type(host[field]) is int and host[field] == value
    assert host['Binds'] is None and host['PortBindings'] == {}
    assert host['CapAdd'] in (None,[]) and host['Devices'] == [] and host['SecurityOpt'] is None
    assert host['Tmpfs'] == {'/tmp':'rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20'}
    expected=[{'Type':'volume','Source':VOLUME,'Target':'/owned','VolumeOptions':{'NoCopy':True}}]
    if not selector: expected.append({'Type':'volume','Source':VOLUME,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}})
    assert type(host['Mounts']) is list and len(host['Mounts']) == len(expected)
    for mount in host['Mounts']:
        assert type(mount['VolumeOptions']['NoCopy']) is bool and mount['VolumeOptions']['NoCopy'] is True
        if 'ReadOnly' in mount: assert type(mount['ReadOnly']) is bool
    assert host['Mounts'] == expected
    mounts=obj['Mounts'];assert type(mounts) is list and len(mounts) == len(expected)
    by_target={mount['Destination']:mount for mount in mounts};assert len(by_target)==len(mounts)
    assert set(by_target)==set(mount['Target']for mount in expected)
    for mount in expected:
        actual=by_target[mount['Target']]
        assert actual['Type']=='volume' and actual['Name']==VOLUME and actual['Driver']=='local'
        assert actual['Source']=='/var/lib/docker/volumes/'+VOLUME+'/_data'
        assert type(actual['RW']) is bool and actual['RW'] is (not mount.get('ReadOnly',False))


def receiver_command():
    G=load_module('receiver_current_source_gate',P/'source-gates.py')
    released=G.qualify_public_release()
    _,body=G.reviewed_source(P/'held-acquisition.py')
    bound={}
    for name in ('attempt5/source-acquisition.py','transport-prep/private-transport.py'):
        row,_=G.reviewed_source(Q/name);bound[name]={'sha256':row['sha256'],'bytes':row['bytes']}
    argv=['/prep/attempt5/source-acquisition.py','receive-copy','/owned/native','source-'+OP,'/owned/private','/prep/transport-prep/transport-binding.json','/owned/receipts']
    config={'operation':OP,'candidateSha256':FREEZE,'publicTransferReceiptSha256':released['publicTransferReceiptSha256'],'sources':bound,'argv':argv}
    code="exec(compile("+repr(body.decode('utf8'))+",'reviewed-held-acquisition.py','exec',dont_inherit=True));native_main("+repr(config)+")"
    return ['/usr/local/bin/python3.12','-B','-c',code]
''' + private[end:]
private=private.replace("def docker_create(name, command, selector=False):\n    argv", "def docker_create(name, command, selector=False):\n    assert name in OWNED_NAMES and name not in OWNED_COMMANDS\n    assert type(command) is list and all(type(value) is str for value in command)\n    OWNED_COMMANDS[name] = list(command)\n    argv")
private=private.replace("'--user', '501:20', '--name', name", "'--user', '501:20', '--workdir', '/tmp', '--tmpfs', '/tmp:rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20', '--name', name")
private=private.replace("    inspect_owned(obj, name)\n    if obj['State']['Running']:", "    assert_recipe(obj, name, selector=name==SELECTOR_NAME, initial=False, stopped=False)\n    if obj['State']['Running']:")
private=private.replace("    inspect_owned(terminal, name)\n    assert terminal['State']['Running'] is False", "    assert_recipe(terminal, name, selector=name==SELECTOR_NAME, initial=False)\n    assert terminal['State']['Running'] is False")
private=private.replace("    argv = docker_create(SELECTOR_NAME, ['/usr/local/bin/python3.12', '-B', '-c', SELECTOR.read_text()], selector=True)", "    G=load_module('selector_current_source_gate',P/'source-gates.py')\n    _,selector_source=G.reviewed_source(SELECTOR)\n    argv = docker_create(SELECTOR_NAME, ['/usr/local/bin/python3.12', '-B', '-c', selector_source.decode('utf8')], selector=True)")
private=private.replace("        command = ['/usr/local/bin/python3.12', '-B', '/prep/attempt5/source-acquisition.py', 'receive-copy',\n                   '/owned/native', 'source-'+OP, '/owned/private', '/prep/transport-prep/transport-binding.json', '/owned/receipts']", "        command = receiver_command()")
private=private.replace("        receiver_attempted = True\n        _, paths = run('private-receiver'", "        _, paths = run('private-receiver-current-inspect', ['docker','inspect',NAME],30)\n        assert_recipe(strict_json(paths['stdout'].read_bytes())[0],NAME)\n        G.qualify_sources()\n        receiver_attempted = True\n        _, paths = run('private-receiver'")
private=private.replace("        inspect_owned(terminal, NAME)","        assert_recipe(terminal, NAME, initial=False)")
private=private.replace("        inspect_owned(obj, SELECTOR_NAME)","        assert_recipe(obj, SELECTOR_NAME, selector=True, initial=False)")
private=private.replace("                value = strict_json(end.read_bytes())\n                assert value", "                value = strict_json(end.read_bytes())\n                assert time.monotonic() < deadline, 'finish_read_completed_after_original_deadline'\n                assert value")
private=private.replace("                completed = True; break", "                assert time.monotonic() < deadline, 'finish_validation_completed_after_original_deadline'\n                completed = True; break")
# Dispatcher retains all original phases/assertions; only consumers move.
dispatcher=dispatcher.replace("task03-attempt6-integrated-preparation'","task03-attempt6-integrated-repair1'")
dispatcher=dispatcher.replace("SOURCE_MANIFEST=P/'operative-source-manifest.json'","SOURCE_MANIFEST=P/'prospective-source-manifest.json'")
dispatcher=dispatcher.replace("Q/'integrated/source-gates.py'","P/'source-gates.py'")
# Reuse entry has identical private mechanism, gated to the new prospective source consumer.
reuse=reuse.replace("task03-attempt6-integrated-preparation'","task03-attempt6-integrated-repair1'")
start=reuse.index('def load_module(');end=reuse.index('\ndef main():',start);reuse=reuse[:start]+loader+reuse[end:]
reuse=reuse.replace("path=QA/'task03-local-native-attempt6-2026-10-06/integrated/source-gates.py'","path=P/'source-gates.py'")
reuse=reuse.replace("KEY_SHA=", "Q=QA/'task03-local-native-attempt6-2026-10-06'\nFREEZE='115e417419ab7b55e9fdbad97e51513f9f24a8e523c7b344168a63c92d8e968c'\nKEY_SHA=")
# Management: identical guard logic, independent preparation record in new namespace.
management=management.replace('preparationReviewed, scratch','canonical, sourcePreflight, scratch')
management=management.replace('  preparationReviewed();','  repairPreparationReviewed();')
needle="let calls = 0; const deadline = Date.now() + 180_000;"
mgate="""function repairPreparationReviewed() {
  sourcePreflight();
  const review=json(resolve(qa,'independent-preparation-review.json'));
  if(review.verdict!=='PASS'||review.independent!==true||review.scope!=='BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'
    ||review.candidateSha256!==hash(readFileSync(resolve(preparation,'candidate-freeze-attempt6.json')))) reject('Current independently reviewed preparation required');
  canonical(scratch,scratch);const stat=lstatSync(scratch);
  if(!stat.isDirectory()||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o700)reject('Original private directory guard rejected');
  canonical(resolve(scratch,'jwt-private.pem'),scratch,true);
}
"""
management=management.replace(needle,mgate+needle)
# Public transfer overlay avoids writing original Q6 local evidence.
helper=helper.replace("    path = SOURCE / p", "    path = Path('/helper') / p if name == 'independent-preparation-review.json' else SOURCE / p")
helper=helper.replace("    part = SOURCE", "    part = Path('/helper') if name == 'independent-preparation-review.json' else SOURCE")
# Public coordinator initial gate is full fresh source closure before any Docker operation.
public=public.replace("P = Q / 'coordinate-source'", "P = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-repair1'")
public=public.replace("OUT = P / 'task03-attempt5-public-acquisition'", "OUT = P / 'runtime-public-acquisition'")
public=public.replace("HELPER = P / 'task03-attempt5-linux-public-transfer.py'","HELPER = P / 'linux-public-transfer.py'")
public=public.replace("COMMON = P / 'task03-attempt5-coordinate-common.py'","COMMON = Q / 'integrated/coordinate-common.py'")
public=public.replace('task03-attempt6-integrated-preparation/task03-attempt6-management-review.json','task03-attempt6-integrated-repair1/task03-attempt6-management-review.json')
public=public.replace("records = []", "records = []\nAPPROVAL=P/'integrated-source-review.json'\ndef strict_json(raw):\n    def pairs(items):\n        value={}\n        for key,item in items:\n            if key in value: raise ValueError('duplicate_public_source_key')\n            value[key]=item\n        return value\n    return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda x: (_ for _ in ()).throw(ValueError('nonfinite_source')))\n"+loader)
start=public.index("    approval = json.loads((P / 'independent-public-coordinator-source-review.json').read_bytes())")
end=public.index("    OUT.mkdir(mode=0o700)",start)
public=public[:start]+"""    assert sys.dont_write_bytecode is True, 'launch_with_python_B_required'
    G=load_module('repair1_public_source_gate',P/'source-gates.py')
    approval,_,_=G.qualify_sources()
    prep=G.strict(G.read(P/'independent-preparation-review.json'))
    assert prep['verdict']=='PASS' and prep['independent'] is True and prep['scope']=='BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'
    assert prep['candidateSha256']==FREEZE and type(prep['candidateMembers']) is int and prep['candidateMembers']==1907
    management=G.strict(G.read(MANAGEMENT_REVIEW))
    assert management['verdict']=='PASS' and management['independent'] is True and management['scope']=='TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY'
    assert management['managementSourceSha256']==hashlib.sha256(G.read(P/'target-management.mjs')).hexdigest()
    assert management['requestSha256']==G.strict(G.read(P/'prospective-binding.json'))['requestSha256']
    C=load_module('repair1_public_common',COMMON)
"""+public[end:]
write('private-coordinate.py',private);write('official-dispatcher.py',dispatcher);write('reuse-private-key.py',reuse);write('public-coordinate.py',public);write('linux-public-transfer.py',helper);write('target-management.mjs',management)
# Adapt original source gate in a separately named prospective namespace.
gate=gate.replace("task03-attempt6-integrated-preparation'","task03-attempt6-integrated-repair1'")
start=gate.index('def expected_source_paths():');end=gate.index('\ndef qualify_sources():',start)
gate=gate[:start]+'''def expected_source_paths():
 plan=strict(read(P/'prospective-source-plan.json'))
 assert plan['scope']=='TASK03_ATTEMPT6_REPAIR1_FINITE_SOURCE_PLAN_ONLY'
 assert plan['historicalD101OriginalCustody']=='FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED'
 assert len(plan['members'])==len({row['path']for row in plan['members']})
 paths={R/row['path']for row in plan['members']}|{P/'prospective-source-plan.json',P/'source-writers-stopped.json'}
 assert all(path.is_absolute()and path.is_relative_to(R)and path.resolve()==path for path in paths)
 return sorted(paths)
def reviewed_source(path):
 mf=strict(read(P/'prospective-source-manifest.json'));approval=strict(read(P/'integrated-source-review.json'))
 assert approval['scope']=='TASK03_ATTEMPT6_INTEGRATED_REPAIR1_SOURCE_ONLY'and approval['verdict']=='PASS'and approval['independent']is True
 assert digest(read(P/'prospective-source-manifest.json',approval['sourceManifestOriginalNine']))==approval['sourceManifestSha256']
 found=[row for row in mf['files']if row['path']==str(path.relative_to(R))];assert len(found)==1
 row=found[0];raw=read(path,row['PRE']);assert len(raw)==row['bytes']and digest(raw)==row['sha256']==approval['sources'][row['path']]
 return row,raw
''' +gate[end:]
gate=gate.replace("mfraw=read(P/'operative-source-manifest.json');mf=strict(mfraw)\n approvalraw=read(P/'integrated-source-review.json');approval=strict(approvalraw)", "approvalraw=read(P/'integrated-source-review.json');approval=strict(approvalraw)\n mfraw=read(P/'prospective-source-manifest.json',approval['sourceManifestOriginalNine']);mf=strict(mfraw)")
gate=gate.replace("'TASK03_ATTEMPT6_INTEGRATED_SOURCE_ONLY'","'TASK03_ATTEMPT6_INTEGRATED_REPAIR1_SOURCE_ONLY'")
gate=gate.replace("assert mf['scope']=='FIRST_PROSPECTIVE_COMPLETE_OPERATIVE_SOURCE_CLOSURE_ONLY'and mf['status']=='READY_FOR_FIRST_INDEPENDENT_REVIEW'", "assert mf['scope']=='TASK03_ATTEMPT6_REPAIR1_NEW_PROSPECTIVE_SOURCE_CLOSURE_ONLY'and mf['status']=='READY_FOR_FRESH_INDEPENDENT_REVIEW'and mf['sourceWriters']=='STOPPED'\n assert mf['historicalD101OriginalCustody']=='FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED'\n planraw=read(P/'prospective-source-plan.json');assert digest(planraw)==mf['sourcePlanSha256']==approval['sourcePlanSha256']\n stopraw=read(P/'source-writers-stopped.json');stop=strict(stopraw)\n assert digest(stopraw)==mf['sourceWritersStoppedSha256']and stop['sourceWriters']=='STOPPED'and stop['remainingSourceWrites']==[]\n assert all(int(row['PRE']['ctime_ns'])<=int(stop['stoppedUnixNs'])for row in mf['files']if row['path']!=str((P/'source-writers-stopped.json').relative_to(R)))")
gate=gate.replace("assert identity(pre)==identity(os.fstat(fd))==row['PRE']", "assert pre.st_uid==501 and pre.st_gid==20 and pre.st_size<=16777216\n   assert identity(pre)==identity(os.fstat(fd))==row['PRE']")
gate=gate.replace("prep=strict(read(Q/'independent-preparation-review.json'))","prep=strict(read(P/'independent-preparation-review.json'))")
gate=gate.replace("Q/'coordinate-source/public-recipe-binding.json'","P/'public-recipe-binding.json'").replace("Q/'coordinate-source/source-receipt-manifest.json'","P/'public-source-receipt-manifest.json'")
gate=gate.replace("return {'binding':binding,'approvalSha256':approval_sha,'sourceManifestSha256':mf_sha}", "assert type(custody['publicTransferReceiptSha256'])is str and len(custody['publicTransferReceiptSha256'])==64 and all(c in '0123456789abcdef'for c in custody['publicTransferReceiptSha256'])\n return {'binding':binding,'approvalSha256':approval_sha,'sourceManifestSha256':mf_sha,'publicTransferReceiptSha256':custody['publicTransferReceiptSha256']}")
write('source-gates.py',gate)
binding=json.loads(read(OLD/'prospective-binding.json'));binding['scope']='REPAIR1_BINDING_UNCHANGED_UNPROVISIONED_OPERATION_CANDIDATE_ONLY';binding['sourceConsumer']=str(P/'source-gates.py');binding['sourceManifest']=str(P/'prospective-source-manifest.json');binding['historicalSourceManifestSha256']='d1012a242bcf52899d63199798ae9c97b821ca04acc00a29db164e889cfff7f1';binding['historicalOriginalCustody']='FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED';save('prospective-binding.json',binding)
save('selective-repair-source-acquisition.json',{'scope':'PUBLIC_CURRENT_WITHIN_READ_BYTES_FOR_SEPARATE_REPAIR_PROGRAMS_ONLY','reads':reads,'oldFilesModified':0,'privateAccess':0,'externalEffects':0,'historicalCustodyRepaired':False})
# Source hash literals only after the new exact management program exists.
path=P/'private-coordinate.py';value=path.read_text();value=value.replace("MANAGEMENT_SHA = 'ff12bbd15b3f4688cd2dd5db4e5d87f3e9e65052435102758ecf8de0ad8d5d5d'", "MANAGEMENT_SHA = '"+hashlib.sha256((P/'target-management.mjs').read_bytes()).hexdigest()+"'");path.write_text(value)
print(json.dumps({'publicSourcesCreated':7,'bindingCreated':True,'privateReads':0,'externalEffects':0,'sourceWriters':'ACTIVE_NOT_YET_GATED'}))
