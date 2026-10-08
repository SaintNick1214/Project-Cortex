"""New Linux SOURCE-file epoch only. C is injected from held verified source."""
import hashlib
import os
import stat
import struct
import sys
import time
import signal
from pathlib import Path

ROOT = Path('/source-epoch')
MAX_PAYLOAD = 300000
MAX_HEADER = 27684


def parse_packet(raw):
    if type(raw) is not bytes or not 8 <= len(raw) <= C.STDIN_BYTES:
        raise ValueError('FRAMED_STDIN_CAP')
    header_size = struct.unpack('>Q', raw[:8])[0]
    C.integer(header_size, 1, MAX_HEADER, 'FRAMED_HEADER_CAP')
    if header_size + 8 > len(raw):
        raise ValueError('TRUNCATED_FRAME_HEADER')
    header = C.strict(raw[8:8+header_size]); body = raw[8+header_size:]
    if type(header) is not dict or set(header) != {'operation', 'batch', 'items', 'bytes', 'sha256'}:
        raise ValueError('EXACT_FRAME_FIELDS')
    if header['operation'] != C.OPERATION:
        raise ValueError('CURRENT_SOURCE_OPERATION')
    C.integer(header['batch'], 0, 8, 'EXACT_NINE_BATCHES')
    C.integer(header['bytes'], 0, MAX_PAYLOAD, 'FRAME_PAYLOAD_CAP')
    if len(body) != header['bytes'] or C.digest(body) != header['sha256']:
        raise ValueError('FRAME_SIZE_HASH_EOF')
    if type(header['items']) is not list or not 1 <= len(header['items']) <= 135:
        raise ValueError('FRAME_ITEM_COUNT')
    count = 0
    for item in header['items']:
        if type(item) is not list or len(item) != 3:
            raise ValueError('FRAME_INDEX_OFFSET_LENGTH')
        C.integer(item[0], 0, 134, 'FRAME_INDEX')
        C.integer(item[1], 0, C.MAX_FILE, 'FRAME_OFFSET')
        count += C.integer(item[2], 0, MAX_PAYLOAD, 'FRAME_LENGTH')
    if count != len(body):
        raise ValueError('FRAME_CONTIGUOUS_BYTES')
    return header, body


def validate_wire(wire):
    if type(wire) is not dict or wire['scope'] != 'TASK03_U4_LINUX_WIRE_LINEAGE_ONLY':
        raise ValueError('WIRE_SCOPE')
    if wire['operation'] != C.OPERATION or wire['sourceEligibility'] is not False:
        raise ValueError('WIRE_NO_RUNTIME_AUTHORITY')
    rows = wire['members']
    if len(rows) != 135 or [row['index'] for row in rows] != list(range(135)):
        raise ValueError('ORIGINAL_135_ORDER_COUNT')
    if sum(row['bytes'] for row in rows) != 2628874:
        raise ValueError('ORIGINAL_135_BYTE_SUM')
    for row in rows:
        if row['linuxPath'] != '/source-epoch/inputs/%04d.bin' % row['index']:
            raise ValueError('NO_PATH_ALIAS_OR_DISCOVERY_RENAME')
        C.integer(row['bytes'], 0, C.MAX_FILE, 'MEMBER_FILE_CAP')
        if type(row['sha256']) is not str or len(row['sha256']) != 64:
            raise ValueError('MEMBER_HASH')
        int(row['sha256'], 16)
    return wire


