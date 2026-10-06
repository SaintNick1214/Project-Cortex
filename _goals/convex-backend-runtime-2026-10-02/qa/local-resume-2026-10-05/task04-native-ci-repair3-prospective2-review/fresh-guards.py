import hashlib, io, json, os, subprocess, sys, tarfile
from pathlib import Path
sys.dont_write_bytecode = True
P=Path(__file__).parent
W=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair3')
sys.path.insert(0, str(W))
from tar_export import TrackedTarReader, finish_tar_record
from bounded_process import BoundedFileStream
OUT=P/'fresh-host-guards'; OUT.mkdir(mode=0o700)
def archive(payload_size):
    data=io.BytesIO()
    with tarfile.open(fileobj=data, mode='w', format=tarfile.USTAR_FORMAT) as t:
        member=tarfile.TarInfo('native-capability.json'); member.size=payload_size
        t.addfile(member, io.BytesIO(b'A'*payload_size))
    return data.getvalue(),512+((payload_size+511)//512)*512
def test(name, data, size, expected_error=None, keep_open=False):
    fixture=OUT/(name+'.tar'); fixture.write_bytes(data)
    program='import os,sys,time; f=open(sys.argv[1],"rb"); b=f.read(65536)\nwhile b:\n os.write(1,b); b=f.read(65536)\nf.close()\n'+('time.sleep(3)\n' if keep_open else '')
    child=subprocess.Popen([sys.executable,'-B','-c',program,str(fixture)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    stream=BoundedFileStream(child, stdout_limit=65536, stderr_limit=4096, timeout=.3 if keep_open else 3)
    error=None; termination=None; receipt=None; payload=b''
    try:
        with tarfile.open(fileobj=stream,mode='r|') as t:
            tracked=TrackedTarReader(t.fileobj);t.fileobj=tracked
            members=[]
            for member in t:
                members.append(member.name)
                assert member.isfile() and member.name=='native-capability.json' and member.size==size
                with t.extractfile(member) as f:
                    while block:=f.read(1048576):payload+=block
                assert payload==b'A'*size
            assert members==['native-capability.json']
            termination=finish_tar_record(t,tracked)
        receipt=stream.finish(); assert receipt['exit']==0 and receipt['stderr']==b'' and receipt['terminal']
    except BaseException as e: error=type(e).__name__+':'+str(e)
    finally:
        if child.poll() is None:
            child.terminate()
            try:child.wait(timeout=1)
            except subprocess.TimeoutExpired:child.kill();child.wait(timeout=1)
        close=stream.close()
        assert child.poll() is not None and child.stdout.closed and child.stderr.closed and not close
    assert (error is None)==(expected_error is None), (name,error)
    if expected_error: assert expected_error in error, (name,error)
    if not expected_error:
        assert termination['exactPhysicalEOF'] and not termination['arbitraryTrailingBytesAccepted']
        assert termination['remainingZeroPaddingBytes']==10240 and termination['streamBytes']==20480
    row=dict(name=name, fixtureBytes=len(data), fixtureSHA256=hashlib.sha256(data).hexdigest(), expectedError=expected_error, actualError=error, exactPayloadVerified=True, payloadBytes=len(payload), tarTermination=termination, actualHostOwnedPipes=True, terminal=True, actualExit=child.returncode, closedPipes=True, closeErrors=close, partial={k:(v.hex() if isinstance(v,bytes) else v) for k,v in stream.partial().items()}, transport={k:(v.hex() if isinstance(v,bytes) else v) for k,v in receipt.items()} if receipt else None, actualDocker=False, nativeAccepted=False)
    (OUT/(name+'.json')).write_text(json.dumps(row,indent=2)+'\n')
    return row
rows=[]
raw,end=archive(9216)
rows.append(test('second-zero-in-next-record',raw,9216))
raw,end=archive(2049)
bad=bytearray(raw);bad[end+1024]=1
rows.append(test('nonzero-buffered-padding',bytes(bad),2049,'EXACT_SECOND_ZERO_AND_RECORD_PADDING_REQUIRED'))
rows.append(test('extra-zero-record',raw+b'\0'*10240,2049,'TRAILING_BYTES_AFTER_EXACT_TAR_RECORD'))
rows.append(test('physical-eof-deadline',raw,2049,'STREAM_DEADLINE_EXCEEDED',True))
result=dict(status='PASS', scope='FOUR_FRESH_BOUNDED_HOST_GUARDS_ONLY_NO_NATIVE_RUNTIME', checks=len(rows), rows=rows, sourceSHA256={n:hashlib.sha256((W/n).read_bytes()).hexdigest() for n in ['tar_export.py','bounded_process.py']}, Python=sys.version, retainedPrior22And6NotRerun=True, actualDocker=False, nativeAccepted=False, Task04Accepted=False)
(P/'fresh-host-guards.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['rows','Python']}))
