"""Finite source-only physical copies. Never import/evaluate candidate subjects."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import tarfile
import time
import traceback

from acquire_lib import acquire_archive, Decoded, encoded_chunks, held, identity, read_json
from phase_resource import admission
from held_runtime import HeldRuntime

ROOT = Path('/var/tmp/cortex-task04-c8-r3-phase')
REPO = Path('/source-repo')
R2 = Path('/r2')
PHASES = ('full8', 'history', 'original', 'comparison', 'packages')


def same_content_and_nine(current, old):
    return all(current[key] == old[key] for key in ('sha256', 'bytes', 'PRE', 'POST', 'pathPOST'))


def owned_cool(path, observe):
    """Advise only an owned regular FD, retaining actual return/stat equality."""
    path = Path(path)
    if not path.is_relative_to(ROOT) or path.resolve() != path:
        raise ValueError('OWNED_FADVISE_BOUNDARY')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        if before.st_uid != 501 or not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
            raise ValueError('OWNED_FADVISE_LITERAL_FD')
        returned = os.posix_fadvise(fd, 0, 0, os.POSIX_FADV_DONTNEED)
        after = os.fstat(fd)
        if identity(before) != identity(after) or identity(after) != identity(os.lstat(path)):
            raise ValueError('OWNED_FADVISE_IDENTITY_DRIFT')
    finally:
        os.close(fd)
    return {'path': str(path), 'operation': 'POSIX_FADV_DONTNEED_OWNED_FD_ONLY',
            'actualReturn': returned, 'PRE': identity(before), 'POST': identity(after),
            'resourceAfterReadAndAdvice': observe()}


class Ledger:
    def __init__(self, path, row_limit, byte_limit, record_limit):
        self.path = path
        self.stream = open(path, 'xb')
        os.chmod(path, 0o600)
        self.rows = self.bytes = 0
        self.row_limit, self.byte_limit, self.record_limit = row_limit, byte_limit, record_limit

    def append(self, value):
        raw = (json.dumps(value, separators=(',', ':')) + '\n').encode()
        if len(raw) > self.record_limit or self.rows + 1 > self.row_limit or self.bytes + len(raw) > self.byte_limit:
            raise ValueError('COMPLETE_METADATA_CAPACITY_HOLD_NO_ROW_OMISSION')
        self.stream.write(raw)
        self.rows += 1
        self.bytes += len(raw)

    def close(self):
        self.stream.flush()
        os.fsync(self.stream.fileno())
        self.stream.close()


def release_and_binding(plan):
    binding, binding_proof = read_json(ROOT / 'bindings/runtime-binding.json')
    release, release_proof = read_json(ROOT / 'bindings/source-release.json')
    if release.get('scope') != 'SOURCE_ONLY_PHYSICAL_PREPARATION' or release.get('bindingSHA256') != binding_proof['sha256']:
        raise ValueError('SOURCE_BINDING_REVIEW_RELEASE_REQUIRED')
    for record in binding['files']:
        if held(Path(record['path']), lambda _: None) != record:
            raise ValueError('CURRENT_REVIEWED_RUNTIME_HELPER_PIN_DRIFT')
    expected_owner = binding['ownerPOST']
    text = Path('/proc/1/stat').read_text()
    fields = text[text.rfind(')') + 2:].split()
    argv = Path('/proc/1/cmdline').read_bytes()
    if fields[19] != expected_owner['startTime'] or argv.hex() != expected_owner['rawArgvHex']:
        raise ValueError('RETAINED_REVIEWED_PHASE_OWNER_REQUIRED')
    if os.environ.get('PATH') != binding['PATH'] or os.environ.get('HOME') != binding['HOME']:
        raise ValueError('REVIEWED_EFFECTIVE_PATH_HOME_DRIFT')
    return binding, binding_proof, release_proof


def materialize(phase, shared_raw_pins):
    plan, _ = read_json(ROOT / 'tools/plan.json')
    binding, binding_proof, release_proof = release_and_binding(plan)
    observe = lambda: admission(ROOT, plan['physicalAdmissionMaxBytes'], include_mount=False)
    before = observe()
    destination = ROOT / 'cohorts' / phase
    if destination.exists():
        raise ValueError('DISTINCT_COHORT_NAMESPACE_NO_FAILED_PIN_REFRESH')
    destination.mkdir(parents=True, mode=0o700)
    raw_root = ROOT / 'raw-preimages'
    raw_root.mkdir(mode=0o700, exist_ok=True)
    report = ROOT / 'physical-receipts' / phase
    report.mkdir(parents=True, mode=0o700)
    ledger = Ledger(report / 'source-rows.jsonl', plan['physicalRowsIncludingLiteralLinks'],
                    plan['physicalLedgerMaxBytes'], plan['metadataRecordMaxEncodedBytes'])
    started = time.monotonic()
    source_proofs, archive_proofs = [], []
    advice_ledger = Ledger(report / 'owned-fd-advice.jsonl', 5 * plan['physicalRowsIncludingLiteralLinks'], 5 * plan['physicalLedgerMaxBytes'], plan['metadataRecordMaxEncodedBytes'])
    contract, contract_proof = read_json(R2 / 'attempt2/report/acquisition-contract.json')
    source_proofs.append(contract_proof)
    selected, _ = read_json(R2 / 'attempt2/report/selected-object-baselines.json')
    selected = {r['sha256']: r for r in selected['objects']}
    raw_pins = shared_raw_pins

    def copy_stream(source, target, expected_hash, expected_size, mode=0o600):
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with open(target, 'xb') as stream:
            os.chmod(target, mode)
            source_pin = held(source, stream.write)
            stream.flush()
            os.fsync(stream.fileno())
        if source_pin['sha256'] != expected_hash or source_pin['bytes'] != expected_size:
            raise ValueError('FULL_HELD_SOURCE_CONTENT_REQUIREMENT')
        target_pin = held(target, lambda _: None)
        if target_pin['sha256'] != expected_hash or target_pin['bytes'] != expected_size:
            raise ValueError('OWNED_PHYSICAL_CONTENT_READBACK')
        advice_ledger.append(owned_cool(target, observe))
        if Path(source).is_relative_to(ROOT):
            advice_ledger.append(owned_cool(Path(source), observe))
        return source_pin, target_pin

    def ensure_raw(digest, size, physical_source=None):
        path = raw_root / digest
        if digest in raw_pins:
            if held(path, lambda _: None) != raw_pins[digest]:
                raise ValueError('EXISTING_POSITIVE_RAW_PREIMAGE_DRIFT')
            advice_ledger.append(owned_cool(path, observe))
        elif path.exists():
            raise ValueError('UNBOUND_EXISTING_RAW_FILE_NO_IMPLICIT_POSITIVE_REPIN')
        elif digest in selected:
            old = selected[digest]
            source = R2 / Path(old['path']).relative_to('/repair')
            source_pin, current = copy_stream(source, path, digest, size)
            if not same_content_and_nine(source_pin, old):
                raise ValueError('READONLY_R2_SELECTED_POSITIVE_PIN_DRIFT')
            raw_pins[digest] = current
        elif physical_source is not None and physical_source.exists():
            _, current = copy_stream(physical_source, path, digest, size)
            raw_pins[digest] = current
        else:
            raise KeyError(digest)
        if raw_pins[digest]['bytes'] != size or raw_pins[digest]['sha256'] != digest:
            raise ValueError('RAW_EXACT_PREIMAGE_HASH_SIZE')
        return raw_pins[digest]

    rows, links, packages = [], [], None
    if phase == 'full8':
        index, proof = read_json(REPO / '_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1/index.json')
        source_proofs.append(proof)
        mapping, proof = read_json(REPO / '_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1' / index['mapParts'][0]['path'])
        source_proofs.append(proof)
        if len(mapping['files']) != 148325 or len(mapping['roots']) != 8 or proof['decodedSHA256'] != index['mapDecodedSha256']:
            raise ValueError('ORIGINAL_FULL8_MAP_ALL_ROWS_ROOTS')
        rows = [r for r in mapping['files'] if r['kind'] == 'file']
        links = [r for r in mapping['files'] if r['kind'] != 'file']
        del mapping
        observe()
    elif phase == 'history':
        history, proof = read_json(R2 / 'attempt2/report/historical70020-coverage.json', maximum=128914214)
        source_proofs.append(proof)
        rows = [r['declared'] for r in history['members']]
        del history
        observe()
        if len(rows) != 70020 or sum(r['bytes'] for r in rows) != 3001521619:
            raise ValueError('ALL_HIST70020_ROWS_FULL83_OBLIGATIONS')
    elif phase in ('original', 'comparison'):
        lineage, proof = read_json(R2 / 'input-metadata/work/resume/task04-c7-exact-identity-repair/candidate/mirror-source-transform-map.json')
        source_proofs.append(proof)
        for original in lineage['inputs']:
            source = original if phase == 'original' else original['legacyC6']
            rows.append({'path': original['source'], 'sha256': source['sha256'], 'bytes': source['bytes'], 'mode': 0o600})
        if len(rows) != 823:
            raise ValueError('ALL_ORIGINAL_OR_COMPARISON823')
    else:
        inventory, proof = read_json(R2 / 'attempt2/report/seven-package-source-inventory.json')
        source_proofs.append(proof)
        packages = inventory['packages']

    if packages is None:
        wanted = {}
        for row in rows:
            digest, size = row['sha256'], row['bytes']
            if digest in wanted and wanted[digest] != size:
                raise ValueError('COHORT_DECLARED_HASH_SIZE_CONFLICT')
            wanted[digest] = size
            literal = row['path'].removeprefix('/workspace/Project-Cortex/')
            if Path(literal).is_absolute() or '..' in Path(literal).parts:
                raise ValueError('FINITE_LITERAL_SOURCE_PATH')
            try:
                ensure_raw(digest, size, REPO / literal if phase == 'history' else None)
            except KeyError:
                pass
        missing = {digest: size for digest, size in wanted.items() if digest not in raw_pins}
        for route in contract['routes']:
            chosen = {h: n for h, n in missing.items() if h in route['members']}
            if not chosen:
                continue
            stage = report / ('stream-' + route['name'])
            stage.mkdir(mode=0o700)
            proof = acquire_archive(REPO, route, chosen, stage,
                                    after_owned_file=lambda row: advice_ledger.append(owned_cool(Path(row['path']), observe)))
            archive_proofs.append(proof)
            for record in proof['selected']:
                source = Path(record['path'])
                target = raw_root / record['sha256']
                os.rename(source, target)
                # Rename creates a new prospective pin. No earlier path pin is
                # treated as current physical authority after the move.
                raw_pins[record['sha256']] = held(target, lambda _: None)
                missing.pop(record['sha256'])
            observe()
        if missing:
            raise ValueError('REQUIRED_CONTENT_ABSENT_NO_OMISSION')
        for row in rows:
            literal = row['path'].removeprefix('/workspace/Project-Cortex/')
            target = destination / literal
            backing = ensure_raw(row['sha256'], row['bytes'])
            _, physical = copy_stream(Path(backing['path']), target, row['sha256'], row['bytes'], row.get('mode', 0o600))
            ledger.append({'declared': row, 'freshPhysicalSource': physical,
                           'beforeByteBacking': {**backing, 'encoding': 'RAW_EXACT_PREIMAGE'},
                           'historicalIdentityAdopted': False})
        for row in links:
            target_bytes = bytes.fromhex(row['targetHex'])
            if hashlib.sha256(target_bytes).hexdigest() != row['sha256']:
                raise ValueError('ORIGINAL_LITERAL_SYMLINK_TARGET')
            target = destination / row['path'].removeprefix('/workspace/Project-Cortex/')
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            os.symlink(os.fsdecode(target_bytes), target)
            fd = os.open(target, os.O_PATH | os.O_NOFOLLOW)
            try:
                st = os.fstat(fd)
                literal = os.fsencode(os.readlink('', dir_fd=fd))
                post = os.fstat(fd)
                path_post = os.lstat(target)
                if literal != target_bytes or identity(st) != identity(post) or identity(post) != identity(path_post):
                    raise ValueError('LITERAL_ALIAS_HELD_FD_DRIFT')
            finally:
                os.close(fd)
            ledger.append({'declared': row, 'freshLiteralSymlink': str(target),
                           'targetHex': target_bytes.hex(), 'PRE': identity(st), 'POST': identity(post), 'pathPOST': identity(path_post),
                           'historicalIdentityAdopted': False})
            observe()
    else:
        for package in packages:
            archive_record = package['archive']
            archive_path = R2 / Path(archive_record['path']).relative_to('/repair')
            pin = held(archive_path, lambda _: None)
            if not same_content_and_nine(pin, archive_record):
                raise ValueError('READONLY_LOCKED_PACKAGE_SOURCE_PIN_DRIFT')
            expected = {m['path']: m for m in package['members']}
            seen = set()
            gzip_proof = {'parts': []}
            reader = Decoded(encoded_chunks(R2, [{'path': str(archive_path.relative_to(R2)), 'bytes': pin['bytes'], 'sha256': pin['sha256']}], gzip_proof), sum(m['bytes'] for m in expected.values()) + 16 * 1048576)
            with tarfile.open(fileobj=reader, mode='r|') as archive:
                for member in archive:
                    if member.name not in expected or member.name in seen:
                        raise ValueError('LOCKED_PACKAGE_FULL_LITERAL_MEMBER_SET')
                    declared = expected[member.name]
                    seen.add(member.name)
                    if declared['type'] == 'directory':
                        if not member.isdir(): raise ValueError('PACKAGE_DIRECTORY_TYPE')
                        continue
                    if not member.isfile() or declared['type'] != 'regular' or member.size != declared['bytes']:
                        raise ValueError('PACKAGE_REGULAR_SOURCE_TYPE_SIZE')
                    relative = member.name.removeprefix(package['literalArchiveRoot'] + '/')
                    if Path(relative).is_absolute() or '..' in Path(relative).parts:
                        raise ValueError('PACKAGE_LITERAL_BOUNDARY')
                    target = destination / 'node_modules' / package['package'] / relative
                    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                    source = archive.extractfile(member)
                    digest = hashlib.sha256()
                    with source, open(target, 'xb') as stream:
                        os.chmod(target, declared['mode'])
                        while chunk := source.read(1048576):
                            digest.update(chunk); stream.write(chunk)
                        stream.flush(); os.fsync(stream.fileno())
                    if digest.hexdigest() != declared['sha256']:
                        raise ValueError('PACKAGE_FULL_MEMBER_HASH')
                    physical = held(target, lambda _: None)
                    advice_ledger.append(owned_cool(target, observe))
                    backing = ensure_raw(declared['sha256'], declared['bytes'], target)
                    ledger.append({'package': package['package'], 'declared': declared,
                                   'freshPhysicalSource': physical,
                                   'beforeByteBacking': {**backing, 'encoding': 'RAW_EXACT_PREIMAGE'},
                                   'packageImportedOrExecuted': False})
            while reader.read(1048576): pass
            if seen != set(expected) or gzip_proof['encodedSHA256'] != pin['sha256']:
                raise ValueError('PACKAGE_FULL_MEMBERSHIP_EOF_CRC')
            reader.close(); observe()
    ledger.close()
    advice_ledger.close()
    expected_rows = plan['knownCohorts'][{'full8':'FULL8','history':'HIST70020','original':'original823','comparison':'C6comparison823','packages':'sevenPackages'}[phase]]
    if ledger.rows != expected_rows.get('rows', expected_rows.get('regularRows')):
        raise ValueError('EXACT_COMPLETE_COHORT_ROW_COUNT')
    result = {'status': 'SOURCE_ONLY_PHYSICAL_COHORT_COMPLETE_NOT_RUNTIME', 'phase': phase,
              'binding': binding_proof, 'reviewRelease': release_proof,
              'resourcePRE': before, 'resourcePOST': observe(), 'ledgerRows': ledger.rows,
              'ledger': held(ledger.path, lambda _: None), 'archiveProofs': archive_proofs,
              'sourceProofs': source_proofs, 'ownedFDAdviceLedger': held(advice_ledger.path, lambda _: None),
              'rawPins': raw_pins, 'elapsedSeconds': time.monotonic() - started,
              'subjectImportedOrEvaluated': False, 'ROOT': 'ABSENT'}
    raw = (json.dumps(result, indent=2) + '\n').encode()
    if len(raw) > plan['phaseReceiptsMaxBytes']:
        raise ValueError('PHYSICAL_RECEIPT_CAPACITY_HOLD')
    with open(report / 'receipt.json', 'xb') as stream:
        os.chmod(stream.name, 0o600); stream.write(raw); stream.flush(); os.fsync(stream.fileno())
    # This index is versioned and immutable; callers must explicitly identify
    # the latest successful index. A failed previous index is never refreshed.
    index = ROOT / 'bindings' / ('raw-positive-index-' + phase + '.json')
    with open(index, 'xb') as stream:
        os.chmod(stream.name, 0o600)
        stream.write((json.dumps({'objects': raw_pins}, indent=2) + '\n').encode())
        stream.flush(); os.fsync(stream.fileno())
    print(json.dumps({'phase': phase, 'sourceRows': ledger.rows, 'subjects': False}))


if __name__ == '__main__':
    if sys.argv[1:] != ['all'] or os.getuid() != 501:
        raise ValueError('ALL_FIVE_FINITE_SOURCE_COHORTS_ONE_RETAINED_OWNER_PROCESS')
    plan, _ = read_json(ROOT / 'tools/plan.json')
    binding, _, _ = release_and_binding(plan)
    observe = lambda: admission(ROOT, plan['physicalAdmissionMaxBytes'], include_mount=False)
    retained = HeldRuntime(binding, observe)
    shared_positive_raw_pins = {}
    try:
        for cohort_phase in PHASES:
            retained.verify()
            materialize(cohort_phase, shared_positive_raw_pins)
            retained.verify()
    except BaseException as error:
        failure = {'status': 'FAILED_PRESERVED_SOURCE_PREPARATION_NOT_RUNTIME', 'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc(), 'phase': cohort_phase, 'resource': observe(), 'subjects': False, 'ROOT': 'ABSENT'}
        path = ROOT / 'physical-receipts/failure.json'
        with open(path, 'xb') as stream:
            os.chmod(path, 0o600); stream.write((json.dumps(failure, indent=2)+'\n').encode()); stream.flush(); os.fsync(stream.fileno())
        raise
    finally:
        retained.close()
