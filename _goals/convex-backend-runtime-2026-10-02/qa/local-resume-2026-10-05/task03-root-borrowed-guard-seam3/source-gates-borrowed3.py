"""Public-only immutable source and current independent release gates; no private access."""
from pathlib import Path
import hashlib, json, os, stat
R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA = R / '_goals/convex-backend-runtime-2026-10-02/qa'
P = QA / 'local-resume-2026-10-05/task03-attempt6-current-binding-repair2'
Q = QA / 'task03-local-native-attempt6-2026-10-06'
FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')

def identity(s):
    return {k: str(getattr(s, 'st_' + k)) for k in FIELDS}

def strict(raw):

    def pairs(items):
        out = {}
        for k, v in items:
            if k in out:
                raise ValueError('duplicate_public_gate_key')
            out[k] = v
        return out
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=lambda x: (_ for _ in ()).throw(ValueError('nonfinite_gate')))

def digest(raw):
    return hashlib.sha256(raw).hexdigest()
RELEASE_DATA_NAMES = {'independent-preparation-review.json': 32768, 'task03-attempt6-management-review.json': 32768, 'base-public-custody-review.json': 131072, 'current-binding-public-custody-review.json': 131072, 'actual-private-crypto-execution-release.json': 32768, 'actual-private-crypto-independent-review.json': 262144, 'private-key-reuse-authorization.json': 32768, 'runtime/coordinator-status.json': 32768}

def read(path, pin=None):
    assert path.is_absolute() and path.is_relative_to(R) and (path.resolve() == path)
    pre = os.lstat(path)
    relative = str(path.relative_to(P)) if path.is_relative_to(P) else None
    if relative in RELEASE_DATA_NAMES:
        assert pre.st_size <= RELEASE_DATA_NAMES[relative]
        assert sum(RELEASE_DATA_NAMES.values()) <= 2097152, 'single_total_future_release_data_reservation_exceeded'
    assert stat.S_ISREG(pre.st_mode) and pre.st_nlink == 1 and (pre.st_uid == 501) and (pre.st_gid == 20) and (0 <= pre.st_size <= 16 * 1024 * 1024)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        current = identity(pre)
        assert current == identity(os.fstat(fd))
        if pin is not None:
            assert current == pin
        raw = bytearray()
        while (data := os.read(fd, 65536)):
            raw.extend(data)
            assert len(raw) <= pre.st_size
        assert len(raw) == pre.st_size
        assert current == identity(os.fstat(fd)) == identity(os.lstat(path))
        return bytes(raw)
    finally:
        os.close(fd)

class HeldSourceLease:
    """Borrow reviewed Cohort rows; only their original owner closes descriptors."""

    def __init__(self, owner):
        assert type(owner.rows) is list and type(owner.by_path) is dict and owner.rows
        self.owner = owner
        self.owner_rows = owner.rows
        self.detached = False
        self.acquired = []
        self.check_owner()

    def check_owner(self):
        assert not self.detached and self.owner.rows is self.owner_rows, 'closed_or_foreign_source_owner'
        assert len(self.owner.rows) == len(self.owner.by_path) and all((self.owner.by_path[r['path']] is r for r in self.owner.rows))
        assert all(r['ownerToken'] is self.owner.source_owner_token for r in self.owner.rows), 'foreign_descriptor_owner_map'
        fds = [r['fd'] for r in self.owner.rows]
        assert len(fds) == len(set(fds)) and all((type(fd) is int and fd >= 0 for fd in fds))
        selected = [r for r in self.owner.rows if r['source'] or r['data']]
        assert len(selected) + 32 <= 4096, 'one_simultaneous_owned_source_descriptor_ceiling'
        assert self.owner.source_bytes + 2097152 <= 67108864 and self.owner.data_bytes <= 2097152

    def acquire(self, path, pin=None):
        self.check_owner()
        assert path.is_absolute() and path.is_relative_to(R) and (path.resolve() == path)
        assert str(path) in self.owner.by_path, 'incomplete_shared_source_map'
        row = self.owner.by_path[str(path)]
        assert row['private'] is False and row['directory'] is False and (row['source'] or row['data'])
        if pin is not None:
            assert row['originalNine'] == pin, 'foreign_or_stale_shared_source_pin'
        assert row['originalNine']['uid'] == '501' and row['originalNine']['gid'] == '20' and (row['originalNine']['nlink'] == '1')
        assert identity(os.fstat(row['fd'])) == identity(path.lstat()) == row['originalNine']
        if row not in self.acquired:
            self.acquired.append(row)
        return row

    def read(self, path, pin=None):
        row = self.acquire(path, pin)
        raw = self.owner.read(row)
        relative = str(path.relative_to(P)) if path.is_relative_to(P) else None
        assert len(raw) <= 16777216
        if relative in RELEASE_DATA_NAMES:
            assert len(raw) <= RELEASE_DATA_NAMES[relative]
        assert row['fullEOF'] is True and len(raw) == row['bytes'] and (digest(raw) == row['sha256'])
        self.check_owner()
        return raw

    def release(self):
        self.check_owner()
        self.detached = True
        self.acquired = []

