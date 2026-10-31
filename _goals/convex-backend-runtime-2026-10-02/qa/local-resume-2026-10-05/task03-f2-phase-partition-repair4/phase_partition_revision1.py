"""Prospective finite SOURCE/custody contract; no live entry or effect operation.

Production partition requires a caller-supplied independent review verifier.
JSON verdicts, origin labels and this packet's mock outcomes are not authority.
Every pre-readiness enabling read shares one cumulative ledger. Existing entry
programs are unchanged and cannot consume this schema without reviewed adapters.
"""
from dataclasses import dataclass
from pathlib import PurePosixPath, Path
import hashlib
import json
import os
import stat
import time

FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')
CAPS = {'paths': 4096, 'bytes': 67108864, 'file': 16777216,
        'MF': 4194304, 'approval': 1048576, 'DATA': 2097152}
COUNTS = {'MacOriginal130': 130, 'MacOriginal113': 113,
          'currentPrograms32': 32, 'requiredCurrent129': 129,
          'Q6ProgramSeeds5': 5, 'originalProgramComparands13': 13,
          'rootNode119': 119, 'rootCompiler114': 114, 'rootCLI5': 5,
          'sourcePreflight161': 161, 'copyPreflight138': 138,
          'frozen1907': 1907, 'actual1914': 1914, 'actual3828FDs': 3828,
          'actualPairBytes': 67266864}
ASSERTIONS = (
    'Mac130_all9_EOF_hash_size_final_onceclose',
    'Mac113_all9_EOF_hash_size_final_onceclose',
    'actual1914_exact1907_plus7_no_dropped_members',
    'actual3828_source_destination_FDs_before_first_member_body',
    'actual1914_original9_EOF_hash_size_final_held_onceclose',
    'compiler114_exact_root_projected_distinct_pairs',
    'compiler114_original9_EOF_hash_size_final_held_onceclose',
    'sourcePreflight161_138_1907_full_bodies',
    'originalCLI_node24.15.0_npm12.2.0_TS6.0.3_three_exit0',
    'original13_distinct_physical_comparands_not_Q6_aliases',
    'current32_required129_Q6seed5_Source_approved_before_actual1914',
    'original_deadlines_case_assertions_and61criteria_unchanged',
    'all_current_source_control_data_4096_64MiB_16MiB_oneDATA2MiB',
    'all_guards_before_any_key_private_target_inference',
    'no_pin_refresh_no_graph_reset_no_read_debt_refund')
ADAPTERS = ('collector', 'G', 'U3', 'B3', 'RootDriver')
OPS = {'read', 'hash', 'parse', 'import', 'compile', 'execute', 'schema', 'control'}
SOURCE_ROLES = {'program', 'schema', 'control', 'document', 'header', 'approval', 'DATA', 'CLI'}


class Denied(RuntimeError):
    """Sticky prospective contract denial, never a functional task verdict."""


