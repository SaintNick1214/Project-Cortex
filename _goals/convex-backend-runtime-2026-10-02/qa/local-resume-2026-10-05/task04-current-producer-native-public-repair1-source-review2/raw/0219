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
from native_contract import Held,strict,identity,demand
from host_contract import validate,volume
from copy_file import copy_file,CopyFailure

S=Path(__file__).resolve().parent
RUN=None;SEQUENCE=0;SOURCE_HELD=[];OWNED_ID=None;EXPECTED=None;LABELS=None;VOLUMES=[];RECEIPTS=[];HOST_RAW_BYTES=0
WHOLE_END=None;STAGE_END=None;STAGE_NAME=None


def phase(name,seconds):
    global STAGE_END,STAGE_NAME
    STAGE_NAME=name;STAGE_END=min(WHOLE_END,time.monotonic()+seconds)


def remaining():
    left=min(WHOLE_END,STAGE_END)-time.monotonic()
    if left<=0:raise ValueError('ABSOLUTE_INFRASTRUCTURE_STAGE_OR_WHOLE_DEADLINE:'+str(STAGE_NAME))
    return left


def save(name,value):
    import json
    raw=(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
    if len(raw)>33554432:raise ValueError('FINITE_HOST_RECEIPT')
    with open(RUN/name,'xb')as out:os.chmod(out.name,0o600);out.write(raw);out.flush();os.fsync(out.fileno())


def host_resources():
    if WHOLE_END is not None:remaining()
    fs=os.statvfs(RUN)
    mem=dict(line.split(':',1)for line in Path('/proc/meminfo').read_text().splitlines())
    available=int(mem['MemAvailable'].split()[0])*1024
    value={'availableBytes':fs.f_bavail*fs.f_frsize,'availableInodes':fs.f_favail,'blockBytes':fs.f_frsize,'memoryAvailableBytes':available}
    # Eight GiB is a separate public bootstrap admission, never FULL8 admission.
    if value['availableBytes']<8589934592 or value['availableInodes']<32768 or available<1610612736:
        raise ValueError('FRESH_HOST_INFRASTRUCTURE_ADMISSION_HOLD:'+repr(value))
    return value


def call(argv,timeout=30,cap=1048576,allow_nonzero=False):
    global SEQUENCE,HOST_RAW_BYTES
    SEQUENCE+=1
    if SEQUENCE>4600:raise ValueError('FINITE_QUALIFIED_CLI_COUNT')
    name='command-'+str(SEQUENCE).zfill(4);receipt=None
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
                with open(RUN/(name+'.'+channel),'xb')as out:os.chmod(out.name,0o600);out.write(raw);out.flush();os.fsync(out.fileno())
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
    proof=strict((S/'source-manifest.json').read_bytes())
    if type(proof['fileCount'])is not int or type(proof['sourceBytes'])is not int:raise ValueError('STRICT_SOURCE_MANIFEST_INTEGERS')
    declared={r['path']for r in proof['files']}
    actual={p.relative_to(S).as_posix()for p in S.rglob('*')if not p.is_dir()}
    if actual!=declared|{'source-manifest.json'}or proof['fileCount']!=len(declared):raise ValueError('EXACT_PUBLISHED_SOURCE_SET')
    for row in proof['files']:SOURCE_HELD.append(Held(str(S/row['path']),16777216,row))
    SOURCE_HELD.append(Held(str(S/'source-manifest.json'),65536))
    save('host-source-before.json',{'scope':'FRESH_GIT_CONTENT_CURRENT_FS_BASELINE_ONLY','rows':[h.row()for h in SOURCE_HELD],'historicalCustody':'NOT_ADOPTED'})


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
    receipt=None
    try:
        receipt=copy_file(OWNED_ID,path,target,cap,expected,timeout=min(60,remaining()));remaining();return receipt
    except CopyFailure as error:receipt=error.receipt;raise
    finally:
        if receipt is not None:save('copy-'+target.name+'.json',receipt)


def main():
    global RUN,OWNED_ID,EXPECTED,LABELS,WHOLE_END
    if sys.platform!='linux'or platform.machine()!='x86_64':raise ValueError('NATIVE_UBUNTU_X64_HOST_NO_EMULATION')
    operation=str(uuid.uuid4());name='cortex-t4-native-public-'+operation[:12]
    RUN=Path(os.environ['RUNNER_TEMP'])/'task04-native-public-current';RUN.mkdir(mode=0o700)
    WHOLE_END=time.monotonic()+2100;phase('setup-acquisition',180)
    LABELS={'cortex.goal':'convex-backend-runtime-2026-10-02','cortex.operation':operation,'cortex.owner':'native-public-preparation1','cortex.scope':'PUBLIC_SOURCE_ONLY_NO_RELEASE','cortex.attempt':os.environ['GITHUB_RUN_ID']+'-'+os.environ['GITHUB_RUN_ATTEMPT']}
    save('operation.json',{'operation':operation,'name':name,'labels':LABELS,'runtimeBindingsExpireAtJobEnd':True})
    save('host-preflight.json',host_resources());verify_source()
    if call(['docker','ps','-q'],cap=65536).strip():raise ValueError('CURRENT_NATIVE_DAEMON_IDLE_REQUIRED')
    info=strict(call(['docker','info','--format','{"OSType":{{json .OSType}},"Architecture":{{json .Architecture}},"MemTotal":{{json .MemTotal}},"DockerRootDir":{{json .DockerRootDir}},"ServerVersion":{{json .ServerVersion}},"CgroupVersion":{{json .CgroupVersion}}}'],cap=65536))
    if info['OSType']!='linux'or info['Architecture']not in('x86_64','amd64'):raise ValueError('NATIVE_DAEMON_X64_REQUIRED')
    save('daemon.json',info);parser=prepare_inputs()
    phase('public-image-build',900)
    image_tag='cortex-task04-native-public:'+operation
    call(['docker','build','--platform','linux/amd64','--tag',image_tag,'--file',str(S/'Dockerfile'),str(S)],900,2097152)
    image=strict(call(['docker','image','inspect',image_tag],cap=65536))[0]
    if image['Architecture']!='amd64'or image['Os']!='linux'or not image['Id'].startswith('sha256:')or image['Size']>1073741824:raise ValueError('FRESH_NATIVE_IMAGE_IMMUTABLE_BINDING')
    save('image.json',image);mounts=[]
    phase('owned-create-binding',120)
    for src,target in [(S,'/native-source'),(S/'producer','/reviewed-source'),(S/'run_controls.py','/reviewed-control.py'),(parser,'/reviewed-typescript.js'),(S/'reference-command.json','/reviewed-command.json'),(RUN/'input-manifest.json','/reviewed-manifest.json'),(S/'bootstrap.py','/reviewed-bootstrap.py')]:
        mounts.append({'type':'bind','source':str(src),'target':target,'rw':False})
    for suffix,target in [('public','/var/tmp'),('c7','/dev/shm/cortex-native-c7-exact-identity-repair')]:
        vname=name+'-'+suffix;absent('volume',vname)
        argv=['docker','volume','create']
        for k,v in LABELS.items():argv+=['--label',k+'='+v]
        argv+=[vname];call(argv)
        vrow=strict(call(['docker','volume','inspect',vname],cap=65536))[0];point=volume(vrow,vname,LABELS);VOLUMES.append(vrow)
        mounts.append({'type':'volume','source':point,'target':target,'name':vname,'rw':True})
    absent('container',name)
    argv=['docker','create','--name',name,'--platform','linux/amd64','--memory','1g','--memory-swap','1g','--network','none','--read-only','--cap-drop','ALL','--pids-limit','128','--user','0:0','--workdir','/native-source','--ulimit','nofile=8192:8192','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=16777216,mode=0700','--env','HOME=/var/tmp/cortex-task04-native-public/home','--env','TMPDIR=/var/tmp/cortex-task04-native-public/tmp','--entrypoint','/usr/local/bin/python3.12']
    for k,v in LABELS.items():argv+=['--label',k+'='+v]
    for m in mounts:
        value='type='+m['type']+',src='+(m['name']if m['type']=='volume'else m['source'])+',dst='+m['target']
        value+=',volume-nocopy'if m['type']=='volume'else ',readonly';argv+=['--mount',value]
    argv+=[image['Id'],'-B','/native-source/native-controller.py'];OWNED_ID=call(argv,cap=65536).decode().strip()
    env=[('HOME=/var/tmp/cortex-task04-native-public/home'if v.startswith('HOME=')else 'TMPDIR=/var/tmp/cortex-task04-native-public/tmp'if v.startswith('TMPDIR=')else v)for v in image['Config']['Env']]
    EXPECTED={'id':OWNED_ID,'image':image['Id'],'name':name,'labels':LABELS,'mounts':mounts,'env':env}
    # Docker splits entrypoint and command; exact argv is checked by the pure contract.
    save('expected-bindings.json',EXPECTED);save('create-inspect.json',validate(inspect(),EXPECTED))
    for h in SOURCE_HELD:h.fence(full=True)
    for row in VOLUMES:
        current=strict(call(['docker','volume','inspect',row['Name']],cap=65536))[0]
        if current!=row:raise ValueError('EXACT_VOLUME_PRESTART_BINDING')
    if call(['docker','ps','-q'],cap=65536).strip():raise ValueError('IMMEDIATE_NATIVE_IDLE_REQUIRED')
    phase('native120-plus-public480',600);began=time.monotonic();call(['docker','start',OWNED_ID],cap=65536)
    polls=[]
    while True:
        if time.monotonic()-began>=600:raise ValueError('NATIVE120_PLUS_PUBLIC480_OUTER_BOUND')
        row=inspect();polls.append(validate(row,EXPECTED,started=True))
        if len(polls)>640:raise ValueError('FINITE_NATIVE_POLL_COUNT')
        if not row['State']['Running']:
            if row['State']['Pid']!=0:raise ValueError('TERMINAL_OWN_PID_ZERO')
            save('terminal.json',row['State']);break
        time.sleep(1)
    remaining();save('polls.json',polls);phase('finite-public-export',300)
    export=RUN/'export';export.mkdir(mode=0o700)
    export_copy('/var/tmp/cortex-task04-native-public/native-export-manifest.json',export/'native-export-manifest.json',16777216)
    mfheld=Held(str(export/'native-export-manifest.json'),16777216)
    try:os.lseek(mfheld.fd,0,os.SEEK_SET);data=strict(os.read(mfheld.fd,16777217));mfheld.fence(full=True)
    finally:mfheld.close()
    if data['scope']!='FINITE_NATIVE_PUBLIC_EXPORT_ONLY'or data['bytes']>570425344 or len(data['files'])>4160:raise ValueError('FINITE_EXACT_NATIVE_EXPORT')
    copied=[];copy_begin=time.monotonic()
    for index,row in enumerate(data['files']):
        if row['status']=='ABSENT':continue
        if time.monotonic()-copy_begin>=300:raise ValueError('FINITE_PUBLIC_EXPORT300_BOUND')
        path=row['path']
        if not(path.startswith('/var/tmp/cortex-task04-native-public/')or path.startswith('/var/tmp/task04-c8-current-canonical-input-producers/'))or '..'in Path(path).parts:raise ValueError('PUBLIC_EXACT_EXPORT_PATH')
        target=export/('file-'+str(index).zfill(4));export_copy(path,target,row['current']['bytes'],row['current'])
        h=Held(str(target),570425344,row['current']);copied.append({**h.fence(full=True),'containerPath':path,'linuxIdentityNotAdopted':True});h.close()
    save('export-copy.json',{'rows':copied,'sourceLinuxManifest':data,'bytes':sum(r['bytes']for r in copied),'historicalCustody':'NOT_ADOPTED'})
    remaining()
    save('run-result.json',{'scope':'ACTUAL_NATIVE_PUBLIC_SOURCE_ONLY_IF_EXECUTED','containerExit':strict((RUN/'terminal.json').read_bytes())['ExitCode'],'original122':'HELD','whole120':'HELD','ROOT':'ABSENT','functionalTask04':False})
    if strict((RUN/'terminal.json').read_bytes())['ExitCode']!=0:raise ValueError('NATIVE_PUBLIC_SUBJECT_CONTROL_FAILURE')


def cleanup():
    """Only exact own IDs/labels; uncertainty never authorizes numeric PID cleanup."""
    if OWNED_ID is None:return
    current=inspect();validate(current,EXPECTED,started=True)
    if current['State']['Running']:
        call(['docker','stop','--time','5',OWNED_ID],30,65536);current=inspect();validate(current,EXPECTED,started=True)
    if current['State']['Running']or current['State']['Pid']!=0:raise ValueError('OWN_CONTAINER_TERMINAL_UNKNOWN')
    save('cleanup-terminal.json',current['State'])
    # Retain the terminal owned container/volumes until runner teardown. No removal
    # can destroy failed raw outputs. CI teardown expires every physical identity.


def artifact_manifest():
    import re
    fixed={'operation.json','host-preflight.json','host-source-before.json','daemon.json','parser-acquisition.json',
           'input-manifest.json','image.json','expected-bindings.json','create-inspect.json','terminal.json','polls.json',
           'export-copy.json','run-result.json','host-failure.json','cleanup-terminal.json','cleanup-failure.json','writer-stop.json'}
    rows=[];total=0
    for p in sorted(RUN.rglob('*')):
        if p.is_dir()or p.name=='typescript.js':continue
        rel=p.relative_to(RUN).as_posix()
        allowed=rel in fixed or re.fullmatch(r'command-[0-9]{4}\.(json|stdout|stderr)',rel)or re.fullmatch(r'copy-(file-[0-9]{4}|native-export-manifest\.json)\.json',rel)or re.fullmatch(r'export/(file-[0-9]{4}|native-export-manifest\.json)',rel)
        if not allowed:raise ValueError('UNKNOWN_HOST_ARTIFACT_MEMBER:'+rel)
        h=Held(str(p),570425344)
        try:current=h.fence(full=True)
        finally:h.close()
        total+=current['bytes']
        if total>671088640 or len(rows)>=16000:raise ValueError('COMBINED_EXACT_PUBLIC_ARTIFACT_CAP')
        rows.append({'relativePath':rel,'current':current})
    save('public-artifact-manifest.json',{'scope':'FINITE_PUBLIC_CONTENT_EXPORT_NOT_RELEASE','files':rows,'bytes':total,'maxBytes':671088640,'runtimeBindingsExpireAtJobEnd':True,'ROOT':'ABSENT','original122':'HELD'})


if __name__=='__main__':
    primary=None
    try:main()
    except BaseException as error:
        primary=repr(error)
        if RUN is not None:save('host-failure.json',{'scope':'FAILED_NATIVE_PUBLIC_SOURCE_ONLY','error':primary,'original122':'HELD','ROOT':'ABSENT'})
    finally:
        if RUN is not None:
            # Separate cleanup allowance: it cannot turn a failed/late body into PASS.
            WHOLE_END=time.monotonic()+60;phase('owned-cleanup-and-final-custody',60)
            try:cleanup()
            except BaseException as error:
                primary=primary or repr(error)
                save('cleanup-failure.json',{'error':repr(error),'authority':'UNKNOWN_DISPATCH_HOLD_NO_FOREIGN_ACTION'})
            for h in SOURCE_HELD:
                try:h.fence(full=True)
                except BaseException as error:primary=primary or repr(error)
                h.close()
            try:remaining()
            except BaseException as error:primary=primary or repr(error)
            save('writer-stop.json',{'scope':'SOURCE_ONLY_NO_RELEASE','sourceWritersClosed':True,'primary':primary,'runtimeBindingsExpireAtJobEnd':True,'original122':'HELD','ROOT':'ABSENT'})
            try:artifact_manifest()
            except BaseException as error:
                primary=primary or repr(error)
                print('FINITE_ARTIFACT_MANIFEST_FAILURE:'+repr(error),file=sys.stderr)
            try:remaining()
            except BaseException as error:primary=primary or repr(error)
    if primary:sys.exit(1)
