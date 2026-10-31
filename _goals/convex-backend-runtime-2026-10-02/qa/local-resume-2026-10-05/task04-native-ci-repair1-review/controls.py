"""Independent actual-source host controls, explicit native/Docker substitutions."""
import ast
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import tarfile
import time
from types import SimpleNamespace

sys.dont_write_bytecode=True
OUT=Path(__file__).resolve().parent
REPO=OUT.parents[4]
W=REPO/'work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair1'
Q=REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c8-physical-preparation-r3/native-ci-repair1'
sys.path=[p for p in sys.path if Path(p).resolve()!=OUT]
sys.path.insert(0,str(W))
import bounded_process as bounded
def load(n):
    spec=importlib.util.spec_from_file_location(n,W/(n+'.py'))
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
native=load('native-capability'); dispatcher=load('ci-run')
CHECKS=[]
def serial(value):
    if isinstance(value,bytes):return {'hex':value.hex(),'bytes':len(value),'sha256':hashlib.sha256(value).hexdigest()}
    if isinstance(value,dict):return {k:serial(v) for k,v in value.items()}
    if isinstance(value,(tuple,list)):return [serial(v) for v in value]
    return value
def record(n,fn,scope='ACTUAL_HOST_OWNED_POPEN_BOOTSTRAP_NOT_NATIVE_TASK04'):
    value=fn();CHECKS.append({'name':n,'outcome':'PASS','scope':scope,'rawObservation':serial(value)})
def command(code,**opts):
    return bounded.bounded_command([sys.executable,'-c',code],stdout_limit=127,stderr_limit=193,timeout=2,**opts)
def expect(code,message,**opts):
    try:command(code,**opts)
    except bounded.CollectionFailure as e:
        r=e.receipt
        assert message==str(e) and len(r['stdout'])<=127 and len(r['stderr'])<=193
        assert r['terminal'] and r['exit'] is not None and not r['closeErrors']
        return r
    raise AssertionError('expected '+message)
def boundaries():
    r=command('import os;os.write(1,b"a"*127);os.write(2,b"b"*193)')
    assert r['stdout']==b'a'*127 and r['stderr']==b'b'*193 and r['terminal'] and r['exit']==0
    return r
record('exact_each_pipe_limit_acceptance',boundaries)
record('stdout_128_rejects_at_127_retained_bytes',lambda:expect('import os,time;os.write(1,b"c"*128);time.sleep(20)','COMMAND_STDOUT_OVERFLOW'))
record('stderr_194_rejects_at_193_retained_bytes',lambda:expect('import os,time;os.write(2,b"d"*194);time.sleep(20)','COMMAND_STDERR_OVERFLOW'))
def timeout():
    try:bounded.bounded_command([sys.executable,'-c','import os,time;os.write(1,b"prefix");os.write(2,b"diagnostic");time.sleep(20)'],stdout_limit=127,stderr_limit=193,timeout=.15)
    except bounded.CollectionFailure as e:
        r=e.receipt
        assert str(e)=='COMMAND_DEADLINE_EXCEEDED' and r['stdout']==b'prefix' and r['stderr']==b'diagnostic' and r['terminal'] and r['elapsedSeconds']<6 and not r['closeErrors']
        return r
    raise AssertionError('deadline accepted')
record('short_deadline_keeps_two_prefixes_and_owned_terminal',timeout)
def badread():
    def read(fd,size):raise OSError('INDEPENDENT_READ_FAULT')
    return expect('import os,time;os.write(1,b"read");time.sleep(20)','COMMAND_PIPE_READ_FAILURE',read=read)
record('read_failure_records_fault_and_joins_owned_child',badread)
def failedspawn():
    try:bounded.bounded_command([str(OUT/'absent-executable')],timeout=.15)
    except bounded.CollectionFailure as e:
        r=e.receipt; assert str(e)=='COMMAND_SPAWN_FAILURE' and 'createdChildPID' not in r and not r['terminal'] and 'spawnError' in r
        return r
    raise AssertionError('spawn accepted')
record('failed_spawn_does_not_invent_child_terminal',failedspawn)
def exit7():
    r=command('import os,sys;os.write(1,b"before");os.write(2,b"error");sys.exit(7)')
    assert r['exit']==7 and r['stdout']==b'before' and r['stderr']==b'error' and r['terminal']; return r
record('nonzero_is_terminal_with_full_bounded_outputs',exit7)
def nosys():
    saved=bounded.os; created=[]
    bounded.os=SimpleNamespace(getpid=os.getpid,pidfd_open=lambda *a:(_ for _ in ()).throw(OSError(38,'ENOSYS')))
    try:
        try:bounded.bounded_command(['unused'],native_pidfd=True,popen=lambda *a,**k:created.append(a))
        except OSError as e:assert e.errno==38 and not created;return {'ENOSYSRejectedBeforeSpawn':True,'created':created,'nativeActualSyscall':'UNEXECUTED'}
        raise AssertionError('native fallback')
    finally:bounded.os=saved
record('native_pidfd_unavailable_has_no_bootstrap_fallback',nosys,'SUBSTITUTED_NATIVE_SYSCALL_GUARD_NOT_LINUX_RUNTIME')