def encode(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()


def digest(value):
    return hashlib.sha256(encode(value)).hexdigest()


def nine(s):
    return {k: str(getattr(s, 'st_' + k)) for k in FIELDS}


def valid_row(row):
    if not isinstance(row, dict):
        raise Denied('row_type')
    path = row.get('path'); size = row.get('bytes'); sha = row.get('sha256'); pin = row.get('nine')
    if (not isinstance(path, str) or not path or PurePosixPath(path).is_absolute()
            or '..' in PurePosixPath(path).parts or str(PurePosixPath(path)) != path):
        raise Denied('row_path')
    if (type(size) is not int or not 0 <= size <= CAPS['file']
            or not isinstance(sha, str) or len(sha) != 64
            or any(c not in '0123456789abcdef' for c in sha)):
        raise Denied('row_size_hash')
    if (not isinstance(pin, dict) or set(pin) != set(FIELDS)
            or any(type(v) is not str or not v.isdigit() for v in pin.values())
            or pin['size'] != str(size)):
        raise Denied('row_literal9')
    return row


def admission_id(row):
    valid_row(row)
    # Full path, all literal nine, size and hash. Equal content at another
    # physical path never deduplicates root/projected/original comparands.
    return digest({k: row[k] for k in ('path', 'bytes', 'sha256', 'nine')})


class Ledger:
    """Single SOURCE conservation ledger, shared across every adapter/phase."""
    def __init__(self, inherited=()):
        self.rows = {}; self.paths = set(); self.read_debts = set(); self.events = []
        for row in inherited:
            self.admit(row, debt=True, reason='inherited_actual_enabling_read')

    @property
    def byte_count(self):
        return sum(r['bytes'] for r in self.rows.values())

    def admit(self, row, debt=False, reason='declared_SOURCE'):
        key = admission_id(row)
        if debt:
            self.read_debts.add(key)
        if key not in self.rows:
            self.rows[key] = dict(row); self.paths.add(row['path'])
        self.events.append({'admission': key, 'reason': reason, 'actualReadDebt': debt})
        # Conservation is sticky: an over-budget admission is recorded before
        # denying, so failed attempts cannot be refunded by a new label/run.
        if len(self.paths) > CAPS['paths'] or self.byte_count > CAPS['bytes']:
            raise Denied('same_cumulative_SOURCE_cap_exceeded')
        return key

    def authorize_use(self, row, caller, operation, edges, phase='SOURCE'):
        key = admission_id(row)
        if phase not in ('SOURCE', 'SOURCE_REVIEW', 'SOURCE_APPROVED'):
            raise Denied('enabling_body_phase_laundering')
        permitted = {(e['caller'], e['target'], e['operation']) for e in edges}
        if operation not in OPS or (caller, key, operation) not in permitted:
            raise Denied('undeclared_hidden_body_use_before_open')
        # Hash/import/compile are reads even when the caller returns no body.
        self.admit(row, debt=True, reason=caller + ':' + operation)
        return key

    def refund(self, *_args, **_kwargs):
        raise Denied('read_debt_refund_forbidden')

    def clone_for_new_phase(self):
        raise Denied('independent_pool_or_cap_reset_forbidden')

    def preflight(self, mf=CAPS['MF'], approval=CAPS['approval'], data=CAPS['DATA'],
                  future_paths=()):
        if (type(mf) is not int or not 0 <= mf <= CAPS['MF']
                or type(approval) is not int or not 0 <= approval <= CAPS['approval']
                or data != CAPS['DATA'] or type(data) is not int):
            raise Denied('original_MF_approval_oneDATA_caps')
        # Single declared aggregate DATA reserve stays 2MiB regardless of
        # current receipt size. No separate DATA reservation per adapter.
        if self.byte_count + mf + approval + data > CAPS['bytes']:
            raise Denied('SOURCE_union_plus_actual_or_original_reserves_over64M')
        if len(self.paths | set(future_paths)) + 2 > CAPS['paths']:
            raise Denied('SOURCE_paths_with_MF_approval_DATA_over4096')
        samepath = {}
        for row in self.rows.values():
            samepath.setdefault(row['path'], []).append(admission_id(row))
        if any(len(v) > 1 for v in samepath.values()):
            raise Denied('unresolved_same_path_versions')
        return {'knownBytes': self.byte_count, 'knownPaths': len(self.paths),
                'totalWithOriginalReserves': self.byte_count + mf + approval + data,
                'qualification': False}


def validate_contract(recipe):
    if recipe.get('schema') != 'task03-prospective-phase-partition-v1':
        raise Denied('schema_version')
    if recipe.get('caps') != CAPS or recipe.get('counts') != COUNTS:
        raise Denied('original_counts_or_caps_changed')
    if recipe.get('assertions') != list(ASSERTIONS):
        raise Denied('original_assertion_loss_or_reorder')
    members = recipe.get('members')
    if not isinstance(members, list) or not members:
        raise Denied('missing_finite_members')
    byid = {}
    for row in members:
        key = admission_id(row)
        if key in byid:
            raise Denied('duplicate_admission_in_recipe')
        byid[key] = row
    for name, expected in (('currentPrograms', 32), ('requiredCurrent', 129),
                           ('Q6Seeds', 5), ('originalComparands', 13),
                           ('frozen', 1907), ('rootCompiler', 114), ('rootCLI', 5)):
        keys = recipe.get('cohorts', {}).get(name)
        if (not isinstance(keys, list) or len(keys) != expected or len(set(keys)) != expected
                or not set(keys) <= set(byid)):
            raise Denied('missing_or_changed_exact_cohort:' + name)
    if set(recipe['cohorts']['rootCompiler']) & set(recipe['cohorts']['rootCLI']):
        raise Denied('root119_compiler_CLI_overlap')
    frozenpaths = {byid[k]['path'] for k in recipe['cohorts']['frozen']}
    if len(frozenpaths) != 1907:
        raise Denied('frozen_original_paths_alias')
    data = recipe.get('futureDATA')
    if (not isinstance(data, list) or len({r['path'] for r in data}) != len(data)
            or any(type(r.get('maxBytes')) is not int or r['maxBytes'] < 0 for r in data)
            or sum(r['maxBytes'] for r in data) > CAPS['DATA']):
        raise Denied('oneDATA_named_aggregate')
    return byid


@dataclass(frozen=True)
class ReviewWitness:
    graph_sha256: str
    adapter_sha256: str
    conservation_sha256: str
    programs_sha256: str
    review_receipt_sha256: str
    independent_authority: object


def proof_of_nonuse(recipe, proof, review_verifier=None):
    """Returns exact custody-only admissions only after external fresh review.

    No production caller is supplied in this packet. The author must integrate
    the independent stopped/mature/FD review authority, including every body-use
    edge and executable bypass inspection, before this result is adoptable.
    """
    byid = validate_contract(recipe)
    if recipe.get('unknownRequiredInputs') or recipe.get('unresolvedEdges'):
        raise Denied('unknown_inputs_or_edges_cannot_close_nonuse')
    if recipe.get('writers') != 'STOPPED' or not recipe.get('stopSha256'):
        raise Denied('unstopped_graph')
    if not isinstance(proof, dict) or proof.get('recipeSha256') != digest(recipe):
        raise Denied('stale_nonuse_recipe_binding')
    edges = recipe.get('bodyUseEdges')
    if not isinstance(edges, list):
        raise Denied('missing_body_use_edge_map')
    programs = set(recipe['cohorts']['currentPrograms'] + recipe['cohorts']['Q6Seeds']
                   + recipe['cohorts']['originalComparands'])
    if set(recipe.get('programApprovals', {})) != programs:
        raise Denied('every_Source_program_approval_required_before_actual1914')
    for key in programs:
        if recipe['programApprovals'][key] != byid[key]['sha256']:
            raise Denied('program_approval_hash_changed')
    adapter_map = recipe.get('adapters', {})
    if set(adapter_map) != set(ADAPTERS):
        raise Denied('missing_required_adapter_edge')
    for name, edge in adapter_map.items():
        if (edge.get('state') != 'INDEPENDENTLY_REVIEWED'
                or edge.get('program') not in byid
                or edge.get('sha256') != byid[edge['program']]['sha256']
                or edge.get('direct_IO') != 'DENY_OUTSIDE_HELD_BROKER'
                or edge.get('assertionsSha256') != digest(list(ASSERTIONS))):
            raise Denied('adapter_not_closed:' + name)
    for edge in edges:
        if (edge.get('caller') not in programs or edge.get('target') not in byid
                or edge.get('operation') not in OPS):
            raise Denied('unresolved_dynamic_import_control_edge')
    # Closure review binds adapters/program bodies, edge map, declared reads,
    # exact physical tuple conservation and current unknown-input closure.
    if review_verifier is None:
        raise Denied('fresh_independent_review_verifier_required')
    witness = review_verifier(recipe, proof)
    expected = (digest(edges), digest(adapter_map), digest(recipe['conservation']),
                digest(recipe['programApprovals']))
    if (not isinstance(witness, ReviewWitness) or witness.independent_authority is None
            or (witness.graph_sha256, witness.adapter_sha256,
                witness.conservation_sha256, witness.programs_sha256) != expected
            or len(witness.review_receipt_sha256) != 64):
        raise Denied('independent_review_witness_unbound')
    used = {e['target'] for e in edges} | set(recipe['actualReadDebts']) | programs
    only = set()
    for key in recipe.get('proposedCustodyOnly', []):
        row = byid.get(key)
        if row is None:
            raise Denied('unknown_custody_candidate')
        if key in used or set(row.get('roles', ())) & SOURCE_ROLES:
            raise Denied('mixed_role_or_read_debt_cannot_defer:' + row['path'])
        if row.get('nineBasis') != 'DECLARED_ORIGINAL' or row.get('originalNineMissing'):
            raise Denied('missing_original9_cannot_close_custody_only')
        if not set(row.get('roles', ())) <= {'candidateCustody', 'compilerCustody'}:
            raise Denied('unsupported_nonuse_class')
        only.add(key)
    if set(proof.get('exactCustodyOnly', ())) != only:
        raise Denied('proof_custody_set_not_exact')
    return only, witness


def assemble(recipe, proof=None, review_verifier=None):
    byid = validate_contract(recipe)
    ledger = Ledger()
    custody = set()
    reason = 'NO_CLOSED_PROOF_ALL_INHERITED_DECLARATIONS_REMAIN_SOURCE_CHARGED'
    if proof is not None:
        custody, _ = proof_of_nonuse(recipe, proof, review_verifier)
        reason = 'EXACT_REVIEWED_PROSPECTIVE_PARTITION_NOT_CURRENT_ADOPTION'
    debts = set(recipe['actualReadDebts'])
    if not debts <= set(byid):
        raise Denied('missing_actual_read_debt_input')
    charged = []
    for key, row in byid.items():
        if key not in custody or key in debts:
            charged.append(row)
            # Do not stop diagnostic conservation on first over-cap row.
            try:
                ledger.admit(row, debt=key in debts)
            except Denied as error:
                if str(error) != 'same_cumulative_SOURCE_cap_exceeded':
                    raise
    total = ledger.byte_count + CAPS['MF'] + CAPS['approval'] + CAPS['DATA']
    return {'scope': 'PROSPECTIVE_SOURCE_ONLY_CONSERVATION_DIAGNOSTIC',
            'reason': reason, 'sourceRows': charged,
            'custodyOnlyRows': [byid[k] for k in sorted(custody)],
            'sourceVersionAdmissions': len(charged), 'sourcePaths': len(ledger.paths),
            'sourceMemberBytes': ledger.byte_count, 'originalReservedTotalBytes': total,
            'over64MiB': max(0, total-CAPS['bytes']),
            'completeCensus': False if recipe['unknownRequiredInputs'] else True,
            'actualMFBytes': None, 'actualPLANBytesAdditional': recipe.get('actualPLANBytes'),
            'compactSerializationSaving': False, 'currentGenericLoopsStillRequireEveryMFBody': True,
            'sourceEligibility': False, 'task03Functional': '0/3', 'task04Functional': '0/3',
            'goalBoundedMilestone': '1/17 task01 only', 'productPercent': 0, 'effects': 0}


class HeldBroker:
    """Finite fixture/prospective read broker; holds all FDs before body use.

    The same caller-owned Ledger is required for assembly, review and G/U3/B3.
    This class performs no import/compile/execute and grants no effect access.
    """
    def __init__(self, root, rows, ledger, edges, caller, stop_ns, mature_ns=240000000000):
        self.root = Path(root).absolute(); self.rows = rows; self.ledger = ledger
        self.edges = edges; self.caller = caller; self.stop_ns = stop_ns
        if mature_ns != 240000000000:
            raise Denied('own_code_original240s_maturity_not_waived')
        self.mature_ns = mature_ns; self.held = {}; self.close_attempts = []; self.events = []
        self.closed = False; self.open_complete = False; self.final_checked = False

    def open_all(self):
        if self.closed or self.held or self.open_complete:
            raise Denied('duplicate_open_epoch')
        paths = [valid_row(row)['path'] for row in self.rows]
        if len(paths) != len(set(paths)) or len(paths) > CAPS['paths']:
            raise Denied('all_FD_path_limit_or_conflict')
        # Resolve every edge/charge before ANY new descriptor open. A denied
        # hidden read cannot sneak one open/hash in before being discovered.
        for row in self.rows:
            self.ledger.authorize_use(row, self.caller, 'read', self.edges)
        for row in self.rows:
            path = self.root / row['path']
            if path.resolve() != path or not path.is_relative_to(self.root):
                raise Denied('symlink_or_escape')
            for parent in (path,) + tuple(path.parents):
                if stat.S_ISLNK(os.lstat(parent).st_mode):
                    raise Denied('symlink_component')
                if parent == self.root:
                    break
            pre = os.lstat(path)
            if not stat.S_ISREG(pre.st_mode) or pre.st_nlink != 1 or nine(pre) != row['nine']:
                raise Denied('literal9_changed_before_open')
            if (max(pre.st_mtime_ns, pre.st_ctime_ns) > self.stop_ns
                    or time.time_ns()-max(pre.st_mtime_ns, pre.st_ctime_ns) < self.mature_ns
                    or time.time_ns()-self.stop_ns < self.mature_ns):
                raise Denied('STOP_or_member_not_currently240s_mature')
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
            self.held[row['path']] = (fd, row)
            if nine(os.fstat(fd)) != row['nine'] or nine(os.lstat(path)) != row['nine']:
                raise Denied('literal9_open_path_mismatch')
        self.open_complete = True
        self.events.append({'event':'ALL_FDS_BEFORE_FIRST_BODY','count':len(self.held)})

    def read(self, path):
        if self.closed or not self.open_complete or path not in self.held:
            raise Denied('body_before_all_FDs_or_undeclared_path')
        fd, row = self.held[path]; offset=0; chunks=[]
        while True:
            chunk=os.pread(fd,65536,offset)
            if not chunk: break
            offset += len(chunk); chunks.append(chunk)
            if offset > row['bytes']:
                raise Denied('body_overdeclared_size')
        raw=b''.join(chunks)
        if len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256']:
            raise Denied('EOF_hash_size_changed')
        if nine(os.fstat(fd)) != row['nine'] or nine(os.lstat(self.root/path)) != row['nine']:
            raise Denied('literal9_post_path_mismatch')
        self.events.append({'event':'FULL_EOF_HASH_SIZE_LITERAL9','path':path,'bytes':len(raw)})
        return raw

    def final_check(self):
        if self.closed or not self.open_complete:
            raise Denied('final_without_open_interval')
        for path in self.held:
            self.read(path)
        self.final_checked = True
        self.events.append({'event':'FINAL_FULL_REQUALIFICATION_ALL_FDS_RETAINED'})

    def close(self):
        if self.closed:
            raise Denied('each_FD_once_close_already_closed')
        self.closed=True; owned=self.held; self.held={}; errors=[]
        for path,(fd,_row) in owned.items():
            try:
                os.close(fd); error=None
            except BaseException as failure:
                error=type(failure).__name__;errors.append(error)
            self.close_attempts.append({'path':path,'attempt':1,'error':error})
        if errors:
            raise Denied('all_close_attempted_errors:'+','.join(errors))


class PhaseMachine:
    """Mockable ordering/conservation contract; never calls effects or old code."""
    ORDER=('SOURCE','SOURCE_APPROVED','ACTUAL1914','ACTUAL114','ORIGINAL_PREFLIGHT','ORIGINAL_CLI','ACTUAL_READY')
    def __init__(self, ledger):
        self.ledger=ledger; self.phase='SOURCE'; self.evidence={}

    def advance(self, next_phase, receipt, independent_verifier=None):
        index=self.ORDER.index(self.phase)
        if index+1 >= len(self.ORDER) or self.ORDER[index+1] != next_phase:
            raise Denied('original_phase_order')
        if independent_verifier is None or independent_verifier(next_phase,receipt) is not True:
            raise Denied('external_independent_original_receipt_verifier_required')
        if receipt.get('counts') != COUNTS or receipt.get('assertions') != list(ASSERTIONS):
            raise Denied('original_receipt_counts_assertions_loss')
        if next_phase=='SOURCE_APPROVED':
            self.ledger.preflight()
            if receipt.get('allProgramsIndependentlyApprovedBefore1914') is not True:
                raise Denied('Source_programs_unapproved_before_actual1914')
        elif receipt.get('originalProgramsUnchanged') is not True:
            raise Denied('original_assertion_program_replaced')
        self.evidence[next_phase]=receipt; self.phase=next_phase

    def protected_action(self, *_args, **_kwargs):
        raise Denied('source_only_packet_never_releases_key_private_target_effects')
