"""Native infrastructure capability/source capture only. No Task04 subject dispatch."""
import hashlib
import json
import os
from pathlib import Path
import platform
import resource
import select
import selectors
import signal
import stat
import subprocess
import sys
import time
import traceback

ROOT=Path('/phase'); OUT=ROOT/'export'; BACK=OUT/'source-backings'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
CAP=536870912; RECEIPT_CAP=16777216
retained=[]; aliases=[]; directories=[]; byte_total=0; snapshots=[]; reserve_min=None; check_count=0
def identity(s): return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def measure(required=134217728,save=False):
    global reserve_min,check_count
    maxraw=Path('/sys/fs/cgroup/memory.max').read_text().strip(); current=Path('/sys/fs/cgroup/memory.current').read_text().strip()
    if not maxraw.isdecimal() or int(maxraw)!=6442450944 or not current.isdecimal(): raise ValueError('ACTUAL_FINITE_SIX_GIB_CGROUP')
    swapmax=Path('/sys/fs/cgroup/memory.swap.max').read_text().strip()
    swapcurrent=Path('/sys/fs/cgroup/memory.swap.current').read_text().strip()
    if swapmax!='0' or not swapcurrent.isdecimal(): raise ValueError('ACTUAL_MATCHED_SIX_GIB_MEMORY_SWAP_NO_EXTRA_CAPACITY')
    reserve=int(maxraw)-int(current); reserve_min=reserve if reserve_min is None else min(reserve_min,reserve); check_count+=1
    if reserve<required: raise ValueError('LITERAL_MEASURED_RESERVE_HOLD')
    disk=os.statvfs(ROOT)
    if disk.f_frsize>4096 or disk.f_bavail*disk.f_frsize<CAP+RECEIPT_CAP or disk.f_favail<10000: raise ValueError('FINITE_CAPABILITY_DISK_OR_INODE_HOLD')
    value={'memoryMax':maxraw,'memoryCurrent':current,'memorySwapMax':swapmax,'memorySwapCurrent':swapcurrent,'literalReserveBytes':reserve,'requiredReserveBytes':required,'diskStatvfs':{k:getattr(disk,k) for k in ('f_frsize','f_blocks','f_bavail','f_files','f_favail','f_namemax')}}
    if save:
        for key,path,maximum in [('memoryStat','/sys/fs/cgroup/memory.stat',16384),('memoryEvents','/sys/fs/cgroup/memory.events',4096),('meminfo','/proc/meminfo',16384),('mountinfo','/proc/self/mountinfo',65536)]:
            value[key]=Path(path).read_text()
            if len(value[key].encode())>maximum: raise ValueError('FINITE_RESOURCE_SCHEMA_BOUND')
        line=[l for l in value['mountinfo'].splitlines() if l.split()[4]=='/phase']
        temp=[l for l in value['mountinfo'].splitlines() if l.split()[4]=='/tmp']
        if len(line)!=1 or len(temp)!=1 or any(l.split(' - ')[1].split()[0] in ('tmpfs','ramfs') for l in line+temp): raise ValueError('EXPLICIT_DISK_BACKED_PHASE_AND_TEMP_MOUNTS')
        snapshots.append(value)
    return value

def write_new(path,raw):
    if len(raw)>RECEIPT_CAP: raise ValueError('BOUNDED_RECEIPT_EXPORT_HOLD')
    with open(path,'xb') as f: os.chmod(path,0o600); f.write(raw); f.flush(); os.fsync(f.fileno())

def owner(pid):
    raw=Path('/proc',str(pid),'stat').read_text(); fields=raw[raw.rfind(')')+2:].split()
    return {'pid':pid,'startTime':fields[19],'rawArgvHex':Path('/proc',str(pid),'cmdline').read_bytes().hex()}

