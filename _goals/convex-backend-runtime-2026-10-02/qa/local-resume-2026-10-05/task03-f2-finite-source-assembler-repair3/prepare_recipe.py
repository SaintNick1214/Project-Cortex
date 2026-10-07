"""Finite ordinary author preparation; no scans or excluded-history body hashing."""
from pathlib import Path
import hashlib
import json
import os
import sys

OWN = Path(__file__).absolute().parent
RUN = sys.argv[1] if len(sys.argv) > 1 else '1'
assert RUN.isdigit()
ROOT = OWN.parents[4]
P = ROOT / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
F2 = P / 'task03-attempt6-current-binding-repair2'
J6 = P / 'task03-u4-original-source-code-independent-review2'
J5 = P / 'task04-r4-c6-independent-source-review1'
FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')


def pin(path, key, role, parse=False):
    # These preparatory reads do not establish the old physical tuple at the
    # earlier conversational inspection instant. They are unqualified current
    # snapshots, charged again as explicit enabling bodies by the assembler.
    pre = {f: str(getattr(os.lstat(path), 'st_' + f)) for f in FIELDS}
    raw = path.read_bytes()
    post = {f: str(getattr(os.lstat(path), 'st_' + f)) for f in FIELDS}
    assert pre == post and len(raw) == int(pre['size'])
    return {'key': key, 'path': str(path.relative_to(ROOT)), 'bytes': len(raw),
            'sha256': hashlib.sha256(raw).hexdigest(), 'nine': pre, 'role': role, 'json': parse}, raw


declared = [
    ('agents', ROOT / 'AGENTS.md', False),
    ('runtime', ROOT / '.agents/CODEX-RUNTIME.md', False),
    ('profile', ROOT / '.agents/PROJECT-PROFILE.md', False),
    ('executor_role', ROOT / '.agents/roles/implementation-executor.md', False),
    ('manifest', ROOT / 'package.json', True),
    ('task03', ROOT / '_goals/convex-backend-runtime-2026-10-02/tasks/03-authorization.md', False),
    ('task04', ROOT / '_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md', False),
    ('c2', ROOT / '_goals/convex-backend-runtime-2026-10-02/qa/resume-dependency-refinement-c2/plan.md', False),
    ('decisions', ROOT / '_research/convex-ai-gateway-2026-10-02/decision-gates.md', False),
    ('root_diagnostic', P / 'root-task03-f2-source-budget-diagnostic-corrections1.json', True),
    ('inactive_verdict', P / 'task03-f2-inactive-lineage-independent-review1/verdict1.json', True),
    ('inactive_report', P / 'task03-f2-inactive-lineage-independent-review1/report1.md', False),
    ('old_builder', F2 / 'build-source-plan-final.py', False),
    ('preliminary', F2 / 'prospective-source-plan-preliminary-budget-tight.json', True),
    ('lineage', P / 'task03-attempt6-integrated-repair1/prospective-source-manifest-final.json', True),
    ('inactive', F2 / 'inactive-source-histories-proposal2.json', True),
    ('j6', J6 / 'finite-source-control-data-manifest1.json', True),
    ('old_consistency', F2 / 'final-operative-source-consistency.json', True),
    ('old_collector', F2 / 'collect-prospective-source.py', False),
    ('old_compact_model', F2 / 'compact-source-manifest-author-budget-model2.json', True),
    ('current_map', F2 / 'operative-source-map-and-release-schemas.json', True),
    ('j6_stop', J6 / 'final-writer-stop1.json', True),
    ('j5_stop', J5 / 'final-review-writer-stop2.json', True),
    ('j5_refs', J5 / 'review-evidence-reference-manifest2.json', True),
    ('b3_current', F2 / 'new-bounded-private-native-reader3/shared-source-epoch3/source-inputs-plan.json', True),
    ('root_current', F2 / 'root-source-stack-controls1/source-inputs-plan.json', True),
    ('u3_current', P / 'task03-attempt6-actual-public-custody-readiness-repair3/closed-source-manifest.json', True),
    ('j5_whole', J5 / 'source-holder8-final-closure.json', True),
    ('j5_two_gap', J5 / 'two-gap-final-FDclosure2.json', True),
    ('j6_host', J6 / 'host-raw-output-pins1.json', True),
    ('root_j6_six', P / 'root-task03-u4-final-six-mature-readback1.json', True),
    ('root_j6_host', P / 'root-task03-u4-complete36-host-raw-mature-readback1.json', True),
    ('root_j6_parent', P / 'root-task03-u4-final-host-and-parent4-mature-readback1.json', True),
    ('root_j6_consistency', P / 'root-task03-u4-final191-child3998-and-host11-consistency1.json', True),
]
specs = []
docs = {}
for key, path, parse in declared:
    spec, raw = pin(path, key, 'ACTUAL_PREPARATION_INPUT_RETAINED_NO_RETROACTIVE_SOURCE_CUSTODY', parse)
    specs.append(spec)
    if parse:
        docs[key] = json.loads(raw)
