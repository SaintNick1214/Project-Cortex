"""Reviewable finite framing/schedule. Effects require the separate Root actor."""
import struct

PAYLOAD = 300000
HEADER = 27684


def frames(carry, bodies):
    if len(carry['members']) != 135 or len(bodies) != 135:
        raise ValueError('EXACT_135_BODIES')
    result = []; pending = []; content = bytearray()
    for row in carry['members']:
        raw = bodies[row['index']]
        if type(raw) is not bytes or len(raw) != row['bytes'] or C.digest(raw) != row['sha256']:
            raise ValueError('EXACT_CARRY_BODY_SIZE_HASH')
        start = 0
        # Empty inputs still get one explicit zero-length owned file creation.
        while start < len(raw) or (not raw and start == 0):
            room = PAYLOAD-len(content); count = min(room, len(raw)-start)
            pending.append([row['index'], start, count]); content.extend(raw[start:start+count]); start += count
            if len(content) == PAYLOAD:
                result.append(packet(len(result), pending, bytes(content))); pending = []; content = bytearray()
            if not raw:
                break
    if pending:
        result.append(packet(len(result), pending, bytes(content)))
    if len(result) != 9:
        raise ValueError('EXACT_NINE_FINITE_BATCHES')
    return result


def packet(batch, items, body):
    header = C.encoded({'operation': C.OPERATION, 'batch': batch, 'items': items,
                        'bytes': len(body), 'sha256': C.digest(body)})
    if len(header) > HEADER or len(body) > PAYLOAD:
        raise ValueError('BOUNDED_BINARY_FRAME')
    raw = struct.pack('>Q', len(header)) + header + body
    if len(raw) > C.STDIN_BYTES:
        raise ValueError('ORIGINAL_COMMON_STDIN_327692')
    return raw


def schedule():
    rows = []
    def add(label, timeout, mutates=False, owned='none', cleanup=0):
        rows.append({'number': len(rows)+1, 'label': label, 'timeoutSeconds': timeout,
            'mutates': mutates, 'ownershipState': owned, 'cleanupReserveCommands': cleanup,
            'stdinBytesMaximum': C.STDIN_BYTES if label.startswith('batch-') or label in ('seed-source-helper', 'qualifier-start-with-ledger') else 0,
            'stdinSeconds': 12, 'stdoutBytesMaximum': C.STREAM_BYTES, 'stderrBytesMaximum': C.STREAM_BYTES})
    for label in ('daemon-inspect', 'image-inspect', 'both-container-absence', 'both-volume-absence'):
        add(label, 30)
    add('create-input-volume', 30, True, 'input', 2)
    add('create-result-volume', 30, True, 'both-volumes', 4)
    add('inspect-both-volume-mappings', 30, False, 'both-volumes', 4)
    add('writer-create', 30, True, 'writer-and-volumes', 6)
    add('writer-prestart-exact-inspect', 30, False, 'writer-and-volumes', 6)
    add('writer-start', 30, True, 'writer-running', 8)
    add('writer-poststart-exact-inspect', 30, False, 'writer-running', 8)
    add('seed-source-helper', 48, True, 'writer-running', 8)
    add('copy-immutable-full-ledger', 30, True, 'writer-running', 8)
    for batch in range(9):
        add('writer-inspect-before-batch-%d' % batch, 30, False, 'writer-running', 8)
        add('batch-%d' % batch, 48, True, 'writer-running', 8)
    add('writer-inspect-before-stop', 30, False, 'writer-running', 8)
    add('write-genuine-source-stop', 48, True, 'writer-running', 8)
    add('writer-inspect-before-owned-stop', 30, False, 'writer-running', 8)
    add('owned-writer-stop', 48, True, 'writer-terminal', 6)
    add('writer-terminal-inspect', 30, False, 'writer-terminal', 6)
    add('qualifier-create', 30, True, 'both-containers-writer-terminal', 6)
    add('qualifier-prestart-exact-inspect', 30, False, 'both-containers-writer-terminal', 6)
    add('qualifier-start-with-ledger', 48, True, 'qualifier-running', 8)
    add('qualifier-terminal-inspect', 30, False, 'both-terminal', 6)
    add('single-receipt-export', 30, False, 'both-terminal', 6)
    for label in ('cleanup-inspect-both-containers', 'cleanup-inspect-both-volumes',
                  'cleanup-remove-owned-containers', 'cleanup-both-container-absence',
                  'cleanup-remove-owned-volumes', 'cleanup-both-volume-absence'):
        add(label, 30, label.startswith('cleanup-remove'), 'cleanup', 0)
    if len(rows) != 47:
        raise ValueError('FORTY_SEVEN_NOMINAL_COMMANDS_WITH_ONE_FAILURE_STOP_RESERVE')
    for row in rows[:42]:
        if row['number'] + row['cleanupReserveCommands'] > 48:
            raise ValueError('PREFIX_CLEANUP_NOT_ADMITTED')
    return rows


