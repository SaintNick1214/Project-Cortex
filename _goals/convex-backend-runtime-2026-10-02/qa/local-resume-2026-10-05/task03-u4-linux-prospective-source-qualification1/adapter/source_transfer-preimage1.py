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
    add('writer-start', 30, True, 'writer-running', 7)
    add('writer-poststart-exact-inspect', 30, False, 'writer-running', 7)
    add('seed-source-helper', 48, True, 'writer-running', 7)
    for batch in range(9):
        add('writer-inspect-before-batch-%d' % batch, 30, False, 'writer-running', 7)
        add('batch-%d' % batch, 48, True, 'writer-running', 7)
    add('writer-inspect-before-stop', 30, False, 'writer-running', 7)
    add('write-genuine-source-stop', 48, True, 'writer-running', 7)
    add('writer-inspect-before-owned-stop', 30, False, 'writer-running', 7)
    add('owned-writer-stop', 48, True, 'writer-terminal', 6)
    add('writer-terminal-inspect', 30, False, 'writer-terminal', 6)
    add('qualifier-create', 30, True, 'both-containers-writer-terminal', 6)
    add('qualifier-prestart-exact-inspect', 30, False, 'both-containers-writer-terminal', 6)
    add('qualifier-start-with-ledger', 48, True, 'qualifier-running', 7)
    add('qualifier-wait', 48, False, 'qualifier-running', 7)
    add('qualifier-terminal-inspect', 30, False, 'both-terminal', 6)
    add('qualifier-logs', 30, False, 'both-terminal', 6)
    add('single-receipt-export', 30, False, 'both-terminal', 6)
    for label in ('cleanup-inspect-both-containers', 'cleanup-inspect-both-volumes',
                  'cleanup-remove-owned-containers', 'cleanup-both-container-absence',
                  'cleanup-remove-owned-volumes', 'cleanup-both-volume-absence'):
        add(label, 30, label.startswith('cleanup-remove'), 'cleanup', 0)
    if len(rows) != 48:
        raise ValueError('WHOLE_48_COMMAND_PLAN')
    for row in rows[:42]:
        if row['number'] + row['cleanupReserveCommands'] > 48:
            raise ValueError('PREFIX_CLEANUP_NOT_ADMITTED')
    return rows


def verify_fixture(actual, expected):
    # Exact complete fields, not a subset containing a convenient label.
    if type(actual) is not dict or type(expected) is not dict or set(actual) != set(expected):
        raise ValueError('EXACT_FIXTURE_FIELD_SET')
    for key in expected:
        if type(actual[key]) is not type(expected[key]) or actual[key] != expected[key]:
            raise ValueError('EXACT_TYPED_FIXTURE_' + key)
    return True


def reconcile(inherited, returned, expected_rows):
    if returned['inheritedDigest'] != inherited['digest']:
        raise ValueError('INHERITED_SOURCE_LEDGER_NOT_PRESERVED')
    if returned['baseAdmissions'] != inherited['admissions'] or returned['baseBytes'] != inherited['bytes']:
        raise ValueError('CROSS_KERNEL_SOURCE_LEDGER_RESET')
    rows = returned['actualLinuxRows']
    if len({row['physicalNamespacePath'] for row in rows}) != len(rows):
        raise ValueError('DUPLICATE_LINUX_PHYSICAL_PATH')
    if {row['physicalNamespacePath'] for row in rows} != set(expected_rows):
        raise ValueError('MISSING_OR_FOREIGN_LINUX_PATH')
    for row in rows:
        if not row['physicalNamespacePath'].startswith(returned['linuxIdentityNamespace']):
            raise ValueError('CROSS_KERNEL_NAMESPACE_OVERLAP')
        expected = expected_rows[row['physicalNamespacePath']]
        if row['bytes'] != expected['bytes'] or row['sha256'] != expected['sha256']:
            raise ValueError('FABRICATED_LINUX_ADMISSION')
        C.valid_nine(row['PRE9'])
        if int(row['PRE9']['size']) != row['bytes'] or row['PRE9']['uid'] != '0' or row['PRE9']['gid'] != '0':
            raise ValueError('ACTUAL_LINUX_NINE_ACCOUNTING')
    if inherited['bytes'] + sum(row['bytes'] for row in rows) > C.MAX_BYTES or inherited['uniquePaths'] + len(rows) > C.MAX_FILES:
        raise ValueError('ONE_NONRESET_SOURCE_CAP')
    return rows