class RootBorrowedGuardLease:
    """Root-owned SourceSession projection. Borrowers receive no descriptor IDs.

    External Root authority must bind this guard and the exact adapter module.
    This class supplies no independent Source approval or protected action.
    """
    def __init__(self, borrowed, adapter_module, ledger, expected_caller,
                 external_bridge_verifier):
        assert external_bridge_verifier is not None, 'independent_guard_bridge_binding_required'
        assert type(borrowed) is adapter_module.BorrowedSourceLease
        assert type(borrowed.ownerToken) is adapter_module.SourceSession
        assert borrowed.ledger is ledger and borrowed.ownerToken.ledger is ledger
        assert borrowed._caller == expected_caller and type(expected_caller) is str
        self._original_links = (borrowed, borrowed.ownerToken, ledger, adapter_module, expected_caller)
        self.borrowed = borrowed
        self.owner = borrowed.ownerToken
        self.ledger = ledger
        self.adapter_module = adapter_module
        self.original_rows = borrowed.rows
        self.original_map = borrowed.by_path
        self.original_seal = adapter_module.sha(adapter_module.encode(borrowed.rows))
        self.detached = False
        self.check_owner()
        assert external_bridge_verifier(adapter_module, borrowed, ledger) is True, 'guard_bridge_not_externally_bound'

    def check_owner(self):
        borrowed, owner, ledger, adapter_module, caller = self._original_links
        assert self.borrowed is borrowed and self.owner is owner
        assert self.ledger is ledger and self.adapter_module is adapter_module
        assert type(borrowed) is adapter_module.BorrowedSourceLease
        assert type(owner) is adapter_module.SourceSession
        assert borrowed.ownerToken is owner, 'original_live_borrowed_owner_required'
        assert borrowed.ledger is ledger and owner.ledger is ledger, 'original_live_Root_ledger_required'
        assert borrowed._caller == caller and type(caller) is str, 'original_live_guard_caller_required'
        assert not self.detached and not self.borrowed.closed
        assert not self.owner.closed and self.owner.open_complete
        assert not self.owner.failures and not self.ledger.unknown_close, 'failed_Source_lifetime_cannot_approve'
        assert self.owner.root == R
        self.owner._sealed()
        assert self.borrowed.rows is self.original_rows and self.borrowed.by_path is self.original_map
        assert type(self.original_rows) is tuple and type(self.original_map) is dict
        assert self.adapter_module.sha(self.adapter_module.encode(self.original_rows)) == self.original_seal
        assert len(self.original_rows) == len(self.original_map) == len(self.owner.rows) == len(self.owner.owned)
        assert all(self.original_map[row['path']] is row for row in self.original_rows)
        assert set(self.original_map) == set(self.owner.rows) == set(self.owner.owned)
        assert all(self.owner.api.admission_id(row) == self.owner.api.admission_id(self.owner.rows[row['path']]) for row in self.original_rows)
        assert len(self.ledger.owned_fds) + 32 <= 4096, 'one_simultaneous_owned_source_descriptor_ceiling'
        assert self.borrowed.source_bytes + 2097152 <= 67108864 and self.borrowed.data_bytes <= 2097152
        for path, (fd, row) in self.owner.owned.items():
            assert type(fd) is int and fd >= 0 and self.ledger.owned_fds.get(fd) is self.owner
            assert self.owner.api.admission_id(row) == self.owner.api.admission_id(self.owner.rows[path])

    def acquire(self, path, pin=None):
        try:
            self.check_owner()
            assert path.is_absolute() and path.is_relative_to(R) and path.resolve() == path
            relative = str(path.relative_to(R))
            row = self.borrowed.lookup(relative)
            assert row['nine']['uid'] == '501' and row['nine']['gid'] == '20' and row['nine']['nlink'] == '1'
            if pin is not None:
                assert row['nine'] == pin, 'foreign_or_stale_shared_source_pin'
            fd, owned_row = self.owner.owned[relative]
            self.owner._fence(path, owned_row, fd)
            return {'member': row, 'originalNine': row['nine'], 'bytes': row['bytes'], 'sha256': row['sha256']}
        except BaseException as failure:
            self.owner._failure('guard_borrowed_acquire', failure)
            raise

    def read(self, path, pin=None, operation='read'):
        try:
            row = self.acquire(path, pin)
            raw = self.borrowed.read(row['member'], operation)
            assert len(raw) == row['bytes'] <= 16777216 and digest(raw) == row['sha256']
            relative = str(path.relative_to(P)) if path.is_relative_to(P) else None
            if relative in RELEASE_DATA_NAMES:
                assert len(raw) <= RELEASE_DATA_NAMES[relative]
            self.check_owner()
            return raw
        except BaseException as failure:
            self.owner._failure('guard_borrowed_read', failure)
            raise

    def release(self):
        self.check_owner()
        self.detached = True
        self.borrowed.release()