dispatcher.CALL_DIR=OUT/'command-receipts';dispatcher.CALL_DIR.mkdir(mode=0o700)
def callfail():
    try:dispatcher.call([sys.executable,'-c','import os,time;os.write(1,b"q"*60);time.sleep(20)'],maximum=59,timeout=2)
    except bounded.CollectionFailure as e:
        r=json.loads((dispatcher.CALL_DIR/'command-00000.json').read_bytes())
        assert (dispatcher.CALL_DIR/'command-00000.stdout').read_bytes()==b'q'*59 and r['stdout']['sha256']==hashlib.sha256(b'q'*59).hexdigest()
        assert r['terminal'] and 'COMMAND_STDOUT_OVERFLOW' in r['failure'] and r['authorityMode']=='BOOTSTRAP_CREATED_POPEN_HANDLE_ONLY_NOT_TASK04'
        return r
    raise AssertionError('dispatcher overflow accepted')
record('actual_dispatcher_call_persists_failed_output_metadata',callfail)
def callnonzero():
    try:dispatcher.call([sys.executable,'-c','import sys;print("final-prefix");sys.exit(19)'],maximum=127,timeout=2)
    except RuntimeError as e:
        r=json.loads((dispatcher.CALL_DIR/'command-00001.json').read_bytes())
        assert r['exit']==19 and r['terminal'] and (dispatcher.CALL_DIR/'command-00001.stdout').read_bytes()==b'final-prefix\n'
        return {'raised':str(e),'saved':r}
    raise AssertionError('nonzero accepted')
record('actual_dispatcher_nonzero_saved_before_raise',callnonzero)

