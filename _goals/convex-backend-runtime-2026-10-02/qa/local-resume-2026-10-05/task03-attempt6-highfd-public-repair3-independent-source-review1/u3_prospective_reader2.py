"""Independent finite U3 SOURCE_ONLY held reader. No candidate entry dispatch.

Tooltext bootstrap must first mature/hold/qualify the complete declared union,
including this source and ledger2. Ownership is handed once and closed once.
"""
import ast
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import traceback

J = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-highfd-public-repair3-independent-source-review1')
R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
DATA = dict(INITIAL_DATA)
ledger = None
reader_failures = []
output_pins = []
published = False


def write(name, value):
    assert re.fullmatch('[a-zA-Z0-9_.-]+', name)
    raw = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    path = J / name
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        remaining = memoryview(raw)
        while remaining:
            count = os.write(fd, remaining)
            assert count > 0
            remaining = remaining[count:]
        os.fsync(fd)
    finally:
        os.close(fd)
    pin = {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    output_pins.append(pin)
    return pin


def owner_rows():
    return [{key: value for key, value in row.items() if key not in ('fd', 'expected')}
            for row in ledger.owners]


try:
    library = {'__name__': 'independent_u3_held_library'}
    exec(compile(DATA[str(J / 'held_ledger2.py')], '<held-verified-ledger2>', 'exec',
                 dont_inherit=True), library)
    ledger = library['HeldLedger'](R, prior_owners=BOOTSTRAP)
    strict = library['strict_json']
    for owner in ledger.owners:
        assert ledger.read(owner) == DATA[owner['path']]
    write('prospective-first-mature-u3-input-readback2.json', {
        'scope': 'INDEPENDENT_CURRENT_FINITE_U3_BYTE_CUSTODY_ONLY_PENDING_REVIEW',
        'files': len(ledger.owners), 'bytes': ledger.bytes,
        'allInputFDsBeforeTargetContents': True,
        'controlDocumentBootstrapExplicitAndHeld': True,
        'allWritersStoppedAndActualMaxMtimeCtimeAgeAtLeast60': True,
        'oldComparandsIncludedInOneLedger': True,
        'sourceEligibility': False, 'fullTask03': False, 'fullGoal': False,
        'inputs': owner_rows(),
        'agentReuse': 'Explicit current-agent reuse; no U3/F2/A2 authorship, no Task04 self-review.'
    })
    if sys.stdin.isatty():
        import termios
        settings = termios.tcgetattr(0)
        settings[3] &= ~(termios.ICANON | termios.ECHO)
        termios.tcsetattr(0, termios.TCSANOW, settings)
    print(json.dumps({'readerReady': True, 'files': len(ledger.owners),
                      'bytes': ledger.bytes, 'sourceEligibility': False}), flush=True)
    for line in sys.stdin:
        request = strict(line)
        operation = request['op']
        try:
            if operation == 'read':
                for path in request['paths']:
                    assert path in DATA
                    print(json.dumps({'path': path, 'bytes': len(DATA[path]),
                                      'text': DATA[path].decode('utf-8')}), flush=True)
            elif operation == 'inspect':
                value = strict(DATA[request['path']])
                def shape(value):
                    if isinstance(value, dict):
                        return {key: shape(child) for key, child in value.items()}
                    if isinstance(value, list):
                        return {'count': len(value), 'first': value[:2]}
                    return value
                print(json.dumps({'path': request['path'], 'shape': shape(value)}), flush=True)
            elif operation == 'add':
                paths = request['paths']
                ages = {path: time.time_ns() - max(Path(path).lstat().st_mtime_ns,
                                                    Path(path).lstat().st_ctime_ns)
                        for path in paths}
                if min(ages.values()) < 60000000000:
                    print(json.dumps({'pendingMaturity': True, 'agesNs': ages,
                                      'FDsOpened': 0, 'contentRead': False}), flush=True)
                    continue
                inputs = [(Path(path), request.get('pins', {}).get(path)) for path in paths]
                owners = ledger.capture_many(inputs)
                for owner in owners:
                    DATA[owner['path']] = ledger.read(owner)
                print(json.dumps({'added': len(owners), 'files': len(ledger.owners),
                                  'bytes': ledger.bytes}), flush=True)
            elif operation == 'controls':
                path = Path(request['path'])
                assert path.is_relative_to(J) and path.resolve() == path
                age = time.time_ns() - max(path.lstat().st_mtime_ns, path.lstat().st_ctime_ns)
                if age < 60000000000:
                    print(json.dumps({'pendingMaturity': True, 'ageNs': str(age),
                                      'FDsOpened': 0, 'contentRead': False}), flush=True)
                    continue
                owners = ledger.capture_many([(path, request.get('pin'))])
                source = ledger.read(owners[0])
                DATA[str(path)] = source
                namespace = {'__file__': str(path), '__name__': 'independent_u3_control',
                             'DATA': DATA, 'OWNERS': ledger.owners, 'REVIEW_DIR': str(J),
                             'MAX_OWNED_FDS_AVAILABLE': 4096 - len(ledger.owners)}
                exec(compile(source, str(path), 'exec', dont_inherit=True), namespace)
                result = namespace['RESULT']
                assert result.get('sourceEligibility') is False
                pin = write(request['output'], result)
                ledger.final_qualify_all()
                print(json.dumps({'result': result, 'output': pin}), flush=True)
            elif operation == 'publish':
                assert published is False
                ledger.final_qualify_all()
                report_pin = write(request['reportName'], request['report'].encode())
                verdict_pin = write(request['verdictName'], request['verdict'])
                ledger.final_qualify_all()
                published = True
                print(json.dumps({'published': True, 'report': report_pin,
                                  'verdict': verdict_pin}), flush=True)
                break
            else:
                raise ValueError('unknown_operation')
        except BaseException as error:
            failure = {'operation': operation, 'request': request,
                       'class': type(error).__name__, 'reason': str(error),
                       'traceback': traceback.format_exc()}
            reader_failures.append(failure)
            pin = write('prospective-reader-request-failure-' + str(len(reader_failures)) + '.json', failure)
            print(json.dumps({'requestFailed': failure, 'preserved': pin,
                              'allRegisteredInputFDsRemainHeld': True}), flush=True)
except BaseException as error:
    reader_failures.append({'operation': 'reader-lifetime', 'class': type(error).__name__,
                            'reason': str(error), 'traceback': traceback.format_exc()})
finally:
    final_failures = []
    if ledger is not None:
        try:
            ledger.final_qualify_all()
        except BaseException as error:
            final_failures.append({'class': type(error).__name__, 'reason': str(error),
                                   'traceback': traceback.format_exc()})
        ledger.close_all_once()
        rows = owner_rows()
        close_errors = ledger.close_errors
        attempts = ledger.close_attempts
    else:
        rows = []
        close_errors = []
        attempts = []
        for owner in BOOTSTRAP:
            fd = owner.pop('fd')
            attempts.append({'path': owner['path'], 'fd': fd})
            try:
                os.close(fd)
            except BaseException as error:
                close_errors.append({'path': owner['path'], 'class': type(error).__name__})
            rows.append(owner)
    write('u3-prospective-held-through-verdict-FDclosure2.json', {
        'scope': 'INDEPENDENT_U3_REVIEW_INPUTS_HELD_FULL_EOF_HASH_NINE_FINAL_ALL_CLOSE_ONCE',
        'published': published, 'readerFailures': reader_failures,
        'finalQualificationFailures': final_failures, 'closeErrors': close_errors,
        'inputRows': rows, 'closeAttempts': attempts,
        'explicitCloseAttempts': len(attempts), 'files': len(rows),
        'bytes': ledger.bytes if ledger is not None else None,
        'outputs': output_pins, 'publisherOutputsSelfExcluded': True,
        'sourceEligibility': False, 'fullTask03': False, 'fullGoal': False
    })
    stop = write('u3-prospective-reader-writer-stop2.json', {
        'scope': 'U3_INDEPENDENT_REVIEW_READER_AND_PUBLISHERS_STOPPED',
        'stoppedNs': str(time.time_ns()), 'remainingWrites': [],
        'published': published, 'readerFailures': reader_failures,
        'finalQualificationFailures': final_failures, 'closeErrors': close_errors,
        'explicitCloseAttempts': len(attempts),
        'laterDistinctActual60MatureOutputReadbackRequired': True,
        'sourceEligibility': False, 'fullTask03': False, 'fullGoal': False
    })
    print(json.dumps({'readerClosed': True, 'published': published,
                      'failures': reader_failures, 'finalFailures': final_failures,
                      'closeErrors': close_errors, 'closeAttempts': len(attempts),
                      'stop': stop}), flush=True)
