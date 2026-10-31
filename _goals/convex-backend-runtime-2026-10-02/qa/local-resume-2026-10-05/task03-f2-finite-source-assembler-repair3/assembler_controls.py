"""Finite source-only regression controls; no original/native programs imported."""
from pathlib import Path
import ast
import hashlib
import json
import os
import sys

OWN = Path(__file__).absolute().parent
SOURCE = OWN / 'finite_assembler.py'
raw = SOURCE.read_bytes()
ast.parse(raw)
namespace = {'__name__': 'prospective_assembler_control_kernel'}
exec(compile(raw, str(SOURCE), 'exec'), namespace)
Denied = namespace['AssemblyDenied']
results = []


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    results.append({'name': name, 'passed': True})


def denial(name, action):
    try:
        action()
    except Denied:
        check(name, True)
    else:
        check(name, False)


pin = {f: str(i + 1) for i, f in enumerate(namespace['FIELDS'])}
pin['size'] = '3'
base = {'path': 'same', 'bytes': 3, 'sha256': 'a' * 64, 'nine': pin}
check('exact_same_path_nine_size_hash_deduplicates', namespace['same_admission'](base, dict(base)))
for field in namespace['FIELDS']:
    other = dict(base)
    other['nine'] = dict(pin)
    other['nine'][field] = str(int(pin[field]) + 1)
    check('changed_' + field + '_cannot_deduplicate', not namespace['same_admission'](base, other))
for field, value in [('path', 'other'), ('sha256', 'b' * 64), ('bytes', 4), ('nine', {})]:
    other = dict(base)
    other[field] = value
    check('changed_' + field + '_cannot_deduplicate', not namespace['same_admission'](base, other))

catalog = [{'path': 'inactive', 'bytes': 3, 'sha256': 'a' * 64},
           {'path': 'required', 'bytes': 4, 'sha256': 'b' * 64}]
selected, omitted, readmitted = namespace['select_inactive'](catalog, catalog[:1], set())
check('metadata_only_selection_omits_inactive_without_body_callback', selected == catalog[1:] and omitted == catalog[:1])
selected, omitted, readmitted = namespace['select_inactive'](catalog, catalog[:1], {'inactive'})
check('actual_reader_readmits_inactive_without_refund', selected == catalog and omitted == [] and readmitted == ['inactive'])
selected, omitted, readmitted = namespace['select_inactive'](catalog, [{'path': 'inactive', 'bytes': 3, 'sha256': 'c' * 64}], set())
check('mismatched_inactive_pin_retained_without_body_or_saving', selected == catalog and omitted == [])

check('empty_budget_preflight_is_not_qualification', namespace['actual_qualifier_preflight']([]) == 'PREFLIGHT_ONLY_NOT_QUALIFIED')
denial('overbyte_budget_denies_before_any_member_open', lambda: namespace['actual_qualifier_preflight']([{'path': 'over', 'bytes': 67108864}]))
denial('overfile_budget_denied', lambda: namespace['actual_qualifier_preflight']([{'path': 'over', 'bytes': 16777217}]))
denial('approval_cap_cannot_expand', lambda: namespace['actual_qualifier_preflight']([], approval_bytes=1048577))
denial('DATA_aggregate_cap_cannot_expand', lambda: namespace['actual_qualifier_preflight']([], data_bytes=2097153))
denial('MF_cap_cannot_expand', lambda: namespace['actual_qualifier_preflight']([], expected_mf_bytes=4194305))
denial('4096_members_plus_MF_and_approval_is_over_paths', lambda: namespace['actual_qualifier_preflight']([{'path': str(i), 'bytes': 0} for i in range(4096)]))
denial('future_DATA_paths_share_original4096_ceiling', lambda: namespace['actual_qualifier_preflight']([{'path': str(i), 'bytes': 0} for i in range(4093)], future_data_paths=['late1', 'late2']))
denial('same_path_conflicts_cannot_be_a_qualifier_graph', lambda: namespace['actual_qualifier_preflight']([{'path': 'same', 'bytes': 0}, {'path': 'same', 'bytes': 0}]))
check('same_snapshot_exact64MiB_boundary_keeps_original_reserves', namespace['actual_qualifier_preflight']([{'path': str(i), 'bytes': x} for i, x in enumerate([16777216, 16777216, 16777216, 9437184])]) == 'PREFLIGHT_ONLY_NOT_QUALIFIED')

