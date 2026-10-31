"""Infrastructure-only actual Linux process/tempfile capability probe."""
import hashlib
import json
import os
from pathlib import Path
import platform
import select
import signal
import stat
import sys

FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')
def identity(s):
    return {'schema': 'FS_IDENTITY_DECIMAL_V1', 'fields': {k: str(getattr(s, 'st_'+k)) for k in FIELDS}}

def main():
    os.umask(0o077)
    tmp = Path('/tmp')
    os.chmod(tmp, 0o700)
    fd = os.open(__file__, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before=identity(os.fstat(fd)); digest=hashlib.sha256(); count=0
        while block:=os.read(fd,1048576): digest.update(block); count+=len(block)
        after=identity(os.fstat(fd)); path_after=identity(os.lstat(__file__))
        if before!=after or after!=path_after: raise ValueError('CAPABILITY_PROBE_SOURCE_DRIFT')
    finally: os.close(fd)
    result={'scope':'INFRASTRUCTURE_CAPABILITY_ONLY_NO_TOOLCHAIN_PRODUCT_QUALIFICATION','machine':platform.machine(),'pythonVersion':sys.version,'uid':os.getuid(),'gid':os.getgid(),'TMPDIR':os.environ.get('TMPDIR'),'source':{'path':__file__,'bytes':count,'sha256':digest.hexdigest(),'PRE':before,'POST':after,'pathPOST':path_after},'mountinfo':Path('/proc/self/mountinfo').read_text(),'tempDirectoryIdentity':identity(os.lstat(tmp)),'resource':{n:Path('/sys/fs/cgroup',n).read_text() for n in ('memory.max','memory.current','memory.stat','memory.events')},'subjects':False}
    try: result['ownerCmdlineHex']=Path('/proc/1/cmdline').read_bytes().hex(); result['ownerStat']=Path('/proc/1/stat').read_text()
    except BaseException as error: result['procError']={'type':type(error).__name__,'message':str(error)}
    pidfd=None
    try:
        pidfd=os.pidfd_open(1,0)
        result['pidfdOpenActual']='PASS'
        result['pidfdInfo']=Path('/proc/self/fdinfo',str(pidfd)).read_text()
        poller=select.poll(); poller.register(pidfd,select.POLLIN|select.POLLHUP|select.POLLERR)
        result['liveOwnerPidfdPollActual']=poller.poll(0)
        result['pidfdSignalZeroActualReturn']=signal.pidfd_send_signal(pidfd,0,None,0)
        result['pidfdSignalZeroActual']='PASS'
    except BaseException as error: result['pidfdError']={'type':type(error).__name__,'errno':getattr(error,'errno',None),'message':str(error)}
    finally:
        if pidfd is not None: result['actualPidfdCloseReturn']=os.close(pidfd)
    result['resourcePOST']={n:Path('/sys/fs/cgroup',n).read_text() for n in ('memory.max','memory.current','memory.events')}
    print(json.dumps(result,indent=2),flush=True)

if __name__=='__main__': main()
