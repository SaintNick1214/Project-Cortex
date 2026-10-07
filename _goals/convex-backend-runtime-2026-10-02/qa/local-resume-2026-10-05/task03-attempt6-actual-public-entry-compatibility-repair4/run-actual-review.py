"""Root-handoff-gated finite actual public review. No private or product effects."""
import base64, hashlib, json, os, re, resource, stat, sys, time, types, zlib
from pathlib import Path

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA = R / '_goals/convex-backend-runtime-2026-10-02/qa'
Q = QA / 'task03-local-native-attempt6-2026-10-06'
F = QA / 'local-resume-2026-10-05/task03-attempt6-integrated-repair1'
O = QA / 'local-resume-2026-10-05/task03-attempt6-actual-public-entry-compatibility-repair4'
OBSERVERS = QA / 'local-resume-2026-10-05/task03-attempt6-actual-public-custody-readiness-repair3'
OLD = QA / 'local-resume-2026-10-05/task03-attempt6-actual-public-custody-readiness-repair2'
CURRENT = QA / 'local-resume-2026-10-05/task03-attempt6-current-binding-repair2'
OUT = O / 'actual-observation1'
RAW = OUT / 'raw'
COMMON = OLD / 'coordinate-common-highfd.py'
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
VOLUME = 'cortex-task03-attempt6-fixture-20261006-c9fbaa34'
DEPS = 'cortex-task03-deps-20261005-b681774e'
FREEZE = '115e417419ab7b55e9fdbad97e51513f9f24a8e523c7b344168a63c92d8e968c'
HISTORICAL_MF_SHA = 'd9e5929e79d682ae2f4e3dfaad4e2fce01e81f09746a8e3f38b094ebaaf330fc'
MF_SHA = None
OP = 'c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f'
REVIEW_OP = 'bd0980b8-7a63-459b-8b13-ef852041999c'
NAMES = {k:'cortex-task03-attempt6-repair4-review-'+k+'-bd0980b8' for k in ('collect','custody','dependencies','readiness')}
LABELS = {'cortex.operation':REVIEW_OP,'cortex.scope':'independent-public-custody-readiness-only'}
DOCKER = '/usr/local/bin/docker'
FIELDS = ('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
AGE = 60_000_000_000
MEM = 2147483648
MAX_EXPORT = 4 * 1024 * 1024
ENV = {'HOME':'/Users/SaintNick','PATH':'/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','CORTEX_COORDINATOR_CWD':str(R)}
all_pins=[]; source_pins=[]; controls=[]; records=[]; owners={}; recipes={}; cleanup_errors=[]; results={}
SOURCE_GRAPH_MAX_FILES=4096; SOURCE_GRAPH_MAX_BYTES=67108864; SOURCE_GRAPH_MAX_FILE=16777216
source_graph_members={}; source_graph_bytes=0; unique_pins={}; source_graph_complete=False

def reserve_source_graph(path,size):
    global source_graph_bytes
    key=str(path)
    assert type(size)is int and 0<=size<=SOURCE_GRAPH_MAX_FILE,'source_graph_file_ceiling'
    if key in source_graph_members:
        assert source_graph_members[key]==size,'source_graph_duplicate_path_size_drift'
        return
    assert len(source_graph_members)+1<=SOURCE_GRAPH_MAX_FILES,'source_graph_descriptor_ceiling'
    assert source_graph_bytes+size<=SOURCE_GRAPH_MAX_BYTES,'source_graph_aggregate_byte_ceiling'
    source_graph_members[key]=size;source_graph_bytes+=size

def strict(raw):
    def pairs(items):
        out={}
        for k,v in items:
            assert k not in out, 'duplicate_key'
            out[k]=v
        return out
    return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda _:(_ for _ in ()).throw(ValueError('nonfinite')))

def sha(raw): return hashlib.sha256(raw).hexdigest()
def nine(s): return {k:str(getattr(s,'st_'+k)) for k in FIELDS}

