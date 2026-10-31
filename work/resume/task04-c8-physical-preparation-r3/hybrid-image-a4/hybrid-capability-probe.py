"""Infrastructure-only native-controller/x64-node process compatibility."""
import hashlib
import json
import os
from pathlib import Path
import platform
import select
import signal
import subprocess
import sys
import time

FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s): return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def full(path):
    path=Path(path).resolve(strict=True); fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        pre=identity(os.fstat(fd)); h=hashlib.sha256(); size=0; head=b''
        while b:=os.read(fd,1048576):
            if not head: head=b[:64]
            h.update(b); size+=len(b)
        post=identity(os.fstat(fd)); pathpost=identity(os.lstat(path))
        if pre!=post or post!=pathpost: raise ValueError('INFRA_SOURCE_DRIFT')
        return {'path':str(path),'bytes':size,'sha256':h.hexdigest(),'PRE':pre,'POST':post,'pathPOST':pathpost,'ELFHeaderHex':head.hex()}
    finally: os.close(fd)
def resource(required):
    r={n:Path('/sys/fs/cgroup',n).read_text() for n in ('memory.max','memory.current','memory.events')}
    r['literalReserveBytes']=int(r['memory.max'])-int(r['memory.current'])
    if r['literalReserveBytes']<required: raise ValueError('INFRA_LITERAL_RESERVE_HOLD')
    return r

def main():
    os.umask(0o077); os.chmod('/tmp',0o700); Path('/tmp/home').mkdir(mode=0o700)
    result={'scope':'INFRASTRUCTURE_HYBRID_COMPATIBILITY_ONLY_NO_TASK04_SUBJECTS','uid':os.getuid(),'gid':os.getgid(),'machine':platform.machine(),'pythonVersion':sys.version,'env':dict(os.environ),'python':full('/usr/local/bin/python3.12'),'node':full('/usr/local/bin/node'),'source':full(__file__),'resourcesPRE':resource(134217728),'esbuildExecuted':False,'original122Executed':False,'originalEight20AndWhole120':'HELD_UNCHANGED'}
    owner=os.pidfd_open(1); result['ownerPidfdInfo']=Path('/proc/self/fdinfo',str(owner)).read_text(); result['ownerPidfdSignalZeroActualReturn']=signal.pidfd_send_signal(owner,0,None,0); os.close(owner)
    if platform.machine()!='aarch64' or not sys.version.startswith('3.12.15'): raise ValueError('PROSPECTIVE_NATIVE_PYTHON_REQUIRED')
    observations=[]
    for label,argv in [('nodeMetadata',['/usr/local/bin/node','-p','JSON.stringify({version:process.version,arch:process.arch,platform:process.platform})']),('npmVersion',['/usr/local/bin/node',str(Path('/usr/local/bin/npm').resolve()),'--version'])]:
        before=resource(536870912); run=subprocess.run(argv,capture_output=True,timeout=15)
        observations.append({'label':label,'argv':argv,'exitCode':run.returncode,'stdoutHex':run.stdout.hex(),'stderrHex':run.stderr.hex(),'resourcePRE':before,'resourcePOST':resource(536870912)})
    result['versionObservations']=observations
    node_meta=json.loads(bytes.fromhex(observations[0]['stdoutHex']))
    if node_meta!={'version':'v24.15.0','arch':'x64','platform':'linux'} or bytes.fromhex(observations[1]['stdoutHex']).strip()!=b'12.2.0' or any(r['exitCode'] for r in observations): raise ValueError('PROSPECTIVE_TOOLCHAIN_METADATA_CONFLICT')
    # The empty inspected program is paused before evaluation. It is an owned
    # infrastructure child, never any candidate/recipe/compiler/private subject.
    argv=['/usr/local/bin/node','--inspect-brk=127.0.0.1:0','-e','']
    result['childResourcePRE']=resource(536870912)
    child=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    pidfd=None
    try:
        pidfd=os.pidfd_open(child.pid,0)
        poll=select.poll(); poll.register(child.stderr.fileno(),select.POLLIN)
        if not poll.poll(5000): raise ValueError('INFRA_NODE_INSPECTOR_READINESS_HOLD')
        ready=os.read(child.stderr.fileno(),8192)
        cmd=Path('/proc',str(child.pid),'cmdline').read_bytes()
        proc=Path('/proc',str(child.pid),'stat').read_text()
        maps=Path('/proc',str(child.pid),'maps').read_text()
        result['child']={'argv':argv,'pid':child.pid,'rawArgvHex':cmd.hex(),'rawArgvEqualsRequested':cmd.split(b'\0')[:-1]==[a.encode() for a in argv],'procStat':proc,'pidfdInfo':Path('/proc/self/fdinfo',str(pidfd)).read_text(),'inspectorReadinessHex':ready.hex(),'mappedSources':maps,'literalMapVisibility':[{'literal':v[5],'exists':Path(v[5]).exists()} for line in maps.splitlines() if len(v:=line.split(maxsplit=5))==6 and v[5].startswith('/')]}
        result['child']['pidfdTermActualReturn']=signal.pidfd_send_signal(pidfd,signal.SIGTERM,None,0)
        out,err=child.communicate(timeout=5)
        result['child'].update(exitCode=child.returncode,stdoutHex=out.hex(),remainingStderrHex=err.hex())
        terminal=select.poll(); terminal.register(pidfd,select.POLLIN|select.POLLHUP|select.POLLERR)
        result['child']['terminalPidfdPollActual']=terminal.poll(0)
    finally:
        if child.poll() is None and pidfd is not None:
            signal.pidfd_send_signal(pidfd,signal.SIGKILL,None,0); child.communicate(timeout=5)
        if pidfd is not None: os.close(pidfd)
    result['resourcePOST']=resource(134217728)
    result['status']='INFRA_HYBRID_CAPABILITIES_OBSERVED_NOT_RUNTIME_BINDING_RELEASE'
    print(json.dumps(result,indent=2),flush=True)

if __name__=='__main__': main()