inactive_set = {x['path'] for x in docs['inactive']['rows']}
current = []
for i, row in enumerate(docs['inactive']['consumers']):
    assert row['path'] not in inactive_set
    spec, _ = pin(ROOT / row['path'], 'current_program_' + str(i), 'CURRENT_REQUIRED_PROGRAM_BODY_UNQUALIFIED_SNAPSHOT')
    if spec['path'] not in {x['path'] for x in specs}:
        specs.append(spec)
    current.append({'path': spec['path'], 'bytes': spec['bytes'], 'sha256': spec['sha256'],
                    'PRE9': spec['nine'], 'fullEOF': True})

own_inputs = []
for name in ('finite_assembler.py', 'assembler_controls.py', 'prepare_recipe.py',
             'assembler-control-results1.json', 'assembler-control-results2.json',
             'assembler-control-results3.json', 'first-assembly-denial1.json',
             'second-assembly-denial2.json', 'recipe1.json', 'recipe2.json'):
    spec, _ = pin(OWN / name, 'own_' + name, 'NEW_REPAIR_SOURCE_OR_CONTROL_BODY')
    specs.append(spec)
    own_inputs.append({'path': spec['path'], 'bytes': spec['bytes'], 'sha256': spec['sha256'], 'PRE9': spec['nine'], 'fullEOF': True})
for run in ('1', '2', '3'):
    for i, body in enumerate((b'first', b'second', b'')):
        path = OWN / ('controls-fixture' + run) / ('file' + str(i))
        own_inputs.append({'path': str(path.relative_to(ROOT)), 'bytes': len(body),
                           'sha256': hashlib.sha256(body).hexdigest(),
                           'PRE9': {f: str(getattr(os.lstat(path), 'st_' + f)) for f in FIELDS},
                           'fullEOF': True})

# finite_assembler.py is already in the bootstrap set. Main adds only its
# recipe; avoid counting an identical self path twice in that one FD stage.
specs = [x for x in specs if x['key'] != 'own_finite_assembler.py']
read_paths = {x['path'] for x in specs} | {str((OWN / 'finite_assembler.py').relative_to(ROOT))}
rootdata = docs['current_map']['futureRootData']
future = [{'path': value.get('path', str(F2 / key)), 'maxBytes': value['maxBytes'],
           'authority': 'ACTIVE_DECLARATION_NOT_FROZEN', 'originalFields': value}
          for key, value in rootdata.items() if key != 'integrated-source-review.json']
