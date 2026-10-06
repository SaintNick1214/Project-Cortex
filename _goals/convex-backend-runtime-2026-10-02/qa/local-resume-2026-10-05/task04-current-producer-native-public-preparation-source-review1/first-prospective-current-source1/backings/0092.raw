"""Proposed native PID1 public controller; no production canonical release."""
import hashlib
import os
from pathlib import Path
import platform
import select
import signal
import stat
import sys
import time

from bounded_process import bounded_command, CollectionFailure
from native_contract import Held, identity, literal_maps, proc, resource, strict
from native_export import manifest as export_manifest
from source_manifest import open_manifest

BASE=Path('/var/tmp/cortex-task04-native-public')
ROOT=Path('/var/tmp/task04-c8-current-canonical-input-producers')
C7ROOT=Path('/dev/shm/cortex-native-c7-exact-identity-repair')
S=Path('/native-source')
HELD=[];CLOSES=[];RESOURCE_ROWS=[];RAW_BYTES=0;CREATED=False
SOURCE_DEADLINE=None;DIRECTORIES=[]


def write(name,value):
    import json
    raw=(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
    if len(raw)>16777216:raise ValueError('FINITE_NATIVE_RECEIPT')
    with open(BASE/name,'xb')as out:os.chmod(BASE/name,0o600);out.write(raw);out.flush();os.fsync(out.fileno())


def resources(initial=False,node=False):
    observed={name:Path('/sys/fs/cgroup',name).read_text()for name in ('memory.max','memory.current','memory.swap.max')}
    fs=os.statvfs(BASE)
    snapshot={'rawCgroup':observed,'availableBytes':fs.f_bavail*fs.f_frsize,'availableInodes':fs.f_favail,'blockBytes':fs.f_frsize}
    try:
        maximum,current,swap=(int(observed[k])for k in ('memory.max','memory.current','memory.swap.max'))
        snapshot.update(memoryMax=maximum,memoryCurrent=current,swapMax=swap,literalReserve=maximum-current)
        row=resource(fs,maximum,current,swap,node,initial)
    except BaseException as error:
        RESOURCE_ROWS.append({'snapshot':snapshot,'failure':repr(error),'monotonic':time.monotonic()});raise
    RESOURCE_ROWS.append({**row,'monotonic':time.monotonic()})
    if len(RESOURCE_ROWS)>8192:raise ValueError('FINITE_RAW_RESOURCE_ROWS')
    return row


def capture(path,cap=268435456,expected=None):
    global RAW_BYTES
    if SOURCE_DEADLINE is not None and time.monotonic()>=SOURCE_DEADLINE:raise ValueError('OWN_NATIVE_PHASE_ABSOLUTE120')
    h=Held(path,cap,expected);HELD.append(h)
    if len(HELD)>4096:raise ValueError('FINITE_RUNTIME_SOURCE_CLOSURE')
    dest=BASE/'python-raw'/h.digest
    if not dest.exists():
        RAW_BYTES+=h.size
        if RAW_BYTES>268435456:raise ValueError('PYTHON_RAW_HALF_COMBINED_BOUND')
        os.lseek(h.fd,0,os.SEEK_SET)
        with open(dest,'xb')as out:
            os.chmod(dest,0o600)
            while block:=os.read(h.fd,65536):out.write(block)
            out.flush();os.fsync(out.fileno())
            if hasattr(os,'posix_fadvise'):os.posix_fadvise(out.fileno(),0,0,os.POSIX_FADV_DONTNEED)
        if hasattr(os,'posix_fadvise'):
            os.posix_fadvise(h.fd,0,0,os.POSIX_FADV_DONTNEED)
    backing=Held(str(dest),h.size,{'bytes':h.size,'sha256':h.digest})
    try:rawrow=backing.fence(full=True)
    finally:backing.close()
    h.fence(full=True);resources()
    return {**h.row(),'beforeByteBacking':{**rawrow,'encoding':'RAW_EXACT_PREIMAGE'}}


def owner_fence(owner,pidfd,node=False):
    now=proc(os.getpid())
    if {k:now[k]for k in ('pid','startTime','pgid','sid','rawArgvHex')}!={k:owner[k]for k in ('pid','startTime','pgid','sid','rawArgvHex')}:
        raise ValueError('CURRENT_NATIVE_OWNER_BINDING')
    if signal.pidfd_send_signal(pidfd,0) is not None:raise ValueError('ACTUAL_SELF_SIGNAL_RETURN')
    poll=select.poll();poll.register(pidfd,select.POLLIN)
    if poll.poll(0):raise ValueError('CURRENT_NATIVE_OWNER_TERMINAL')
    for h in HELD:h.fence()
    for row in DIRECTORIES:
        if identity(os.lstat(row['path']))!=row['identity']or sorted(os.listdir(row['path']))!=row['members']:
            raise ValueError('CURRENT_DIRECTORY_MEMBERSHIP_NINE_DRIFT')
    resources(node=node)


def command(name,argv,timeout,owner,pidfd):
    receipt=None
    try:
        receipt=bounded_command(argv,1048576,262144,timeout,
            env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':str(BASE/'home'),'TMPDIR':str(BASE/'tmp'),
                 'PYTHONDONTWRITEBYTECODE':'1'},native_pidfd=True,
            progress=lambda:owner_fence(owner,pidfd,node=name=='c7-own20'))
        if receipt['exit']!=0:raise CollectionFailure('PUBLIC_NATIVE_CHILD_NONZERO',receipt)
        return receipt
    except CollectionFailure as error:receipt=error.receipt;raise
    finally:
        if receipt is not None:
            for channel in ('stdout','stderr'):
                raw=receipt.pop(channel,b'')
                with open(BASE/(name+'.'+channel),'xb')as out:os.chmod(out.name,0o600);out.write(raw);out.flush();os.fsync(out.fileno())
            write(name+'.terminal.json',receipt)


