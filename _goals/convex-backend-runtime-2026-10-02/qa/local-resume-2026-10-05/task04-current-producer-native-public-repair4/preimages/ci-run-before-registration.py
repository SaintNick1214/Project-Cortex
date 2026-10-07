"""Future reviewed native public run. Merely reading/importing this file dispatches nothing."""
import hashlib
import os
from pathlib import Path
import platform
import select
import signal
import sys
import time
import uuid

from bounded_process import bounded_command,CollectionFailure
from native_contract import Held,strict,identity,demand,host_demand,proc
from host_contract import validate,volume
from copy_file import copy_file,CopyFailure
from source_manifest import open_manifest,fence_directories
from native_export import validate_manifest
from public_export_contract import validate_public,validate_public_outcome

S=Path(__file__).resolve().parent
RUN=None;SEQUENCE=0;SOURCE_HELD=[];SOURCE_DIRS=[];OWNED_ID=None;EXPECTED=None;LABELS=None;VOLUMES=[];RECEIPTS=[];HOST_RAW_BYTES=0
WHOLE_END=None;STAGE_END=None;STAGE_NAME=None
BUILD_BASELINE=None;HOST_TOTAL_BYTES=0
PHASE_NAME=None;COMBINED_EXPORT_BYTES=0;COMBINED_EXPORT_PATHS=0;EXPORT_SECONDS_USED=0;OWNED_PHASES=[]


def phase(name,seconds):
    global STAGE_END,STAGE_NAME
    STAGE_NAME=name;STAGE_END=min(WHOLE_END,time.monotonic()+seconds)


def remaining():
    left=min(WHOLE_END,STAGE_END)-time.monotonic()
    if left<=0:raise ValueError('ABSOLUTE_INFRASTRUCTURE_STAGE_OR_WHOLE_DEADLINE:'+str(STAGE_NAME))
    return left