def source_read(path, pin=None, source_lease=None):
    if source_lease is None:
        return read(path, pin)
    assert type(source_lease) in (HeldSourceLease, RootBorrowedGuardLease)
    return source_lease.read(path, pin)

def expected_source_paths(source_lease=None):
    plan = strict(source_read(P / 'prospective-source-plan.json', source_lease=source_lease))
    assert plan['scope'] == 'TASK03_ATTEMPT6_REPAIR2_FINITE_SOURCE_PLAN_ONLY'
    assert plan['historicalD101OriginalCustody'] == 'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED'
    assert len(plan['members']) == len({row['path'] for row in plan['members']})
    paths = {R / row['path'] for row in plan['members']} | {P / 'prospective-source-plan.json', P / 'source-writers-stopped.json'}
    assert all((path.is_absolute() and path.is_relative_to(R) and (path.resolve() == path) for path in paths))
    return sorted(paths)

def reviewed_source(path, source_lease=None):
    mf = strict(source_read(P / 'prospective-source-manifest.json', source_lease=source_lease))
    approval = strict(source_read(P / 'integrated-source-review.json', source_lease=source_lease))
    assert approval['scope'] == 'TASK03_ATTEMPT6_CURRENT_BINDING_REPAIR2_SOURCE_ONLY' and approval['verdict'] == 'PASS' and (approval['independent'] is True)
    assert digest(source_read(P / 'prospective-source-manifest.json', approval['sourceManifestOriginalNine'], source_lease=source_lease)) == approval['sourceManifestSha256']
    found = [row for row in mf['files'] if row['path'] == str(path.relative_to(R))]
    assert len(found) == 1
    row = found[0]
    raw = source_read(path, row['PRE'], source_lease=source_lease)
    assert len(raw) == row['bytes'] and digest(raw) == row['sha256'] == approval['sources'][row['path']]
    return (row, raw)

