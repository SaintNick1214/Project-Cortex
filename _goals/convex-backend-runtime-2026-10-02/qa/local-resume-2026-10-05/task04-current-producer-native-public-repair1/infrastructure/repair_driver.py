from pathlib import Path
N=Path(__file__).resolve().parents[1];p=N/'source/ci-run.py';t=p.read_text()
t=t.replace('from native_export import validate_manifest','from native_export import validate_manifest\nfrom public_export_contract import validate_public')
t=t.replace('BUILD_BASELINE=None;HOST_TOTAL_BYTES=0','BUILD_BASELINE=None;HOST_TOTAL_BYTES=0\nPHASE_NAME=None;COMBINED_EXPORT_BYTES=0;COMBINED_EXPORT_PATHS=0;EXPORT_SECONDS_USED=0;OWNED_PHASES=[]')
t=t.replace("save('copy-'+target.name+'.json',receipt)","save('copy-'+PHASE_NAME+'-'+target.name+'.json',receipt)")
start=t.index('\ndef main():');end=t.index('\ndef cleanup():',start)
t=t[:start]+'''
def startup_origins():
    rows=[]
    for name,module in tuple(sys.modules.items()):
        origin=getattr(module,'__file__',None);cached=getattr(module,'__cached__',None)
        if origin and not origin.startswith('<'):
            rows.append({'module':name,'file':origin,'cached':cached,
                         'cachedExists':bool(cached and Path(cached).is_file())})
    return sorted(rows,key=lambda r:r['module'])


def create_phase(mode,operation,image,parser):
    global OWNED_ID,EXPECTED,LABELS,VOLUMES,PHASE_NAME
    PHASE_NAME=mode;OWNED_ID=None;EXPECTED=None;VOLUMES=[]
    name='cortex-t4-'+mode+'-'+operation[:12]
    LABELS={'cortex.goal':'convex-backend-runtime-2026-10-02','cortex.operation':operation,
        'cortex.owner':'native-public-repair1','cortex.scope':'PUBLIC_SOURCE_ONLY_NO_RELEASE',
        'cortex.phase':mode,'cortex.attempt':os.environ['GITHUB_RUN_ID']+'-'+os.environ['GITHUB_RUN_ATTEMPT']}
    phase(mode+'-create-binding',120)
    mounts=[]
    for src,target in [(S,'/native-source'),(S/'producer','/reviewed-source'),
        (S/'run_controls.py','/reviewed-control.py'),(parser,'/reviewed-typescript.js'),
        (S/'reference-command.json','/reviewed-command.json'),(RUN/'input-manifest.json','/reviewed-manifest.json'),
        (S/'bootstrap.py','/reviewed-bootstrap.py')]:
        mounts.append({'type':'bind','source':str(src),'target':target,'rw':False})
    targets=[('public','/var/tmp')]
    if mode=='native20':targets.append(('c7','/dev/shm/cortex-native-c7-exact-identity-repair'))
    for suffix,target in targets:
        vname=name+'-'+suffix;absent('volume',vname)
        argv=['docker','volume','create']
        for k,v in LABELS.items():argv+=['--label',k+'='+v]
        argv+=[vname];call(argv)
        vrow=strict(call(['docker','volume','inspect',vname],cap=65536))[0]
        point=volume(vrow,vname,LABELS);VOLUMES.append(vrow)
        mounts.append({'type':'volume','source':point,'target':target,'name':vname,'rw':True})
    absent('container',name)
    argv=['docker','create','--name',name,'--platform','linux/amd64','--memory','1g','--memory-swap','1g',
        '--network','none','--read-only','--cap-drop','ALL','--pids-limit','128','--pid=',
        '--ipc','private','--cgroupns','private','--init=false','--security-opt','no-new-privileges',
        '--user','0:0','--workdir','/native-source','--ulimit','nofile=8192:8192',
        '--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=16777216,mode=0700',
        '--env','HOME=/var/tmp/cortex-task04-native-public/home',
        '--env','TMPDIR=/var/tmp/cortex-task04-native-public/tmp','--entrypoint','/usr/local/bin/python3.12']
    for k,v in LABELS.items():argv+=['--label',k+'='+v]
    for m in mounts:
        value='type='+m['type']+',src='+(m['name']if m['type']=='volume'else m['source'])+',dst='+m['target']
        value+=',volume-nocopy'if m['type']=='volume'else ',readonly';argv+=['--mount',value]
    command='/native-source/native-controller.py'if mode=='native20'else '/reviewed-bootstrap.py'
    argv+=[image['Id'],'-B',command];OWNED_ID=call(argv,cap=65536).decode().strip()
    env=[('HOME=/var/tmp/cortex-task04-native-public/home'if v.startswith('HOME=')else
        'TMPDIR=/var/tmp/cortex-task04-native-public/tmp'if v.startswith('TMPDIR=')else v)for v in image['Config']['Env']]
    EXPECTED={'id':OWNED_ID,'image':image['Id'],'name':name,'phase':mode,'labels':LABELS,'mounts':mounts,'env':env}
    save(mode+'-expected-bindings.json',EXPECTED)
    save(mode+'-source-before.json',{'rows':[h.fence(full=True) for h in SOURCE_HELD],
        'separateOwner':mode,'noCrossPhaseNativeCustody':True})
    fence_directories(SOURCE_DIRS)
    save(mode+'-create-inspect.json',validate(inspect(),EXPECTED))
    for row in VOLUMES:
        current=strict(call(['docker','volume','inspect',row['Name']],cap=65536))[0]
        volume(current,row['Name'],LABELS)
        if current!=row:raise ValueError('EXACT_VOLUME_PRESTART_BINDING')
    if call(['docker','ps','-q'],cap=65536).strip():raise ValueError('IMMEDIATE_NATIVE_IDLE_REQUIRED')
    # Recheck source and every actual binding immediately before START.
    for h in SOURCE_HELD:h.fence(full=True)
    fence_directories(SOURCE_DIRS)
    validate(inspect(),EXPECTED)
    remaining()


def run_phase(mode,seconds):
    phase(mode+'-execution',seconds);began=time.monotonic()
    call(['docker','start',OWNED_ID],cap=65536)
    polls=[]
    while True:
        remaining()
        row=inspect();polls.append(validate(row,EXPECTED,started=True))
        if len(polls)>640:raise ValueError('FINITE_PHASE_POLL_COUNT')
        if not row['State']['Running']:
            if row['State']['Pid']!=0 or row['State']['Status']!='exited':raise ValueError('EXACT_PHASE_TERMINAL')
            remaining()  # Post-inspect terminal acceptance against the same bound.
            save(mode+'-terminal.json',{'actual':row['State'],'elapsedSeconds':time.monotonic()-began,
                'originalPhaseBound':seconds,'nativeOwnerExpiredAtTerminal':True,'noCrossPhaseLiveCustody':True})
            break
        time.sleep(min(1,remaining()))
    save(mode+'-polls.json',polls)
    return row['State']['ExitCode']


def export_phase(mode):
    global COMBINED_EXPORT_BYTES,COMBINED_EXPORT_PATHS,EXPORT_SECONDS_USED
    left=300-EXPORT_SECONDS_USED
    if left<=0:raise ValueError('CUMULATIVE_EXPORT300_EXHAUSTED')
    phase(mode+'-export',left);began=time.monotonic()
    export=RUN/'export'/mode;export.mkdir(parents=True,mode=0o700)
    remote=('/var/tmp/cortex-task04-native-public/native-export-manifest.json'if mode=='native20'else
        '/var/tmp/task04-c8-current-canonical-input-producers/public-export-manifest.json')
    target=export/('native-export-manifest.json'if mode=='native20'else 'public-export-manifest.json')
    export_copy(remote,target,16777216 if mode=='native20'else 65536)
    h=Held(str(target),16777216)
    try:
        os.lseek(h.fd,0,os.SEEK_SET);data=strict(os.read(h.fd,16777217));h.fence(full=True)
    finally:h.close()
    rows=validate_manifest(data)['files']if mode=='native20'else validate_public(data)
    # Include the manifest itself in cumulative finite transport limits.
    required_bytes=target.stat().st_size+sum(r['current']['bytes']for r in rows if r['status']=='EXISTS')
    required_paths=1+sum(r['status']=='EXISTS'for r in rows)
    if COMBINED_EXPORT_BYTES+required_bytes>570425344 or COMBINED_EXPORT_PATHS+required_paths>4096:
        raise ValueError('COMBINED_TWO_PHASE_EXPORT_BYTES_PATHS_HOLD')
    copied=[];remote_targets={}
    for index,row in enumerate(rows):
        if row['status']=='ABSENT':continue
        remaining();path=row['path']
        target=export/('file-'+str(index).zfill(4))
        export_copy(path,target,row['current']['bytes'],row['current'])
        h=Held(str(target),570425344,row['current'])
        try:copied.append({**h.fence(full=True),'containerPath':path,'nativeIdentityNotAdoptedByHost':True})
        finally:h.close()
        remote_targets[path]=target
    save(mode+'-export-copy.json',{'rows':copied,'remoteManifest':data,'separatePhase':mode,
        'nativeOwnerAlreadyExpired':True,'historicalCustody':'NOT_ADOPTED'})
    if mode=='public48'and data['primaryFailure'] is None:
        result=strict(remote_targets['/var/tmp/task04-c8-current-canonical-input-producers/controls/linux-public-repair2/results.json'].read_bytes())
        if result['count']!=48 or len(result['controls'])!=48 or any(r['status']!='PASS'for r in result['controls'])or result['nativeClaims'] is not False:
            raise ValueError('EXACT_UNCHANGED48_PUBLIC_OUTCOMES')
    remaining();COMBINED_EXPORT_BYTES+=required_bytes;COMBINED_EXPORT_PATHS+=required_paths
    EXPORT_SECONDS_USED+=time.monotonic()-began
    if EXPORT_SECONDS_USED>=300:raise ValueError('CUMULATIVE_EXPORT300_LATE_TERMINAL')


def retire_successful_first_phase():
    global OWNED_ID,EXPECTED,VOLUMES
    phase('native20-exported-owned-retirement',60)
    current=inspect();validate(current,EXPECTED,started=True)
    if current['State']['Running']or current['State']['ExitCode']!=0 or current['State']['Status']!='exited':
        raise ValueError('SUCCESSFUL_OWN_TERMINAL_REQUIRED_BEFORE_RETIREMENT')
    for old in VOLUMES:
        actual=strict(call(['docker','volume','inspect',old['Name']],cap=65536))[0]
        volume(actual,old['Name'],LABELS)
        if actual!=old:raise ValueError('EXACT_OWN_VOLUME_RETIREMENT_BINDING')
    cid=OWNED_ID;name=EXPECTED['name'];labels=LABELS;volumes=[r['Name']for r in VOLUMES]
    call(['docker','container','rm',cid],cap=65536);absent('container',cid)
    for vname in volumes:
        call(['docker','volume','rm',vname],cap=65536);absent('volume',vname)
    remaining()
    save('native20-retirement.json',{'id':cid,'name':name,'labels':labels,'volumes':volumes,
        'removedOnlyKnownExactOwnedTargets':True,'successfulFiniteExportBeforeRemoval':True,
        'nativeOwnerExpiredAtTerminal':True,'crossPhaseNativeCustody':'ABSENT'})
    OWNED_PHASES.append({'phase':'native20','id':cid,'retired':True})
    OWNED_ID=None;EXPECTED=None;VOLUMES=[]


def main():
    global RUN,WHOLE_END,BUILD_BASELINE
    if sys.platform!='linux'or platform.machine()!='x86_64':raise ValueError('NATIVE_UBUNTU_X64_HOST_NO_EMULATION')
    operation=str(uuid.uuid4())
    RUN=Path(os.environ['RUNNER_TEMP'])/'task04-native-public-current';RUN.mkdir(mode=0o700)
    WHOLE_END=time.monotonic()+2100;phase('setup-acquisition',180)
    save('operation.json',{'operation':operation,'twoExclusivePID1Containers':True,
        'strictSerialOrder':['native20','export','retire','public48','export','final-cleanup'],
        'runtimeBindingsExpireAtOwnTerminal':True,'crossPhaseNativeCustody':'ABSENT'})
    save('trusted-startup.json',{'actualOriginsAfterStartup':startup_origins(),
        'entryImageAndEarlyHelperImportsTrustedSeparately':True,'-B':'WRITE_SUPPRESSION_ONLY_NOT_CACHE_READ_PROOF',
        'completeBeforeFirstUseClosure':False})
    save('host-preflight.json',host_resources(initial=True));verify_source()
    if call(['docker','ps','-q'],cap=65536).strip():raise ValueError('CURRENT_NATIVE_DAEMON_IDLE_REQUIRED')
    info=strict(call(['docker','info','--format','{"OSType":{{json .OSType}},"Architecture":{{json .Architecture}},"MemTotal":{{json .MemTotal}},"DockerRootDir":{{json .DockerRootDir}},"ServerVersion":{{json .ServerVersion}},"CgroupVersion":{{json .CgroupVersion}}}'],cap=65536))
    if info['OSType']!='linux'or info['Architecture']not in('x86_64','amd64'):raise ValueError('NATIVE_DAEMON_X64_REQUIRED')
    if os.stat(info['DockerRootDir']).st_dev!=os.stat(RUN).st_dev:raise ValueError('SINGLE_HOST_DOCKER_FILESYSTEM_ADMISSION_REQUIRED')
    save('daemon.json',info);parser=prepare_inputs()
    phase('public-image-build',720);BUILD_BASELINE=host_resources()
    image_tag='cortex-task04-native-public:'+operation
    call(['docker','build','--platform','linux/amd64','--tag',image_tag,'--file',str(S/'Dockerfile'),str(S)],720,2097152)
    image=strict(call(['docker','image','inspect',image_tag],cap=65536))[0]
    import re
    if type(image['Id'])is not str or not re.fullmatch('sha256:[0-9a-f]{64}',image['Id'])or image['Architecture']!='amd64'or image['Os']!='linux'or type(image['Size'])is not int or image['Size']>1073741824:
        raise ValueError('FRESH_NATIVE_IMAGE_IMMUTABLE_BINDING')
    save('image.json',image);BUILD_BASELINE=None
    create_phase('native20',operation,image,parser)
    native_exit=run_phase('native20',120)
    export_phase('native20')
    if native_exit!=0:raise ValueError('NATIVE20_FAILED_STICKY_PUBLIC48_NOT_STARTED')
    retire_successful_first_phase()
    create_phase('public48',operation,image,parser)
    public_exit=run_phase('public48',480)
    export_phase('public48')
    if public_exit!=0:raise ValueError('PUBLIC48_FAILED_STICKY')
    remaining()
    save('run-result.json',{'scope':'ACTUAL_NATIVE_PUBLIC_SOURCE_ONLY_IF_EXECUTED','twoSeparateOwners':True,
        'native20Exit':native_exit,'public48Exit':public_exit,'crossPhaseNativeCustody':'ABSENT',
        'combinedExportBytes':COMBINED_EXPORT_BYTES,'combinedExportPaths':COMBINED_EXPORT_PATHS,
        'original122':'HELD','whole120':'HELD','ROOT':'ABSENT','functionalTask04':False})

''' + t[end:]
t=t.replace("save('cleanup-terminal.json',current['State'])", "save('cleanup-terminal.json',{'phase':PHASE_NAME,'id':OWNED_ID,'labels':LABELS,'actual':current['State'],'nativeOwnerExpired':True})")
# Retain finite host artifact allowlist with both phase scopes.
a=t.index("    fixed={'operation.json'");b=t.index('    rows=[];total=0',a)
t=t[:a]+'''    fixed={'operation.json','host-preflight.json','host-source-before.json','trusted-startup.json','daemon.json',
           'parser-acquisition.json','input-manifest.json','image.json','run-result.json','host-failure.json',
           'cleanup-terminal.json','cleanup-failure.json','writer-stop.json','native20-retirement.json'}
    for mode in ('native20','public48'):
        fixed.update(mode+'-'+suffix+'.json'for suffix in ('expected-bindings','source-before','create-inspect','terminal','polls','export-copy'))
''' + t[b:]
a=t.index("        allowed=rel in fixed");b=t.index("\n        if not allowed",a)
t=t[:a]+'''        allowed=rel in fixed or re.fullmatch(r'command-[0-9]{4}\\.(json|stdout|stderr)',rel)or re.fullmatch(r'copy-(native20|public48)-(file-[0-9]{4}|(native|public)-export-manifest\\.json)\\.json',rel)or re.fullmatch(r'export/(native20|public48)/(file-[0-9]{4}|(native|public)-export-manifest\\.json)',rel)''' +t[b:]
p.write_text(t)