def write_batch(wire, raw, root=ROOT):
    """Producer I/O is not qualification of the later complete 135-file cohort."""
    validate_wire(wire); header, body = parse_packet(raw)
    if (root/'source-stop.json').exists():
        raise ValueError('SOURCE_WRITER_ALREADY_STOPPED')
    state_path = root/'batch-state.json'
    state = C.strict(state_path.read_bytes()) if state_path.exists() else {'next': 0}
    if state != {'next': header['batch']}:
        raise ValueError('REPLAY_OR_NONCONTIGUOUS_BATCH')
    offset = 0; observations = []; errors = []
    deadline = time.monotonic() + C.BODY_SECONDS
    for index, start, length in header['items']:
        if time.monotonic() >= deadline:
            raise TimeoutError('SOURCE_BODY_48_SECONDS')
        expected = wire['members'][index]
        if start + length > expected['bytes']:
            raise ValueError('MEMBER_WRITE_CEILING')
        path = root/'inputs'/('%04d.bin' % index)
        if start == 0:
            flags = os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
        else:
            pin = C.nine(path.lstat())
            if pin['nlink'] != '1' or int(pin['size']) != start or not stat.S_ISREG(int(pin['mode'])):
                raise ValueError('SOURCE_WRITE_ORIGINAL_OFFSET')
            flags = os.O_RDWR | os.O_NOFOLLOW
        fd = os.open(path, flags, 0o600); primary = None
        try:
            before = C.nine(os.fstat(fd))
            if before['uid'] != '0' or before['gid'] != '0' or before['nlink'] != '1' or int(before['size']) != start:
                raise ValueError('SOURCE_WRITE_OWNER_OFFSET')
            os.lseek(fd, start, os.SEEK_SET); view = memoryview(body)[offset:offset+length]
            while view:
                if time.monotonic() >= deadline:
                    raise TimeoutError('SOURCE_BODY_48_SECONDS')
                count = os.write(fd, view)
                if count <= 0:
                    raise OSError('SOURCE_SHORT_WRITE')
                view = view[count:]
            os.fsync(fd); os.lseek(fd, 0, os.SEEK_SET); h = hashlib.sha256(); seen = 0
            while True:
                block = os.read(fd, 65536)
                if not block:
                    break
                seen += len(block); h.update(block)
                if time.monotonic() >= deadline:
                    raise TimeoutError('SOURCE_BODY_48_SECONDS')
            after = C.nine(os.fstat(fd))
            if seen != start + length or after != C.nine(path.lstat()):
                raise ValueError('SOURCE_WRITE_FULL_EOF_NINE')
            if seen == expected['bytes'] and h.hexdigest() != expected['sha256']:
                raise ValueError('COMPLETE_COPIED_BODY_HASH')
            observations.append({'index': index, 'linuxPath': expected['linuxPath'], 'bytes': seen,
                'sha256': h.hexdigest(), 'PRE9': before, 'POST9': after, 'fullEOF': True,
                'complete': seen == expected['bytes'], 'qualification': False})
        except BaseException as error:
            primary = error
        try:
            os.close(fd)
        except BaseException as close:
            raise C.SourceFailure(([primary] if primary else []) + [close]) from primary
        if primary:
            raise primary
        offset += length
    # Replacement is confined to this new owned control file; old evidence is
    # never overwritten. Its successive actual tuples must each be charged.
    new_state = root/('batch-state-%d.json' % header['batch'])
    C.durable_new(new_state, C.encoded({'next': header['batch']+1}))
    os.replace(new_state, state_path)
    return {'scope': 'SOURCE_COPY_BATCH_ONLY_NOT_COHORT_ACCEPTANCE', 'batch': header['batch'],
        'copies': observations, 'stateNine': C.nine(state_path.lstat()),
        'stateBytes': state_path.stat().st_size, 'stateSha256': C.digest(state_path.read_bytes()),
        'sourceEligibility': False, 'runtimeAuthority': False}


def stop_writer(wire, root=ROOT):
    validate_wire(wire)
    if C.strict((root/'batch-state.json').read_bytes()) != {'next': 9}:
        raise ValueError('ALL_NINE_BATCHES_REQUIRED')
    metadata = []
    for row in wire['members']:
        pin = C.nine((root/'inputs'/('%04d.bin' % row['index'])).lstat())
        if int(pin['size']) != row['bytes'] or pin['uid'] != '0' or pin['gid'] != '0' or pin['nlink'] != '1':
            raise ValueError('EXACT_COMPLETE_SOURCE_METADATA')
        metadata.append(pin)
    stopped = time.time_ns()
    if any(max(int(pin['mtime_ns']), int(pin['ctime_ns'])) > stopped for pin in metadata):
        raise ValueError('SOURCE_METADATA_AFTER_STOP')
    value = {'scope': 'NEW_LINUX_SOURCE_WRITER_STOP_ONLY', 'operation': C.OPERATION,
        'stoppedUnixNs': str(stopped), 'writers': 'STOPPED', 'remainingWrites': [],
        'memberCount': 135, 'wireSha256': C.digest(C.encoded(wire)), 'sourceEligibility': False}
    raw = C.encoded(value); C.durable_new(root/'source-stop.json', raw)
    return {'bytes': len(raw), 'sha256': C.digest(raw), 'nine': C.nine((root/'source-stop.json').lstat())}