def exact(actual, expected, where='fixture'):
    if type(actual) is not type(expected):
        raise ValueError('EXACT_TYPED_'+where)
    if type(expected) is dict:
        if set(actual) != set(expected): raise ValueError('EXACT_FIELDS_'+where)
        for key in expected: exact(actual[key], expected[key], where+'.'+key)
    elif type(expected) is list:
        if len(actual) != len(expected): raise ValueError('EXACT_LENGTH_'+where)
        for i, item in enumerate(expected): exact(actual[i], item, where+'.'+str(i))
    elif actual != expected:
        raise ValueError('EXACT_VALUE_'+where)
    return True


def verify_fixture(actual, expected):
    return exact(actual, expected)


def merge_suffix(ledger, base_export, amendments, returned):
    """Reconstruct the exact ordered base+suffix; no parent row can disappear."""
    if returned['baseLedgerSha256'] != base_export['sha256']:
        raise ValueError('INHERITED_SOURCE_LEDGER_NOT_PRESERVED')
    if returned['amendmentsSha256'] != C.digest(C.encoded(amendments)):
        raise ValueError('AMENDMENT_PREVIOUS_STATE_HASH')
    rows = returned['newAdmissions']
    if type(rows) is not list or rows[:len(amendments)] != amendments:
        raise ValueError('AMENDMENT_OMISSION_ORDER_OR_FABRICATION')
    reconstruction = C.Ledger.inherit(base_export['body'], base_export['sha256'])
    reconstruction.inherited_live = ledger.snapshot()['liveOwnedSourceFDs']
    reconstruction.peak = ledger.peak
    for row in rows:
        if set(row) != {'path','PRE9','sha256','bytes','kind'}:
            raise ValueError('EXACT_RETURNED_SOURCE_ROW')
        if not reconstruction.admit(row['path'], row['PRE9'], row['sha256'], row['bytes'], row['kind']):
            raise ValueError('DUPLICATE_OR_OVERLAPPING_RETURNED_ADMISSION')
        if not row['path'].startswith('linux:'+C.OPERATION+':') and row not in amendments:
            raise ValueError('FABRICATED_NONLINUX_SOURCE_ADMISSION')
    summary = returned['completeNewLedgerSummary']
    current = reconstruction.snapshot()
    for name in ('uniquePaths','admissions','bytes','liveOwnedSourceFDs','noReset','metadataExemption','stickyUnknownClose'):
        if type(summary[name]) is not type(current[name]) or summary[name] != current[name]:
            raise ValueError('COMPLETE_NEW_LEDGER_SUMMARY_'+name)
    C.integer(summary['peakOwnedSourceFDs'], current['peakOwnedSourceFDs'], C.MAX_FILES, 'SOURCE_FD_PEAK')
    reconstruction.peak = summary['peakOwnedSourceFDs']
    if reconstruction.export()['sha256'] != returned['completeNewLedgerSha256']:
        raise ValueError('COMPLETE_NEW_STATE_HASH')
    # Parent has the same complete admission set; re-admit only exact suffix
    # identities, deduping unchanged original physical pins, never changed tuples.
    for row in rows:
        ledger.admit(row['path'], row['PRE9'], row['sha256'], row['bytes'], row['kind'])
    ledger.peak=max(ledger.peak,summary['peakOwnedSourceFDs'])
    return rows


