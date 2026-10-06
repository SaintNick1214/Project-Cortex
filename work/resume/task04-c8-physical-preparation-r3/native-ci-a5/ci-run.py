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

def call(args, maximum=16777216, check=True):
    result=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=900)
    if len(result.stdout)>maximum or len(result.stderr)>1048576: raise ValueError('BOUNDED_INFRASTRUCTURE_COMMAND_OUTPUT_HOLD')
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
        build=call(['docker','build','--platform','linux/amd64','--progress','plain','--tag',tag,str(source)],maximum=1048576)
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
        capture=call(['docker','exec',name,'/usr/local/bin/python3.12','/source/native-capability.py'],check=False)
        new_receipt(output/'capture-command.json',{'argv':['docker','exec',name,'/usr/local/bin/python3.12','/source/native-capability.py'],'exit':capture.returncode,'stdout':capture.stdout.decode(errors='replace'),'stderr':capture.stderr.decode(errors='replace')})
        # Copy only the exact finite capability export namespace. Export identities
        # are new content-copy observations, never the container's all9 authority.
        export=output/'export'; export.mkdir(mode=0o700)
        producer=subprocess.Popen(['docker','exec',name,'tar','-C','/phase/export','-cf','-','.'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        seen=set(); total=0; files=0
        try:
            with tarfile.open(fileobj=producer.stdout,mode='r|') as archive:
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
            if producer.stdout.read(1): raise ValueError('EXPORT_TRAILING_BYTES')
            exitcode=producer.wait(timeout=30); errors=producer.stderr.read(1048577)
            if exitcode or len(errors)>1048576: raise ValueError('EXPORT_PRODUCER_TERMINAL_FAILURE')
        finally:
            if producer.poll() is None: producer.kill(); producer.wait(timeout=30)
            producer.stdout.close(); producer.stderr.close()
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
        if started:
            stop=call(['docker','stop','--time','10',name],check=False)
            terminal=json.loads(call(['docker','inspect',name]).stdout)[0]
            new_receipt(output/'owner-terminal.json',{'dockerStopExit':stop.returncode,'inspect':terminal,'runtimeBinding':'EXPIRED; new container identities require new capture/review','noContainerOrVolumeDeletion':True})
            if stop.returncode or terminal['State']['Running']:
                if primary is None: raise ValueError('OWNER_STOP_TERMINAL_FAILURE')
                primary.add_note('SECONDARY_NATIVE_OWNER_STOP_FAILURE')
    print(str(output))

if __name__=='__main__': main()