def capture(path,kind,original=None):
    path=Path(path)
    assert path.is_absolute() and path.is_relative_to(R) and path.resolve()==path
    current=R
    for part in ('.',*path.relative_to(R).parts):
        if part!='.':current/=part
        value=current.lstat();assert not stat.S_ISLNK(value.st_mode) and current.resolve()==current
        if current!=path:assert stat.S_ISDIR(value.st_mode)
    pre=path.lstat();now=time.time_ns()
    assert stat.S_ISREG(pre.st_mode) and pre.st_nlink==1 and pre.st_uid==501 and pre.st_gid==20
    assert 0<=pre.st_size<=16*1024*1024
    assert max(pre.st_mtime_ns,pre.st_ctime_ns)+AGE<=now, 'immature_before_first_capture:'+str(path)
    reserve_source_graph(path,pre.st_size)
    if str(path)in unique_pins:
        pin=unique_pins[str(path)]
        assert nine(pre)==nine(os.fstat(pin['fd']))==pin['PRE9'],'held_duplicate_path_nine_drift'
        if original is not None:assert pin['PRE9']==original,'original_nine_changed:'+str(path)
        return pin
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    pin={'path':str(path),'fd':fd,'closeAttempted':False}
    all_pins.append(pin) # successful open is immediately owned before metadata/assertion work
    pin.update(kind=kind,PRE9=nine(pre),capturedUnixNs=str(now))
    unique_pins[str(path)]=pin
    assert nine(os.fstat(fd))==pin['PRE9']
    if original is not None:assert pin['PRE9']==original,'original_nine_changed:'+str(path)
    return pin

def qualify(pin,expected=None,collect=False):
    fd=pin['fd'];path=Path(pin['path']);baseline=pin['PRE9'];os.lseek(fd,0,os.SEEK_SET)
    assert nine(os.fstat(fd))==baseline
    digest=hashlib.sha256();length=0;chunks=[]
    while data:=os.read(fd,65536):
        length+=len(data);assert length<=int(baseline['size']);digest.update(data)
        if collect:chunks.append(data)
    assert length==int(baseline['size']) and nine(os.fstat(fd))==nine(path.lstat())==baseline
    row={'path':str(path),'sha256':digest.hexdigest(),'bytes':length,'PRE9':baseline,'capturedUnixNs':pin['capturedUnixNs'],'fullEOF':True,'finalDescriptorAndPathNineEqual':True}
    if expected:assert row['sha256']==expected['sha256'] and row['bytes']==expected['bytes']
    return row,b''.join(chunks)

def load_current_common(pin,row):
    _,raw=qualify(pin,row,True)
    assert sha(raw)=='3b7d195b905465275b081b32f0a934af4c232f7dafb76281c044d50e8b03dc8f' and len(raw)==21476
    module=types.ModuleType('attempt6_independent_common');module.__file__=str(COMMON);module.__package__=''
    exec(compile(raw,str(COMMON),'exec',dont_inherit=True),module.__dict__)
    qualify(pin,row)
    return module

def command(label,argv,timeout=30,required=True):
    assert source_graph_complete is True,'source_graph_not_complete_no_dispatch'
    assert len(records)<48 and 0<timeout<=190
    row,out,err=C.run(label,argv,RAW,timeout,ENV,required=False);records.append(row)
    assert row['terminal'] is True and row['closeErrors']==[] and row['failureClass'] is None,'command_terminal_unknown:'+label
    assert type(row['exitCode'])is int
    if required:assert row['exitCode']==0,'command_exit:'+label
    return row,out,err

def inspect(key,label,required=True):
    row,raw,err=command(label,[DOCKER,'inspect',NAMES[key]],required=required)
    if row['exitCode']==1:
        assert raw==b'[]\n' and err.lower().strip()==('error: no such object: '+NAMES[key]).encode()
        return None
    assert row['exitCode']==0 and err==b''
    objs=strict(raw);assert type(objs)is list and len(objs)==1
    return objs[0]