model_row = dict(base)
model_row['nineBasis'] = 'DECLARED_ORIGINAL'
model = json.loads(namespace['compact_manifest_model']([model_row]))
for phase in ('PRE', 'OPEN', 'POST', 'pathPOST'):
    check('compact_model_preserves_' + phase + '_all_nine', model['files'][0][phase] == pin)
check('compact_model_does_not_claim_EOF_or_actual_custody', model['files'][0]['fullEOF'] is False and 'NO_CUSTODY' in model['scope'])

run = sys.argv[1] if len(sys.argv) > 1 else '1'
assert run.isdigit()
fixture = OWN / ('controls-fixture' + run)
fixture.mkdir(exist_ok=False)
specs = []
for i, body in enumerate((b'first', b'second', b'')):
    p = fixture / ('file' + str(i))
    p.write_bytes(body)
    specs.append({'key': str(i), 'path': str(p), 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(), 'role': 'OWN_FINITE_FIXTURE'})
events = []
original_open = os.open
original_read = os.read


def tracked_open(*args, **kwargs):
    events.append('open')
    return original_open(*args, **kwargs)


def tracked_read(*args, **kwargs):
    events.append('read')
    return original_read(*args, **kwargs)


os.open = tracked_open
os.read = tracked_read
try:
    ledger = namespace['BodyLedger'](OWN, specs, set())
    docs = ledger.read_stage()
finally:
    os.open = original_open
    os.read = original_read
check('all_bootstrap_FDs_open_before_first_bootstrap_body', events[:3] == ['open'] * 3 and events[3] == 'read')
check('full_EOF_hash_length_and_once_close_including_empty_file', docs == {'0': b'first', '1': b'second', '2': b''} and len(ledger.close_attempts) == 3 and all(x['error'] is None and x['attempt'] == 1 for x in ledger.close_attempts))
check('single_cumulative_body_ledger_not_reset', ledger.cumulative_bytes == 11 and ledger.peak_fds == 3)
blocked = namespace['BodyLedger'](OWN, specs, {str(Path(specs[0]['path']).relative_to(OWN))})
denial('forbidden_inactive_path_blocked_before_open', blocked.read_stage)
check('forbidden_path_was_never_body_read_or_opened', blocked.rows == [] and blocked.close_attempts == [])
wrong = [dict(x) for x in specs]
wrong[0]['sha256'] = '0' * 64
failed = namespace['BodyLedger'](OWN, wrong, set())
denial('wrong_body_hash_denies', failed.read_stage)
check('hash_denial_attempts_every_owned_close_once', len(failed.close_attempts) == 3 and failed.held == [] and all(x['attempt'] == 1 and x['error'] is None for x in failed.close_attempts))
changed = [dict(x) for x in specs]
changed[0]['nine'] = dict(namespace['nine'](os.lstat(changed[0]['path'])))
changed[0]['nine']['ctime_ns'] = '1'
denial('original_nine_is_never_silently_refreshed', lambda: namespace['BodyLedger'](OWN, changed, set()).read_stage())

result = {'scope': 'PROSPECTIVE_ASSEMBLER_SOURCE_ONLY_CONTROLS_NO_SOURCE_OR_RUNTIME_ACCEPTANCE',
          'assemblerSourceSha256': hashlib.sha256(raw).hexdigest(), 'assemblerSourceBytes': len(raw),
          'discovered': len(results), 'executed': len(results), 'passed': len(results), 'failed': 0,
          'skipped': 0, 'results': results, 'sourceEligibility': False, 'effects': 0,
          'originalProgramsImportedOrExecuted': 0, 'wholeGraphQualifierExecuted': False}
namespace['publish_new'](OWN / ('assembler-control-results' + run + '.json'), namespace['encode'](result))
print(json.dumps({'controls': len(results), 'passed': len(results), 'effects': 0}))
