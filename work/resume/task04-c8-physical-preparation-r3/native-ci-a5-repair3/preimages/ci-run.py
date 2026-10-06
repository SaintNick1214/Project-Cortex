"""Dispatch only reviewed infrastructure capture. Never dispatch Task04 subjects."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import subprocess
import sys
import tarfile
import time
from types import SimpleNamespace

from bounded_process import BoundedFileStream, CollectionFailure, bounded_command

CALL_DIR=None
CALL_COUNT=0
CALL_BYTES=0
JOB_DEADLINE=None
CLEANUP_MODE=False

def record_command(receipt):
    global CALL_COUNT,CALL_BYTES
    if CALL_DIR is None: return
    if CALL_COUNT>=64: raise ValueError('FINITE_BOOTSTRAP_COMMAND_COUNT_HOLD')
    prefix='command-'+str(CALL_COUNT).zfill(5); CALL_COUNT+=1
    row={k:v for k,v in receipt.items() if k not in ('stdout','stderr')}
    for name in ('stdout','stderr'):
        raw=receipt.get(name,b'')
        CALL_BYTES+=len(raw)
        if CALL_BYTES>134217728: raise ValueError('FINITE_BOOTSTRAP_COMMAND_RAW_ALLOCATION_HOLD')
        path=CALL_DIR/(prefix+'.'+name)
        with open(path,'xb') as out: os.chmod(path,0o600); out.write(raw); out.flush(); os.fsync(out.fileno())
        row[name]={'path':path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'contentCopyNotRuntimeAuthority':True}
    if len((json.dumps(row,indent=2)+'\n').encode())>65536: raise ValueError('FINITE_COMMAND_METADATA_64KIB_HOLD')
    new_receipt(CALL_DIR/(prefix+'.json'),row)


def call(args, maximum=1048576, check=True, timeout=30):
    # Bootstrap owns this newly created Popen handle. This is not a substitute
    # for original/native Task04 pidfd authority; native controller uses its
    # mandatory measured pidfd mode and has no numeric-PID fallback.
    if JOB_DEADLINE is not None and not CLEANUP_MODE:
        timeout=min(timeout,JOB_DEADLINE-time.monotonic()-45)
        if timeout<=0: raise ValueError('INFRASTRUCTURE_JOB_DEADLINE_CLEANUP_RESERVE_HOLD')
    try:
        receipt=bounded_command(args,stdout_limit=maximum,stderr_limit=1048576,timeout=timeout,native_pidfd=False)
    except CollectionFailure as error:
        record_command(error.receipt)
        raise
    record_command(receipt)
    result=SimpleNamespace(returncode=receipt['exit'],stdout=receipt['stdout'],stderr=receipt['stderr'],lifecycle=receipt)
    if check and result.returncode:
        raise RuntimeError('INFRASTRUCTURE_COMMAND_FAILED:'+json.dumps({'argv':args,'exit':result.returncode,'stderr':result.stderr.decode(errors='replace')}))
    return result


def new_receipt(path,value):
    raw=(json.dumps(value,indent=2)+'\n').encode()
    if len(raw)>16777216: raise ValueError('BOUNDED_INFRASTRUCTURE_HOST_RECEIPT')
    with open(path,'xb') as out: os.chmod(path,0o600); out.write(raw); out.flush(); os.fsync(out.fileno())

def main():
    os.umask(0o077)
    if platform.system()!='Linux' or platform.machine()!='x86_64': raise ValueError('ACTUAL_NATIVE_X64_GUEST_REQUIRED')
    suffix=os.environ['GITHUB_RUN_ID']+'-'+os.environ['GITHUB_RUN_ATTEMPT']
    if not re.fullmatch(r'[0-9]+-[0-9]+',suffix): raise ValueError('FINITE_OWNED_CI_NAMESPACE')
    source=Path(__file__).resolve().parent; output=Path(os.environ['RUNNER_TEMP'])/('task04-c8-native-'+suffix)
    output.mkdir(mode=0o700,exist_ok=False)
    global CALL_DIR,JOB_DEADLINE,CLEANUP_MODE
    JOB_DEADLINE=time.monotonic()+1050
    CALL_DIR=output/'command-receipts'; CALL_DIR.mkdir(mode=0o700)
    manifest=json.loads((source/'ci-source-manifest.json').read_text())
    if sum(row['bytes'] for row in manifest['files'])>1048576 or len(manifest['files'])>64: raise ValueError('FINITE_CI_HELPER_SOURCE_CAPACITY_HOLD')
    for row in manifest['files']:
        path=source/row['path']; raw=path.read_bytes()
        if path.resolve()!=path or len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']: raise ValueError('EXACT_REVIEWED_CI_SOURCE_BYTES')
    if manifest['allowedEffect']!='INFRASTRUCTURE_NATIVE_CAPABILITY_AND_SOURCE_CAPTURE_ONLY': raise ValueError('FINITE_REVIEWED_EFFECT')
    tag='cortex-task04-c8-native:'+suffix; name='cortex-task04-c8-native-'+suffix
    phase=name+'-phase'; temp=name+'-tmp'; started=False; primary=None
    try:
        disk=os.statvfs(output)
        pre={'hostArchitecture':platform.machine(),'uname':call(['uname','-a']).stdout.decode(),'diskStatvfs':{k:getattr(disk,k) for k in ('f_frsize','f_bavail','f_files','f_favail')},'sourceManifestSHA256':hashlib.sha256((source/'ci-source-manifest.json').read_bytes()).hexdigest(),'commit':os.environ['GITHUB_SHA'],'branch':os.environ['GITHUB_REF'],'scope':'INFRASTRUCTURE_ONLY_NO_COHORTS_OR_SUBJECTS'}
        if disk.f_frsize>4096 or disk.f_bavail*disk.f_frsize<2147483648 or disk.f_favail<10000: raise ValueError('FINITE_IMAGE_AND_EXPORT_DISK_PREFLIGHT_HOLD')
        new_receipt(output/'host-preflight.json',pre)
        # Public reviewed build inputs; no registry publishing, private mounts,
        # installation lifecycle, or original seven-package/compiler execution.
        build=call(['docker','build','--platform','linux/amd64','--progress','plain','--tag',tag,str(source)],maximum=1048576,timeout=600)
        (output/'image-build.stdout').write_bytes(build.stdout)
        (output/'image-build.stderr').write_bytes(build.stderr)
        image=json.loads(call(['docker','image','inspect',tag]).stdout)[0]
        if image['Architecture']!='amd64' or image['Os']!='linux': raise ValueError('ACTUAL_NATIVE_IMAGE_PLATFORM')
        new_receipt(output/'native-image.json',image)
        for volume in (phase,temp):
            if call(['docker','volume','inspect',volume],check=False).returncode==0: raise ValueError('DISTINCT_VOLUME_NO_REUSE')
            call(['docker','volume','create','--label','cortex.scope=task04-c8-native-infrastructure',volume])
        args=['docker','run','--detach','--name',name,'--platform','linux/amd64','--network','none','--read-only','--memory','6g','--memory-swap','6g','--pids-limit','128','--user','0:0','--mount','type=volume,src='+phase+',dst=/phase,volume-nocopy','--mount','type=volume,src='+temp+',dst=/tmp,volume-nocopy','--mount','type=bind,src='+str(source)+',dst=/source,readonly','--env','HOME=/phase/home','--env','TMPDIR=/tmp','--env','PATH=/usr/local/bin:/usr/bin:/bin','--env','PYTHONDONTWRITEBYTECODE=1','--entrypoint','/usr/local/bin/python3.12',image['Id'],'/source/native-owner.py']
        call(args); started=True
        before=json.loads(call(['docker','inspect',name]).stdout)[0]
        if before['Image']!=image['Id'] or not before['State']['Running'] or (before['HostConfig']['Memory']!=6442450944 or before['HostConfig']['MemorySwap']!=6442450944): raise ValueError('ACTUAL_RETAINED_OWNER_IMAGE_CGROUP')
        new_receipt(output/'owner-before.json',before)
        capture=call(['docker','exec',name,'/usr/local/bin/python3.12','/source/native-capability.py'],check=False,timeout=240)
        new_receipt(output/'capture-command.json',{'argv':['docker','exec',name,'/usr/local/bin/python3.12','/source/native-capability.py'],'exit':capture.returncode,'stdout':capture.stdout.decode(errors='replace'),'stderr':capture.stderr.decode(errors='replace')})
        # Copy only the exact finite capability export namespace. Export identities
        # are new content-copy observations, never the container's all9 authority.
        export=output/'export'; export.mkdir(mode=0o700)
        producer=None;export_stream=None;export_primary=None
        seen=set(); total=0; files=0
        try:
            export_timeout=min(60,JOB_DEADLINE-time.monotonic()-45)
            if export_timeout<=0: raise ValueError('EXPORT_DEADLINE_CLEANUP_RESERVE_HOLD')
            producer=subprocess.Popen(['docker','exec',name,'tar','-C','/phase/export','-cf','-','.'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            export_stream=BoundedFileStream(producer,stdout_limit=564133888,stderr_limit=1048576,timeout=export_timeout)
            with tarfile.open(fileobj=export_stream,mode='r|') as archive:
                for member in archive:
                    literal=member.name.removeprefix('./'); parts=PurePosixPath(literal).parts
                    if literal in ('','.') and member.isdir(): continue
                    allowed=literal=='native-capability.json' or (len(parts)==2 and parts[0]=='source-backings' and re.fullmatch(r'pending-[0-9]+',parts[1]))
                    if literal=='source-backings' and member.isdir(): (export/literal).mkdir(mode=0o700); continue
                    if not allowed or not member.isfile() or literal in seen or '..' in parts or literal.startswith('/'): raise ValueError('STRICT_FINITE_CAPABILITY_EXPORT_MEMBERSHIP')
                    seen.add(literal); files+=1; total+=member.size
                    if total>553648128 or files>10000 or member.size>536870912: raise ValueError('FINITE_EXPORT_CAPACITY_HOLD')
                    target=export/literal; target.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
                    with archive.extractfile(member) as stream, open(target,'xb') as out:
                        os.chmod(target,0o600); copied=0
                        while block:=stream.read(1048576): out.write(block); copied+=len(block)
                        if copied!=member.size: raise ValueError('EXPORT_FULL_MEMBER_EOF')
                        out.flush(); os.fsync(out.fileno())
            transport=export_stream.finish()
            if transport['exit'] or transport['stderr']: raise ValueError('EXPORT_PRODUCER_TERMINAL_FAILURE')
            new_receipt(output/'export-transport.json',{k:(v.hex() if isinstance(v,bytes) else v) for k,v in transport.items()})
        except BaseException as error:
            export_primary=error
            partial=export_stream.partial() if export_stream is not None else {'stdoutPrefix':b'','stderr':b''}
            partial.update(failure=str(error),scope='OWNED_BOOTSTRAP_EXPORT_NOT_TASK04_AUTHORITY')
            raise
        finally:
            cleanup_errors=[]
            try:
                if producer is not None and producer.poll() is None:
                    producer.terminate()
                    try: producer.wait(timeout=2)
                    except subprocess.TimeoutExpired: producer.kill(); producer.wait(timeout=3)
            except BaseException as error:
                cleanup_errors.append({'operation':'OWNED_EXPORT_CREATED_POPEN_CLEANUP','error':repr(error)})
            export_close=export_stream.close() if export_stream is not None else []
            if export_stream is None and producer is not None:
                for pipe in (producer.stdout,producer.stderr):
                    if pipe is not None:
                        try: pipe.close()
                        except BaseException as error: export_close.append({'operation':'OWNED_EXPORT_PIPE_CLOSE','error':repr(error)})
            if export_primary is not None:
                partial.update(terminal=(producer.poll() is not None if producer is not None else False),exit=(producer.returncode if producer is not None else None),closeErrors=export_close,cleanupErrors=cleanup_errors)
                new_receipt(output/'export-transport-failure.json',{k:(v.hex() if isinstance(v,bytes) else v) for k,v in partial.items()})
            if export_close or cleanup_errors:
                if export_primary is not None: export_primary.add_note('SECONDARY_EXPORT_CLEANUP_FAILURE:'+repr(export_close+cleanup_errors))
                else: raise ValueError('EXPORT_TRANSPORT_CLEANUP_FAILURE:'+repr(export_close+cleanup_errors))
        result=json.loads((export/'native-capability.json').read_text())
        for row in result.get('files',result.get('filesCapturedBeforeFailure',[])):
            path=export/row['rawExactBacking']; digest=hashlib.sha256(); size=0
            with open(path,'rb') as stream:
                while block:=stream.read(1048576): digest.update(block); size+=len(block)
            if size!=row['bytes'] or digest.hexdigest()!=row['sha256']: raise ValueError('EXPORTED_EXACT_SOURCE_BACKING_HASH_SIZE')
        after=json.loads(call(['docker','inspect',name]).stdout)[0]
        if after['State']['Pid']!=before['State']['Pid'] or after['State']['StartedAt']!=before['State']['StartedAt'] or not after['State']['Running']: raise ValueError('SAME_NATIVE_HOLDER_IDENTITY_DURING_CAPTURE')
        new_receipt(output/'owner-after-capture.json',after)
        new_receipt(output/'export-content-copy.json',{'sourceContainer':name,'sourceImage':image['Id'],'files':files,'bytes':total,'allSourceBackingsHashSizeVerified':True,'physicalCustodyRestored':False,'futureBulkRelease':'HELD','subjects':False})
        if capture.returncode: raise ValueError('ACTUAL_NATIVE_INFRASTRUCTURE_CAPTURE_FAILED_PRESERVED')
    except BaseException as error:
        primary=error
        new_receipt(output/'host-failure.json',{'type':type(error).__name__,'message':str(error),'subjects':False,'cohorts':False,'ROOT':'ABSENT'})
        raise
    finally:
        CLEANUP_MODE=True
        if started:
            stop=call(['docker','stop','--time','10',name],check=False)
            terminal=json.loads(call(['docker','inspect',name]).stdout)[0]
            new_receipt(output/'owner-terminal.json',{'dockerStopExit':stop.returncode,'inspect':terminal,'runtimeBinding':'EXPIRED; new container identities require new capture/review','noContainerOrVolumeDeletion':True})
            if stop.returncode or terminal['State']['Running']:
                if primary is None: raise ValueError('OWNER_STOP_TERMINAL_FAILURE')
                primary.add_note('SECONDARY_NATIVE_OWNER_STOP_FAILURE')
    print(str(output))

if __name__=='__main__': main()
