"""Actual dispatcher export AST and owned host pipes; Docker producer substituted."""
import ast
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import time
from types import SimpleNamespace

from bounded_process import BoundedFileStream
from tar_export import TrackedTarReader, finish_tar_record

SOURCE = Path(__file__).resolve().parent
OUTPUT = Path(sys.argv[1]).resolve()
OUTPUT.mkdir(mode=0o700, exist_ok=False)
tree = ast.parse((SOURCE / 'ci-run.py').read_bytes())
main = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'main')
export_try = next(n for n in ast.walk(main) if isinstance(n, ast.Try) and
                  any(isinstance(b, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'export_timeout'
                      for t in b.targets) for b in n.body))
unit = compile(ast.fix_missing_locations(ast.Module(body=[export_try], type_ignores=[])),
               str(SOURCE / 'ci-run.py') + ':EXACT_EXPORT_TRY', 'exec')

def receipt(path, value):
    with path.open('x') as out:
        out.write(json.dumps(value, indent=2) + '\n'); out.flush(); os.fsync(out.fileno())

def archive_bytes(members):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for name, data in members:
            member = tarfile.TarInfo(name); member.size = len(data); member.mode = 0o600
            archive.addfile(member, io.BytesIO(data))
    return buffer.getvalue()

def check(label, raw, expected=None, delay=False, stderr=False):
    output = OUTPUT / label; output.mkdir(mode=0o700)
    export = output / 'export'; export.mkdir(mode=0o700)
    fixture = output / 'public-fixture.tar'; fixture.write_bytes(raw)
    processes = []; argv_seen = []
    def spawn(argv, **options):
        assert argv == ['docker','exec','HOST_PUBLIC_DUMMY','tar','--blocking-factor=20','-C','/phase/export','-cf','-','.']
        assert set(options) == {'stdout', 'stderr'}
        argv_seen.append(argv)
        code = 'import os,sys,time;os.write(1,open(sys.argv[1],"rb").read());'
        if stderr: code += 'os.write(2,b"public transport failure");'
        if delay: code += 'time.sleep(4);'
        process = subprocess.Popen([sys.executable, '-B', '-c', code, str(fixture)], **options)
        processes.append(process)
        return process
    env = dict(os=os, time=time, json=json, re=re, tarfile=tarfile,
               PurePosixPath=PurePosixPath, subprocess=SimpleNamespace(Popen=spawn, PIPE=subprocess.PIPE, TimeoutExpired=subprocess.TimeoutExpired),
               BoundedFileStream=BoundedFileStream, TrackedTarReader=TrackedTarReader,
               finish_tar_record=finish_tar_record, output=output, export=export,
               name='HOST_PUBLIC_DUMMY', JOB_DEADLINE=time.monotonic() + (45.4 if delay else 50),
               producer=None, export_stream=None, export_primary=None, seen=set(), total=0, files=0,
               new_receipt=receipt)
    failure = None
    try: exec(unit, env)
    except BaseException as error: failure = str(error)
    assert len(processes) == 1 and processes[0].poll() is not None
    assert all(p.closed for p in (processes[0].stdout, processes[0].stderr))
    if expected is None:
        assert failure is None, failure
        transport = json.loads((output / 'export-transport.json').read_text())
        assert transport['tarRecordTermination']['exactPhysicalEOF'] and transport['terminal']
        assert transport['exit'] == 0 and transport['stderr'] == ''
        assert (export / 'native-capability.json').read_bytes() == b'{}\n'
        assert (export / 'source-backings/pending-0').read_bytes() == b'public backing\n'
    else:
        assert failure and expected in failure, (expected, failure)
        transport = json.loads((output / 'export-transport-failure.json').read_text())
        assert transport['terminal'] and not transport['closeErrors'] and not transport['cleanupErrors']
    row = dict(label=label, expected=expected or 'PASS', failure=failure, terminal=True,
               exit=processes[0].returncode, actualDispatcherExportBody=True, actualOwnedHostPipes=True,
               substitutedDockerProducer=True, nativeRuntime=False, rawBytes=len(raw),
               rawSHA256=hashlib.sha256(raw).hexdigest(), argv=argv_seen, transport=transport)
    receipt(output / 'outcome.json', row)
    return row

good = archive_bytes([('native-capability.json', b'{}\n'), ('source-backings/pending-0', b'public backing\n')])
rows = [check('valid-export', good)]
rows.append(check('extra-trailing-byte', good + b'X', 'TRAILING_BYTES_AFTER_EXACT_TAR_RECORD'))
rows.append(check('duplicate-member', archive_bytes([('native-capability.json', b'{}\n'), ('native-capability.json', b'{}\n')]), 'STRICT_FINITE_CAPABILITY_EXPORT_MEMBERSHIP'))
rows.append(check('outside-allowlist', archive_bytes([('../outside', b'public')]), 'STRICT_FINITE_CAPABILITY_EXPORT_MEMBERSHIP'))
rows.append(check('physical-eof-timeout', good, 'STREAM_DEADLINE_EXCEEDED', delay=True))
rows.append(check('producer-stderr', good, 'EXPORT_PRODUCER_TERMINAL_FAILURE', stderr=True))
receipt(OUTPUT / 'controls.json', dict(scope='ACTUAL_HOST_DISPATCHER_EXPORT_AST_AND_PIPE_OUTCOMES_ONLY',
    status='PASS', checks=len(rows), rows=rows,
    sourceSHA256=hashlib.sha256((SOURCE / 'ci-run.py').read_bytes()).hexdigest(),
    helperSHA256=hashlib.sha256((SOURCE / 'tar_export.py').read_bytes()).hexdigest(),
    originalNativeFailureTrailer='UNAVAILABLE_NOT_RECONSTRUCTED',
    originalBoundsUnchanged=True, Docker=False, nativeRuntime=False, subjects=False))
print(json.dumps(dict(checks=len(rows), actualHostAST=True, Docker=False, status='PASS')))