def validate_new_linux_rows(rows,amendments,namespace,expected,require_pinned=True):
    for row in rows[len(amendments):]:
        if row['path'] not in expected:raise ValueError('UNDECLARED_NEW_LINUX_SOURCE_PATH')
        spec=expected[row['path']]
        if (row['bytes'],row['sha256'],row['kind'])!=(spec['bytes'],spec['sha256'],spec['kind']):
            raise ValueError('FABRICATED_LINUX_SOURCE_CHARGE')
        C.valid_nine(row['PRE9'])
        if row['path']!=namespace+spec['linuxPath'] or row['PRE9']['uid']!='0' or row['PRE9']['gid']!='0' or row['PRE9']['nlink']!='1' or int(row['PRE9']['size'])!=row['bytes']:
            raise ValueError('EXACT_NEW_LINUX_PHYSICAL_IDENTITY')
        if require_pinned and 'PRE9' in spec and row['PRE9']!=spec['PRE9']:
            raise ValueError('ORIGINAL_NEW_LINUX_PHYSICAL_PIN_CHANGED')
    return True


def charge_failed_attempts(ledger,base,amendments,returned,namespace,expected):
    """Charge failed reads before denial; this envelope grants no authority."""
    fields={'scope','operation','baseLedgerSha256','amendmentsSha256','newAdmissions',
        'bootstrapAttemptedRows','bootstrapCloseOnce','errors','stickyUnknownClose',
        'sourceEligibility','runtimeAuthority','macSourceGatesReplaced'}
    if type(returned)is not dict or set(returned)!=fields:raise ValueError('EXACT_FAILED_ATTEMPT_ENVELOPE')
    for key,value in {'scope':'FAILED_LINUX_SOURCE_ATTEMPTS_ONLY','operation':C.OPERATION,
        'baseLedgerSha256':base['sha256'],'amendmentsSha256':C.digest(C.encoded(amendments)),
        'sourceEligibility':False,'runtimeAuthority':False,'macSourceGatesReplaced':False}.items():exact(returned[key],value)
    if type(returned['errors'])is not list or not returned['errors'] or not all(type(e)is str for e in returned['errors']):
        raise ValueError('STICKY_FAILED_SOURCE_ERRORS_REQUIRED')
    if type(returned['stickyUnknownClose'])is not bool:raise ValueError('TYPED_FAILED_CLOSE_STATE')
    rows=returned['newAdmissions']
    if type(rows)is not list or rows[:len(amendments)]!=amendments:raise ValueError('FAILED_ATTEMPT_PREVIOUS_STATE_NOT_PRESERVED')
    reconstruction=C.Ledger.inherit(base['body'],base['sha256'])
    seen=set()
    for row in rows:
        if type(row)is not dict or set(row)!={'path','PRE9','sha256','bytes','kind'}:raise ValueError('FAILED_ATTEMPT_EXACT_ROW')
        key=(row['path'],tuple(C.valid_nine(row['PRE9'])[x] for x in C.FIELDS),row['sha256'],row['bytes'])
        if key in seen:raise ValueError('FAILED_ATTEMPT_DUPLICATE_ROW')
        seen.add(key)
        if not reconstruction.admit(row['path'],row['PRE9'],row['sha256'],row['bytes'],row['kind']):raise ValueError('FAILED_ATTEMPT_BASE_OVERLAP')
    validate_new_linux_rows(rows,amendments,namespace,expected,require_pinned=False)
    attempted=returned['bootstrapAttemptedRows'];closed=returned['bootstrapCloseOnce']
    if type(attempted)is not list or type(closed)is not list or len(set(closed))!=len(closed):raise ValueError('FAILED_ATTEMPT_CLOSE_MAP')
    if any(r not in rows for r in attempted) or any(namespace+p not in {r['path'] for r in attempted} for p in closed):
        raise ValueError('FAILED_ATTEMPT_OWNERSHIP_MAP')
    # Do not mark the ledger sticky until every finite attempted charge has
    # been conserved; unknown close can never enable further dispatch.
    for row in rows:ledger.admit(row['path'],row['PRE9'],row['sha256'],row['bytes'],row['kind'])
    if returned['stickyUnknownClose']:ledger.failed_close=True
    return {'scope':'FAILED_ATTEMPTS_CHARGED_NO_SOURCE_ACCEPTANCE','rows':len(rows),
        'sourceEligibility':False,'runtimeAuthority':False,'stickyFailure':True}