def qualify_sources(source_lease=None):
    approvalraw = source_read(P / 'integrated-source-review.json', source_lease=source_lease)
    assert len(approvalraw) <= 1048576
    approval = strict(approvalraw)
    mfraw = source_read(P / 'prospective-source-manifest.json', approval['sourceManifestOriginalNine'], source_lease=source_lease)
    mf = strict(mfraw)
    assert approval['verdict'] == 'PASS' and approval['independent'] is True and (approval['scope'] == 'TASK03_ATTEMPT6_CURRENT_BINDING_REPAIR2_SOURCE_ONLY')
    assert approval['sourceManifestSha256'] == digest(mfraw)
    assert approval['candidateSha256'] == digest(source_read(Q / 'candidate-freeze-attempt6.json', source_lease=source_lease))
    assert mf['scope'] == 'TASK03_ATTEMPT6_REPAIR2_NEW_PROSPECTIVE_SOURCE_CLOSURE_ONLY' and mf['status'] == 'READY_FOR_FRESH_INDEPENDENT_REVIEW' and (mf['sourceWriters'] == 'STOPPED')
    assert mf['historicalD101OriginalCustody'] == 'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED'
    planraw = source_read(P / 'prospective-source-plan.json', source_lease=source_lease)
    assert digest(planraw) == mf['sourcePlanSha256'] == approval['sourcePlanSha256']
    stopraw = source_read(P / 'source-writers-stopped.json', source_lease=source_lease)
    stop = strict(stopraw)
    assert digest(stopraw) == mf['sourceWritersStoppedSha256'] and stop['sourceWriters'] == 'STOPPED' and (stop['remainingSourceWrites'] == [])
    assert int(mf['capturedUnixNs']) >= int(stop['stoppedUnixNs']) + 60000000000
    assert all((max(int(row['PRE']['ctime_ns']), int(row['PRE']['mtime_ns'])) + 60000000000 <= int(mf['capturedUnixNs']) for row in mf['files']))
    assert all((max(int(row['PRE']['ctime_ns']), int(row['PRE']['mtime_ns'])) <= int(stop['stoppedUnixNs']) for row in mf['files'] if row['path'] != str((P / 'source-writers-stopped.json').relative_to(R))))
    assert len(mf['files']) == len({row['path'] for row in mf['files']})
    assert {R / row['path'] for row in mf['files']} == set(expected_source_paths(source_lease=source_lease))
    assert set(approval['sources']) == {row['path'] for row in mf['files']}
    plan = strict(planraw)
    planrows = {row['path']: row for row in plan['members']}
    assert 0 < len(mf['files']) <= 4096 and sum((row['bytes'] for row in mf['files'])) <= 67108864
    assert plan['sourceGraphBudgetIncludesManifestApprovalAndReleaseData'] is True
    assert type(plan['futureReleaseDataByteReserve']) is int and plan['futureReleaseDataByteReserve'] == 2097152
    assert sum((row['bytes'] for row in mf['files'])) + len(mfraw) + len(approvalraw) + plan['futureReleaseDataByteReserve'] <= 67108864, 'whole_declared_source_control_data_graph_not_admitted'
    for row in mf['files']:
        assert type(row['bytes']) is int and 0 <= row['bytes'] <= 16777216
        if row['path'] in planrows:
            assert row['sha256'] == planrows[row['path']]['sha256'] and row['bytes'] == planrows[row['path']]['bytes']
    held = []
    failure = None
    try:
        for row in mf['files']:
            path = R / row['path']
            assert path.is_relative_to(R) and path.resolve() == path
            pre = os.lstat(path)
            assert stat.S_ISREG(pre.st_mode) and pre.st_nlink == 1
            if source_lease is None:
                fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
                try:held.append((path, fd, row))
                except BaseException as original:
                    try:os.close(fd)
                    except BaseException as cleanup:raise RuntimeError('unregistered_gate_fd_close_failed:'+type(original).__name__+':'+type(cleanup).__name__)from original
                    raise
            else:
                borrowed = source_lease.acquire(path, row['PRE'])
                fd = None if type(source_lease) is RootBorrowedGuardLease else borrowed['fd']
                held.append((path, fd, row))
            assert pre.st_uid == 501 and pre.st_gid == 20 and (pre.st_size <= 16777216)
            if type(source_lease) is RootBorrowedGuardLease:
                assert identity(pre) == borrowed['originalNine'] == row['PRE']
            else:
                assert identity(pre) == identity(os.fstat(fd)) == row['PRE']
        for path, fd, row in held:
            raw = bytearray()
            offset = 0
            if type(source_lease) is RootBorrowedGuardLease:
                raw.extend(source_lease.read(path, row['PRE']))
            else:
                while (data := os.pread(fd, 65536, offset)):
                    raw.extend(data)
                    offset += len(data)
                    assert len(raw) <= 16777216
            assert len(raw) == row['bytes'] and digest(raw) == row['sha256'] == approval['sources'][row['path']]
            if type(source_lease) is RootBorrowedGuardLease:
                assert identity(os.lstat(path)) == source_lease.acquire(path, row['PRE'])['originalNine'] == row['PRE']
            else:
                assert identity(os.fstat(fd)) == identity(os.lstat(path)) == row['PRE']
        for path, fd, row in held:
            if type(source_lease) is RootBorrowedGuardLease:
                source_lease.read(path, row['PRE'], operation='hash')
                assert identity(os.lstat(path)) == source_lease.acquire(path, row['PRE'])['originalNine'] == row['PRE']
            else:
                assert identity(os.fstat(fd)) == identity(os.lstat(path)) == row['PRE']
    except BaseException as original:
        failure = original
        raise
    finally:
        if source_lease is None:
            owned = list(held)
            held.clear()
            errors = []
            for path, fd, row in owned:
                try:
                    os.close(fd)
                except BaseException as cleanup:
                    errors.append(type(cleanup).__name__)
            if errors:
                raise RuntimeError('all_attempted_gate_source_close_errors:' + ','.join(errors)) from failure
        else:
            source_lease.check_owner()
    return (approval, digest(approvalraw), digest(mfraw))