def recipe(obj,key,argv,mounts,initial=False,allow_running=False):
    assert obj['Name']=='/'+NAMES[key] and obj['Config']['Labels']==LABELS
    assert obj['Id']==owners[key] and len(obj['Id'])==64 and all(c in '0123456789abcdef'for c in obj['Id'])
    assert obj['Image']==obj['Config']['Image']==IMAGE and obj['Platform']=='linux'
    assert obj['Config']['User']=='501:20' and obj['Config']['WorkingDir']==str(R)
    assert obj['Config']['Cmd']==argv and obj['Config']['Entrypoint'] is None
    assert obj['Config']['Env']==image_env
    state=obj['State'];assert type(state['Running'])is bool and state['Running'] is allow_running and state['OOMKilled'] is False
    assert type(state['ExitCode'])is int and state['Error']==''
    assert state['Status']==('running'if allow_running else('created'if initial else'exited'))
    host=obj['HostConfig']
    assert host['NetworkMode']=='none' and host['ReadonlyRootfs'] is True and host['Privileged'] is False and host['AutoRemove'] is False
    assert host['PortBindings']=={} and host['PublishAllPorts'] is False and host['CapDrop']==['ALL'] and host['SecurityOpt']==['no-new-privileges']
    for k,v in [('Memory',MEM),('MemorySwap',MEM),('PidsLimit',64),('NanoCpus',2000000000)]:assert type(host[k])is int and host[k]==v
    assert host['Tmpfs']=={'/tmp':'rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20'}
    choices=[]
    for mapping,prefix in [('literal',''),('docker-desktop-host_mnt','/host_mnt')]:
        expected=[]
        for m in mounts:
            m=dict(m)
            if m['Type']=='bind':m['Source']=prefix+m['Source']
            expected.append(m)
        if host['Mounts']==expected:choices.append(mapping)
    assert len(choices)==1,'exact_mapping_required';mapping=choices[0]
    if key in recipes:assert mapping==recipes[key]['mapping']
    actual=obj['Mounts'];assert type(actual)is list and len(actual)==len(mounts)
    by={m['Destination']:m for m in actual};assert len(by)==len(actual) and set(by)=={m['Target']for m in mounts}
    for m in mounts:
        a=by[m['Target']];assert a['Type']==m['Type'] and type(a['RW'])is bool and a['RW'] is False
        if m['Type']=='bind':assert a['Source']==(''if mapping=='literal'else'/host_mnt')+m['Source']
        else:assert a['Name']==m['Source'] and a['Driver']=='local' and a['Source']=='/var/lib/docker/volumes/'+m['Source']+'/_data'
    return mapping

def execute(key,argv,mounts):
    assert inspect(key,key+'-absence',False)is None
    create=[DOCKER,'create','--name',NAMES[key],'--label','cortex.operation='+REVIEW_OP,'--label','cortex.scope='+LABELS['cortex.scope'],'--platform','linux/amd64','--network','none','--memory',str(MEM),'--memory-swap',str(MEM),'--cpus','2','--pids-limit','64','--read-only','--user','501:20','--workdir',str(R),'--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp:rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20']
    for m in mounts:
        value='type='+m['Type']+',source='+m['Source']+',target='+m['Target']+',readonly'
        if m['Type']=='volume':
            value+=',volume-nocopy'
            if m['VolumeOptions'].get('Subpath'):value+=',volume-subpath='+m['VolumeOptions']['Subpath']
        create+=['--mount',value]
    _,raw,err=command(key+'-create',create+[IMAGE,*argv]);assert err==b''
    cid=raw.strip().decode();assert len(cid)==64 and all(c in '0123456789abcdef'for c in cid)
    owners[key]=cid
    obj=inspect(key,key+'-initial-inspect');mapping=recipe(obj,key,argv,mounts,True)
    recipes[key]={'containerId':cid,'mapping':mapping,'argv':argv,'mounts':mounts,'initialInspect':obj}
    C.durable_json(OUT/(key+'-initial-recipe.json'),recipes[key])
    row,out,err=command(key+'-run',[DOCKER,'start','--attach',cid],190,False)
    obj=inspect(key,key+'-terminal-inspect');recipe(obj,key,argv,mounts)
    assert row['exitCode']==obj['State']['ExitCode']==0 and err==b''
    command(key+'-remove',[DOCKER,'rm',cid]);assert inspect(key,key+'-removed-absence',False)is None
    return out

def compressed(raw):
    assert len(raw)<=262144;env=strict(raw)
    assert env['encoding']=='gzip+base64' and type(env['decodedBytes'])is int and 0<=env['decodedBytes']<=MAX_EXPORT
    compressed=base64.b64decode(env['body'],validate=True);decoder=zlib.decompressobj(16+zlib.MAX_WBITS)
    body=decoder.decompress(compressed,MAX_EXPORT+1)
    assert len(body)<=MAX_EXPORT and decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
    assert len(body)==env['decodedBytes'] and sha(body)==env['decodedSha256']
    return strict(body)

def volume(name,label,expected):
    _,raw,err=command(label,[DOCKER,'volume','inspect',name]);assert err==b''
    rows=strict(raw);assert type(rows)is list and len(rows)==1 and rows[0]==expected
    return rows[0]