def qualify(wire, controls, ledger, fs=None, root=ROOT):
    validate_wire(wire)
    rows = [{'path': str(root/'inputs'/('%04d.bin' % r['index'])),
             'ledgerPath': controls['linuxIdentityNamespace'] + r['linuxPath'],
             'bytes': r['bytes'], 'sha256': r['sha256'], 'kind': 'NEW_LINUX_ACTUAL_SOURCE'}
            for r in wire['members']]
    rows += controls['controlRows']
    cohort = C.Cohort(rows, ledger, fs=fs, owner=(0, 0))
    primary = None; result = None; deadline = time.monotonic()+C.BODY_SECONDS
    try:
        cohort.open_all(); bodies = cohort.read_all()
        stop = C.strict(bodies[str(root/'source-stop.json')])
        if stop['writers'] != 'STOPPED' or stop['remainingWrites'] != [] or stop['operation'] != C.OPERATION:
            raise ValueError('GENUINE_LINUX_SOURCE_STOP')
        if stop['wireSha256'] != C.digest(C.encoded(wire)):
            raise ValueError('STOP_WIRE_DIGEST_BINDING')
        for entry in cohort.owned:
            if entry['row']['path'] != str(root/'source-stop.json') and max(int(entry['pin']['mtime_ns']), int(entry['pin']['ctime_ns'])) > int(stop['stoppedUnixNs']):
                raise ValueError('SOURCE_METADATA_NOT_STOPPED')
        if time.monotonic() >= deadline:
            raise TimeoutError('SOURCE_BODY_48_SECONDS')
        result = {'scope': 'NEW_LINUX_135_SOURCE_PHYSICAL_EPOCH_ONLY', 'operation': C.OPERATION,
            'kernel': sys.platform, 'wireSha256': C.digest(C.encoded(wire)),
            'macCarrySha256': wire['macCarrySha256'], 'originalMac130And113AreSeparateLineage': True,
            'oldMacCustodyRepaired': False, 'macSourceGatesReplaced': False,
            'sourceEligibility': False, 'runtimeAuthority': False, 'fullTask03': False, 'fullGoal': False}
    except BaseException as error:
        primary = error
    closed = cohort.final_and_close(primary)
    if closed['closeErrors']:
        raise C.SourceFailure(closed['closeErrors'])
    if time.monotonic() >= deadline:
        raise TimeoutError('SOURCE_BODY_48_SECONDS_AFTER_FINAL_CLOSE')
    result['physicalSourceCohort'] = closed
    # Each nine-field comparison above remains executed. Avoid serializing the
    # same actual pin four times onto the original262144-byte result pipe.
    result['physicalSourceCohort']['members'] = [{
        'path':r['path'],'bytes':r['bytes'],'sha256':r['sha256'],'PRE9':r['PRE9'],
        'fullEOF':r['fullEOF'],'OPEN9EqualsPRE9':r['OPEN9']==r['PRE9'],
        'POST9EqualsPRE9':r['POST9']==r['PRE9'],'FINAL9EqualsPRE9':r['FINAL9']==r['PRE9']}
        for r in closed['members']]
    result['physicalSourceCohort']['ledger'] = None  # complete digest/summary is returned by held bootstrap
    return result


def main(argv):
    if sys.platform != 'linux' or sys.version_info[:2] != (3, 12):
        raise ValueError('LINUX_3_12_SOURCE_ONLY_HELPER_REQUIRED')
    if len(argv) < 2 or argv[0] not in ('write', 'stop', 'qualify'):
        raise ValueError('EXACT_SOURCE_HELPER_ACTION')
    wire_raw = (ROOT/'wire-manifest.json').read_bytes()
    if C.digest(wire_raw) != argv[1]:
        raise ValueError('ROOT_REVIEWED_WIRE_HASH')
    wire = C.strict(wire_raw)
    if argv[0] == 'write':
        # Outer reviewed Common writer additionally enforces12s and327692.
        raw = sys.stdin.buffer.read(C.STDIN_BYTES+1)
        result = write_batch(wire, raw)
    elif argv[0] == 'stop':
        result = stop_writer(wire)
    else:
        if len(argv) != 4:
            raise ValueError('EXACT_QUALIFY_LEDGER_HASH_CONTROL_ARGUMENTS')
        raw = sys.stdin.buffer.read(C.STDIN_BYTES+1)
        if len(raw) > C.STDIN_BYTES:
            raise ValueError('FULL_INHERITED_LEDGER_STDIN_CAP')
        exported = C.strict(raw)
        ledger = C.Ledger.inherit(exported, argv[2])
        controls = C.strict(argv[3])
        result = qualify(wire, controls, ledger)
        result['inheritedLedgerSha256'] = argv[2]
        result['inheritedAdmissions'] = exported['summary']['admissions']
        result['inheritedBytes'] = exported['summary']['bytes']
        result['oneCumulativeLedgerAfter'] = ledger.export()['sha256']
    raw = C.encoded(result)
    if len(raw) > C.STREAM_BYTES:
        raise ValueError('SOURCE_STREAM_CAP')
    sys.stdout.buffer.write(raw); sys.stdout.buffer.flush()


def timed_main(argv):
    """Own-process Linux alarm; never a signal to a foreign PID or container."""
    if sys.platform != 'linux':
        raise ValueError('LINUX_HELPER_TIMER_ONLY')
    def expired(signum, frame):
        raise TimeoutError('SOURCE_HELPER_48_SECOND_BODY')
    previous = signal.signal(signal.SIGALRM, expired)
    signal.setitimer(signal.ITIMER_REAL, C.BODY_SECONDS)
    try:
        return main(argv)
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)
