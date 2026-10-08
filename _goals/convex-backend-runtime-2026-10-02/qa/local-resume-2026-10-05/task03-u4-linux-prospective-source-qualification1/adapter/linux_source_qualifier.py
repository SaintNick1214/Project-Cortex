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


class NativeIO(C.NativeFS):
    def exists(self,path): return path.exists()
    def open_write(self,path,flags): return os.open(path,flags,0o600)
    def seek(self,fd,offset): return os.lseek(fd,offset,os.SEEK_SET)
    def write(self,fd,view): return os.write(fd,view)
    def sync(self,fd): return os.fsync(fd)
    def replace(self,source,destination): return os.replace(source,destination)
    def write_stop(self,path,raw,ledger):C.durable_new(path,raw,ledger=ledger)


def read_state(root,expected,ledger,namespace,io):
    raw=C.encoded({'next':expected}); path=root/'batch-state.json'
    key=namespace+str(path)
    old=next((values for (name,values,sha,size) in reversed(list(ledger.admissions)) if name==key),None)
    if old is None: raise ValueError('EXACT_PREVIOUS_STATE_ADMISSION_REQUIRED')
    row={'path':str(path),'ledgerPath':key,'bytes':len(raw),'sha256':C.digest(raw),
         'expectedNine':dict(zip(C.FIELDS,old)),'kind':'NEW_LINUX_CHANGED_BATCH_CONTROL'}
    cohort=C.Cohort([row],ledger,fs=io,owner=(0,0));primary=None;value=None
    try:
        cohort.open_all();value=C.strict(cohort.read_all()[str(path)])
        if value!={'next':expected}: raise ValueError('REPLAY_OR_NONCONTIGUOUS_BATCH')
    except BaseException as error: primary=error
    closed=cohort.final_and_close(primary)
    if closed['closeErrors']:raise C.SourceFailure(closed['closeErrors'])
    return value


def write_batch(wire,raw,root=ROOT,ledger=None,namespace=None,io=None,clock=None):
    """Partial destinations are write-only outputs, never Source-admitted reads."""
    validate_wire(wire);header,body=parse_packet(raw)
    if ledger is None or namespace!='linux:'+C.OPERATION+':':raise ValueError('SAME_ROOT_LEDGER_NAMESPACE_REQUIRED')
    io=io or NativeIO();clock=clock or time
    if io.exists(root/'source-stop.json'):raise ValueError('SOURCE_WRITER_ALREADY_STOPPED')
    if header['batch']:
        read_state(root,header['batch'],ledger,namespace,io)
    elif io.exists(root/'batch-state.json'):
        raise ValueError('INITIAL_BATCH_REPLAY')
    offset=0;observations=[];deadline=clock.monotonic()+C.BODY_SECONDS
    for index,start,length in header['items']:
        if clock.monotonic()>=deadline:raise TimeoutError('SOURCE_BODY_48_SECONDS')
        expected=wire['members'][index]
        if start+length>expected['bytes']:raise ValueError('MEMBER_WRITE_CEILING')
        path=root/'inputs'/('%04d.bin'%index)
        flags=os.O_RDWR|os.O_NOFOLLOW
        if start==0:flags|=os.O_CREAT|os.O_EXCL
        else:
            pin=C.nine(io.lstat(str(path)))
            if pin['nlink']!='1' or int(pin['size'])!=start or not stat.S_ISREG(int(pin['mode'])):
                raise ValueError('SOURCE_WRITE_ORIGINAL_OFFSET')
        ledger.can_open();fd=io.open_write(path,flags);primary=None;record=None;registered=False
        try:
            ledger.own(fd,str(path));registered=True
            before=C.nine(io.fstat(fd))
            if before['uid']!='0' or before['gid']!='0' or before['nlink']!='1' or int(before['size'])!=start:
                raise ValueError('SOURCE_WRITE_OWNER_OFFSET')
            io.seek(fd,start);view=memoryview(body)[offset:offset+length]
            while view:
                if clock.monotonic()>=deadline:raise TimeoutError('SOURCE_BODY_48_SECONDS')
                count=io.write(fd,view)
                if type(count)is not int or not 0<count<=len(view):raise OSError('SOURCE_SHORT_WRITE')
                view=view[count:]
            io.sync(fd);after=C.nine(io.fstat(fd))
            if after!=C.nine(io.lstat(str(path))) or int(after['size'])!=start+length:
                raise ValueError('SOURCE_WRITE_SIZE_PATH_NINE')
            complete=start+length==expected['bytes'];seen=None;sha=None
            if complete:
                # Charge this actual complete source-read attempt before its
                # first byte, including a later EOF/hash/deadline failure.
                ledger.admit(namespace+str(path),after,expected['sha256'],expected['bytes'],'NEW_LINUX_COPY_FULL_EOF')
                io.seek(fd,0);h=hashlib.sha256();seen=0
                while True:
                    block=io.read(fd,65536)
                    if not block:break
                    seen+=len(block)
                    if seen>expected['bytes']:raise ValueError('COMPLETE_COPY_READ_CAP')
                    h.update(block)
                    if clock.monotonic()>=deadline:raise TimeoutError('SOURCE_BODY_48_SECONDS')
                sha=h.hexdigest()
                if seen!=expected['bytes'] or sha!=expected['sha256']:raise ValueError('COMPLETE_COPIED_BODY_HASH_EOF')
                if after!=C.nine(io.fstat(fd)) or after!=C.nine(io.lstat(str(path))):raise ValueError('COMPLETE_COPY_FINAL_NINE')
            record={'index':index,'linuxPath':expected['linuxPath'],'writtenBytes':start+length,
                'bytes':seen,'sha256':sha,'PRE9':before,'POST9':after,'fullEOF':complete,
                'complete':complete,'partialDestinationBodyRead':False if not complete else None,
                'sourceAdmitted':complete,'qualification':False}
        except BaseException as error:primary=error
        detach_error=None
        if fd in ledger.live:
            try:ledger.detach(fd)
            except BaseException as error:detach_error=error;ledger.failed_close=True
        try:io.close(fd)
        except BaseException as close:
            ledger.failed_close=True;raise C.SourceFailure(([primary] if primary else [])+([detach_error] if detach_error else [])+[close]) from primary
        if detach_error is not None:raise C.SourceFailure(([primary] if primary else [])+[detach_error]) from primary
        if primary:raise primary
        observations.append(record);offset+=length
    # The fresh state control is immutable for60s before its next Source read.
    state_raw=C.encoded({'next':header['batch']+1});temporary=root/('batch-state-%d.json'%header['batch'])
    ledger.can_open();fd=io.open_write(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW);primary=None;registered=False
    try:
        ledger.own(fd,str(temporary));registered=True;view=memoryview(state_raw)
        while view:
            count=io.write(fd,view)
            if type(count)is not int or not 0<count<=len(view):raise OSError('STATE_SHORT_WRITE')
            view=view[count:]
        io.sync(fd)
    except BaseException as error:primary=error
    detach_error=None
    if fd in ledger.live:
        try:ledger.detach(fd)
        except BaseException as error:detach_error=error;ledger.failed_close=True
    try:io.close(fd)
    except BaseException as close:
        ledger.failed_close=True;raise C.SourceFailure(([primary] if primary else [])+([detach_error] if detach_error else [])+[close]) from primary
    if detach_error is not None:raise C.SourceFailure(([primary] if primary else [])+[detach_error]) from primary
    if primary:raise primary
    io.replace(temporary,root/'batch-state.json');state_nine=C.nine(io.lstat(str(root/'batch-state.json')))
    ledger.admit(namespace+str(root/'batch-state.json'),state_nine,C.digest(state_raw),len(state_raw),'NEW_LINUX_CHANGED_BATCH_CONTROL')
    return {'scope':'SOURCE_COPY_BATCH_ONLY_NOT_COHORT_ACCEPTANCE','batch':header['batch'],'copies':observations,
        'stateNine':state_nine,'stateBytes':len(state_raw),'stateSha256':C.digest(state_raw),
        'sourceEligibility':False,'runtimeAuthority':False}