def native_primitives(owner,pidfd):
    # These are new capability controls, not substituted original subject cases.
    link=BASE/'literal-link';os.symlink('home',link)
    before=identity(os.lstat(link));fd=os.open(link,os.O_PATH|os.O_NOFOLLOW)
    try:
        if identity(os.fstat(fd))!=before or os.readlink(link)!='home':raise ValueError('ACTUAL_OPATH_LITERAL_PIN')
        if identity(os.lstat(link))!=before:raise ValueError('ACTUAL_OPATH_FINAL_NINE')
        opath={'PRE':before,'OPEN':identity(os.fstat(fd)),'literal':'home','pathFINAL':identity(os.lstat(link))}
    finally:opath_close=os.close(fd)
    commands=[]
    healthy=command('native-child-healthy',['/usr/local/bin/python3.12','-B','-c','import sys,time;print("NATIVE_CHILD_HEALTHY");sys.stderr.write("ERR_OK\\n");time.sleep(.1)'],20,owner,pidfd)
    commands.append({'case':'actual-pidfd-live-terminal-and-close','receipt':healthy})
    for name,body,cap in [('stdout-overflow','import sys,time;sys.stdout.write("x"*4097);sys.stdout.flush();time.sleep(2)',4096),
                          ('stderr-overflow','import sys,time;sys.stderr.write("x"*4097);sys.stderr.flush();time.sleep(2)',4096),
                          ('timeout','import time;time.sleep(2)',4096)]:
        receipt=None
        try:
            receipt=bounded_command(['/usr/local/bin/python3.12','-B','-c',body],cap,cap,.3,
                env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':str(BASE/'home'),'TMPDIR':str(BASE/'tmp')},native_pidfd=True,
                progress=lambda:owner_fence(owner,pidfd))
            raise ValueError('EXPECTED_NATIVE_NEGATIVE_NOT_RAISED')
        except CollectionFailure as error:
            receipt=error.receipt
            expected='COMMAND_DEADLINE_EXCEEDED'if name=='timeout'else 'COMMAND_'+name.split('-')[0].upper()+'_OVERFLOW'
            if error.args[0]!=expected or not receipt['terminal']or receipt['closeErrors']or receipt.get('cleanupError'):
                raise ValueError('NATIVE_NEGATIVE_TERMINAL_ASSERTION:'+repr(receipt))from error
            commands.append({'case':name,'receipt':{k:v for k,v in receipt.items()if k not in ('stdout','stderr')}})
        finally:
            if receipt:
                for channel in ('stdout','stderr'):
                    with open(BASE/(name+'.'+channel),'xb')as out:os.chmod(out.name,0o600);out.write(receipt.get(channel,b''));out.flush();os.fsync(out.fileno())
    return {'O_PATH':opath,'O_PATHCloseReturn':opath_close,'processControls':commands}


