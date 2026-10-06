"""Actual host public tar/pipe controls; no Docker/native qualification."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile

from bounded_process import BoundedFileStream
from tar_export import TrackedTarReader, finish_tar_record

Q = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/task04-c8-physical-preparation-r3/native-ci-repair3')
OUT = Q / 'tar-controls1'

def fixture(size):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        item = tarfile.TarInfo('native-capability.json')
        item.size = size
        item.mode = 0o600
        archive.addfile(item, io.BytesIO(b'A' * size))
    return buf.getvalue(), 512 + ((size + 511) // 512) * 512

def observe(label, raw, wanted, exact=False, deadline=False):
    path = OUT / (label + '.tar')
    with path.open('xb') as file:
        file.write(raw); file.flush(); os.fsync(file.fileno())
    script = 'import os,sys,time; b=open(sys.argv[1],"rb").read(); os.write(1,b); ' + ('time.sleep(3)' if deadline else '')
    process = subprocess.Popen([sys.executable,'-B','-c',script,str(path)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    stream = BoundedFileStream(process,stdout_limit=65536,stderr_limit=4096,timeout=0.5 if deadline else 3)
    failure = None
    termination = None
    try:
        with tarfile.open(fileobj=stream,mode='r|') as archive:
            tracked = TrackedTarReader(archive.fileobj)
            archive.fileobj = tracked
            members = list()
            for member in archive:
                members.append(member.name)
                if member.isfile():
                    with archive.extractfile(member) as input:
                        data = input.read()
                        assert len(data) == member.size
            assert members == ['native-capability.json']
            if exact:
                termination = finish_tar_record(archive, tracked)
        result = stream.finish()
        assert result['exit'] == 0 and result['stderr'] == b''
    except BaseException as error:
        failure = str(error)
    finally:
        if process.poll() is None:
            process.terminate()
            try: process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait(timeout=2)
        close = stream.close()
        assert not close and process.poll() is not None
    row = {'label':label,'expected':wanted,'actual':'PASS' if failure is None else failure,
           'terminal':True,'exit':process.returncode,'closeErrors':close,
           'fixtureBytes':len(raw),'fixtureSha256':hashlib.sha256(raw).hexdigest(),
           'tarRecordTermination':termination,'nativeRuntime':False}
    (OUT/(label+'.json')).write_text(json.dumps(row,indent=2)+'\n')
    assert (failure is None) if wanted == 'PASS' else (failure is not None and wanted in failure)
    return row

if __name__=='__main__':
    OUT.mkdir(mode=0o700)
    raw, end = fixture(2049)
    rows = [observe('original-exporter-zero-padding-failure',raw,'STREAM_TRAILING_STDOUT')]
    rows.append(observe('exact-record-success',raw,'PASS',exact=True))
    boundary, boundary_end = fixture(9216)
    rows.append(observe('next-record-second-zero-success',boundary,'PASS',exact=True))
    bad = bytearray(raw); bad[end] = 1
    rows.append(observe('invalid-nonzero-first-terminator',bytes(bad),'EXACT_FIRST_ZERO',exact=True))
    bad = bytearray(raw); bad[end+512] = 1
    rows.append(observe('nonzero-second-terminator',bytes(bad),'EXACT_SECOND_ZERO',exact=True))
    rows.append(observe('truncated-terminator-record',raw[:end+1023],'EXACT_SECOND_ZERO',exact=True))
    rows.append(observe('extra-zero-record',raw+b'\0'*10240,'TRAILING_BYTES_AFTER',exact=True))
    rows.append(observe('extra-nonzero-byte',raw+b'X','TRAILING_BYTES_AFTER',exact=True))
    rows.append(observe('concatenated-extra-archive',raw+raw,'TRAILING_BYTES_AFTER',exact=True))
    rows.append(observe('physical-eof-deadline',raw,'STREAM_DEADLINE_EXCEEDED',exact=True,deadline=True))
    final={'scope':'ACTUAL_HOST_PUBLIC_TAR_AND_PIPE_OUTCOMES_ONLY','status':'PASS','controls':len(rows),
           'rows':rows,'sources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path(__file__),Path(__file__).with_name('tar_export.py'),Path(__file__).with_name('bounded_process.py')]},
           'originalNativeFailureTailBytes':'UNAVAILABLE_NOT_RECONSTRUCTED','Docker':False,'nativeQualified':False,
           'originalQuotaAssertionsUnchanged':True,'arbitraryTrailingBytesAccepted':False}
    (OUT/'controls.json').write_text(json.dumps(final,indent=2)+'\n')
    print(json.dumps(final))