OLD = P.parent / 'task03-attempt6-integrated-repair1'
CURRENT_PATH = P / 'current-transport-binding.json'
CURRENT_SHA = '3cf0becc5cbb8718bb01c3566e9cb8d71aae1f8c30348aeff7ac40e3f5e9b08e'
NATIVE_CURRENT_PATH = '/current-transport-binding.json'
SIX = ('operation', 'requestSha256', 'projectSlug', 'projectName', 'teamId', 'privateEnvironmentFile')

def validate_current_binding(binding, request):
    assert set(binding) == set(SIX) | {'forbiddenRetiredDeployments'}
    assert type(binding['teamId']) is int and binding['teamId'] == 325340
    assert all((type(binding[field]) is str for field in SIX if field != 'teamId'))
    for field in SIX:
        expected = digest(json.dumps(request, separators=(',', ':'), ensure_ascii=False).encode()) if field == 'requestSha256' else request[field]
        assert binding[field] == expected, 'current_transport_binding_canonical_field_mismatch'
    assert binding['projectName'] == binding['projectSlug'] == 'cortex-foundation-delta-312f13a61cc6'
    assert binding['forbiddenRetiredDeployments'] == ['efficient-ox-979', 'fiery-setter-784', 'admired-walrus-730', 'quaint-jellyfish-819', 'joyous-ostrich-974', 'gallant-mastiff-565', 'brilliant-chinchilla-648']
    assert request['requiredKind'] == 'cloud' and request['requiredDeploymentType'] == 'dev' and (request['maximumPaidCalls'] == 0)
    assert request['productionDeployment'] is False and request['sharedCiTarget'] is False and (request['retirementRequired'] is True)
    return binding

def qualify_current_binding(source_lease=None):
    row, raw = reviewed_source(CURRENT_PATH, source_lease=source_lease)
    assert digest(raw) == row['sha256'] == CURRENT_SHA
    return validate_current_binding(strict(raw), strict(source_read(Q / 'project-request.json', source_lease=source_lease)))

def qualify_base_public(source_lease=None):
    approval, approval_sha, mf_sha = qualify_sources(source_lease=source_lease)
    binding = strict(source_read(P / 'prospective-binding.json', source_lease=source_lease))
    freeze_sha = digest(source_read(Q / 'candidate-freeze-attempt6.json', source_lease=source_lease))
    assert freeze_sha == binding['freezeSha256'] == approval['candidateSha256']
    request = strict(source_read(Q / 'project-request.json', source_lease=source_lease))
    assert request['operation'] == binding['operation']
    assert digest(json.dumps(request, separators=(',', ':'), ensure_ascii=False).encode()) == binding['requestSha256']
    assert binding['currentTransportBindingPath'] == str(CURRENT_PATH) and binding['currentTransportBindingSha256'] == CURRENT_SHA and (binding['currentTransportBindingNativePath'] == NATIVE_CURRENT_PATH)
    assert binding['additionalCurrentPublicInputs'] == 1 and type(binding['additionalCurrentPublicInputs']) is int
    transport = qualify_current_binding(source_lease=source_lease)
    prep = strict(source_read(P / 'independent-preparation-review.json', source_lease=source_lease))
    assert prep['scope'] == 'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION' and prep['verdict'] == 'PASS' and (prep['independent'] is True)
    assert prep['candidateSha256'] == freeze_sha and type(prep['candidateMembers']) is int and (prep['candidateMembers'] == 1907)
    management = strict(source_read(P / 'task03-attempt6-management-review.json', source_lease=source_lease))
    assert management['scope'] == 'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY' and management['verdict'] == 'PASS' and (management['independent'] is True)
    assert management['managementSourceSha256'] == digest(source_read(P / 'target-management.mjs', source_lease=source_lease)) and management['requestSha256'] == binding['requestSha256']
    custody = strict(source_read(P / 'base-public-custody-review.json', source_lease=source_lease))
    assert custody['scope'] == 'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY' and custody['verdict'] == 'PASS' and (custody['independent'] is True)
    assert custody['operation'] == binding['operation'] and custody['volume'] == binding['volume'] and (custody['candidateSha256'] == freeze_sha)
    assert custody['prospectiveSourceManifestSha256'] == mf_sha
    assert custody['sourceApprovalSha256'] == approval_sha
    assert custody['immutableImage'] == 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
    assert type(custody['publicFiles']) is int and custody['publicFiles'] == 1914 and (binding['publicCopiedFiles'] == 1914) and (binding['candidateMembers'] == 1907)
    assert custody['allCurrentDestinationIdentities'] == 'PASS_ALL9' and custody['currentSourceDestinationFullContent'] == 'PASS'
    assert custody['publicRecipeBindingSha256'] == digest(source_read(OLD / 'public-recipe-binding-final.json', source_lease=source_lease)) and custody['publicSourceManifestSha256'] == digest(source_read(OLD / 'public-source-receipt-manifest-final.json', source_lease=source_lease))
    assert type(custody['publicTransferReceiptSha256']) is str and len(custody['publicTransferReceiptSha256']) == 64 and all((c in '0123456789abcdef' for c in custody['publicTransferReceiptSha256']))
    return {'binding': binding, 'currentTransportBinding': transport, 'approvalSha256': approval_sha, 'sourceManifestSha256': mf_sha, 'publicTransferReceiptSha256': custody['publicTransferReceiptSha256'], 'basePublicDecisionSha256': digest(source_read(P / 'base-public-custody-review.json', source_lease=source_lease))}