def stream_case(code,stdout_cap=127,stderr_cap=193,timeout=2,expected=None):
    child=subprocess.Popen([sys.executable,'-c',code],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    reader=bounded.BoundedFileStream(child,stdout_cap,stderr_cap,timeout=timeout); chunks=bytearray();row={}
    try:
        while block:=reader.read(11):chunks.extend(block)
        row=reader.finish();assert expected is None and row['terminal'] and row['exit']==0
        row['consumed']=bytes(chunks)
    except bounded.CollectionFailure as e:
        assert str(e)==expected and reader.stdout_bytes<=stdout_cap and len(reader.stderr)<=stderr_cap and len(reader.pending)<=65536
        row={'failure':str(e),'partial':e.receipt,'consumed':bytes(chunks)}
    finally:
        if child.poll() is None:child.terminate();child.wait(timeout=3)
        errors=reader.close();assert child.poll() is not None and not errors
        row['ownedFinalExit']=child.returncode;row['closeErrors']=errors
    return row
record('stream_stdout_limit_is_measured_during_read',lambda:stream_case('import os,time;os.write(1,b"s"*128);time.sleep(20)',expected='STREAM_STDOUT_OVERFLOW'))
record('stream_stderr_limit_is_measured_during_read',lambda:stream_case('import os,time;os.write(2,b"t"*194);time.sleep(20)',expected='STREAM_STDERR_OVERFLOW'))
record('stream_deadline_retains_partial_and_terminal',lambda:stream_case('import os,time;os.write(1,b"partial");time.sleep(20)',timeout=.15,expected='STREAM_DEADLINE_EXCEEDED'))
def tar_case():
    content=b'owned independent tar payload';raw=io.BytesIO()
    with tarfile.open(fileobj=raw,mode='w') as f:
        member=tarfile.TarInfo('source-backings/pending-8');member.size=len(content);f.addfile(member,io.BytesIO(content))
    data=raw.getvalue();child=subprocess.Popen([sys.executable,'-c','import os;os.write(1,bytes.fromhex('+repr(data.hex())+'))'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    reader=bounded.BoundedFileStream(child,len(data),127,timeout=2)
    try:
        with tarfile.open(fileobj=reader,mode='r|') as f:
            found=[(m.name,f.extractfile(m).read()) for m in f]
        r=reader.finish();assert found==[('source-backings/pending-8',content)] and r['terminal'] and r['exit']==0;return {'member':found,'transport':r}
    finally:
        if child.poll() is None:child.kill();child.wait(timeout=3)
        assert not reader.close()
record('real_tarfile_consumer_uses_repaired_stream_to_eof',tar_case)

fixture=OUT/'owned-dummy';fixture.mkdir(mode=0o700)
native.OUT=fixture;native.BACK=fixture/'backings';native.BACK.mkdir(mode=0o700)
native.os=SimpleNamespace(**{k:getattr(os,k) for k in dir(os)})
native.os.posix_fadvise=lambda *a:None;native.os.POSIX_FADV_DONTNEED=4
native.measure=lambda *a,**k:None
aliasobservations=[]
native.alias=lambda p:aliasobservations.append({'path':str(p),'literalTarget':os.readlink(p),'LinuxOPathSubstituted':True})
def alias_type():
    p=Q/'controls-attempt4/source-fixture/python-bin';sources=set();native.alias_target(p,sources)
    assert not sources and len(native.directories)==1 and native.directories[0]['names']==sorted(os.listdir(p.resolve()))
    own=fixture/'regular';own.write_bytes(b'independent regular\n');os.chmod(own,0o600)
    native.alias_target(own,sources);assert sources=={str(own)}
    r=native.capture(own);native.final_verify();assert r['EOF'] and r['sha256']==hashlib.sha256(own.read_bytes()).hexdigest()
    return {'directoryExcludedFromFileSet':True,'literalAlias':aliasobservations,'heldDirectoryMembers':native.directories[0]['names'],'actualFile':r}
record('actual_alias_target_separates_held_directory_and_file_set',alias_type,'ACTUAL_HOST_FILE_ALL9_WITH_SUBSTITUTED_LINUX_ALIAS_ADVICE_RESERVE')
def strict():
    rejected=[]
    for p in [fixture,Q/'controls-attempt4/source-fixture/hard-link']:
        try:native.capture(p)
        except ValueError as e:assert str(e)=='RUNTIME_REGULAR_SINGLE_LINK_SOURCE';rejected.append(str(p))
        else:raise AssertionError('strict file assertion weakened')
    return {'rejected':rejected}
record('strict_regular_and_one_link_assertions_unchanged',strict,'ACTUAL_HOST_FILE_TYPES_SUBSTITUTED_LINUX_ADVICE_RESERVE')
def membership_change():
    d=fixture/'held-empty-directory';d.mkdir();native.members(d);(d/'added-member').write_bytes(b'owned negative')
    try:native.final_verify()
    except ValueError as e:assert str(e)=='FINAL_DIRECTORY_MEMBERSHIP_NINE';return {'rejected':str(e)}
    raise AssertionError('directory drift accepted')
record('held_directory_membership_mutation_rejected',membership_change,'ACTUAL_HOST_OWNED_DIRECTORY_ALL9_NOT_NATIVE_RUNTIME')
for row in native.retained+native.directories:os.close(row['fd'])

tree=ast.parse((W/'ci-run.py').read_bytes());main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
assign=next(n for n in ast.walk(main) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='allowed' for t in n.targets))
guard=next(n for n in ast.walk(main) if isinstance(n,ast.If) and ast.unparse(n).startswith('if not allowed or not member.isfile()'))
def export_guards():
    code=compile(ast.fix_missing_locations(ast.Module(body=[assign,guard],type_ignores=[])),'<exact-allowlist-source>','exec')
    ns={'re':re,'seen':set(),'member':SimpleNamespace(isfile=lambda:True)}
    for path in ('native-capability.json','source-backings/pending-0'):
        ns.update(literal=path,parts=PurePosixPath(path).parts);exec(code,ns)
    rejected=[]
    for path in ('../private','/native-capability.json','source-backings/pending-0/extra','unapproved.json'):
        ns.update(literal=path,parts=PurePosixPath(path).parts)
        try:exec(code,ns)
        except ValueError as e:assert str(e)=='STRICT_FINITE_CAPABILITY_EXPORT_MEMBERSHIP';rejected.append(path)
        else:raise AssertionError('export path accepted')
    ns.update(literal='native-capability.json',parts=('native-capability.json',),seen={'native-capability.json'})
    try:exec(code,ns)
    except ValueError as e:assert str(e)=='STRICT_FINITE_CAPABILITY_EXPORT_MEMBERSHIP';rejected.append('duplicate')
    else:raise AssertionError('duplicate accepted')
    return {'accepted':2,'rejected':rejected}
record('exact_export_source_rejects_traversal_extra_and_duplicate',export_guards,'SUBSTITUTED_TAR_MEMBER_GUARD_NOT_DOCKER')
def ownerstop():
    guard=next(n for n in ast.walk(main) if isinstance(n,ast.If) and ast.unparse(n).startswith("if stop.returncode or terminal['State']['Running']"))
    code=compile(ast.fix_missing_locations(ast.Module(body=[guard],type_ignores=[])),'<exact-terminal-source>','exec')
    try:exec(code,{'stop':SimpleNamespace(returncode=0),'terminal':{'State':{'Running':True}},'primary':None})
    except ValueError as e:assert str(e)=='OWNER_STOP_TERMINAL_FAILURE';return {'nonterminalOwnerRejected':True}
    raise AssertionError('running owner accepted')
record('exact_owner_terminal_guard_requires_terminal',ownerstop,'SUBSTITUTED_DOCKER_INSPECT_GUARD_NOT_RUNTIME')

receipt={'scope':'FRESH_INDEPENDENT_ACTUAL_SOURCE_HOST_CONTROLS_WITH_EXPLICIT_SUBSTITUTIONS','checks':CHECKS,'sourceHashes':[{ 'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in (W/'bounded_process.py',W/'ci-run.py',W/'native-capability.py')],'nativePidfdMapsArgvCgroup':'HELD_UNEXECUTED','DockerCalls':False,'Task04Subjects':False,'workflowWrites':False,'ROOT':'ABSENT'}
with open(OUT/'independent-controls.json','x') as f:f.write(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'checks':len(CHECKS),'allOutcomeAssertions':'PASS','nativeRuntime':'HELD','DockerCalls':False}))
