"""Publish an explicitly charged, stopped ordinary-source diagnostic packet."""
from pathlib import Path
import ast
import datetime
import hashlib
import json
import os
import stat
import time

OWN = Path(__file__).absolute().parent
ROOT = OWN.parents[4]
FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')


def encode(o):
    return (json.dumps(o, separators=(',', ':'), sort_keys=True) + '\n').encode()


def nine(s):
    return {f: str(getattr(s, 'st_' + f)) for f in FIELDS}


def write(name, raw):
    fd = os.open(OWN / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
    with os.fdopen(fd, 'wb') as out:
        out.write(raw)
        out.flush()
        os.fsync(out.fileno())


read_names = ['raw-census-results1.json', 'prospective-source-plan1.json',
              'actual-enabling-read-ledger1.json', 'same-path-conflicts1.json',
              'assembler-control-results3.json', 'finite_assembler.py',
              'assembler_controls.py', 'prepare_recipe.py', 'finalize_publication.py']
held = []
rows = []
contents = {}
closes = []
try:
    for name in read_names:
        path = OWN / name
        pre = os.lstat(path)
        assert stat.S_ISREG(pre.st_mode) and pre.st_nlink == 1 and pre.st_size <= 16777216
        pin = nine(pre)
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        held.append((name, fd, pin))
        assert pin == nine(os.fstat(fd)) == nine(os.lstat(path))
    for name, fd, pin in held:
        blocks = []
        size = 0
        while True:
            raw = os.read(fd, 65536)
            if not raw:
                break
            blocks.append(raw)
            size += len(raw)
            assert size <= int(pin['size'])
        raw = b''.join(blocks)
        assert size == int(pin['size']) and pin == nine(os.fstat(fd)) == nine(os.lstat(OWN / name))
        contents[name] = raw
        rows.append({'path': str((OWN / name).relative_to(ROOT)), 'bytes': size,
                     'sha256': hashlib.sha256(raw).hexdigest(), 'PRE9': pin,
                     'OPEN9': pin, 'POST9': pin, 'pathPOST9': pin, 'fullEOF': True,
                     'sourceQualification': False})
    for name, fd, pin in held:
        assert pin == nine(os.fstat(fd)) == nine(os.lstat(OWN / name))
finally:
    for name, fd, _ in held:
        try:
            os.close(fd)
            closes.append({'path': str((OWN / name).relative_to(ROOT)), 'attempt': 1, 'error': None})
        except BaseException as e:
            closes.append({'path': str((OWN / name).relative_to(ROOT)), 'attempt': 1, 'error': type(e).__name__})
    assert all(x['error'] is None for x in closes)

plan = json.loads(contents['prospective-source-plan1.json'])
counts = json.loads(contents['raw-census-results1.json'])
initial_ledger = json.loads(contents['actual-enabling-read-ledger1.json'])
controls = json.loads(contents['assembler-control-results3.json'])
source = contents['finite_assembler.py']
assert hashlib.sha256(source).hexdigest() == controls['assemblerSourceSha256']
syntax = []
for name in ('finite_assembler.py', 'assembler_controls.py', 'prepare_recipe.py', 'finalize_publication.py'):
    ast.parse(contents[name], filename=name)
    syntax.append(name)
assert controls['discovered'] == controls['executed'] == controls['passed'] == 40 and controls['skipped'] == 0

# Continue the same ordinary author body ledger; exact repeated snapshots alone
# can deduplicate. This does not retroactively qualify the earlier inspections.
all_reads = list(initial_ledger['rows'])
dedup = 0
for row in rows:
    if any((row['path'], row['bytes'], row['sha256'], row['PRE9']) ==
           (old['path'], old['bytes'], old['sha256'], old['PRE9']) for old in all_reads):
        dedup += 1
    else:
        all_reads.append(row)
assert len(all_reads) <= 4096 and sum(x['bytes'] for x in all_reads) <= 67108864
amendment = {'scope': 'CONTINUED_ONE_ORDINARY_AUTHOR_READ_LEDGER_NOT_SOURCE_GATE',
             'base': 'actual-enabling-read-ledger1.json', 'addedStageRows': rows,
             'exactSamePathAllNineHashLengthReadDeduplications': dedup,
             'totalVersionAdmissions': len(all_reads), 'totalAdmittedReadBytes': sum(x['bytes'] for x in all_reads),
             'wholeGraphFirstBodyClaim': False, 'stagedBootstrapAndPublicationReadbackOnly': True,
             'allOwnedCloseAttempts': closes, 'sourceEligibility': False, 'effects': 0}
write('continued-enabling-read-ledger2.json', encode(amendment))
commands = {'scope': 'FINITE_ACTUAL_SOURCE_ONLY_COMMAND_AND_FAILURE_HISTORY',
            'commands': ['python3 -B assembler_controls.py', 'python3 -B prepare_recipe.py',
                         'python3 -B finite_assembler.py (denied inactive pin mismatch)',
                         'python3 -B assembler_controls.py 2', 'python3 -B prepare_recipe.py 2',
                         'python3 -B finite_assembler.py 2 (denied changed own PRE9)',
                         'python3 -B assembler_controls.py 3', 'python3 -B prepare_recipe.py 3',
                         'python3 -B finite_assembler.py 3 (ordinary census completed)',
                         'python3 -B finalize_publication.py'],
            'maturity': 'Two 60-second waits used for author-output metadata settling; no SOURCE qualification assertion',
            'syntaxParsed': syntax, 'appModuleUIQA': 'NOT_APPLICABLE_SOURCE_CONTROL_PACKET_ONLY_NO_APP_CODE_CHANGE',
            'controlResult': {'discovered': 40, 'executed': 40, 'passed': 40, 'failed': 0, 'skipped': 0},
            'oldFilesOverwritten': 0, 'originalProgramsImportedOrExecuted': 0,
            'network': 0, 'Docker': 0, 'targets': 0, 'privateInputs': 0, 'GitMutations': 0,
            'physicalQualification': False, 'sourceEligibility': False, 'effects': 0}
write('command-and-verification-history1.json', encode(commands))
cohorts = {}
for row in plan['members']:
    v = cohorts.setdefault(row['origins'][0], {'admissions': 0, 'bytes': 0})
    v['admissions'] += 1
    v['bytes'] += row['bytes']
write('known-source-cohort-breakdown1.json', encode({'primaryOriginAssignedOnce': cohorts,
    'sumBytes': sum(x['bytes'] for x in cohorts.values()), 'sourceEligibility': False}))
report = f'''# Task Completion Report

## Status: PARTIAL — finite repair published; original-cap eligibility blocked

The new finite assembler preserves existing files and pins, prevents unapproved inactive-body reads, and publishes the honest known declaration/read union. The unchanged SOURCE cap cannot hold this known graph. L is still active and uncensused, so no complete current source census, source eligibility, handoff, runtime outcome, or functional acceptance is asserted.

The known graph has {counts['knownUniquePaths']:,} distinct paths and {counts['knownVersionAdmissions']:,} version admissions, charged at {counts['knownAdmittedBytes']:,} bytes. Five same-path old/current conflicts remain separately charged: collector, controlling source map, source gate, private coordinator, and official dispatcher. Their old pins are preserved; no content-only dedup or silent original-pin refresh is applied. The separate PLAN is {counts['separatePlanBytes']:,} bytes. With the original MF4MiB, approval1MiB and one aggregate futureDATA2MiB reservations, the known total is {counts['knownTotalBytesWithPlanAndOriginalReserves']:,} bytes, {counts['knownOverCapBytes']:,} bytes over64MiB **before the additional late publications tabulated in final-writer-stop1.json and before L**.

The exact serialization model is {counts['compactManifestCompleteFieldsModelBytes']:,} bytes and preserves all nine fields and PRE/OPEN/POST/pathPOST/EOF keys. It is unexecuted and grants no actual MF saving. The PLAN is charged separately. Existing future Root DATA maxima are retained; the original2MiB aggregate is not reduced or reset when a new receipt has small fields.

## Changes Made

- finite_assembler.py uses a finite recipe, records all actual bootstrap body reads, compares path/FD nine plus full EOF/hash/size, closes every owned FD once, and prevents the inactive188 body's read without explicit re-admission. It never opens the graph's member bodies or executes an actual qualifier.
- recipe3.json separates the minimum prospective assembler inputs from all actual preparation inputs informing this repair. The old builder, lineage MF, current map, parent metadata, original compiler/product/source declarations, required current129, current controls, J6 qualified/producer/host/Root proof references, and J5 current evidence/closed-source references stay visible and chargeable. Including J5's transitive references is conservative and cannot be removed without a finite supported nonuse contract.
- The exact188 decision intersects the located preliminary catalog in136 rows. One mismatched pin (preparation-report.md) is retained unresolved. Only135 matching unread rows are omitted (2,764,493 declared bytes), with no net-savings claim. The 3,600,048-byte lineage MF was actually read while preparing this repair and is explicitly re-admitted. Files and all histories remain in place.
- assembler_controls.py validates40 meaningful source-only outcomes, including all-nine dedup, stale/missing fields, omission/readmission, forbidden-body prevention, original cap boundaries, future DATA path accounting, all bootstrap FDs before first bootstrap body, EOF/hash/empty file handling, and once-close after denial.
- The initial inactive-pin denial and second changed-PRE9 denial are preserved with their unmodified recipes. Their original read instants and unrecorded closure details are not retrospectively qualified. Future author failures automatically publish partial actual ledgers and close attempts.

## Requirements Checklist

- [x] Original4096 paths/simultaneousFDs,64MiB/16MiB, separate1914 custody phase, single futureDATA2MiB, approval1MiB and MF4MiB contracts remain unchanged.
- [x] Finite read set, exact source/hash/nine dedup rule, current-input accounting and preserved failed history — source, recipe, controls and ledgers.
- [x] Actual ordinary bootstrap readback76 bodies /6,553,819 bytes /76 peak FDs /76 successful once-closes; continued publication reads stay in the same ledger amendment. These staged ordinary reads do not assert whole-graph SOURCE first-content acceptance.
- [x] Original/native files, assertions, deadlines and tests untouched; no original program import/execution, services, private inputs, Docker, target action or Git mutation.
- [x] Raw census, exact conflict list, finite pins, stop record, actual read ledger and verification report.
- [ ] Complete stopped current Source/L/F2/Root graph and fresh independent acceptance — pending. Active L's135 physical files, full source-carry/wire/proofs/copies/stops, complete bridge amendments, and late Root source/approval/release/sender documents are explicit unknown obligations, with no guessed admission or savings.
- [ ] SOURCE eligibility, actual handoff, Task03/04 functional acceptance — blocked; Task03/04 remain0/3.

## Verification

- All four own Python sources parse with ast.parse.
- Latest controls:40 discovered/executed/passed,0 failed,0 skipped; result binds the exact assembler SHA and size.
- Application quality/module/UI tests are not applicable: this packet changes no app behavior. No physical/native/runtime check is represented by the source controls.
- Root must independently review before any use. New publishers are self-excluded from their own physical qualification and require later mature Root capture.

## Notes for Reviewer

known-source-cohort-breakdown1.json assigns every charged admission once by primary origin. final-writer-stop1.json adds all exact late publication bytes to the known total without budget reset. All3058 admission rows, five conflicts and292 rows without a declared original nine remain visible in prospective-source-plan1.json. Missing original nines are labelled unqualified metadata observations; they never replace a historical pin. Every actual later input or omitted-history read must be admitted to the original single ledger before Source eligibility. Earlier conversational body-read tuples were not captured and cannot become original custody by this packet.
'''
write('report1.md', report.encode())

# Only this exact finite own list is inspected. No archive/history/hash glob.
names = ['finite_assembler.py', 'assembler_controls.py', 'prepare_recipe.py', 'finalize_publication.py',
         'recipe1.json', 'recipe2.json', 'recipe3.json', 'assembler-control-results1.json',
         'assembler-control-results2.json', 'assembler-control-results3.json',
         'first-assembly-denial1.json', 'second-assembly-denial2.json',
         'prospective-source-plan1.json', 'raw-census-results1.json', 'same-path-conflicts1.json',
         'actual-enabling-read-ledger1.json', 'continued-enabling-read-ledger2.json',
         'command-and-verification-history1.json', 'known-source-cohort-breakdown1.json', 'report1.md']
names += ['controls-fixture' + r + '/file' + str(i) for r in ('1', '2', '3') for i in range(3)]
pins = []
for name in names:
    path = OWN / name
    raw = path.read_bytes()
    pins.append({'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
                 'physicalNine': 'REQUIRES_LATER_MATURE_ROOT_CAPTURE_NO_PUBLISHER_SELF_QUALIFICATION'})
# This pin scan is ordinary publication preparation, and is explicitly recorded
# as such. It never certifies the earlier pin's physical read interval.
write('publication-pin-scan-read-set1.json', encode({'scope': 'ORDINARY_OWN_PUBLICATION_PIN_SCAN',
    'paths': [str(OWN / n) for n in names], 'chargedGlobalBodies': True,
    'physicalSourceQualification': False, 'effects': 0}))
scan_raw = (OWN / 'publication-pin-scan-read-set1.json').read_bytes()
pins.append({'path': str(OWN / 'publication-pin-scan-read-set1.json'), 'bytes': len(scan_raw),
             'sha256': hashlib.sha256(scan_raw).hexdigest(), 'physicalNine': 'PENDING_LATER_ROOT_CAPTURE'})
pinsraw = encode({'scope': 'FINITE_FINAL_SOURCE_REPAIR_PUBLISHER_HASH_SIZE_PINS_ONLY',
                  'members': pins, 'originalPinsRefreshed': False, 'sourceEligibility': False,
                  'selfExcludedPublishers': ['finite-publication-pins1.json', 'final-writer-stop1.json'],
                  'laterRootMaturityMinimumSeconds': 240})
write('finite-publication-pins1.json', pinsraw)
known_paths = {x['path'] for x in plan['members']}
plan_rel = str((OWN / 'prospective-source-plan1.json').relative_to(ROOT))
late = [x for x in pins if str(Path(x['path']).relative_to(ROOT)) not in known_paths
        and str(Path(x['path']).relative_to(ROOT)) != plan_rel]
late_bytes = sum(x['bytes'] for x in late) + len(pinsraw)
stop = {'scope': 'FINITE_SOURCE_ASSEMBLER_REPAIR3_ALL_WRITERS_STOPPED_NOT_SOURCE_ELIGIBILITY',
        'writers': 'STOPPED', 'remainingWrites': [], 'stoppedUnixNs': str(time.time_ns()),
        'timestampUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'knownBasePaths': counts['knownUniquePaths'], 'knownBaseVersionAdmissions': counts['knownVersionAdmissions'],
        'knownBaseAdmittedBytes': counts['knownAdmittedBytes'], 'separatePLANBytes': counts['separatePlanBytes'],
        'originalMFReserveBytes': 4194304, 'originalApprovalReserveBytes': 1048576,
        'oneOriginalFutureDATAReserveBytes': 2097152, 'sourceCapBytes': 67108864,
        'knownBaseTotalBytes': counts['knownTotalBytesWithPlanAndOriginalReserves'],
        'lateOwnPublisherBodies': late, 'finitePinsPublisherBytes': len(pinsraw),
        'finitePinsPublisherSha256': hashlib.sha256(pinsraw).hexdigest(),
        'stopPublisherSelfExcludedFromPhysicalBaseline': True,
        'knownCompleteCurrentSourceCensus': 'UNKNOWN',
        'unknownRequiredInputs': counts['unknownRequiredInputs'], 'samePathConflicts': 5,
        'sourceEligibility': False, 'handoffAuthorized': False, 'physicalQualification': False,
        'functionalTask03': '0/3', 'functionalTask04': '0/3', 'effects': 0,
        'controls': {'discovered': 40, 'executed': 40, 'passed': 40, 'failed': 0, 'skipped': 0},
        'latePublicationBytesIncludingStop': 0, 'stopPublisherBytes': 0,
        'knownTotalIncludingAllLateOwnPublicationsBytes': 0, 'knownOverCapIncludingLateOwnPublicationsBytes': 0}
for _ in range(10):
    sraw = encode(stop)
    stop['stopPublisherBytes'] = len(sraw)
    stop['latePublicationBytesIncludingStop'] = late_bytes + len(sraw)
    stop['knownTotalIncludingAllLateOwnPublicationsBytes'] = counts['knownTotalBytesWithPlanAndOriginalReserves'] + late_bytes + len(sraw)
    stop['knownOverCapIncludingLateOwnPublicationsBytes'] = stop['knownTotalIncludingAllLateOwnPublicationsBytes'] - 67108864
    if len(encode(stop)) == len(sraw):
        break
else:
    raise AssertionError('stop_byte_count_did_not_converge')
sraw = encode(stop)
assert stop['stopPublisherBytes'] == len(sraw)
write('final-writer-stop1.json', sraw)
print(json.dumps({'STOPPED': True, 'pinsBytes': len(pinsraw), 'pinsSha256': hashlib.sha256(pinsraw).hexdigest(),
    'stopBytes': len(sraw), 'stopSha256': hashlib.sha256(sraw).hexdigest(),
    'knownTotalWithAllOwnPublishers': stop['knownTotalIncludingAllLateOwnPublicationsBytes'],
    'knownOverCapWithAllOwnPublishers': stop['knownOverCapIncludingLateOwnPublicationsBytes'],
    'sourceEligibility': False, 'effects': 0}))