def save(name,value):
    global HOST_TOTAL_BYTES
    import json
    raw=(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
    if len(raw)>33554432:raise ValueError('FINITE_HOST_RECEIPT')
    if HOST_TOTAL_BYTES+len(raw)>671088640:raise ValueError('COMBINED_HOST_WRITE_CAP_BEFORE_WRITE')
    with open(RUN/name,'xb')as out:os.chmod(out.name,0o600);out.write(raw);out.flush();os.fsync(out.fileno())
    HOST_TOTAL_BYTES+=len(raw)


def host_resources(initial=False):
    if WHOLE_END is not None:remaining()
    fs=os.statvfs(RUN)
    mem=dict(line.split(':',1)for line in Path('/proc/meminfo').read_text().splitlines())
    available=int(mem['MemAvailable'].split()[0])*1024
    value={'availableBytes':fs.f_bavail*fs.f_frsize,'availableInodes':fs.f_favail,'blockBytes':fs.f_frsize,'memoryAvailableBytes':available}
    required=host_demand(fs.f_frsize);value['required']=required;value['initial']=initial
    bytes_required=required['initialAvailableBytesRequired']if initial else required['maintainedAvailableBytesRequired']
    inodes_required=required['initialAvailableInodesRequired']if initial else required['maintainedAvailableInodesRequired']
    if value['availableBytes']<bytes_required or value['availableInodes']<inodes_required or available<1610612736:
        raise ValueError('FRESH_HOST_INFRASTRUCTURE_ADMISSION_HOLD:'+repr(value))
    if BUILD_BASELINE is not None:
        value['buildCurrentFootprintBytes']=max(0,BUILD_BASELINE['availableBytes']-value['availableBytes'])
        value['buildCurrentFootprintInodes']=max(0,BUILD_BASELINE['availableInodes']-value['availableInodes'])
        if value['buildCurrentFootprintBytes']>required['buildFootprintBytesMax']or value['buildCurrentFootprintInodes']>required['buildFootprintInodesMax']:
            raise ValueError('FINITE_MEASURED_IMAGE_BUILD_FOOTPRINT_HOLD:'+repr(value))
    return value


def call(argv,timeout=30,cap=1048576,allow_nonzero=False):
    global SEQUENCE,HOST_RAW_BYTES,HOST_TOTAL_BYTES
    SEQUENCE+=1
    if SEQUENCE>4600:raise ValueError('FINITE_QUALIFIED_CLI_COUNT')
    name='command-'+str(SEQUENCE).zfill(4);receipt=None
    if HOST_TOTAL_BYTES+2*cap+33554432>671088640:raise ValueError('FINITE_COMMAND_RAW_AND_RECEIPT_ADMISSION_BEFORE_DISPATCH')
    try:
        receipt=bounded_command(argv,cap,cap,min(timeout,remaining()),env={k:os.environ[k]for k in ('PATH','HOME','TMPDIR')if k in os.environ},
                                native_pidfd=True,progress=host_resources)
        remaining()
        if receipt['exit']!=0 and not allow_nonzero:raise CollectionFailure('QUALIFIED_HOST_COMMAND_NONZERO',receipt)
        return receipt.get('stdout',b'')
    except CollectionFailure as error:receipt=error.receipt;raise
    finally:
        if receipt is not None:
            for channel in ('stdout','stderr'):
                raw=receipt.pop(channel,b'');HOST_RAW_BYTES+=len(raw)
                if HOST_TOTAL_BYTES+len(raw)>671088640:raise ValueError('COMBINED_HOST_WRITE_CAP_BEFORE_WRITE')
                with open(RUN/(name+'.'+channel),'xb')as out:os.chmod(out.name,0o600);out.write(raw);out.flush();os.fsync(out.fileno())
                HOST_TOTAL_BYTES+=len(raw)
            save(name+'.json',receipt);RECEIPTS.append(name)
            if HOST_RAW_BYTES>67108864:raise ValueError('COMBINED_HOST_RAW_CAPTURE_CAP')


def inspect():
    data=strict(call(['docker','container','inspect',OWNED_ID],cap=65536))
    if len(data)!=1:raise ValueError('EXACT_INSPECT_ONE')
    return data[0]


def absent(kind,name):
    raw=call(['docker',kind,'inspect',name],cap=65536,allow_nonzero=True)
    terminal=strict((RUN/('command-'+str(SEQUENCE).zfill(4)+'.json')).read_bytes())
    error=(RUN/('command-'+str(SEQUENCE).zfill(4)+'.stderr')).read_bytes()
    if terminal['exit']!=1 or raw.strip()!=b'[]'or name.encode()not in error or b'No such'not in error:
        raise ValueError('EXACT_ABSENCE_NOT_ESTABLISHED')


def verify_source():
    proof,manifest_held,directories=open_manifest(S)
    SOURCE_HELD.append(manifest_held);SOURCE_DIRS.extend(directories)
    for row in proof['files']:SOURCE_HELD.append(Held(str(S/row['path']),16777216,row))
    fence_directories(SOURCE_DIRS)
    save('host-source-before.json',{'scope':'FRESH_GIT_CONTENT_CURRENT_FS_BASELINE_ONLY','rows':[h.row()for h in SOURCE_HELD],'directories':SOURCE_DIRS,'historicalCustody':'NOT_ADOPTED'})


def prepare_inputs():
    parser=RUN/'typescript.js';save('parser-acquisition.json',strict(call([sys.executable,'-B',str(S/'acquire-parser.py'),str(parser)],60,65536)))
    names=('ast_parser.mjs','build_reference_contract.py','canonical_entry.py','consumer_schema.mjs','consumer_wiring.mjs','literal-destination-map.json','native_boundary.py','producers.py','reference-contract.json','reference-input-observations.json','strict_io.py')
    rows=[]
    for name in names:
        p=S/'producer'/name;raw=p.read_bytes();rows.append({'source':'/reviewed-source/'+name,'destination':'source/'+name,'hostSource':str(p),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
    for p,guest,target in [(S/'run_controls.py','/reviewed-control.py','controls/run_controls.py'),(parser,'/reviewed-typescript.js','public-parser/typescript.js'),(S/'reference-command.json','/reviewed-command.json','source/reference-command.json')]:
        h=Held(str(p),16777216);SOURCE_HELD.append(h);rows.append({'source':guest,'destination':target,'hostSource':str(p),'bytes':h.size,'sha256':h.digest})
    save('input-manifest.json',{'scope':'PROPOSED_PUBLIC_SYNTHETIC_CONTROLS_ONLY','files':rows,'fileCount':14,'inputBytes':sum(r['bytes']for r in rows),'historicalCustody':'NOT_ADOPTED','DockerExecuted':False,'priorProposal':'repair2 exact source/input assertions unchanged; this operation uses a fresh native filesystem'})
    SOURCE_HELD.append(Held(str(RUN/'input-manifest.json'),65536))
    return parser


def export_copy(path,target,cap,expected=None):
    global HOST_TOTAL_BYTES
    receipt=None
    if HOST_TOTAL_BYTES+cap+33554432>671088640:raise ValueError('COMBINED_HOST_COPY_AND_RECEIPT_CAP_BEFORE_WRITE')
    try:
        receipt=copy_file(OWNED_ID,path,target,cap,expected,timeout=min(60,remaining()));remaining();return receipt
    except CopyFailure as error:receipt=error.receipt;raise
    finally:
        if target.exists():HOST_TOTAL_BYTES+=target.stat().st_size
        if receipt is not None:save('copy-'+PHASE_NAME+'-'+target.name+'.json',receipt)


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
    polls=[];owner=None;owner_fd=None;primary=None;terminal=None;close_result=None;owner_fd_closed=False
    try:
        call(['docker','start',OWNED_ID],cap=65536)
        while True:
            remaining()
            row=inspect();polls.append(validate(row,EXPECTED,started=True))
            if len(polls)>640:raise ValueError('FINITE_PHASE_POLL_COUNT')
            if row['State']['Running']:
                pid=row['State']['Pid']
                if owner is None:
                    before=proc(pid);owner_fd=os.pidfd_open(pid,0)
                    opened=proc(pid)
                    if before!=opened:raise ValueError('PHASE_OWNER_PIDFD_ACQUISITION_DRIFT')
                    expected_script='/native-source/native-controller.py'if mode=='native20'else '/reviewed-bootstrap.py'
                    argv=('/usr/local/bin/python3.12'+chr(0)+'-B'+chr(0)+expected_script+chr(0)).encode().hex()
                    if opened['rawArgvHex']!=argv:raise ValueError('EXACT_PHASE_OWNER_KERNEL_ARGV')
                    status=Path('/proc',str(pid),'status').read_text()
                    nsline=next(line for line in status.splitlines()if line.startswith('NSpid:'))
                    if int(nsline.split()[-1])!=1:raise ValueError('ACTUAL_PHASE_NAMESPACE_PID1')
                    owner={**opened,'namespacePID':1,'containerID':OWNED_ID,'labels':LABELS,
                        'scope':'POST_START_OBSERVED_OWNER_NOT_BEFORE_FIRST_USE_STARTUP_PROOF'}
                elif pid!=owner['pid']or proc(pid)['startTime']!=owner['startTime']:
                    raise ValueError('CURRENT_PHASE_OWNER_REPLACED')
                signal.pidfd_send_signal(owner_fd,0)
                poll=select.poll();poll.register(owner_fd,select.POLLIN)
                if poll.poll(0):raise ValueError('RUNNING_PHASE_OWNER_ALREADY_TERMINAL')
            else:
                if row['State']['Pid']!=0 or row['State']['Status']!='exited':raise ValueError('EXACT_PHASE_TERMINAL')
                if owner_fd is None:raise ValueError('PHASE_TERMINAL_WITHOUT_OBSERVED_CURRENT_OWNER_HOLD')
                poll=select.poll();poll.register(owner_fd,select.POLLIN)
                if not poll.poll(0):raise ValueError('PHASE_OWNER_PIDFD_TERMINAL_NOT_READY')
                remaining();terminal=row['State'];break
            time.sleep(min(1,remaining()))
    except BaseException as error:
        primary=error
    finally:
        if owner_fd is not None:
            try:
                close_result=os.close(owner_fd);owner_fd_closed=True
            except BaseException as error:primary=primary or error
        try:remaining()
        except BaseException as error:primary=primary or error
        save(mode+'-terminal.json',{'actual':terminal,'elapsedSeconds':time.monotonic()-began,
            'originalPhaseBound':seconds,'owner':owner,'ownerPidfdCloseReturn':close_result,
            'closeCompleted':owner_fd_closed,
            'nativeOwnerExpiredAtTerminal':terminal is not None,'noCrossPhaseLiveCustody':True,
            'outcome':'FAILED'if primary else 'IN_WINDOW','failure':repr(primary)if primary else None})
        save(mode+'-polls.json',polls)
    if primary:raise primary
    return terminal['ExitCode']


def public_terminal_fence(process_exit):
    if type(process_exit) is not int or not 0<=process_exit<=255:raise ValueError('STRICT_PUBLIC_PROCESS_EXIT')
    row=inspect();validate(row,EXPECTED,started=True)
    state=row['State']
    if state['Running'] is not False or type(state['Pid']) is not int or state['Pid']!=0 or state['Status']!='exited' or type(state['ExitCode']) is not int or state['ExitCode']!=process_exit:
        raise ValueError('PUBLIC_PROCESS_TERMINAL_EXPORT_INCONSISTENCY')
    remaining();return row

def export_phase(mode,process_exit=None):
    global COMBINED_EXPORT_BYTES,COMBINED_EXPORT_PATHS,EXPORT_SECONDS_USED
    left=300-EXPORT_SECONDS_USED
    if left<=0:raise ValueError('CUMULATIVE_EXPORT300_EXHAUSTED')
    phase(mode+'-export',left);began=time.monotonic()
    export=RUN/'export'/mode;export.mkdir(parents=True,mode=0o700)
    remote=('/var/tmp/cortex-task04-native-public/native-export-manifest.json'if mode=='native20'else
        '/var/tmp/task04-c8-current-canonical-input-producers/public-export-manifest.json')
    target=export/('native-export-manifest.json'if mode=='native20'else 'public-export-manifest.json')
    public_terminal=None
    if mode=='public48':public_terminal=public_terminal_fence(process_exit)
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
    copied=[];remote_targets={};remote_pins={}
    for index,row in enumerate(rows):
        if row['status']=='ABSENT':continue
        remaining();path=row['path']
        target=export/('file-'+str(index).zfill(4))
        export_copy(path,target,row['current']['bytes'],row['current'])
        h=Held(str(target),570425344,row['current'])
        try:copied.append({**h.fence(full=True),'containerPath':path,'nativeIdentityNotAdoptedByHost':True})
        finally:h.close()
        remote_targets[path]=target;remote_pins[path]=row['current']
    save(mode+'-export-copy.json',{'rows':copied,'remoteManifest':data,'separatePhase':mode,
        'nativeOwnerAlreadyExpired':True,'historicalCustody':'NOT_ADOPTED'})
    if mode=='public48':
        result=None
        if type(process_exit) is int and process_exit==0 and data['primaryFailure'] is None:
            path='/var/tmp/task04-c8-current-canonical-input-producers/controls/linux-public-repair2/results.json'
            if path not in remote_targets:raise ValueError('EXACT_UNCHANGED48_PUBLIC_RESULT_REQUIRED')
            # This independently held read retains the transport byte/hash pin and
            # fences full bytes and all nine fields before and after strict parse.
            h=Held(str(remote_targets[path]),1048576,remote_pins[path])
            try:
                os.lseek(h.fd,0,os.SEEK_SET);raw=os.read(h.fd,1048577)
                if len(raw)!=h.size:raise ValueError('PUBLIC_RESULT_FULL_EOF')
                h.fence(full=True);result=strict(raw);h.fence(full=True)
            finally:h.close()
        remaining()
        if public_terminal_fence(process_exit)!=public_terminal:raise ValueError('PUBLIC_TERMINAL_EXPORT_RACE')
        validate_public_outcome(data,process_exit,result)
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
    distro_raw=Path('/etc/os-release').read_text()
    distro=dict(line.split('=',1)for line in distro_raw.splitlines()if '='in line and not line.startswith('#'))
    if distro.get('ID','').strip(chr(34))!='ubuntu'or distro.get('VERSION_ID','').strip(chr(34))!='24.04':
        raise ValueError('FRESH_ACTUAL_UBUNTU2404_HOST_REQUIRED')
    operation=str(uuid.uuid4())
    RUN=Path(os.environ['RUNNER_TEMP'])/'task04-native-public-current';RUN.mkdir(mode=0o700)
    WHOLE_END=time.monotonic()+2100;phase('setup-acquisition',180)
    save('operation.json',{'operation':operation,'twoExclusivePID1Containers':True,
        'strictSerialOrder':['native20','export','retire','public48','export','final-cleanup'],
        'runtimeBindingsExpireAtOwnTerminal':True,'crossPhaseNativeCustody':'ABSENT','actualHostOsReleaseRaw':distro_raw})
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
    export_phase('public48',process_exit=public_exit)
    if public_exit!=0:raise ValueError('PUBLIC48_FAILED_STICKY')
    remaining()
    save('run-result.json',{'scope':'ACTUAL_NATIVE_PUBLIC_SOURCE_ONLY_IF_EXECUTED','twoSeparateOwners':True,
        'native20Exit':native_exit,'public48Exit':public_exit,'crossPhaseNativeCustody':'ABSENT',
        'combinedExportBytes':COMBINED_EXPORT_BYTES,'combinedExportPaths':COMBINED_EXPORT_PATHS,
        'original122':'HELD','whole120':'HELD','ROOT':'ABSENT','functionalTask04':False})


def cleanup():
    """Only exact own IDs/labels; uncertainty never authorizes numeric PID cleanup."""
    if OWNED_ID is None:return
    current=inspect();validate(current,EXPECTED,started=True)
    if current['State']['Running']:
        call(['docker','stop','--time','5',OWNED_ID],30,65536);current=inspect();validate(current,EXPECTED,started=True)
    if current['State']['Running']or current['State']['Pid']!=0:raise ValueError('OWN_CONTAINER_TERMINAL_UNKNOWN')
    save('cleanup-terminal.json',{'phase':PHASE_NAME,'id':OWNED_ID,'labels':LABELS,'actual':current['State'],'nativeOwnerExpired':True})
    # Retain the terminal owned container/volumes until runner teardown. No removal
    # can destroy failed raw outputs. CI teardown expires every physical identity.


def artifact_manifest():
    import re
    fixed={'operation.json','host-preflight.json','host-source-before.json','trusted-startup.json','daemon.json',
           'parser-acquisition.json','input-manifest.json','image.json','run-result.json','host-failure.json',
           'cleanup-terminal.json','cleanup-failure.json','writer-stop.json','native20-retirement.json'}
    for mode in ('native20','public48'):
        fixed.update(mode+'-'+suffix+'.json'for suffix in ('expected-bindings','source-before','create-inspect','terminal','polls','export-copy'))
    rows=[];total=0
    for p in sorted(RUN.rglob('*')):
        if p.is_dir()or p.name=='typescript.js':continue
        rel=p.relative_to(RUN).as_posix()
        allowed=rel in fixed or re.fullmatch(r'command-[0-9]{4}\.(json|stdout|stderr)',rel)or re.fullmatch(r'copy-(native20|public48)-(file-[0-9]{4}|(native|public)-export-manifest\.json)\.json',rel)or re.fullmatch(r'export/(native20|public48)/(file-[0-9]{4}|(native|public)-export-manifest\.json)',rel)
        if not allowed:raise ValueError('UNKNOWN_HOST_ARTIFACT_MEMBER:'+rel)
        h=Held(str(p),570425344)
        try:current=h.fence(full=True)
        finally:h.close()
        total+=current['bytes']
        if total>671088640 or len(rows)>=16000:raise ValueError('COMBINED_EXACT_PUBLIC_ARTIFACT_CAP')
        rows.append({'relativePath':rel,'current':current})
    save('public-artifact-manifest.json',{'scope':'FINITE_PUBLIC_CONTENT_EXPORT_NOT_RELEASE','files':rows,'bytes':total,'maxBytes':671088640,'runtimeBindingsExpireAtJobEnd':True,'ROOT':'ABSENT','original122':'HELD'})


class EntryFailure(RuntimeError):
    """Every owned cleanup failure stays visible after all close attempts."""
    def __init__(self,primary,failures):
        super().__init__('SOURCE_RUN_FAILED_STICKY')
        self.primaryFailure=primary
        self.failures=failures


def entry():
    global WHOLE_END,SOURCE_HELD
    primary=None;failures=[]
    def record(stage,error):
        nonlocal primary
        if primary is None:primary=error
        failures.append((stage,error))
    def attempt(stage,fn):
        try:return fn()
        except BaseException as error:record(stage,error)
    try:
        try:main()
        except BaseException as error:
            record('main',error)
            if RUN is not None:
                attempt('host-failure-report',lambda:save('host-failure.json',{'scope':'FAILED_NATIVE_PUBLIC_SOURCE_ONLY','error':repr(error),'original122':'HELD','ROOT':'ABSENT'}))
    finally:
        # Report, clock or container-cleanup failures cannot skip the owned source lifetime.
        try:
            if RUN is not None:
                def cleanup_window():
                    global WHOLE_END
                    WHOLE_END=time.monotonic()+60;phase('owned-cleanup-and-final-custody',60)
                attempt('cleanup-window',cleanup_window)
                try:cleanup()
                except BaseException as error:
                    record('owned-cleanup',error)
                    attempt('cleanup-failure-report',lambda:save('cleanup-failure.json',{'error':repr(error),'authority':'UNKNOWN_DISPATCH_HOLD_NO_FOREIGN_ACTION'}))
        finally:
            owned=SOURCE_HELD;SOURCE_HELD=[]
            for h in owned:
                attempt('source-fence',lambda h=h:h.fence(full=True))
                attempt('source-close',h.close)
            attempt('source-directory-fence',lambda:fence_directories(SOURCE_DIRS))
        if RUN is not None:
            attempt('remaining-before-stop',remaining)
            attempt('writer-stop-report',lambda:save('writer-stop.json',{'scope':'SOURCE_ONLY_NO_RELEASE','sourceWritersClosed':not any(stage=='source-close'for stage,error in failures),'primary':repr(primary)if primary is not None else None,'failures':[{'stage':stage,'error':repr(error)}for stage,error in failures],'runtimeBindingsExpireAtJobEnd':True,'original122':'HELD','ROOT':'ABSENT'}))
            attempt('artifact-manifest',artifact_manifest)
            attempt('remaining-after-artifact',remaining)
    if primary is not None:raise EntryFailure(primary,failures)from primary
    return 0


if __name__=='__main__':
    try:entry()
    except EntryFailure as error:
        print(str(error),file=sys.stderr)
        sys.exit(1)