def verify_raw(directory,rows):
    snapshots=[]
    assert len(rows)<=48 and len({r['label']for r in rows})==len(rows)
    for row in rows:
        assert re.fullmatch('[a-z][a-z0-9-]{1,70}',row['label'])
        assert row['terminal'] is True and row['failureClass'] is None and row['closeErrors']==[] and type(row['exitCode'])is int
        assert row['pipeLimits']==262144 and row['ownedGroup']['absenceObserved'] is True
        for suffix in ('receipt.json','stdout','stderr'):
            pin=capture(directory/(row['label']+'.'+suffix),'retained-acquisition-raw')
            meta,raw=qualify(pin,collect=True);controls.append(pin);snapshots.append(meta)
            if suffix=='receipt.json':assert strict(raw)==row
            else:assert sha(raw)==row[suffix+'Sha256'] and len(raw)==row['streamByteCounts'][suffix]
    return snapshots

failure=None;failure_chain=[];C=None;image_env=None;handoff_pin=None;public_transfer_sha=None;control_rows={}
def retain_error(stage,error,primary=False):
    global failure
    row={'stage':stage,'class':type(error).__name__,'reason':str(error)[:500]}
    failure_chain.append(row)
    if primary and failure is None:failure={'class':row['class'],'reason':row['reason']}
    return row

def close_owned_inputs():
    for pin in all_pins:
        if pin.get('closeAttempted')is True:continue
        pin['closeAttempted']=True # unknown descriptor state is never retried
        try:os.close(pin['fd'])
        except BaseException as error:
            row=retain_error('input-close',error)
            cleanup_errors.append({'key':'held-input-close','path':pin.get('path'),'fd':pin['fd'],**row})