def stop_writer(wire, root=ROOT, ledger=None, namespace=None,io=None):
    io=io or NativeIO()
    validate_wire(wire)
    if ledger is None or namespace!='linux:'+C.OPERATION+':':raise ValueError('SAME_ROOT_LEDGER_STOP_REQUIRED')
    if read_state(root,9,ledger,namespace,io) != {'next': 9}:
        raise ValueError('ALL_NINE_BATCHES_REQUIRED')
    metadata = []
    for row in wire['members']:
        pin = C.nine(io.lstat(str(root/'inputs'/('%04d.bin' % row['index']))))
        if int(pin['size']) != row['bytes'] or pin['uid'] != '0' or pin['gid'] != '0' or pin['nlink'] != '1':
            raise ValueError('EXACT_COMPLETE_SOURCE_METADATA')
        metadata.append(pin)
    stopped = io.now_ns()
    if any(max(int(pin['mtime_ns']), int(pin['ctime_ns'])) > stopped for pin in metadata):
        raise ValueError('SOURCE_METADATA_AFTER_STOP')
    value = {'scope': 'NEW_LINUX_SOURCE_WRITER_STOP_ONLY', 'operation': C.OPERATION,
        'stoppedUnixNs': str(stopped), 'writers': 'STOPPED', 'remainingWrites': [],
        'memberCount': 135, 'wireSha256': C.digest(C.encoded(wire)), 'sourceEligibility': False}
    raw = C.encoded(value); io.write_stop(root/'source-stop.json', raw,ledger)
    return {'bytes': len(raw), 'sha256': C.digest(raw), 'nine': C.nine(io.lstat(str(root/'source-stop.json'))),'stopValue':value}


def qualify(wire, controls, ledger, fs=None, root=ROOT,clock=None,kernel=None):
    validate_wire(wire)
    rows = [{'path': str(root/'inputs'/('%04d.bin' % r['index'])),
             'ledgerPath': controls['linuxIdentityNamespace'] + r['linuxPath'],
             'bytes': r['bytes'], 'sha256': r['sha256'], 'kind': 'NEW_LINUX_COPY_FULL_EOF'}
            for r in wire['members']]
    rows += controls['controlRows']
    cohort = C.Cohort(rows, ledger, fs=fs, owner=(0, 0))
    clock=clock or time
    primary = None; result = None; deadline = clock.monotonic()+C.BODY_SECONDS
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
        if clock.monotonic() >= deadline:
            raise TimeoutError('SOURCE_BODY_48_SECONDS')
        result = {'scope': 'NEW_LINUX_135_SOURCE_PHYSICAL_EPOCH_ONLY', 'operation': C.OPERATION,
            'kernel': sys.platform if kernel is None else kernel, 'wireSha256': C.digest(C.encoded(wire)),
            'macCarrySha256': wire['macCarrySha256'], 'originalMac130And113AreSeparateLineage': True,
            'oldMacCustodyRepaired': False, 'macSourceGatesReplaced': False,
            'sourceEligibility': False, 'runtimeAuthority': False, 'fullTask03': False, 'fullGoal': False}
    except BaseException as error:
        primary = error
    closed = cohort.final_and_close(primary)
    if closed['closeErrors']:
        raise C.SourceFailure(closed['closeErrors'])
    if clock.monotonic() >= deadline:
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