future += docs['current_map']['additionalSourceEnablingData']
assert len({x['path'] for x in future}) == len(future)
assert sum(x['maxBytes'] for x in future) <= 2097152
recipe = {
    'scope': 'FINITE_ASSEMBLER_REPAIR_SOURCE_ONLY_ORDINARY_AUTHOR_PREPARATION',
    'root': str(ROOT), 'bootstrapBodies': specs,
    'inactiveProposalSha256': next(x['sha256'] for x in specs if x['key'] == 'inactive'),
    'metadataOnlyInactiveForbiddenBodyPaths': sorted(inactive_set - read_paths),
    'explicitPreparationReadmissionOfProposedInactive': sorted(inactive_set & read_paths),
    'currentObservedPrograms': current, 'mandatoryPreparationInputs': [],
    'ownSourceInputs': own_inputs,
    'rootJ6ParentProofReferences': docs['root_j6_parent']['rows'],
    'futureDATA': future,
    'futureDATAReservedAggregateBytes': 2097152,
    'futureDATAKnownNamedMaxima': sum(x['maxBytes'] for x in future),
    'futureDATAUnassignedWithinSameOriginalAggregate': 2097152 - sum(x['maxBytes'] for x in future),
    'minimumFutureAssemblerReadKeys': ['preliminary', 'lineage', 'inactive', 'inactive_verdict',
        'b3_current', 'root_current', 'u3_current', 'j6', 'j6_stop', 'j6_host',
        'j5_refs', 'j5_whole', 'j5_two_gap', 'j5_stop', 'current_map', 'root_j6_parent',
        'own_recipe', 'own_assembler'],
    'actualPreparationReadsBeyondMinimumRemainCharged': True,
    'earlierConversationalBodyReadTuples': 'NOT_CAPTURED_NO_RETROACTIVE_QUALIFICATION_OR_SAVINGS',
    'unknownRequiredInputs': [
        {'path': str(P / 'task03-u4-linux-prospective-source-qualification1'),
         'state': 'ACTIVE_NO_STOP_NO_FINAL_SOURCE_MF',
         'finiteRequiredRoles': ['original immutable plan1 JSON/MD/STOP',
             'source-carry-manifest.json full135+130/history137', 'linux-wire-manifest.json',
             'original113-subset-proof.json', 'actual Linux physical135 NEW paths',
             'all final adapter sources controls receipts and Common original comparator',
             'four code/wire/full-ledger copies and state/stop admissions',
             'all ordered complete-source-ledger bridge amendments'],
         'authorReported135PhysicalBytes': 2628874, 'reportedBytesAreAdmittedOrSavings': False,
         'rowPathsNinesHashesAndNetUnion': 'UNKNOWN_NOT_STAT_OR_READ_AS_AUTHORITY'},
        {'roles': ['current F2 complete stopped source/control map',
                   'Root source MF/STOP', 'late Source approval/release/sender-five prospective-nine documents',
                   'future full F2/B3/A2/source independent judgment actual inputs and publishers'],
         'finitePathsNinesHashesAndCaps': 'PENDING_AUTHOR_ROOT_DECLARATIONS',
         'cannotResetOriginalSOURCEOrFutureDATAAggregate': True},
        {'roles': ['earlier preparatory inspection exact physical nines'],
         'state': 'UNLOGGED_ORIGINAL_READ_INSTANTS_CANNOT_BE_RETROACTIVELY_QUALIFIED'}],
    'runtimeAcceptance': False, 'sourceEligibility': False, 'effects': 0,
}
raw = (json.dumps(recipe, separators=(',', ':'), sort_keys=True) + '\n').encode()
fd = os.open(OWN / ('recipe' + RUN + '.json'), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
with os.fdopen(fd, 'wb') as out:
    out.write(raw)
    out.flush()
    os.fsync(out.fileno())
print(json.dumps({'bootstrapBodies': len(specs), 'bootstrapBytes': sum(x['bytes'] for x in specs),
                  'recipeBytes': len(raw), 'conditionalInactivePreparationReadmissions': recipe['explicitPreparationReadmissionOfProposedInactive'],
                  'currentConsumerPrograms': len(current), 'sourceEligibility': False}))