try:
    assert os.getuid()==501 and os.getgid()==20 and sys.dont_write_bytecode and Path.cwd()==R
    assert len(sys.argv)==2,'explicit_root_handoff_path_required'
    soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
    if soft<8192:resource.setrlimit(resource.RLIMIT_NOFILE,(min(8192,hard),hard))
    assert resource.getrlimit(resource.RLIMIT_NOFILE)[0]>=4096
    handoff_pin=capture(Path(sys.argv[1]),'explicit-Root-actual-handoff')
    handoff_meta,hraw=qualify(handoff_pin,collect=True);H=strict(hraw)
    assert H['scope']=='TASK03_ATTEMPT6_REPAIR4_ACTUAL_PUBLIC_REVIEW_HANDOFF' and H['explicitActualPublicReviewAuthorized'] is True
    assert H['operation']==OP and H['reviewerOperation']==REVIEW_OP and H['volume']==VOLUME and H['immutableImage']==IMAGE and H['candidateSha256']==FREEZE
    assert H['allNewWritersStopped'] is True and H['remainingWrites']==[]
    MF_SHA=H['sourceManifestSha256']
    assert re.fullmatch('[a-f0-9]{64}',MF_SHA) and MF_SHA!=HISTORICAL_MF_SHA
    assert H['sourceEpochScope']=='TASK03_ATTEMPT6_REPAIR2_NEW_PROSPECTIVE_SOURCE_CLOSURE_ONLY'
    assert type(H['sourceRows'])is int and 0<H['sourceRows']<=4096 and type(H['sourceBytes'])is int and 0<H['sourceBytes']<=67108864
    control_paths=['sourceApproval','preparationDecision','managementDecision','sourceManifest','sourcePlan','sourceWritersStopped','publicRecipeBinding','publicSourceManifest','acquisitionCommands','reviewSourceAcceptance']
    control_docs={};control_rows={}
    # Each dependent data document has its first mature held capture before its first content qualification.
    for name in control_paths:
        row=H['inputs'][name];pin=capture(Path(row['path']),name,row['PRE9']);controls.append(pin)
        meta,raw=qualify(pin,row,True);control_rows[name]=meta;control_docs[name]=strict(raw)
    approval=control_docs['sourceApproval'];mf=control_docs['sourceManifest'];prep=control_docs['preparationDecision'];management=control_docs['managementDecision']
    assert approval['scope']=='TASK03_ATTEMPT6_CURRENT_BINDING_REPAIR2_SOURCE_ONLY' and approval['independent'] is True and approval['verdict']=='PASS'
    assert approval['sourceManifestSha256']==MF_SHA==control_rows['sourceManifest']['sha256'] and approval['sourceManifestOriginalNine']==control_rows['sourceManifest']['PRE9']
    assert approval['candidateSha256']==FREEZE and mf['sourceWriters']=='STOPPED' and mf['historicalD101OriginalCustody']=='FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED'
    assert Path(control_rows['sourceManifest']['path'])==CURRENT/'prospective-source-manifest.json'
    assert Path(control_rows['sourceApproval']['path'])==CURRENT/'integrated-source-review.json'
    assert mf['scope']==H['sourceEpochScope']
    assert mf['sourcePlanSha256']==approval['sourcePlanSha256']==control_rows['sourcePlan']['sha256']
    assert mf['sourceWritersStoppedSha256']==control_rows['sourceWritersStopped']['sha256']
    assert len(mf['files'])==len({r['path']for r in mf['files']})==H['sourceRows'] and sum(r['bytes']for r in mf['files'])==H['sourceBytes']
    assert set(approval['sources'])=={r['path']for r in mf['files']}
    assert prep['scope']=='BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION' and prep['independent'] is True and prep['verdict']=='PASS' and prep['candidateSha256']==FREEZE and prep['candidateMembers']==1907
    assert management['scope']=='TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY' and management['independent'] is True and management['verdict']=='PASS'
    binding=control_docs['publicRecipeBinding'];assert binding['operation']==OP and binding['volume']==VOLUME and binding['immutableImage']==IMAGE and binding['publicCopiedFiles']==1914
    required_sources={str(O/n) for n in ('actual-entry.py','run-actual-review.py')}|{str(OBSERVERS/n) for n in ('linux-public-observer.py','linux-dependency-observer.mjs')}|{str(COMMON)}
    named_acceptance=control_docs['reviewSourceAcceptance']
    assert named_acceptance['scope']=='TASK03_ATTEMPT6_PUBLIC_REVIEW_REPAIR4_NAMED_SOURCE_ACCEPTANCE' and named_acceptance['independent']is True and named_acceptance['verdict']=='PASS'
    assert named_acceptance['reviewerOperation']==REVIEW_OP and named_acceptance['sourceEpochManifestSha256']==MF_SHA
    assert named_acceptance['sourceHashes']=={p:r['sha256']for p,r in H['reviewSources'].items()}
    assert set(H['reviewSources'])==required_sources
    for path,row in H['reviewSources'].items():
        pin=capture(Path(path),'Root-reviewed-new-observer',row['PRE9']);controls.append(pin);qualify(pin,row)
    # Entire newly accepted source epoch captured before qualifying ANY of its source cohort content.
    for row in mf['files']:
        path=Path(row['path']);assert not path.is_absolute() and '..'not in path.parts
        source_pins.append((capture(R/path,'current-approved-operative-source',row['PRE']),row))
    assert len(all_pins)<=4096
    initial=[]
    for pin,row in source_pins:
        assert approval['sources'][row['path']]==row['sha256']
        meta,_=qualify(pin,row);initial.append(meta)
    common_pin=unique_pins[str(COMMON)];common_row=H['reviewSources'][str(COMMON)]
    C=load_current_common(common_pin,common_row)
    OUT.mkdir(mode=0o700);RAW.mkdir(mode=0o700)
    C.durable_json(OUT/'current-source-pre9-and-full-content.json',{'scope':'NEW_CURRENT_ORIGINAL_APPROVED_SOURCE_COHORT_ONLY','files':initial,'allCapturedBeforeFirstSourceContentQualification':True,'sourceRows':H['sourceRows'],'sourceBytes':H['sourceBytes'],'historicalFailuresNotAdopted':True})
    C.durable_json(OUT/'review-operation.json',{'scope':'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY','operation':OP,'reviewerOperation':REVIEW_OP,'names':NAMES,'labels':LABELS,'handoff':handoff_meta,'reviewSources':H['reviewSources'],'effectsBudgetPaid':0})
    acq=control_docs['acquisitionCommands'];assert acq['operation']==OP and acq['volume']==VOLUME and acq['status']=='PASS' and acq['cleanupErrors']==[] and acq['custodyReview']=='REQUIRED'
    assert acq['credentialReads']==acq['serviceCalls']==0 and acq['CLI'] is False and acq['nativeFoundationAccepted'] is False
    original_raw=verify_raw(Path(H['acquisitionDirectory']),acq['commands'])
    C.durable_json(OUT/'retained-acquisition-raw-verification.json',{'status':'PASS','commands':len(acq['commands']),'rawFiles':original_raw})
    source_graph_complete=True
    C.durable_json(OUT/'source-graph-aggregate-ledger.json',{'scope':'ONE_SOURCE_ACQUISITION_GRAPH_ALL_SOURCE_CONTROL_DATA_INPUTS','files':len(source_graph_members),'bytes':source_graph_bytes,'limits':{'files':4096,'bytes':67108864,'perFileBytes':16777216},'members':source_graph_members,'noSubgraphReset':True,'allInputDescriptorsRemainHeld':True,'distinctLinux1914CustodyContractUnchanged':True})
    _,raw,_=command('daemon-memory',[DOCKER,'info','--format','{{json .MemTotal}}']);assert int(raw)>=MEM
    _,raw,_=command('running-container-ids',[DOCKER,'ps','--quiet']);assert raw==b'','foreign_container_resource_admission'
    _,raw,err=command('immutable-image',[DOCKER,'image','inspect',IMAGE]);assert err==b''
    images=strict(raw);assert len(images)==1 and images[0]['Id']==IMAGE and images[0]['Architecture']=='amd64' and images[0]['Os']=='linux';image_env=images[0]['Config']['Env']
    expected_public=H['publicVolumeInspect'];expected_deps=H['dependencyVolumeInspect']
    assert expected_public['Name']==VOLUME and expected_public['Driver']=='local' and expected_public['Labels']=={'cortex.goal':'convex-backend-runtime-2026-10-02','cortex.operation':OP}
    assert expected_public['Mountpoint']=='/var/lib/docker/volumes/'+VOLUME+'/_data' and expected_public['Options']is None and expected_public['Scope']=='local'
    assert expected_deps['Name']==DEPS and expected_deps['Driver']=='local' and expected_deps['Mountpoint']=='/var/lib/docker/volumes/'+DEPS+'/_data'
    volume(VOLUME,'public-volume-initial',expected_public);volume(DEPS,'dependency-volume-initial',expected_deps)
    source={'Type':'bind','Source':str(R),'Target':str(R),'ReadOnly':True}
    public={'Type':'volume','Source':VOLUME,'Target':'/owned','ReadOnly':True,'VolumeOptions':{'NoCopy':True}}
    selected=['/usr/bin/env','-i','PATH='+str(R/'node_modules/.bin')+':/usr/local/bin:/usr/bin:/bin','HOME=/tmp','LANG=C.UTF-8','NO_COLOR=1','CI=1','TMPDIR=/tmp']
    linux=str(OBSERVERS/'linux-public-observer.py')
    collection=compressed(execute('collect',[*selected,'/usr/local/bin/python3.12','-B',linux,'collect'],[source,public]))
    receipt_raw=collection.pop('receiptBody').encode();receipt_metadata=collection['receiptMetadata']
    assert sha(receipt_raw)==receipt_metadata['sha256'] and len(receipt_raw)==receipt_metadata['bytes'] and collection['publicMembers']==1914
    public_transfer_sha=sha(receipt_raw)
    C.durable(OUT/'collected-public-transfer-receipt.json',receipt_raw);C.durable_json(OUT/'collected-transfer-metadata.json',collection)
    raw=execute('custody',[*selected,'/usr/local/bin/python3.12','-B',linux,'custody',receipt_metadata['sha256'],json.dumps(receipt_metadata['PRE9'],separators=(',',':'))],[source,public])
    lines=raw.splitlines();assert len(lines)==2;pre,custody=[compressed(line)for line in lines]
    assert pre['descriptors']==3828 and len(pre['files'])==1914 and pre['captureBeforeQualification'] is True
    assert custody['status']=='PASS' and custody['publicMembers']==len(custody['observed'])==1914 and custody['receiptMetadata']==receipt_metadata
    assert custody['allCurrentDestinationIdentities']=='PASS_ALL9' and custody['currentSourceDestinationFullContent']=='PASS' and custody['transferSourceOriginalNine']=='PASS_ALL9'
    C.durable_json(OUT/'linux1914-first-pre9.json',pre);C.durable_json(OUT/'actual-public-custody.json',custody);results['custody']='PASS'
    depsroot={'Type':'volume','Source':DEPS,'Target':'/deps','ReadOnly':True,'VolumeOptions':{'NoCopy':True}}
    deps={'Type':'volume','Source':DEPS,'Target':str(R/'node_modules'),'ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'node_modules'}}
    candidate={'Type':'volume','Source':VOLUME,'Target':str(Q),'ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}}
    raw=execute('dependencies',[*selected,'/usr/local/bin/node',str(OBSERVERS/'linux-dependency-observer.mjs')],[source,depsroot,deps,candidate])
    lines=raw.splitlines();assert len(lines)==2;pre,deps_result=[compressed(line)for line in lines]
    assert pre['sourceRoots']==4 and pre['compilerProjectionMembers']==114 and deps_result['compilerProjectionMembers']==114 and deps_result['sourcePreflightCounts']==[161,138,1907]
    assert deps_result['fixtureExactPackagePins']==9 and deps_result['ancillaryExactPackagePins']==3 and len(deps_result['versions'])==12
    assert deps_result['status']=='PASS' and deps_result['currentSourceAll9BeforeFirstQualificationThroughHeldFinal']=='PASS' and deps_result['retainedOriginalVolumePackageAll9']=='PASS'
    assert deps_result['externalRequests']==deps_result['serviceDeployments']==deps_result['packageInstalls']==deps_result['volumeWrites']==deps_result['privateScratchReads']==0
    final={(r['kind'],r['path']):r for r in deps_result['finalHeld']};assert len(final)==len(pre['files'])==pre['heldDescriptors']
    for row in pre['files']:assert final[(row['kind'],row['path'])]['identityDecimal']==row['identityDecimal']
    C.durable_json(OUT/'dependency-first-pre9.json',pre);C.durable_json(OUT/'actual-dependency-readiness.json',deps_result);results['dependencies']='PASS'
    source_command="import {sourcePreflight} from "+json.dumps(str(Q/'scripts/guard.mjs'))+";import{readFileSync}from'node:fs';if(process.env.NODE_OPTIONS!==undefined||readFileSync('/sys/fs/cgroup/memory.max','utf8').trim()!=='2147483648'||readFileSync('/sys/fs/cgroup/memory.swap.max','utf8').trim()!=='0')throw Error('resource recipe');const{source,copies,frozen}=sourcePreflight();if(source.files.length!==161||copies.files.length!==138||frozen.files.length!==1907||frozen.actualExternalRequests!==0||frozen.actualDeployments!==0)throw Error('source counts');console.log(JSON.stringify({scope:'ACTUAL_PUBLIC_SOURCE_PREFLIGHT_ONLY',status:'PASS',sources:161,copies:138,frozenMembers:1907,actualExternalRequests:0,actualDeployments:0}));await import("+json.dumps(str(Q/'attempt2/cli-readiness.mjs'))+");"
    raw=execute('readiness',[*selected,'/usr/local/bin/node','--input-type=module','-e',source_command],[source,deps,candidate])
    lines=raw.splitlines();assert len(lines)==2;preflight,ready=[strict(line)for line in lines]
    assert preflight['status']==ready['status']=='PASS' and ready['scope']=='CREDENTIAL_FREE_ACTUAL_CLI_COMPILER_READINESS'
    assert ready['nodeVersion']=='v24.15.0' and ready['npmVersion']=='12.2.0' and ready['compilerVersion']==ready['projectedCompilerVersion']=='Version 6.0.3'
    assert len(ready['results'])==3 and all(row['exitCode']==0 for row in ready['results']) and ready['actualExternalRequests']==ready['serviceDeployments']==0
    for sample in (ready['resourceBefore'],ready['resourceAfter']):
        assert sample['cgroupMemoryMax']=='2147483648'
        events=dict(line.split()for line in sample['cgroupMemoryEvents'].splitlines());assert all(events[k]=='0'for k in ('oom','oom_kill','oom_group_kill'))
    C.durable_json(OUT/'actual-public-source-preflight.json',preflight);C.durable_json(OUT/'actual-cli-compiler-readiness.json',ready);results['readiness']='PASS'
    final=[]
    for pin,row in source_pins:final.append(qualify(pin,row)[0])
    assert final==initial
    for pin in controls:qualify(pin)
    qualify(handoff_pin)
    C.durable_json(OUT/'current-source-final.json',{'status':'PASS_ALL_NEW_SOURCE_EPOCH_ORIGINAL_NINE_FULL_EOF_HASH_SIZE','files':final,'initialEqualsFinal':True})
    volume(VOLUME,'public-volume-final',expected_public);volume(DEPS,'dependency-volume-final',expected_deps)
except BaseException as error:
    retain_error('primary',error,True)
finally:
    try:
        if C is not None and RAW.is_dir():
            for key in NAMES:
                try:
                    obj=inspect(key,'final-'+key+'-inspect',False)
                    if obj is not None:
                        assert key in recipes and key in owners
                        # Unknown or foreign recipe is NEVER signaled or removed.
                        if obj['State']['Running']:
                            recipe(obj,key,recipes[key]['argv'],recipes[key]['mounts'],allow_running=True)
                            command('final-'+key+'-sigterm',[DOCKER,'kill','--signal','SIGTERM',owners[key]])
                            command('final-'+key+'-wait',[DOCKER,'wait',owners[key]],30)
                            obj=inspect(key,'final-'+key+'-terminal')
                        recipe(obj,key,recipes[key]['argv'],recipes[key]['mounts'])
                        command('final-'+key+'-remove',[DOCKER,'rm',owners[key]])
                        assert inspect(key,'final-'+key+'-absence',False)is None
                except BaseException as error:retain_error('container-cleanup:'+key,error);cleanup_errors.append({'key':key,'class':type(error).__name__,'reason':str(error)[:250]})
            try:
                _,raw,err=command('final-known-owned-containers',[DOCKER,'ps','--all','--quiet','--filter','label=cortex.operation='+REVIEW_OP]);assert raw==b'' and err==b''
            except BaseException as error:retain_error('final-known-owned',error);cleanup_errors.append({'key':'final-known-owned','class':type(error).__name__,'reason':str(error)[:250]})
            for pin in all_pins:
                try:qualify(pin)
                except BaseException as error:retain_error('final-held-input',error);cleanup_errors.append({'key':'final-held-input','class':type(error).__name__,'reason':str(error)[:250]})
            status='PASS'if failure is None and cleanup_errors==[] and results=={'custody':'PASS','dependencies':'PASS','readiness':'PASS'}else'FAIL'
            C.durable_json(OUT/'commands.json',{'scope':'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY','status':status,'operation':OP,'reviewerOperation':REVIEW_OP,'volume':VOLUME,'dependencyVolume':DEPS,'commands':records,'results':results,'failure':failure,'failureChain':failure_chain,'cleanupErrors':cleanup_errors,'inputCloses':'FINAL_CLOSE_RECEIPT_REQUIRED','ownedContainersRemoved':cleanup_errors==[],'volumeWrites':0,'privateReads':0,'serviceCalls':0,'paidCalls':0,'nativeFoundationAccepted':False,'fullTask03':False,'fullGoal':False,'prospectiveSourceManifestSha256':MF_SHA,'sourceApprovalSha256':control_rows.get('sourceApproval',{}).get('sha256'),'publicRecipeBindingSha256':control_rows.get('publicRecipeBinding',{}).get('sha256'),'publicSourceManifestSha256':control_rows.get('publicSourceManifest',{}).get('sha256'),'publicTransferReceiptSha256':public_transfer_sha,'sourceGraphFiles':len(source_graph_members),'sourceGraphBytes':source_graph_bytes,'independentFinalEvidenceSeal':'REQUIRED_AFTER_ALL_OUTPUTS_MATURE'})
    except BaseException as error:
        retain_error('final-reconciliation-or-report',error,True)
        cleanup_errors.append({'key':'final-report-or-reconciliation','class':type(error).__name__,'reason':str(error)[:500]})
    finally:
        close_owned_inputs()
    # The main report retains inputs through its durable attempt. This separate final
    # receipt makes close failures sticky; a failed write cannot bypass owned closes.
    if C is not None and OUT.is_dir():
        try:C.durable_json(OUT/'input-close-receipt.json',{'scope':'ALL_OWNED_INPUT_CLOSE_ATTEMPTS_FINAL','status':'PASS'if not cleanup_errors and failure is None else'FAIL','failure':failure,'failureChain':failure_chain,'cleanupErrors':cleanup_errors,'closeAttempts':[{'path':p.get('path'),'fd':p['fd'],'attempted':p.get('closeAttempted')is True}for p in all_pins],'unknownCloseStatesNeverRetried':True,'nativeFoundationAccepted':False,'fullTask03':False})
        except BaseException as error:retain_error('input-close-report',error,True);cleanup_errors.append({'key':'input-close-report','class':type(error).__name__,'reason':str(error)[:500]})
print(json.dumps({'status':'PASS'if failure is None and cleanup_errors==[] and results=={'custody':'PASS','dependencies':'PASS','readiness':'PASS'}else'FAIL','results':results,'failure':failure,'failureChain':failure_chain,'cleanupErrors':cleanup_errors,'actualEvidenceClosureRequired':True}))
raise SystemExit(0 if failure is None and cleanup_errors==[] and len(results)==3 else 1)