def capture(path):
    global byte_total
    path=Path(path)
    if path.is_symlink(): alias(path)
    canonical=path.resolve(strict=True)
    prior=next((r for r in retained if r['record']['path']==str(canonical)),None)
    if prior: return prior['record']
    fd=os.open(canonical,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        st=os.fstat(fd); before=identity(st)
        if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1: raise ValueError('RUNTIME_REGULAR_SINGLE_LINK_SOURCE')
        rawpath=BACK/('pending-'+str(len(retained)))
        digest=hashlib.sha256(); size=0
        with open(rawpath,'xb') as out:
            os.chmod(rawpath,0o600)
            while block:=os.read(fd,1048576):
                size+=len(block); byte_total+=len(block)
                if byte_total>CAP: raise ValueError('COMPLETE_RUNTIME_BACKING_EXPORT_CAPACITY_HOLD')
                digest.update(block); out.write(block); measure()
            out.flush(); os.fsync(out.fileno())
        after=identity(os.fstat(fd)); post=identity(os.lstat(canonical))
        if before!=after or after!=post or size!=st.st_size: raise ValueError('SOURCE_FULL_BYTES_EOF_HELD_NINE_DRIFT')
        record={'path':str(canonical),'bytes':size,'sha256':digest.hexdigest(),'PRE':before,'POST':after,'pathPOST':post,'EOF':True,'rawExactBacking':str(rawpath.relative_to(OUT))}
        retained.append({'fd':fd,'record':record}); fd=None
        with open(rawpath,'rb') as out:
            pre=identity(os.fstat(out.fileno())); check=hashlib.sha256(); checked=0
            while block:=out.read(1048576): check.update(block); checked+=len(block); measure()
            returned=os.posix_fadvise(out.fileno(),0,0,os.POSIX_FADV_DONTNEED); post=identity(os.fstat(out.fileno()))
            if checked!=size or check.hexdigest()!=digest.hexdigest() or returned is not None or pre!=post or post!=identity(os.lstat(rawpath)): raise ValueError('OWNED_BACKING_FULL_EOF_FSYNC_ADVICE_NINE')
        record['rawBackingIdentity']=post
        record['actualOwnedBackingAdviceReturn']=returned
        return record
    finally:
        if fd is not None: os.close(fd)

def alias(path):
    path=Path(path)
    if any(r['path']==str(path) for r in aliases): return
    fd=os.open(path,os.O_PATH|os.O_NOFOLLOW)
    try:
        pre=identity(os.fstat(fd)); target=os.fsencode(os.readlink('',dir_fd=fd)); post=identity(os.fstat(fd)); pathpost=identity(os.lstat(path))
        if pre!=post or post!=pathpost: raise ValueError('LITERAL_RUNTIME_ALIAS_NINE')
        aliases.append({'path':str(path),'targetHex':target.hex(),'PRE':pre,'POST':post,'pathPOST':pathpost,'fd':fd}); fd=None
    finally:
        if fd is not None: os.close(fd)

def members(path):
    path=Path(path); before=identity(os.lstat(path)); names=sorted(os.listdir(path)); after=identity(os.lstat(path))
    if before!=after: raise ValueError('FINITE_DIRECTORY_SOURCE_MEMBERSHIP_DRIFT')
    directories.append({'path':str(path),'PRE':before,'POST':after,'names':names})

def mapped(pid):
    result=set()
    raw=Path('/proc',str(pid),'maps').read_text()
    for line in raw.splitlines():
        fields=line.split(maxsplit=5)
        if len(fields)==6 and fields[5].startswith('/'):
            literal=fields[5].replace('\\040',' ').replace('\\011','\t').replace('\\012','\n').replace('\\134','\\')
            if literal.endswith(' (deleted)') or not Path(literal).is_file(): raise ValueError('FULL_MAPPED_SOURCE_UNREADABLE:'+literal)
            result.add(literal)
    return {'pid':pid,'rawMaps':raw,'paths':sorted(result)}

def final_verify():
    for held in retained:
        record=held['record']; fd=held['fd']; before=identity(os.fstat(fd)); os.lseek(fd,0,0); digest=hashlib.sha256(); size=0
        while block:=os.read(fd,1048576): digest.update(block); size+=len(block); measure()
        if before!=record['PRE'] or identity(os.fstat(fd))!=before or identity(os.lstat(record['path']))!=before or size!=record['bytes'] or digest.hexdigest()!=record['sha256']: raise ValueError('FINAL_RETAINED_FULL_BYTES_NINE')
    for row in aliases:
        if identity(os.fstat(row['fd']))!=row['PRE'] or identity(os.lstat(row['path']))!=row['PRE'] or os.fsencode(os.readlink('',dir_fd=row['fd'])).hex()!=row['targetHex']: raise ValueError('FINAL_LITERAL_ALIAS_NINE')
    for row in directories:
        if identity(os.lstat(row['path']))!=row['PRE'] or sorted(os.listdir(row['path']))!=row['names']: raise ValueError('FINAL_DIRECTORY_MEMBERSHIP_NINE')

def main():
    os.umask(0o077); OUT.mkdir(mode=0o700); BACK.mkdir(mode=0o700)
    if os.getuid()!=0 or platform.machine()!='x86_64' or sys.version_info[:2]!=(3,12) or os.environ.get('PATH')!='/usr/local/bin:/usr/bin:/bin' or os.environ.get('HOME')!='/phase/home' or os.environ.get('TMPDIR')!='/tmp': raise ValueError('PROSPECTIVE_NATIVE_SOURCE_ONLY_RUNTIME')
    soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
    if soft<8192:
        if hard<8192: raise ValueError('FINITE_RUNTIME_FD_CLOSURE_CAPACITY_HOLD')
        resource.setrlimit(resource.RLIMIT_NOFILE,(8192,hard))
    began=time.monotonic(); measure(536870912,True)
    oldowner=owner(1); ownerfd=os.pidfd_open(1,0); ownerpoll=select.poll(); ownerpoll.register(ownerfd,select.POLLIN)
    node=None; nodefd=None; failure=None; closeerrors=[]; result={}
    try:
        owner_signal0=signal.pidfd_send_signal(ownerfd,0); actualownerpoll=ownerpoll.poll(0)
        if actualownerpoll: raise ValueError('NATIVE_OWNER_ALREADY_TERMINAL')
        env=dict(os.environ)
        for args,expected in [(['/usr/local/bin/node','--version'],b'v24.15.0\n'),(['/usr/local/bin/node','-p','process.platform+" "+process.arch'],b'linux x64\n'),(['/usr/local/bin/node','/usr/local/lib/node_modules/npm/bin/npm-cli.js','--version'],b'12.2.0\n')]:
            measure(536870912); got=subprocess.run(args,capture_output=True,env=env,timeout=30,check=True)
            if got.stdout!=expected or got.stderr: raise ValueError('EXACT_ACTUAL_VERSION_PROBE')
        args=['/usr/local/bin/node','--inspect-brk=127.0.0.1:0','-e','']
        measure(536870912); node=subprocess.Popen(args,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        nodefd=os.pidfd_open(node.pid,0); poll=select.poll(); poll.register(nodefd,select.POLLIN)
        wait=selectors.DefaultSelector(); wait.register(node.stderr,selectors.EVENT_READ)
        try:
            if not wait.select(timeout=15): raise ValueError('INFRASTRUCTURE_NODE_INSPECTOR_READINESS_HOLD')
            inspector=os.read(node.stderr.fileno(),65537)
            if len(inspector)>65536 or b'Debugger listening on ws://127.0.0.1:' not in inspector: raise ValueError('OWNED_PAUSED_EMPTY_NODE_READINESS')
        finally: wait.close()
        nodeowner=owner(node.pid)
        if bytes.fromhex(nodeowner['rawArgvHex'])!=b'\0'.join(os.fsencode(a) for a in args)+b'\0': raise ValueError('UNMODIFIED_NATIVE_KERNEL_ARGV_REQUIRED')
        node_signal0=signal.pidfd_send_signal(nodefd,0)
        if poll.poll(0): raise ValueError('OWNED_NODE_ALREADY_TERMINAL')
        maps=[mapped(os.getpid()),mapped(1),mapped(node.pid)]
        sources={sys.executable,'/usr/local/bin/node','/source/native-owner.py','/source/native-capability.py','/source/Dockerfile','/source/bootstrap-npm.py','/source/ci-run.py','/source/ci-source-manifest.json','/source/task04-c8-native-infrastructure.yml.proposed','/source/derive-finite-demand-attempt3.py','/source/materialize-cohort-proposed.py'}
        for item in maps: sources.update(item['paths'])
        imports=[]
        for name,module in sorted(sys.modules.items()):
            origin=getattr(module,'__file__',None); cached=getattr(module,'__cached__',None)
            imports.append({'module':name,'origin':origin,'cache':cached})
            for path in (origin,cached):
                if path and Path(path).is_file(): sources.add(path)
        npm=Path('/usr/local/lib/node_modules/npm')
        for path in sorted(npm.rglob('*')):
            if path.is_dir(): members(path)
            elif path.is_symlink(): alias(path); sources.add(str(path))
            elif path.is_file(): sources.add(str(path))
            else: raise ValueError('FINITE_NPM_SOURCE_SPECIAL_MEMBER')
        members(npm)
        for path in ('/usr/local/bin','/usr/bin','/bin'):
            if Path(path).is_symlink(): alias(path)
            members(Path(path).resolve(strict=True))
        for path in ('/usr/local/bin/npm','/usr/local/bin/npx','/usr/local/bin/python','/usr/local/bin/python3','/opt/cortex-c8/python/bin'):
            if Path(path).is_symlink(): alias(path)
            sources.add(str(Path(path).resolve(strict=True)))
        for path in sorted(sources): capture(path)
        final_verify()
        if owner(1)!=oldowner or owner(node.pid)!=nodeowner or poll.poll(0) or ownerpoll.poll(0): raise ValueError('RETAINED_NATIVE_PROCESS_LIFECYCLE_DRIFT')
        measure(536870912,True)
        node_sigterm=signal.pidfd_send_signal(nodefd,signal.SIGTERM)
        stdout,stderr=node.communicate(timeout=15)
        terminal=poll.poll(0)
        if node.returncode!=-signal.SIGTERM or not terminal or stdout or len(stderr)>65536: raise ValueError('OWNED_NATIVE_PIDFD_TERMINAL_DISPOSITION')
        result={'status':'NATIVE_INFRASTRUCTURE_CAPABILITY_AND_SOURCE_CAPTURE_COMPLETE_NOT_SUBJECT_QUALIFICATION','nodeVersion':'v24.15.0','npmVersion':'12.2.0','pythonVersion':sys.version,'architecture':platform.machine(),'environment':env,'ownerPRE':oldowner,'ownerPOST':owner(1),'actualOwnerPidfdOpen':True,'actualOwnerSignal0Return':None,'actualOwnerLivePoll':actualownerpoll,'nodeRequestedArgv':args,'nodeKernelBinding':nodeowner,'actualNodePidfdOpen':True,'actualNodeSignal0Return':None,'actualNodeTerminationSignal':'SIGTERM_VIA_PIDFD','actualNodeExit':node.returncode,'actualNodeTerminalPoll':terminal,'rawNodeInspector':inspector.decode(),'maps':maps,'PythonImportOriginsAndCaches':imports,'files':[r['record'] for r in retained],'aliases':[{k:v for k,v in a.items() if k!='fd'} for a in aliases],'directories':directories,'resourceSnapshots':snapshots,'literalReserveMinimum':reserve_min,'literalResourceCheckCount':check_count,'rawSourceBackingBytes':byte_total,'elapsedSeconds':time.monotonic()-began,'subjectImports':False,'cohortsMaterialized':False,'originalGates':'122_EIGHT20_WHOLE120_FULLRPC_501_301_UNCHANGED','futureBinding':'EXPIRED_WHEN_THIS_OWNER_JOB_ENDS; NEW_PHASE_ALL9_CAPTURE_AND_INDEPENDENT_RELEASE_REQUIRED','ROOT':'ABSENT'}
        result['actualOwnerSignal0Return']=owner_signal0
        result['actualNodeSignal0Return']=node_signal0
        result['actualNodeTerminationSignalReturn']=node_sigterm
        disk=os.statvfs(ROOT)
        result['futureFiniteSourcePreparationAdmissionDiagnostic']={'requiredBytes':48565865408,'requiredAdditionalInodes':317987,'actualAvailableBytes':disk.f_bavail*disk.f_frsize,'actualAvailableInodes':disk.f_favail,'bytesFitAtThisObservation':disk.f_bavail*disk.f_frsize>=48565865408,'inodesFitAtThisObservation':disk.f_favail>=317987,'release':'HELD_REGARDLESS; this job performs capability only and ends this runtime binding','sameFilesystemExistingGitImagesInputs':'already reduce measured available space; future new inputs and updated helper bytes require their own exact admission','canonicalSubjectClosureDemand':'UNKNOWN_UNTIL_SEVEN_COMPLETE_INPUTS; HELD'}
    except BaseException as error:
        failure=error
        result={'status':'FAILED_INFRASTRUCTURE_CAPTURE_PRESERVED','type':type(error).__name__,'message':str(error),'traceback':traceback.format_exc(),'ownerPRE':oldowner,'filesCapturedBeforeFailure':[r['record'] for r in retained],'rawSourceBackingBytes':byte_total,'subjectImports':False,'cohortsMaterialized':False,'ROOT':'ABSENT'}
    finally:
        if node and node.poll() is None:
            try:
                if nodefd is None: raise ValueError('NO_PIDFD_AUTHORITY_FOR_INFRASTRUCTURE_CHILD_CLEANUP')
                signal.pidfd_send_signal(nodefd,signal.SIGKILL); node.communicate(timeout=15)
            except BaseException as error: closeerrors.append({'operation':'OWNED_CHILD_CLEANUP','error':str(error)})
        for fd in [r['fd'] for r in retained]+[a['fd'] for a in aliases]+[ownerfd]+([nodefd] if nodefd is not None else []):
            try: os.close(fd)
            except OSError as error: closeerrors.append({'operation':'ACTUAL_FD_CLOSE','fd':fd,'error':str(error)})
        result['actualLifecycleCloseErrors']=closeerrors
        write_new(OUT/'native-capability.json',(json.dumps(result,indent=2)+'\n').encode())
    if failure is not None: raise failure
    if closeerrors: raise ValueError('ACTUAL_LIFECYCLE_CLOSE_FAILURE')
    print(json.dumps({'status':result['status'],'files':len(retained),'rawSourceBackingBytes':byte_total,'subjects':False}))

if __name__=='__main__': main()
