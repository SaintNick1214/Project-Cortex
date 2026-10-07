"""Prospective finite SOURCE assembly only; never runs a physical/runtime gate.

All body reads use the explicit recipe.  Conditional inactive histories are
declarations, not files to be rehashed.  Assembly does not bless an old tuple,
refresh historical custody, or turn a serialization model into an actual MF.
"""
from pathlib import Path
import hashlib
import json
import os
import stat
import sys

FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')
CAP_PATHS = 4096
CAP_BYTES = 67108864
CAP_FILE = 16777216
MF_RESERVE = 4194304
APPROVAL_RESERVE = 1048576
DATA_RESERVE = 2097152


class AssemblyDenied(RuntimeError):
    pass


def encode(value):
    return (json.dumps(value, separators=(',', ':'), sort_keys=True) + '\n').encode()


def nine(s):
    return {key: str(getattr(s, 'st_' + key)) for key in FIELDS}


def valid_nine(value, size):
    return (isinstance(value, dict) and set(value) == set(FIELDS)
            and all(isinstance(value[k], str) and value[k].isdigit() for k in FIELDS)
            and value['size'] == str(size))


def safe_path(root, text):
    path = Path(text)
    if not path.is_absolute():
        path = root / path
    if not path.is_relative_to(root) or path.resolve() != path:
        raise AssemblyDenied('path_escape_or_symlink:' + str(path))
    # resolve() alone is insufficient for a nonexistent last component.
    for parent in (path,) + tuple(path.parents):
        s = os.lstat(parent)
        if stat.S_ISLNK(s.st_mode):
            raise AssemblyDenied('parent_or_member_symlink:' + str(parent))
        if parent == root:
            break
    return path


def normalized_row(root, value, origin):
    path = safe_path(root, value['path'])
    size = value['bytes']
    sha = value['sha256']
    if (type(size) is not int or not 0 <= size <= CAP_FILE or
            not isinstance(sha, str) or len(sha) != 64 or
            any(c not in '0123456789abcdef' for c in sha)):
        raise AssemblyDenied('invalid_declared_length_or_hash:' + str(path))
    declared = value.get('PRE', value.get('PRE9', value.get('originalNine')))
    original_serialized_nine = declared
    if declared is not None and set(declared) == set(FIELDS):
        if any(type(v) not in (str, int) for v in declared.values()):
            raise AssemblyDenied('invalid_original_nine_value_type:' + str(path))
        declared = {key: str(declared[key]) for key in FIELDS}
    if declared is not None and not valid_nine(declared, size):
        raise AssemblyDenied('invalid_original_nine:' + str(path))
    current = nine(os.lstat(path))
    if not stat.S_ISREG(int(current['mode'])) or current['nlink'] != '1':
        raise AssemblyDenied('not_single_regular_file:' + str(path))
    # A missing original nine is explicit. This metadata observation never
    # replaces an original pin and has no EOF/custody authority.
    pin = dict(declared) if declared is not None else current
    return {'path': str(path.relative_to(root)), 'bytes': size, 'sha256': sha,
            'nine': pin, 'nineBasis': 'DECLARED_ORIGINAL' if declared else 'UNQUALIFIED_METADATA_ONLY',
            'originalNineMissing': declared is None, 'currentMetadataNine': current,
            'originalSerializedNine': original_serialized_nine,
            'metadataMatchesDeclared': declared is None or current == declared,
            'origins': [origin], 'fullEOF': value.get('fullEOF') is True,
            'historicalD101PRE': value.get('historicalD101PRE')}


def same_admission(a, b):
    # No content-only, inode-only, relative-path-only, or missing-field dedup.
    return (a['path'] == b['path'] and a['bytes'] == b['bytes']
            and a['sha256'] == b['sha256'] and a['nine'] == b['nine']
            and valid_nine(a['nine'], a['bytes']) and valid_nine(b['nine'], b['bytes']))


