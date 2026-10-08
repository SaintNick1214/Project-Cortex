"""Reviewed -c entry: acquire all source descriptors before any source body.

Only stdlib is imported before verified source compilation. This text is supplied
from Root-held reviewed bytes; no .pyc, module cache, or source-path import is used.
"""
import hashlib
import json
import math
import os
import stat
import sys
import time
import types

FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')


def pin(value):
    return {key: str(getattr(value, 'st_'+key)) for key in FIELDS}


def strict(raw):
    def pairs(items):
        out = {}
        for key, value in items:
            if key in out:
                raise ValueError('BOOTSTRAP_DUPLICATE_KEY')
            out[key] = value
        return out
    def bad(value):
        raise ValueError('BOOTSTRAP_NONFINITE')
    def floating(value):
        result=float(value)
        if not math.isfinite(result):bad(value)
        return result
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=bad,parse_float=floating)


def canonical(value):
    return (json.dumps(value, separators=(',', ':'), allow_nan=False)+'\n').encode()


class BootstrapFailure(RuntimeError):
    def __init__(self,envelope):
        self.envelope=envelope
        super().__init__('BOOTSTRAP_STICKY_FAILURE_CHAIN: '+repr(envelope['errors']))


def execute(contract, action, raw_input, fs=os, now=time.time_ns, qualification_fs=None,clock=None,write_io=None,qualification_kernel=None):
    clock=clock or time
    started=clock.monotonic()
    def on_time():
        if clock.monotonic()-started>=48:raise TimeoutError('WHOLE_SOURCE_BOOTSTRAP_BODY_48_SECONDS')
    if set(contract) != {'operation', 'sourceRows', 'baseLedgerSha256', 'amendments',
                         'amendmentsSha256', 'linuxIdentityNamespace', 'wireSha256', 'rootLiveFDs', 'rootPeakFDs'}:
        raise ValueError('EXACT_BOOTSTRAP_CONTRACT')
    rows = contract['sourceRows']
    if contract['linuxIdentityNamespace']!='linux:'+contract['operation']+':':raise ValueError('EXACT_CURRENT_LINUX_PHYSICAL_NAMESPACE')
    if len(rows) != 4 or {r['name'] for r in rows} != {'C', 'Q', 'wire', 'base'}:
        raise ValueError('EXACT_FOUR_BOOTSTRAP_SOURCES')
    if len({r['path'] for r in rows}) != 4:
        raise ValueError('BOOTSTRAP_UNIQUE_SOURCES')
    if type(contract['rootLiveFDs']) is not int or not 0<=contract['rootLiveFDs']<=4092:
        raise ValueError('WHOLE_ROOT_AND_LINUX_FDS_BEFORE_FIRST_OPEN')
    if type(contract['rootPeakFDs']) is not int or not contract['rootLiveFDs']<=contract['rootPeakFDs']<=4096:
        raise ValueError('EXACT_ROOT_SOURCE_PEAK_BEFORE_FIRST_OPEN')
    bodies = {}; observations = []; failure_slots=[None]*32;failure_count=0;primary=None;result=None
    attempted=[];close_failed=False
    def failure(value):
        nonlocal failure_count
        failure_slots[failure_count]=value;failure_count+=1
    # Allocate ownership records before first open; registration cannot leave a
    # newly acquired handle outside the all-attempts outer lifetime.
    entries = [{'row': r, 'fd': None, 'pin': None, 'closed': False} for r in rows]
    try:
        for entry in entries:
            on_time()
            row = entry['row']; path = row['path']
            if path not in ('/source-epoch/source_contract.py', '/source-epoch/linux_source_qualifier.py',
                            '/source-epoch/wire-manifest.json', '/source-epoch/base-ledger.json'):
                raise ValueError('BOOTSTRAP_EXACT_PATH')
            before = pin(fs.lstat(path))
            if before['uid'] != '0' or before['gid'] != '0' or before['nlink'] != '1' or not stat.S_ISREG(int(before['mode'])):
                raise ValueError('BOOTSTRAP_OWNER_REGULAR')
            if type(row['bytes']) is not int or not 0 <= row['bytes'] <= 16777216 or int(before['size']) != row['bytes']:
                raise ValueError('BOOTSTRAP_SIZE')
            if now()-max(int(before['mtime_ns']), int(before['ctime_ns'])) < 60000000000:
                raise ValueError('BOOTSTRAP_SOURCE_60_SECONDS')
            entry['pin'] = before
            attempted.append({'path':contract['linuxIdentityNamespace']+path,'PRE9':before,
                'sha256':row['sha256'],'bytes':row['bytes'],'kind':'NEW_LINUX_BOOTSTRAP_SOURCE'})
            fd = fs.open(path, os.O_RDONLY | os.O_NOFOLLOW)
            entry['fd'] = fd  # immediate preallocated owner, before fstat
            if pin(fs.fstat(fd)) != before:
                raise ValueError('BOOTSTRAP_OPEN_NINE')
        for entry in entries:
            row = entry['row']; chunks = []; count = 0; h = hashlib.sha256()
            while True:
                on_time()
                raw = fs.read(entry['fd'], 65536)
                if not raw:
                    break
                count += len(raw)
                if count > row['bytes']:
                    raise ValueError('BOOTSTRAP_BOUNDED_EOF')
                h.update(raw); chunks.append(raw)
            if count != row['bytes'] or h.hexdigest() != row['sha256']:
                raise ValueError('BOOTSTRAP_FULL_EOF_HASH')
            if pin(fs.fstat(entry['fd'])) != entry['pin'] or pin(fs.lstat(row['path'])) != entry['pin']:
                raise ValueError('BOOTSTRAP_POST_NINE')
            bodies[row['name']] = b''.join(chunks)
            observations.append({'path': contract['linuxIdentityNamespace']+row['path'],
                'PRE9': entry['pin'], 'sha256': row['sha256'], 'bytes': count,
                'kind': 'NEW_LINUX_BOOTSTRAP_SOURCE', 'fullEOF': True})
        base = strict(bodies['base'])
        on_time()
        if hashlib.sha256(canonical(base)).hexdigest() != contract['baseLedgerSha256']:
            raise ValueError('COMPLETE_BASE_LEDGER_HASH')
        amendments = contract['amendments']
        if hashlib.sha256(canonical(amendments)).hexdigest() != contract['amendmentsSha256']:
            raise ValueError('COMPLETE_AMENDMENT_HASH')
        # Validate the entire original parent table with verified C, then charge
        # all current actual Linux physical sources before compiling Q/effects.
        C = types.ModuleType('held_source_contract')
        exec(compile(bodies['C'], rows[0]['path'], 'exec', dont_inherit=True), C.__dict__)
        ledger = C.Ledger.inherit(base, contract['baseLedgerSha256'])
        base_keys = set(ledger.admissions)
        ledger.inherited_live = C.integer(contract['rootLiveFDs'], base['summary']['liveOwnedSourceFDs'], C.MAX_FILES, 'EXACT_CURRENT_ROOT_LIVE_SOURCE_FDS')
        ledger.peak = C.integer(contract['rootPeakFDs'], ledger.peak, C.MAX_FILES, 'EXACT_CURRENT_ROOT_SOURCE_FD_PEAK')
        for row in amendments:
            if set(row) != {'path', 'PRE9', 'sha256', 'bytes', 'kind'}:
                raise ValueError('EXACT_AMENDMENT_ROW')
            if not ledger.admit(row['path'], row['PRE9'], row['sha256'], row['bytes'], row['kind']):
                raise ValueError('AMENDMENT_OVERLAP_OR_DUPLICATE')
        if len(ledger.live)+ledger.inherited_live+len(entries) > C.MAX_FILES:
            raise ValueError('WHOLE_ROOT_AND_LINUX_LIVE_SOURCE_FDS')
        for entry, observation in zip(entries, observations):
            ledger.admit(observation['path'], observation['PRE9'], observation['sha256'], observation['bytes'], observation['kind'])
            ledger.own(entry['fd'], observation['path'])
        Q = types.ModuleType('held_linux_qualifier'); Q.C = C
        exec(compile(bodies['Q'], rows[1]['path'], 'exec', dont_inherit=True), Q.__dict__)
        wire = C.strict(bodies['wire'])
        if C.digest(bodies['wire']) != contract['wireSha256'] or contract['operation'] != C.OPERATION:
            raise ValueError('CURRENT_REVIEWED_WIRE_OPERATION')
        Q.validate_wire(wire)
        on_time()
        if action == 'write':
            result = Q.write_batch(wire, raw_input, ledger=ledger, namespace=contract['linuxIdentityNamespace'],clock=clock,io=write_io)
            ledger.admit(contract['linuxIdentityNamespace']+'/source-epoch/batch-state.json', result['stateNine'], result['stateSha256'], result['stateBytes'], 'NEW_LINUX_CHANGED_BATCH_CONTROL')
        elif action == 'stop':
            result = Q.stop_writer(wire, ledger=ledger, namespace=contract['linuxIdentityNamespace'],io=write_io)
            ledger.admit(contract['linuxIdentityNamespace']+'/source-epoch/source-stop.json', result['nine'], result['sha256'], result['bytes'], 'NEW_LINUX_SOURCE_STOP')
        elif action == 'qualify':
            controls = C.strict(raw_input)
            result = Q.qualify(wire, controls, ledger,fs=qualification_fs,clock=clock,kernel=qualification_kernel)
        else:
            raise ValueError('BOOTSTRAP_ACTION')
        result['baseLedgerSha256'] = contract['baseLedgerSha256']
        result['amendmentsSha256'] = contract['amendmentsSha256']
        result['bootstrapFullEOFActualRows'] = observations
    except BaseException as error:
        primary=error;failure(error)
    finally:
        for entry in entries:
            fd = entry['fd']
            if fd is None:
                continue
            try:
                if pin(fs.fstat(fd)) != entry['pin'] or pin(fs.lstat(entry['row']['path'])) != entry['pin']:
                    raise ValueError('BOOTSTRAP_FINAL_NINE')
            except BaseException as error:
                failure(error)
        for entry in entries:
            fd = entry['fd']
            if fd is None:
                continue
            entry['fd'] = None; entry['closed'] = True
            try:
                if 'ledger' in locals() and fd in ledger.live:ledger.detach(fd)
            except BaseException as error:failure(error)
            try:
                fs.close(fd)
            except BaseException as error:
                failure(error)
                close_failed=True
                if 'ledger' in locals(): ledger.failed_close = True
    try:on_time()
    except BaseException as error:failure(error)
    failed_ledger=locals().get('ledger')
    def envelope():
        if failed_ledger is not None:
            exported=failed_ledger.export()
            new_rows=[r for r in exported['body']['members']
                if (r['path'],tuple(r['PRE9'][x] for x in FIELDS),r['sha256'],r['bytes']) not in base_keys]
        else:new_rows=list(contract['amendments'])
        known={(r['path'],tuple(r['PRE9'][x] for x in FIELDS),r['sha256'],r['bytes']) for r in new_rows}
        for row in attempted:
            key=(row['path'],tuple(row['PRE9'][x] for x in FIELDS),row['sha256'],row['bytes'])
            if key not in known:new_rows.append(row);known.add(key)
        value={'scope':'FAILED_LINUX_SOURCE_ATTEMPTS_ONLY','operation':contract['operation'],
            'baseLedgerSha256':contract['baseLedgerSha256'],'amendmentsSha256':contract['amendmentsSha256'],
            'newAdmissions':new_rows,'bootstrapAttemptedRows':attempted,
            'bootstrapCloseOnce':[e['row']['path'] for e in entries if e['closed']],
            'errors':[repr(x) for x in failure_slots[:failure_count]],'stickyUnknownClose':bool(close_failed or (failed_ledger is not None and failed_ledger.failed_close)),
            'sourceEligibility':False,'runtimeAuthority':False,'macSourceGatesReplaced':False}
        return value
    if failure_count:raise BootstrapFailure(envelope()) from primary
    exported = ledger.export()
    result['completeNewLedgerSha256'] = exported['sha256']
    # Root retains the complete base; return the complete ordered suffix rather
    # than duplicating a potentially16MiB ledger onto a262144-byte output pipe.
    result['newAdmissions'] = [r for r in exported['body']['members']
        if (r['path'], tuple(r['PRE9'][x] for x in FIELDS), r['sha256'], r['bytes']) not in base_keys]
    result['completeNewLedgerSummary'] = exported['body']['summary']
    result['bootstrapCloseOnce'] = [e['row']['path'] for e in entries if e['closed']]
    try:on_time()  # includes final encoding preparation and every close
    except BaseException as error:
        failure(error);raise BootstrapFailure(envelope()) from error
    return result