def main():
    global CREATED,SOURCE_DEADLINE
    if sys.platform!='linux'or platform.machine()!='x86_64'or os.getuid()!=0 or sys.executable!='/usr/local/bin/python3.12'or os.getpid()!=1:
        raise ValueError('NATIVE_X64_PID1_CANONICAL_PYTHON_UID')
    if BASE.exists()or BASE.is_symlink()or ROOT.exists()or ROOT.is_symlink():raise ValueError('EXCLUSIVE_FRESH_NAMESPACE')
    if any(C7ROOT.iterdir()):raise ValueError('EXCLUSIVE_EMPTY_C7_DISK_VOLUME')
    os.umask(0o077);BASE.mkdir(mode=0o700);CREATED=True
    for name in ('home','tmp','python-raw','node-raw'): (BASE/name).mkdir(mode=0o700)
    resources(initial=True);SOURCE_DEADLINE=time.monotonic()+120
    owner=proc(1)
    if owner['rawArgvHex']!=b'/usr/local/bin/python3.12\0-B\0/native-source/native-controller.py\0'.hex():raise ValueError('EXACT_NATIVE_OWNER_KERNEL_ARGV')
    pidfd=os.pidfd_open(1,0)
    try:
        proof,proof_held,directories=open_manifest(S);HELD.append(proof_held);DIRECTORIES.extend(directories);rows=[]
        for row in proof['files']:
            if set(row)!={'path','bytes','sha256'}or type(row['bytes'])is not int or row['path']=='source-manifest.json'or Path(row['path']).is_absolute()or '..'in Path(row['path']).parts:raise ValueError('NO_CIRCULAR_OR_UNKNOWN_SOURCE_PIN')
            rows.append(capture(str(S/row['path']),16777216,row))
        manifest_row=capture('/reviewed-manifest.json',65536)
        manifest_h=HELD[-1];os.lseek(manifest_h.fd,0,os.SEEK_SET);input_manifest=strict(os.read(manifest_h.fd,65537))
        if len(input_manifest['files'])!=14:raise ValueError('EXACT14_REVIEWED_INPUTS')
        for row in input_manifest['files']:rows.append(capture(row['source'],16777216,row))
        rows.append(capture('/reviewed-bootstrap.py',1048576,next(r for r in proof['files']if r['path']=='bootstrap.py')))
        # Closed official npm source tree only; no whole SDK node_modules alias.
        npm_root=Path('/usr/local/lib/node_modules/npm');npm_files=sorted(p for p in npm_root.rglob('*')if not p.is_dir())
        if len(npm_files)!=1942 or sum(p.stat().st_size for p in npm_files)!=12397700:raise ValueError('OFFICIAL_NPM1942_SOURCE_CLOSURE')
        for p in npm_files:rows.append(capture(str(p),16777216))
        for p in sorted({npm_root,*[p.parent for p in npm_files]}):DIRECTORIES.append({'path':str(p),'identity':identity(os.lstat(p)),'members':sorted(os.listdir(p))})
        mapped_raw=Path('/proc/self/maps').read_bytes();mapped=literal_maps(mapped_raw)
        imports=sorted({str(Path(module.__file__))for module in tuple(sys.modules.values())if getattr(module,'__file__',None)and not module.__file__.startswith('<')})
        runtime=[]
        for path in sorted(set(mapped+imports+['/usr/local/bin/python3.12','/usr/local/bin/node'])):
            if path not in {h.path for h in HELD}:runtime.append(capture(path))
        write('native-binding.json',{'scope':'NATIVE_PUBLIC_CURRENT_HELPER_KERNEL_SOURCE_ONLY','owner':owner,
            'python':sys.version,'machine':platform.machine(),'UID':os.getuid(),'GID':os.getgid(),
            'sourceRows':rows,'sourceDirectories':DIRECTORIES,'runtimeRows':runtime,'actualImportedOrigins':imports,'rawMapsHex':mapped_raw.hex(),
            'mappedLiteralPaths':mapped,'environment':{k:os.environ.get(k)for k in ('PATH','HOME','TMPDIR','NODE_PATH')},
            'imageIdentityIsNotAllNine':True,'productionNativeBoundaryRelease':'ABSENT','original122':'HELD','ROOT':'ABSENT'})
        write('native-primitives.json',native_primitives(owner,pidfd))
        (C7ROOT/'fixture').mkdir(mode=0o700)
        with open(C7ROOT/'fixture/one','xb')as f:f.write(b'owned fixture\n');f.flush();os.fsync(f.fileno())
        resources(node=True);remaining=SOURCE_DEADLINE-time.monotonic()-5
        if remaining<=0:raise ValueError('ABSOLUTE_NATIVE120_PRE_DISPATCH')
        c7=command('c7-own20',['/usr/local/bin/node','--experimental-vm-modules','/native-source/native-node.mjs'],min(20,remaining),owner,pidfd)
        # 20s is an additional OWN-public body limit; eight original compiler20s
        # recipes remain held. This phase keeps a separate absolute120s deadline.
        data=strict((BASE/'c7-own20.stdout').read_bytes())
        if len(data['results'])!=20 or any(r['status']!='PASS'for r in data['results'])or data['original122']!='HELD':
            raise ValueError('EXACT_ORIGINAL_C7_OWN20_OUTCOMES')
        for h in HELD:h.fence(full=True)
        if time.monotonic()>=SOURCE_DEADLINE:raise ValueError('ABSOLUTE_NATIVE120_FINAL')
        write('native-phase-terminal.json',{'scope':'ACTUAL_NATIVE_PUBLIC_OWN20_IF_EXECUTED','absoluteSeconds':120,
            'remainingSeconds':SOURCE_DEADLINE-time.monotonic(),'ownerFinal':proc(1),'original122':'HELD','eight20s':'HELD','whole120':'HELD','ROOT':'ABSENT'})
        SOURCE_DEADLINE=None
        command('producer48',['/usr/local/bin/python3.12','-B','/reviewed-bootstrap.py'],400,owner,pidfd)
        result=strict((ROOT/'controls/linux-public-repair2/results.json').read_bytes())
        if result['count']!=48 or any(r['status']!='PASS'for r in result['controls'])or result['nativeClaims']is not False:
            raise ValueError('EXACT_UNCHANGED48_PUBLIC_OUTCOMES')
        for h in HELD:h.fence(full=True)
        owner_fence(owner,pidfd)
        final_maps=Path('/proc/self/maps').read_bytes()
        final_imports=sorted({str(Path(module.__file__))for module in tuple(sys.modules.values())if getattr(module,'__file__',None)and not module.__file__.startswith('<')})
        if literal_maps(final_maps)!=mapped or final_imports!=imports:raise ValueError('ACTUAL_RUNTIME_MAP_IMPORT_ORIGIN_SET_DRIFT')
        write('native-public-result.json',{'scope':'NATIVE_KERNEL_AND_UNCHANGED_PUBLIC_SOURCE_CONTROLS_ONLY','originalPublicCount':48,
            'originalC7OwnCount':20,'functionalTask04':False,'original122':'HELD','whole120':'HELD','native8recipes':'HELD','ROOT':'ABSENT','ownerFinal':proc(1)})
    finally:
        returned=os.close(pidfd);CLOSES.append({'kind':'ownerPidfd','closeReturn':returned})


if __name__=='__main__':
    error=None
    try:main()
    except BaseException as failure:error=repr(failure);raise
    finally:
        final_rows=[]
        for h in HELD:
            try:final_rows.append(h.fence(full=True))
            except BaseException as failure:error=error or repr(failure)
            try:CLOSES.append(h.close())
            except BaseException as failure:error=error or repr(failure)
        if CREATED:
            write('native-resource-raw.json',{'scope':'NATIVE_PUBLIC_RESOURCE_RAW_ONLY','rows':RESOURCE_ROWS,'error':error})
            write('native-source-final.json',{'scope':'NATIVE_PUBLIC_FINAL_SOURCE_AND_FD_CLOSE_ONLY','finalCurrentRowsBeforeClose':final_rows,'closed':CLOSES,'error':error,'original122':'HELD','ROOT':'ABSENT'})
            write('native-export-manifest.json',export_manifest(BASE,ROOT,ROOT/'public-export-manifest.json'))
        if error:sys.exit(1)