class Union:
    def __init__(self, root):
        self.root = root
        self.by_path = {}
        self.admissions = []
        self.conflicts = []
        self.exact_deduplications = 0

    def add(self, value, origin):
        row = normalized_row(self.root, value, origin)
        existing = self.by_path.setdefault(row['path'], [])
        for old in existing:
            if same_admission(old, row):
                old['origins'].extend(x for x in row['origins'] if x not in old['origins'])
                old['fullEOF'] = old['fullEOF'] or row['fullEOF']
                self.exact_deduplications += 1
                return old
        if existing:
            self.conflicts.append({'path': row['path'], 'left': existing[0], 'right': row,
                                   'resolution': 'DENY_NEVER_REFRESH_OR_CONTENT_ONLY_DEDUP'})
        existing.append(row)
        self.admissions.append(row)
        return row

    def bytes(self):
        return sum(x['bytes'] for x in self.admissions)


class BodyLedger:
    """Ordinary author read ledger. Its staged reads are NOT whole-graph SOURCE acceptance."""
    def __init__(self, root, specs, forbidden):
        self.root = root
        self.specs = specs
        self.forbidden = forbidden
        self.held = []
        self.rows = []
        self.parent_metadata = {}
        self.close_attempts = []
        self.events = []
        self.cumulative_bytes = 0
        self.peak_fds = 0

    def read_stage(self):
        parsed = {}
        try:
            # Capture all finite bootstrap descriptors BEFORE their first body.
            # This is a bootstrap stage, not a claim about the unopened graph.
            paths = [safe_path(self.root, x['path']) for x in self.specs]
            if len(set(paths)) != len(paths) or len(paths) > CAP_PATHS:
                raise AssemblyDenied('duplicate_or_overcap_bootstrap')
            for path, spec in zip(paths, self.specs):
                rel = str(path.relative_to(self.root))
                if rel in self.forbidden:
                    raise AssemblyDenied('inactive_body_read_requires_explicit_readmission:' + rel)
                pre = os.lstat(path)
                if not stat.S_ISREG(pre.st_mode) or pre.st_nlink != 1 or pre.st_size > CAP_FILE:
                    raise AssemblyDenied('invalid_bootstrap_file:' + rel)
                pin = nine(pre)
                if spec['bytes'] != pre.st_size:
                    raise AssemblyDenied('bootstrap_declared_size_changed:' + rel)
                if spec.get('nine') is not None and spec['nine'] != pin:
                    raise AssemblyDenied('bootstrap_declared_nine_changed:' + rel)
                self.cumulative_bytes += pre.st_size
                if self.cumulative_bytes > CAP_BYTES:
                    raise AssemblyDenied('bootstrap_cumulative_bytes_overcap')
                fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
                try:
                    self.held.append((path, fd, pin, spec))
                except BaseException:
                    os.close(fd)
                    raise
                if nine(os.fstat(fd)) != pin or nine(os.lstat(path)) != pin:
                    raise AssemblyDenied('bootstrap_pre_open_path_mismatch:' + rel)
                for parent in path.parents:
                    self.parent_metadata[str(parent)] = nine(os.lstat(parent))
                    if parent == self.root:
                        break
            self.peak_fds = len(self.held)
            self.events.append({'event': 'ALL_FINITE_BOOTSTRAP_FDS_OPEN_BEFORE_FIRST_BOOTSTRAP_BODY',
                                'count': len(self.held), 'bytes': self.cumulative_bytes})
            for path, fd, pin, spec in self.held:
                chunks = []
                count = 0
                while True:
                    data = os.read(fd, 65536)
                    if not data:
                        break
                    chunks.append(data)
                    count += len(data)
                    if count > int(pin['size']):
                        raise AssemblyDenied('body_exceeded_declared_size')
                raw = b''.join(chunks)
                sha = hashlib.sha256(raw).hexdigest()
                if count != spec['bytes'] or sha != spec['sha256']:
                    raise AssemblyDenied('bootstrap_eof_hash_length_mismatch:' + str(path))
                if nine(os.fstat(fd)) != pin or nine(os.lstat(path)) != pin:
                    raise AssemblyDenied('bootstrap_post_path_mismatch:' + str(path))
                row = {'path': str(path.relative_to(self.root)), 'bytes': count, 'sha256': sha,
                       'PRE9': pin, 'OPEN9': pin, 'POST9': pin, 'pathPOST9': pin,
                       'fullEOF': True, 'role': spec['role'], 'sourceQualification': False}
                self.rows.append(row)
                parsed[spec['key']] = json.loads(raw) if spec.get('json') else raw
            for path, fd, pin, _ in self.held:
                if nine(os.fstat(fd)) != pin or nine(os.lstat(path)) != pin:
                    raise AssemblyDenied('bootstrap_final_path_mismatch:' + str(path))
            return parsed
        finally:
            held = self.held
            self.held = []
            errors = []
            for path, fd, _, _ in held:
                try:
                    os.close(fd)
                    self.close_attempts.append({'path': str(path.relative_to(self.root)), 'attempt': 1, 'error': None})
                except BaseException as error:
                    errors.append(type(error).__name__)
                    self.close_attempts.append({'path': str(path.relative_to(self.root)), 'attempt': 1,
                                                'error': type(error).__name__})
            if errors:
                raise AssemblyDenied('all_source_close_attempted_errors:' + ','.join(errors))