def entry():
    if sys.platform != 'linux' or sys.version_info[:2] != (3, 12):
        raise ValueError('EXACT_LINUX_SOURCE_ONLY_INTERPRETER')
    if len(sys.argv) != 3:
        raise ValueError('EXACT_BOOTSTRAP_ARGV')
    contract = strict(sys.argv[1]); action = sys.argv[2]
    raw = sys.stdin.buffer.read(327693)
    if len(raw) > 327692:
        raise ValueError('BOOTSTRAP_ORIGINAL_STDIN_CAP')
    # An own-process alarm enforces the distinct48s body through final closes.
    import signal
    expired_flag=[False];deadline=time.monotonic()+48
    def expired(number, frame): expired_flag[0]=True
    class WholeBodyClock:
        def monotonic(self):
            current=time.monotonic()
            if expired_flag[0] or current>=deadline:raise TimeoutError('BOOTSTRAP_BODY_48_SECONDS')
            return current
    prior = signal.signal(signal.SIGALRM, expired)
    signal.setitimer(signal.ITIMER_REAL, 48)
    try:
        try:result = execute(contract, action, raw,clock=WholeBodyClock())
        except BootstrapFailure as failure:
            output=canonical(failure.envelope)
            if len(output)>262144:raise ValueError('FAILED_SOURCE_ATTEMPT_OUTPUT_CAP') from failure
            sys.stdout.buffer.write(output);sys.stdout.buffer.flush()
            raise SystemExit(23) from failure
        output = canonical(result)
        if len(output) > 262144:
            raise ValueError('BOOTSTRAP_ORIGINAL_OUTPUT_CAP')
        WholeBodyClock().monotonic()
        sys.stdout.buffer.write(output); sys.stdout.buffer.flush()
        WholeBodyClock().monotonic()
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0); signal.signal(signal.SIGALRM, prior)


if __name__ == '__main__':
    entry()
