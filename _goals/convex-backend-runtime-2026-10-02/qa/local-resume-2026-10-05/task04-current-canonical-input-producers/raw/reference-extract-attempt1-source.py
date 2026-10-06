"""Read-only finite reference extraction. Identities stay typed historical only."""
import hashlib
from pathlib import Path
import sys
from strict_io import Reader, encoded, strict_json


def extract(repo, target):
    old = repo / 'work/resume/task04-c7-exact-identity-repair/candidate'
    reader = Reader(deadline_seconds=120)
    references = {}
    def read(path):
        row, raw = reader.read(str(path), 8388608)
        references[str(path.relative_to(repo))] = row
        return strict_json(raw)
    rules = read(old / 'finite-producer-rules.json')
    lineage = read(old / 'mirror-source-transform-map.json')
    prepared = read(old / 'prepared-source-inputs.json')
    command = read(repo / 'work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json')
    mirror = '/dev/shm/cortex-native-c7-exact-identity-repair/mirror/'
    logical = {row['destination']: row['source'] for row in lineage['inputs']}
    guard = '/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c8/evidence/full-preservation01-failure/scripts--guard.mjs.text'
    own = ['/workspace/Project-Cortex/work/resume/task04-c7-exact-identity-repair/candidate/' + name
           for name in ('vm-consumer-controls.mjs', 'external-review-executor.mjs')]
    logical.update({path: path for path in own + [guard]})
    pairs = [('/dev/shm/cortex-native-c6-closed-launcher-c6', '${PHASE_ROOT}'),
             ('/tmp/cortex-native-c5-closed-launcher-c5', '${PHASE_ROOT}'),
             ('/dev/shm/cortex-native-c7-exact-identity-repair', '${PHASE_ROOT}'),
             ('/workspace/Project-Cortex/work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6', '${PHASE_ROOT}/candidate'),
             ('/workspace/Project-Cortex/work/resume/task04-c7-exact-identity-repair/candidate', '${PHASE_ROOT}/candidate')]
    sources = {}
    destinations = []
    for row in lineage['inputs']:
        source = row['source']; leaf = source[len('/workspace/Project-Cortex/'):]
        sources[source] = {'originalSHA256': row['sha256'], 'originalBytes': row['bytes'],
                           'comparisonSHA256': row['legacyC6']['sha256'], 'comparisonBytes': row['legacyC6']['bytes'],
                           'allowedLiteralPairs': [list(pair) for pair in pairs]}
        destinations.append({'logicalSource': source, 'original': '${PHASE_ROOT}/cohorts/original/' + leaf,
                             'comparison': '${PHASE_ROOT}/cohorts/comparison/' + leaf, 'mirror': '${PHASE_ROOT}/mirror/' + leaf})
    recipes = {}
    for command_id, row in rules['perId'].items():
        calls = []
        for call in row['calls']:
            calls.append({'producerLogical': logical[call['producer']], 'kind': call['kind'],
                          'argumentExpression': call['argumentExpression'], 'sourceLogicalPaths': [logical[s['path']] for s in call['sources']],
                          'parent': call['parent'], 'canonical': call['canonical'], 'json': call['json'], 'resolution': call['resolution'],
                          'historicalCoordinatesReferenceOnly': {'line': call['line'], 'columnStart': call['columnStart'], 'columnEnd': call['columnEnd']}})
        recipes[command_id] = {'entryLogical': logical[row['entry']], 'calls': calls, 'parentProfile': row.get('parentProfile')}
    argv = {}
    for c in command['commands']:
        for value in c['proposedArgv']:
            if value.startswith('/workspace/Project-Cortex/'):
                argv[value] = '${PHASE_ROOT}/mirror/' + value[len('/workspace/Project-Cortex/'):]
    contract = {'schema': 'C8_FINITE_REFERENCE_CONTRACT_V1', 'sources': sources, 'recipes': recipes,
                'originalIds': [c['id'] for c in command['commands']], 'selectors': sum(len(r['calls']) for r in recipes.values()),
                'commandCanonicalSHA256': hashlib.sha256(encoded(command)).hexdigest(), 'commandRawSHA256': references[str((repo / 'work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json').relative_to(repo))]['sha256'],
                'oldGuardLogical': guard, 'ownSelectorLogicalPaths': own,
                'externalSelectorLogicalPaths': {guard: '${PHASE_ROOT}/cohorts/history/' + guard[len('/workspace/Project-Cortex/'):],
                                               **{path: '${PHASE_ROOT}/candidate/' + Path(path).name for path in own}},
                'argvDestinationMap': argv, 'preparedReferenceLogicalPaths': [row['path'] for row in prepared['files']],
                'originalGates': {'commands': 122, 'executableOperational': 741, 'sources': 823, 'selectors': 246,
                                  'semantic': 501, 'residuals': 301, 'ROOT': 27, 'nativeRecipes': 8, 'nativeSeconds': 20,
                                  'wholeSeconds': 120, 'ROOTReceiptBytes': 1073741824, 'RPC': 'FULL', 'status': 'HELD'}}
    assert len(sources) == 823 and len(recipes) == 124 and contract['selectors'] == 246 and len(prepared['files']) == 7
    reader.final()
    for name, data in [('reference-contract.json', contract), ('literal-destination-map.json', {'rows': destinations}),
                       ('reference-input-observations.json', {'references': references, 'historicalPinsAdopted': False,
                          'sourceIdentities': 'CURRENT_HOST_REFERENCE_READS_ONLY_NOT_NATIVE_AUTHORITY', 'preparedSelfIncluded': False})]:
        with open(target / name, 'xb') as stream: stream.write(encoded(data))


if __name__ == '__main__':
    assert len(sys.argv) == 3
    extract(Path(sys.argv[1]), Path(sys.argv[2]))