def qualify_public_release(source_lease=None):
    released = qualify_base_public(source_lease=source_lease)
    custodyraw = source_read(P / 'current-binding-public-custody-review.json', source_lease=source_lease)
    custody = strict(custodyraw)
    assert custody['scope'] == 'ACTUAL_CURRENT_TRANSPORT_BINDING_PUBLIC_INPUT_ONLY' and custody['verdict'] == 'PASS' and (custody['independent'] is True)
    for field in ('operation', 'volume', 'candidateSha256'):
        expected = released['binding']['freezeSha256'] if field == 'candidateSha256' else released['binding'][field]
        assert custody[field] == expected
    assert custody['sourceManifestSha256'] == released['sourceManifestSha256'] and custody['sourceApprovalSha256'] == released['approvalSha256']
    assert custody['currentTransportBindingSha256'] == CURRENT_SHA and custody['currentTransportBindingSourcePath'] == str(CURRENT_PATH) and (custody['currentTransportBindingNativePath'] == NATIVE_CURRENT_PATH)
    assert custody['currentTransportBindingSixFieldsCanonical'] == 'PASS' and custody['currentTransportBindingFullEOFAllNine'] == 'PASS'
    assert custody['basePublicDecisionSha256'] == released['basePublicDecisionSha256'] and custody['basePublicTransferReceiptSha256'] == released['publicTransferReceiptSha256']
    assert custody['probeSourceSha256'] == digest(source_read(P / 'linux-current-binding-probe.py', source_lease=source_lease)) and custody['probeCoordinatorSha256'] == digest(source_read(P / 'public-current-binding-coordinate.py', source_lease=source_lease))
    assert custody['immutableImage'] == 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
    assert type(custody['additionalPublicInputs']) is int and custody['additionalPublicInputs'] == 1
    assert custody['basePublicCopiedFiles'] == 1914 and type(custody['basePublicCopiedFiles']) is int
    assert custody['privateAccess'] is False and custody['serviceRequests'] == 0 and (type(custody['serviceRequests']) is int) and (custody['targetCreated'] is False)
    native = custody['currentTransportBindingOriginalNine']
    assert set(native) == set(FIELDS) and all((type(v) is str and v.isdecimal() for v in native.values()))
    row, raw = reviewed_source(CURRENT_PATH, source_lease=source_lease)
    assert custody['currentTransportBindingSourceOriginalNine'] == row['PRE'] and native['uid'] == '501' and (native['gid'] == '20') and (native['nlink'] == '1') and (stat.S_IMODE(int(native['mode'])) == 384) and (int(native['size']) == len(raw))
    assert type(custody['actualProbeReceiptSha256']) is str and len(custody['actualProbeReceiptSha256']) == 64 and all((c in '0123456789abcdef' for c in custody['actualProbeReceiptSha256']))
    return {**released, 'currentBindingPublicDecisionSha256': digest(custodyraw), 'currentTransportBindingOriginalNine': native, 'actualProbeReceiptSha256': custody['actualProbeReceiptSha256']}