def select_inactive(catalog, proposal, actually_read):
    proposed = {x['path']: x for x in proposal}
    kept, omitted = [], []
    readmitted = sorted(set(proposed) & actually_read)
    for row in catalog:
        candidate = proposed.get(row['path'])
        if candidate is None:
            kept.append(row)
            continue
        if row['bytes'] != candidate['bytes'] or row['sha256'] != candidate['sha256']:
            # Neither refresh the old catalog nor grant an omission from a
            # mismatched declaration. Retain it as unresolved source cost.
            kept.append(row)
            continue
        if row['path'] in actually_read:
            kept.append(row)
        else:
            omitted.append(row)
    return kept, omitted, readmitted


def compact_manifest_model(rows):
    # Every original nine and every EOF/FD/path phase field is retained. The
    # model claims no physical capture. Until an actual complete MF exists,
    # the budget still charges the original 4 MiB reservation.
    return encode({'scope': 'SERIALIZATION_MODEL_ONLY_NO_CUSTODY_OR_SOURCE_ELIGIBILITY',
                   'files': [{'path': r['path'], 'bytes': r['bytes'], 'sha256': r['sha256'],
                              'PRE': r['nine'], 'OPEN': r['nine'], 'POST': r['nine'],
                              'pathPOST': r['nine'], 'fullEOF': False,
                              'capture': 'UNEXECUTED_REQUIRED_FUTURE_WHOLE_GRAPH_INTERVAL'} for r in rows]})


def actual_qualifier_preflight(rows, expected_mf_bytes=MF_RESERVE,
                               approval_bytes=APPROVAL_RESERVE, data_bytes=DATA_RESERVE,
                               future_data_paths=()):
    # Called before opening ANY member/body. Not an actual qualifier.
    if expected_mf_bytes > MF_RESERVE or approval_bytes > APPROVAL_RESERVE or data_bytes > DATA_RESERVE:
        raise AssemblyDenied('original_metadata_approval_or_DATA_cap_exceeded')
    if len({r['path'] for r in rows}) != len(rows):
        raise AssemblyDenied('unresolved_same_path_versions')
    if (len(rows) + 2 + len(set(future_data_paths)) > CAP_PATHS
            or any(r['bytes'] > CAP_FILE for r in rows)):
        raise AssemblyDenied('SOURCE_path_or_file_cap_exceeded')
    if sum(r['bytes'] for r in rows) + expected_mf_bytes + approval_bytes + data_bytes > CAP_BYTES:
        raise AssemblyDenied('SOURCE_whole_union_bytes_overcap_before_any_member_open')
    return 'PREFLIGHT_ONLY_NOT_QUALIFIED'


