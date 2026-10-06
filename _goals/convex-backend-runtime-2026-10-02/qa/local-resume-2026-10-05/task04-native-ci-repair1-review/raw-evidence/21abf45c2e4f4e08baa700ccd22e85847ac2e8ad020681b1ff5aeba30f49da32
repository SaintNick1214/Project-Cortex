"""Actual repaired infrastructure source controls; no Docker or Task04 subjects."""
import ast
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import select
import signal
import stat
import subprocess
import sys
import tarfile
import time
from types import SimpleNamespace

SOURCE=Path(__file__).resolve().parent
OUTPUT=Path(sys.argv[1]).resolve()
OUTPUT.mkdir(mode=0o700,exist_ok=False)
sys.path.insert(0,str(SOURCE))
import bounded_process as bounded

def load(name):
    spec=importlib.util.spec_from_file_location(name,SOURCE/(name+'.py'))
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

native=load('native-capability'); bootstrap=load('ci-run')
checks=[]
def receipt_json(value):
    if isinstance(value,bytes):return {'bytes':len(value),'hex':value.hex(),'sha256':hashlib.sha256(value).hexdigest()}
    if isinstance(value,dict):return {k:receipt_json(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [receipt_json(v) for v in value]
    return value
def record(name,kind,fn):
    began=time.monotonic()
    value=fn()
    checks.append({'name':name,'scope':kind,'outcome':'ASSERTIONS_PASSED','observation':receipt_json(value),'elapsedSeconds':time.monotonic()-began})
def command(code,**options):
    return bounded.bounded_command([sys.executable,'-c',code],stdout_limit=256,stderr_limit=256,timeout=3,**options)
def expected(code,message,**options):
    try:command(code,**options)
    except bounded.CollectionFailure as error:
        row=error.receipt
        assert message in str(error),str(error)
        assert len(row['stdout'])<=256 and len(row['stderr'])<=256
        if 'createdChildPID' in row:
            assert row['terminal'] and row['exit'] is not None and not row['closeErrors'],row
        return {'failure':str(error),'receipt':row}
    raise AssertionError('Expected '+message)

def healthy():
    row=command('import os;os.write(1,b"healthy-out");os.write(2,b"healthy-err")')
    assert row['stdout']==b'healthy-out' and row['stderr']==b'healthy-err' and row['exit']==0 and row['terminal']
    assert row['authorityMode']=='BOOTSTRAP_CREATED_POPEN_HANDLE_ONLY_NOT_TASK04' and row['closeErrors']==[]
    return row
record('actual_source_healthy_two_pipe_collection','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',healthy)
record('actual_source_stdout_overflow_preserves_bounded_prefix_and_terminal','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',lambda:expected('import os,time;os.write(1,b"x"*4096);time.sleep(10)','COMMAND_STDOUT_OVERFLOW'))
record('actual_source_stderr_overflow_preserves_bounded_prefix_and_terminal','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',lambda:expected('import os,time;os.write(2,b"e"*4096);time.sleep(10)','COMMAND_STDERR_OVERFLOW'))
def timeout():
    try:bounded.bounded_command([sys.executable,'-c','import os,time;os.write(1,b"waiting");time.sleep(10)'],stdout_limit=256,stderr_limit=256,timeout=1)
    except bounded.CollectionFailure as error:
        row=error.receipt
        assert 'COMMAND_DEADLINE_EXCEEDED' in str(error) and row['stdout']==b'waiting'
        assert row['terminal'] and row['exit'] is not None and row['elapsedSeconds']<7 and not row['closeErrors']
        return row
    raise AssertionError('timeout accepted')
record('actual_source_timeout_preserves_prefix_and_owned_terminal','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',timeout)
def spawn_failure():
    try:bounded.bounded_command([str(OUTPUT/'no-such-executable')],stdout_limit=256,stderr_limit=256,timeout=1)
    except bounded.CollectionFailure as error:
        row=error.receipt
        assert 'COMMAND_SPAWN_FAILURE' in str(error) and 'createdChildPID' not in row and row['stdout']==b'' and row['stderr']==b'' and 'spawnError' in row
        return row
    raise AssertionError('missing executable accepted')
record('actual_source_failed_spawn_has_no_child_or_invented_terminal','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',spawn_failure)
def read_failure():
    calls=[0]
    def fail_second(fd,size):
        calls[0]+=1
        if calls[0]==2:raise OSError('OWNED_TEST_READ_FAILURE')
        return os.read(fd,size)
    row=expected('import os,time;os.write(1,b"first");time.sleep(.1);os.write(1,b"second");time.sleep(10)','COMMAND_PIPE_READ_FAILURE',read=fail_second)
    assert row['receipt']['stdout']==b'first' and 'OWNED_TEST_READ_FAILURE' in row['receipt']['readError']
    return row
record('actual_source_read_failure_preserves_partial_and_terminal','ACTUAL_HOST_PUBLIC_DUMMY_WITH_DECLARED_READ_SEAM_NOT_LINUX_PIDFD',read_failure)
def nonzero():
    row=command('import os,sys;os.write(1,b"before-failure");os.write(2,b"error");sys.exit(7)')
    assert row['exit']==7 and row['terminal'] and row['stdout']==b'before-failure' and row['stderr']==b'error'
    return row
record('actual_source_nonzero_exit_retains_output_and_terminal','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',nonzero)
def zero_limit():
    row=bounded.bounded_command([sys.executable,'-c','pass'],stdout_limit=0,stderr_limit=0,timeout=3)
    assert row['stdout']==b'' and row['stderr']==b'' and row['exit']==0
    return row
record('actual_source_zero_byte_limits_accept_only_empty_output','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',zero_limit)

def streamed(code,expected_error=None,timeout=3):
    process=subprocess.Popen([sys.executable,'-c',code],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    stream=bounded.BoundedFileStream(process,stdout_limit=256,stderr_limit=256,timeout=timeout)
    collected=bytearray();caught=None
    try:
        while block:=stream.read(17):collected.extend(block)
        result=stream.finish()
        if expected_error is not None:raise AssertionError('stream accepted '+expected_error)
        assert len(collected)<=256 and process.returncode==0
        result['consumedStdout']=bytes(collected)
        return result
    except bounded.CollectionFailure as error:
        caught=error
        assert expected_error and expected_error in str(error),str(error)
        assert error.receipt['stdoutBytes']<=256 and len(error.receipt['stderr'])<=256 and len(stream.pending)<=65536
        return {'failure':str(error),'partial':error.receipt,'consumedStdout':bytes(collected)}
    finally:
        if process.poll() is None:
            process.terminate()
            try:process.wait(timeout=2)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=3)
        assert process.poll() is not None
        errors=stream.close();assert not errors
record('actual_streamed_export_reader_healthy_dual_pipe','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',lambda:streamed('import os;os.write(1,b"streamed-ok");os.write(2,b"bounded-stderr")'))
record('actual_streamed_export_reader_stdout_overflow','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',lambda:streamed('import os,time;os.write(1,b"s"*4096);time.sleep(10)','STREAM_STDOUT_OVERFLOW'))
record('actual_streamed_export_reader_stderr_overflow','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',lambda:streamed('import os,time;os.write(2,b"s"*4096);time.sleep(10)','STREAM_STDERR_OVERFLOW'))
record('actual_streamed_export_reader_deadline','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',lambda:streamed('import os,time;os.write(1,b"partial");time.sleep(10)','STREAM_DEADLINE_EXCEEDED',timeout=1))

# Exercise the repaired public call(), not a duplicate collector implementation.
bootstrap.CALL_DIR=OUTPUT/'command-receipts'; bootstrap.CALL_DIR.mkdir(mode=0o700)
def call_healthy():
    row=bootstrap.call([sys.executable,'-c','print("bootstrap-ok")'],maximum=256,timeout=3)
    assert row.returncode==0 and row.stdout==b'bootstrap-ok\n' and row.lifecycle['terminal']
    return row.lifecycle
record('actual_ci_call_records_healthy_partial_files','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',call_healthy)
def call_overflow():
    try:bootstrap.call([sys.executable,'-c','import os,time;os.write(1,b"p"*4096);time.sleep(10)'],maximum=256,timeout=3)
    except bounded.CollectionFailure as error:
        assert error.receipt['stdout']==b'p'*256 and error.receipt['terminal']
        path=bootstrap.CALL_DIR/'command-00001.stdout'
        assert path.read_bytes()==b'p'*256
        row=json.loads((bootstrap.CALL_DIR/'command-00001.json').read_text())
        assert row['terminal'] and row['stdout']['bytes']==256 and row['stdout']['sha256']==hashlib.sha256(b'p'*256).hexdigest()
        return row
    raise AssertionError('call accepted overflow')
record('actual_ci_call_overflow_records_bounded_failed_outputs','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',call_overflow)

# Native-only guards are source seams. These are explicitly not Linux receipts.
def native_no_fallback():
    class NoPidfd:
        def pidfd_open(self,*args):raise OSError(38,'DECLARED_NATIVE_PIDFD_ENOSYS_SEAM')
        def getpid(self):return os.getpid()
    saved=bounded.os;created=[]
    bounded.os=NoPidfd()
    try:
        try:bounded.bounded_command(['owned-unused'],native_pidfd=True,popen=lambda *a,**k:created.append(a))
        except OSError as error:
            assert error.errno==38 and not created
            return {'actualBodyRejectedBeforeSpawn':True,'created':created,'nativeRuntime':'HELD; syscall failure was substituted, not native PASS'}
        raise AssertionError('native guard accepted ENOSYS')
    finally:bounded.os=saved
record('native_pidfd_ENOSYS_seam_rejects_before_spawn_without_fallback','DECLARED_NATIVE_SYSCALL_SOURCE_SEAM_NOT_RUNTIME',native_no_fallback)

# Strict capture() uses actual owned host files and real held stat identities;
# only Linux-only advice/alias effects are declared substitutions.
fixture=OUTPUT/'source-fixture';fixture.mkdir(mode=0o700)
native.OUT=fixture;native.BACK=fixture/'backings';native.BACK.mkdir(mode=0o700)
proxy=SimpleNamespace(**{key:getattr(os,key) for key in dir(os)})
proxy.posix_fadvise=lambda *args:None;proxy.POSIX_FADV_DONTNEED=4
native.os=proxy;native.measure=lambda *args,**kwargs:None
literal_aliases=[]
native.alias=lambda p:literal_aliases.append({'path':str(p),'literalTarget':os.readlink(p),'scope':'HOST_LITERAL_OBSERVATION_NOT_LINUX_OPATH'})
def file_and_alias_directory():
    binpath=fixture/'bin';binpath.mkdir(mode=0o700)
    regular=binpath/'python3.12';regular.write_bytes(b'owned regular source\n');os.chmod(regular,0o600)
    aliaspath=fixture/'python-bin';aliaspath.symlink_to(binpath,target_is_directory=True)
    sources=set();native.alias_target(aliaspath,sources)
    assert sources==set() and len(native.directories)==1 and native.directories[0]['names']==['python3.12']
    assert literal_aliases[-1]['path']==str(aliaspath)
    native.alias_target(regular,sources)
    assert sources=={str(regular)}
    row=native.capture(regular);native.final_verify()
    assert row['sha256']==hashlib.sha256(b'owned regular source\n').hexdigest() and row['EOF']
    return {'resolvedDirectoryExcludedFromFileSet':True,'fileSources':sorted(sources),'directoryMembers':native.directories[0]['names'],'literalAlias':literal_aliases[-1],'file':row}
record('actual_repaired_alias_target_separates_directory_and_file_closures','ACTUAL_HOST_OWNED_FILES_PLUS_DECLARED_LINUX_ALIAS_ADVICE_SEAMS_NOT_RUNTIME',file_and_alias_directory)
def regular_assertions():
    try:native.capture(fixture/'bin')
    except ValueError as error:assert str(error)=='RUNTIME_REGULAR_SINGLE_LINK_SOURCE'
    else:raise AssertionError('directory passed regular assertion')
    target=fixture/'hard-original';target.write_bytes(b'never qualified');link=fixture/'hard-link';os.link(target,link)
    try:native.capture(link)
    except ValueError as error:assert str(error)=='RUNTIME_REGULAR_SINGLE_LINK_SOURCE'
    else:raise AssertionError('hardlink passed regular assertion')
    return {'directoryRejected':True,'hardlinkRejected':True,'originalAssertions':'unchanged'}
record('strict_regular_and_single_link_assertions_remain','ACTUAL_HOST_OWNED_FILES_NOT_LINUX_RUNTIME',regular_assertions)
def directory_mutation():
    (fixture/'bin/new-foreign-member').write_bytes(b'owned negative control')
    try:native.final_verify()
    except ValueError as error:
        assert str(error)=='FINAL_DIRECTORY_MEMBERSHIP_NINE'
        return {'directoryMutationRejected':str(error)}
    raise AssertionError('changed directory accepted')
record('held_directory_membership_and_all9_mutation_rejects','ACTUAL_HOST_OWNED_FILES_NOT_LINUX_RUNTIME',directory_mutation)
for row in native.retained+native.aliases+native.directories:
    if 'fd' in row:os.close(row['fd'])

tree=ast.parse((SOURCE/'native-capability.py').read_text())
main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
argvif=next(n for n in ast.walk(main) if isinstance(n,ast.If) and 'UNMODIFIED_NATIVE_KERNEL_ARGV_REQUIRED' in ast.unparse(n))
args=['/usr/local/bin/node','--inspect-brk=127.0.0.1:0','-e',''];literal=b'\0'.join(os.fsencode(a) for a in args)+b'\0'
def argv_seam():
    ns={'args':args,'nodeowner':{'rawArgvHex':literal.hex()},'os':os}
    compiled=compile(ast.fix_missing_locations(ast.Module(body=[argvif],type_ignores=[])),'<exact-new-argv-source>','exec')
    exec(compiled,ns)
    ns['nodeowner']['rawArgvHex']=(b'/run/rosetta/rosetta\0'+literal).hex()
    try:exec(compiled,ns)
    except ValueError as error:
        assert str(error)=='UNMODIFIED_NATIVE_KERNEL_ARGV_REQUIRED'
        return {'literalAccepted':True,'wrapperRejected':str(error),'nativeRuntime':'HELD'}
    raise AssertionError('wrapper accepted')
record('exact_raw_kernel_argv_source_guard_retained','DECLARED_ARGV_SOURCE_SEAM_NOT_NATIVE_RUNTIME',argv_seam)

def tar_consumer():
    raw=io.BytesIO()
    with tarfile.open(fileobj=raw,mode='w') as archive:
        member=tarfile.TarInfo('source-backings/pending-0');payload=b'owned public dummy tar source\n'
        member.size=len(payload);archive.addfile(member,io.BytesIO(payload))
    data=raw.getvalue()
    code='import os;os.write(1,bytes.fromhex('+repr(data.hex())+'));os.write(2,b"transport-dummy-stderr")'
    process=subprocess.Popen([sys.executable,'-c',code],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    stream=bounded.BoundedFileStream(process,len(data),256,timeout=3)
    try:
        with tarfile.open(fileobj=stream,mode='r|') as archive:
            rows=[]
            for member in archive:
                with archive.extractfile(member) as input:copied=input.read()
                assert copied==payload and member.name=='source-backings/pending-0'
                rows.append({'path':member.name,'bytes':len(copied),'sha256':hashlib.sha256(copied).hexdigest()})
        terminal=stream.finish()
        assert terminal['terminal'] and terminal['exit']==0 and terminal['stderr']==b'transport-dummy-stderr'
        return {'members':rows,'terminal':terminal}
    finally:
        if process.poll() is None:process.kill();process.wait(timeout=3)
        assert not stream.close()
record('actual_streamed_tarfile_consumer_complete_member_and_terminal','ACTUAL_HOST_PUBLIC_DUMMY_BOOTSTRAP_NOT_LINUX_PIDFD',tar_consumer)

def native_failed_output_receipt():
    value={'stdout':b'partial-version','stderr':b'failed-version','signals':[{'return':None}],'terminal':True}
    converted=native.receipt_value(value)
    assert converted['stdout']['hex']==value['stdout'].hex() and converted['stderr']['sha256']==hashlib.sha256(value['stderr']).hexdigest()
    return {'failedCommandRawByteSerialization':converted,'nativeExecution':'HELD'}
record('failed_native_version_receipt_preserves_exact_partial_bytes','ACTUAL_SOURCE_SERIALIZATION_NOT_NATIVE_RUNTIME',native_failed_output_receipt)

def compile_guard(nodes,namespace):
    exec(compile(ast.fix_missing_locations(ast.Module(body=nodes,type_ignores=[])),'<declared-source-seam>','exec'),namespace)

measure_values={'memory.max':'6442450944','memory.current':'1','memory.swap.max':'0','memory.swap.current':'0'}
class ResourcePath:
    def __init__(self,path):self.name=path.rsplit('/',1)[-1]
    def read_text(self):return measure_values[self.name]
measure_ns={'Path':ResourcePath,'os':SimpleNamespace(statvfs=lambda p:SimpleNamespace(f_frsize=4096,f_blocks=10000000,f_bavail=10000000,f_files=10000000,f_favail=100000,f_namemax=255)),'ROOT':fixture,'CAP':536870912,'RECEIPT_CAP':16777216,'reserve_min':None,'check_count':0,'snapshots':[],'monitored_stream':None}
compile_guard([n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='measure'],measure_ns)
def resource_guard(key,value,error=None):
    old=measure_values[key];measure_values[key]=value
    try:
        try:result=measure_ns['measure']()
        except ValueError as actual:
            assert error and error==str(actual)
            return {'rejected':str(actual),'nativeResource':'HELD; inputs substituted'}
        assert error is None
        return {'literalReserve':result['literalReserveBytes'],'nativeResource':'HELD; inputs substituted'}
    finally:measure_values[key]=old
record('literal_six_gib_matched_swap_source_guard','DECLARED_RESOURCE_SEAM_NOT_RUNTIME',lambda:resource_guard('memory.current','1'))
record('extra_swap_source_rejection','DECLARED_RESOURCE_SEAM_NOT_RUNTIME',lambda:resource_guard('memory.swap.max','6442450944','ACTUAL_MATCHED_SIX_GIB_MEMORY_SWAP_NO_EXTRA_CAPACITY'))
record('literal_128mib_shortfall_source_rejection','DECLARED_RESOURCE_SEAM_NOT_RUNTIME',lambda:resource_guard('memory.current',str(6442450944-134217727),'LITERAL_MEASURED_RESERVE_HOLD'))
record('unbounded_cgroup_source_rejection','DECLARED_RESOURCE_SEAM_NOT_RUNTIME',lambda:resource_guard('memory.max','max','ACTUAL_FINITE_SIX_GIB_CGROUP'))

runmain=next(n for n in ast.parse((SOURCE/'ci-run.py').read_text()).body if isinstance(n,ast.FunctionDef) and n.name=='main')
allowassign=next(n for n in ast.walk(runmain) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='allowed' for t in n.targets))
exportif=next(n for n in ast.walk(runmain) if isinstance(n,ast.If) and ast.unparse(n).startswith('if not allowed or not member.isfile()'))
def export_guard():
    import re
    ns={'re':re,'seen':set(),'member':SimpleNamespace(isfile=lambda:True)}
    def member(path):
        ns.update(literal=path,parts=Path(path).parts)
        compile_guard([allowassign,exportif],ns)
    member('source-backings/pending-42')
    rejected=[]
    for path in ('source-backings/../../private','unapproved.json','/source-backings/pending-42','source-backings/pending-42/extra'):
        try:member(path)
        except ValueError as error:
            assert str(error)=='STRICT_FINITE_CAPABILITY_EXPORT_MEMBERSHIP';rejected.append(path)
        else:raise AssertionError('export accepted '+path)
    sizeif=next(n for n in ast.walk(runmain) if isinstance(n,ast.If) and ast.unparse(n).startswith('if total > 553648128'))
    ns.update(total=553648129,files=1,member=SimpleNamespace(size=1))
    try:compile_guard([sizeif],ns)
    except ValueError as error:assert str(error)=='FINITE_EXPORT_CAPACITY_HOLD'
    else:raise AssertionError('export admitted overflow')
    return {'approvedLiteral':'source-backings/pending-42','rejected':rejected,'capacityOverflowRejected':True,'transportExecution':'NONE'}
record('strict_export_allowlist_and_capacity_source_guards','DECLARED_EXPORT_SEAMS_NOT_DOCKER',export_guard)

def nonterminal_guard():
    stopif=next(n for n in ast.walk(runmain) if isinstance(n,ast.If) and ast.unparse(n).startswith("if stop.returncode or terminal['State']['Running']"))
    ns={'stop':SimpleNamespace(returncode=0),'terminal':{'State':{'Running':True}},'primary':None}
    try:compile_guard([stopif],ns)
    except ValueError as error:assert str(error)=='OWNER_STOP_TERMINAL_FAILURE'
    else:raise AssertionError('nonterminal owner accepted')
    return {'nonterminalRejected':True,'DockerExecution':'NONE'}
record('owned_owner_nonterminal_source_guard','DECLARED_TERMINAL_SEAM_NOT_DOCKER',nonterminal_guard)

result={'scope':'IMPLEMENTER_REPAIR_CONTROLS_NOT_INDEPENDENT_JUDGMENT_NOT_NATIVE_RUNTIME_ACCEPTANCE','sourceHashes':[{ 'path':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(SOURCE.glob('*.py'))],'checks':checks,'nativePidfdAndMaps':'REQUIRE_ACTUAL_NATIVE_LINUX_CI; NOT_PASSED_HERE','DockerCalls':False,'Task04Subjects':False,'ROOT':'ABSENT'}
with open(OUTPUT/'controls.json','x') as out:out.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'checks':len(checks),'allAssertionsPassed':True,'nativeRuntimeQualification':'HELD','DockerCalls':False}))