def assemble(root, recipe, docs, body_rows):
    union = Union(root)
    preliminary = docs['preliminary']
    lineage = docs['lineage']
    inactive = docs['inactive']
    if len(preliminary['members']) != 2572 or sum(x['bytes'] for x in preliminary['members']) != 58854796:
        raise AssemblyDenied('original_preliminary_catalog_changed')
    if len(lineage['files']) != 2352 or inactive['count'] != 188:
        raise AssemblyDenied('original_finite_catalog_counts_changed')
    if docs['inactive_verdict']['verdict'] != 'PASS' or docs['inactive_verdict']['proposal']['sha256'] != recipe['inactiveProposalSha256']:
        raise AssemblyDenied('conditional_inactive_decision_not_exact_proposal')
    actually_read = {r['path'] for r in body_rows}
    kept, omitted, readmitted = select_inactive(preliminary['members'], inactive['rows'], actually_read)
    nines = {r['path']: r for r in lineage['files']}
    for row in kept:
        original = nines.get(row['path'])
        enriched = dict(row)
        if original and (original['sha256'], original['bytes']) == (row['sha256'], row['bytes']):
            enriched['PRE'] = original['PRE']
            enriched['fullEOF'] = original['fullEOF']
        union.add(enriched, 'PRELIMINARY_CATALOG_NOT_CURRENT_ACCEPTANCE')
    # A real author/control/manifest/document read defeats a nonuse claim.
    for row in body_rows:
        union.add(row, 'ACTUAL_REPAIR_ENABLING_BODY_READ')
    required = set()
    for key in ('b3_current', 'root_current', 'u3_current'):
        for row in docs[key]['members']:
            added = union.add(row, key)
            required.add(added['path'])
    for row in inactive['consumers']:
        added = union.add(row, 'STOPPED_32_CURRENT_CONSUMER_CONTRACT')
        required.add(added['path'])
    if len(required) != 129:
        raise AssemblyDenied('original_current129_contract_not_preserved')
    for row in docs['j6']['sourceQualifiedRows']:
        union.add(row, 'J6_DISTINCT_QUALIFIED_SOURCE_INTERVAL_REFERENCE')
    for row in docs['j6']['knownProducerReferences']:
        union.add(row, 'J6_FINITE_PRODUCER_INPUT_SOURCE_CONTROL_RAW_REFERENCE')
    for row in docs['j6_stop']['publisherPins']:
        union.add(row, 'J6_FINAL_SELF_EXCLUDED_PUBLISHER')
    for row in docs['j6_host']['rows']:
        union.add(row, 'J6_REQUIRED_FINITE_HOST_RAW_TRIPLET_REFERENCE')
    for row in docs['j5_refs']['references']:
        union.add(row, 'J5_CURRENT_FINAL_EVIDENCE_REFERENCE')
    for key in ('j5_whole', 'j5_two_gap'):
        for row in docs[key]['rows']:
            union.add(row, key + '_ACTUAL_SOURCE_CUSTODY_REFERENCE')
    for row in docs['j5_stop']['publishersExceptSelf']:
        union.add(row, 'J5_FINAL_SELF_EXCLUDED_PUBLISHER')
    # The stopped producer map has changed since its old consumer pins. Keep
    # those old pins and report conflicts; never silently refresh originals.
    for row in recipe['currentObservedPrograms']:
        union.add(row, 'CURRENT_PROGRAM_METADATA_DECLARATION_REQUIRES_FRESH_AUTHOR_FREEZE')
    for row in recipe['mandatoryPreparationInputs']:
        union.add(row, 'PREPARATION_INPUT_USED_BY_CURRENT_REPAIR')
    for row in recipe['ownSourceInputs']:
        union.add(row, 'CURRENT_FINITE_ASSEMBLER_AND_CONTROLS')
    for row in recipe['rootJ6ParentProofReferences']:
        union.add(row, 'CURRENT_ROOT_J6_FOUR_PARENT_PROOF_INPUT')
    rows = sorted(union.admissions, key=lambda r: (r['path'], r['sha256']))
    proposed_by_path = {r['path']: r for r in inactive['rows']}
    omission_pin_mismatches = [r['path'] for r in preliminary['members']
        if r['path'] in proposed_by_path and
        (r['bytes'], r['sha256']) != (proposed_by_path[r['path']]['bytes'], proposed_by_path[r['path']]['sha256'])]
    # No OLD or supplemental-body glob. No member bodies are opened here.
    if any(r['path'] in {x['path'] for x in omitted} for r in rows):
        raise AssemblyDenied('new_reader_reintroduced_omitted_path_without_readmission')
    model = compact_manifest_model(rows)
    base = {'scope': 'FINITE_PROSPECTIVE_SOURCE_PLAN_ONLY_NOT_EXECUTABLE_HANDOFF',
            'caps': {'pathsAndSimultaneousFDs': CAP_PATHS, 'bytes': CAP_BYTES, 'perFile': CAP_FILE},
            'members': rows, 'conditionalInactiveOmissions': [x['path'] for x in omitted],
            'inactiveActuallyReadReadmissions': readmitted, 'requiredCurrent129': sorted(required),
            'mismatchedInactivePinsRetainedUnresolved': omission_pin_mismatches,
            'historicalCustodyRepaired': False, 'originalPinsRefreshed': False,
            'sourceEligibility': False, 'runtimeAcceptance': False, 'effects': 0,
            'unknownRequiredInputs': recipe['unknownRequiredInputs'],
            'futureDATA': recipe['futureDATA'], 'futureDATAAggregateReserve': DATA_RESERVE,
            'approvalReserve': APPROVAL_RESERVE, 'actualMF': None,
            'manifestReserveUntilActualCompleteMF': MF_RESERVE,
            'publisherBodiesAreAdditionalChargedInputs': True}
    plan_raw = encode(base)
    # The separate PLAN is never smuggled into or confused with the MF.
    total = union.bytes() + len(plan_raw) + MF_RESERVE + APPROVAL_RESERVE + DATA_RESERVE
    unique = len(union.by_path)
    totals = {'scope': 'EXACT_KNOWN_DECLARATION_UNION_PLUS_ACTUAL_REPAIR_READS_ONLY',
              'knownUniquePaths': unique, 'knownVersionAdmissions': len(rows),
              'knownAdmittedBytes': union.bytes(), 'separatePlanBytes': len(plan_raw),
              'actualManifestBytes': None, 'manifestReserveBytes': MF_RESERVE,
              'compactManifestCompleteFieldsModelBytes': len(model),
              'compactModelIsActualMFSaving': False, 'approvalReserveBytes': APPROVAL_RESERVE,
              'oneFutureDATAReserveBytes': DATA_RESERVE, 'knownTotalBytesWithPlanAndOriginalReserves': total,
              'knownOverCapBytes': max(0, total - CAP_BYTES), 'exactDeduplications': union.exact_deduplications,
              'samePathConflicts': len(union.conflicts), 'metadataMismatchAdmissions':
              sum(not r['metadataMatchesDeclared'] for r in rows),
              'originalNineMissingAdmissions': sum(r['originalNineMissing'] for r in rows),
              'conditional188CatalogIntersectionOmitted': len(omitted),
              'conditional188OmittedCatalogBytes': sum(x['bytes'] for x in omitted),
              'mismatchedInactivePinsRetainedUnresolved': omission_pin_mismatches,
              'omissionArithmeticIsNetSavings': False,
              'newMinimumAssemblerReadSet': recipe['minimumFutureAssemblerReadKeys'],
              'actualPreparationBodyReadPathsRemainCharged': [r['path'] for r in body_rows],
              'currentCompleteSourceCensus': 'UNKNOWN', 'unknownRequiredInputs': recipe['unknownRequiredInputs'],
              'verdict': 'BLOCKED_KNOWN_OVER_CAP_AND_UNCLOSED_CURRENT_INPUTS' if total > CAP_BYTES else 'BLOCKED_UNCLOSED_CURRENT_INPUTS',
              'sourceEligibility': False, 'functionalTask03': '0/3', 'functionalTask04': '0/3', 'effects': 0}
    return base, totals, union.conflicts, model


def publish_new(path, raw):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
    with os.fdopen(fd, 'wb') as out:
        out.write(raw)
        out.flush()
        os.fsync(out.fileno())


def main():
    own = Path(__file__).absolute().parent
    root = own.parents[4]
    # The recipe is a finite explicit bootstrap, never a metadata exemption.
    run = sys.argv[1] if len(sys.argv) > 1 else '1'
    if not run.isdigit():
        raise AssemblyDenied('invalid_recipe_run')
    recipe_path = own / ('recipe' + run + '.json')
    rraw = recipe_path.read_bytes()
    recipe = json.loads(rraw)
    if root != Path(recipe['root']):
        raise AssemblyDenied('wrong_checkout')
    specs = recipe['bootstrapBodies']
    # Recipe and self are body inputs too. They are admitted with current
    # ordinary-author metadata and charged; later SOURCE custody is pending.
    for key, path in (('own_recipe', recipe_path), ('own_assembler', Path(__file__).absolute())):
        raw = path.read_bytes()
        specs.append({'key': key, 'path': str(path.relative_to(root)), 'bytes': len(raw),
                      'sha256': hashlib.sha256(raw).hexdigest(), 'nine': nine(os.lstat(path)),
                      'role': 'EXPLICIT_SELF_BOOTSTRAP_ORDINARY_READ_NOT_SOURCE_ACCEPTANCE', 'json': False})
    ledger = BodyLedger(root, specs, recipe['metadataOnlyInactiveForbiddenBodyPaths'])
    try:
        docs = ledger.read_stage()
        plan, totals, conflicts, model = assemble(root, recipe, docs, ledger.rows)
    except BaseException as error:
        # Preserve the actual partial ledger and all once-only close attempts;
        # an author failure is never repaired by overwriting an old recipe.
        publish_new(own / ('failed-assembly-ledger' + run + '.json'), encode({
            'rows': ledger.rows, 'events': ledger.events, 'bytesChargedBeforeFailure': ledger.cumulative_bytes,
            'closeAttempts': ledger.close_attempts, 'sourceEligibility': False, 'effects': 0}))
        publish_new(own / ('assembly-denial' + run + '.json'), encode({
            'scope': 'PRESERVED_ORDINARY_AUTHOR_ASSEMBLY_DENIAL', 'error': str(error),
            'recipePath': str(recipe_path), 'sourceEligibility': False, 'effects': 0}))
        raise
    outputs = {'prospective-source-plan1.json': encode(plan), 'raw-census-results1.json': encode(totals),
               'same-path-conflicts1.json': encode({'conflicts': conflicts, 'sourceEligibility': False}),
               'actual-enabling-read-ledger1.json': encode({'scope': 'ORDINARY_AUTHOR_READBACK_NOT_SOURCE_ACCEPTANCE',
                   'rows': ledger.rows, 'uniquePaths': len(ledger.rows), 'bytes': ledger.cumulative_bytes,
                   'events': ledger.events, 'parentMetadata': ledger.parent_metadata,
                   'peakOwnedFDs': ledger.peak_fds, 'allOwnedCloseAttempts': ledger.close_attempts,
                   'sourceEligibility': False, 'effects': 0})}
    for name, raw in outputs.items():
        publish_new(own / name, raw)
    print(json.dumps(totals, separators=(',', ':')))


if __name__ == '__main__':
    main()
