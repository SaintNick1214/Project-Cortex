"""Complete successful acquisition data after preserving both failed helpers."""
import json
import os
from pathlib import Path
import re
import sys
import time
import traceback
from acquire_lib import held, identity, read_json

R = Path('/inputs/Project-Cortex')
ROOT = Path('/repair')
P = ROOT / 'attempt2/report'
O = ROOT / 'completion'

def put(path, body):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    raw = body if isinstance(body, bytes) else (json.dumps(body, indent=2) + '\n').encode()
    with open(path, 'xb') as stream:
        os.chmod(path, 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    return held(path, lambda _: None)

def resources():
    values = {n: Path('/sys/fs/cgroup', n).read_text() for n in ('memory.max', 'memory.current', 'memory.stat', 'memory.events')}
    maximum, current = values['memory.max'].strip(), values['memory.current'].strip()
    disk = os.statvfs(ROOT)
    if not maximum.isdecimal() or not current.isdecimal() or int(maximum) - int(current) < 134217728 or disk.f_bavail * disk.f_frsize < 256 * 1048576:
        raise ValueError('FRESH_RESOURCE_HOLD')
    return {'memory': values, 'literalReserveBytes': int(maximum) - int(current), 'requiredPythonBytes': 134217728, 'laterRequiredNodeBytes': 536870912, 'diskAvailableBytes': disk.f_bavail * disk.f_frsize, 'rootIdentity': identity(os.lstat(ROOT))}

def main():
    if len(sys.argv) != 1 or O.exists():
        raise ValueError('EXCLUSIVE_COMPLETION_ONLY')
    before_resources = resources()
    O.mkdir(mode=0o700)
    started = time.monotonic()
    sources, outputs = [], []
    tool_pre = held(Path(__file__).resolve(), lambda _: None)
    interpreter_pre = held(Path(sys.executable).resolve(), lambda _: None)
    def read(path):
        maximum = 128914214 if path == P / 'historical70020-coverage.json' else 64 * 1048576
        body, proof = read_json(path, maximum=maximum)
        sources.append(proof)
        return body
    first = read(ROOT / 'report/acquisition-receipt.json')
    second = read(P / 'acquisition-receipt.json')
    if not first['ownedToolsAndRuntimeEqual'] or not second['ownedToolsAndRuntimeEqual'] or second['primary'] != {'type': 'KeyError', 'message': "'bytes'"}:
        raise ValueError('EXACT_PRESERVED_FAILURE_SCOPE_REQUIRED')
    contract = read(P / 'acquisition-contract.json')
    object_data = read(P / 'selected-object-baselines.json')
    records = {r['sha256']: r for r in object_data['objects']}
    cache = {}
    object_pins = []
    def object_bytes(digest):
        if digest in cache:
            return cache[digest]
        record = records[digest]
        chunks = []
        now = held(Path(record['path']), chunks.append)
        if any(now[k] != record[k] for k in record):
            raise ValueError('EXISTING_POSITIVE_OBJECT_PIN_DRIFT_NO_REFRESH')
        object_pins.append({'existingPin': record, 'freshHeldEquality': now})
        cache[digest] = b''.join(chunks)
        return cache[digest]
    # Revalidate every selected object, including the mandatory13,909,295-byte
    # historical object and finite additional declared manifests.
    for digest in sorted(records):
        object_bytes(digest)
    packages = read(P / 'seven-package-source-inventory.json')['packages']
    current_files = {}
    for package in packages:
        archive = held(Path(package['archive']['path']), lambda _: None)
        if archive != package['archive']:
            raise ValueError('EXISTING_PACKAGE_SOURCE_PIN_DRIFT_NO_REFRESH')
        root = package['literalArchiveRoot'] + '/'
        for member in package['members']:
            if member['type'] == 'regular':
                current_files['node_modules/' + package['package'] + '/' + member['path'].removeprefix(root)] = member
    logical = contract['logicalOriginalInputs']
    original_path = '_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-extra-preparation-c5/toolchain-evidence.json'
    original = json.loads(object_bytes(logical[original_path]['sha256']))
    comparisons = []
    for row in original['files']:
        path = row['path'].removeprefix('/workspace/Project-Cortex/')
        if not path.startswith('node_modules/'):
            continue
        current = current_files.get(path)
        comparisons.append({'originalDeclaredPath': path, 'originalSHA256': row['sha256'], 'originalDeclaredBytes': row.get('bytes'), 'originalDoesNotDeclareSize': 'bytes' not in row, 'newPackageSource': current, 'exactHashMatch': current is not None and current['sha256'] == row['sha256'], 'declaredSizeMatch': current is not None and ('bytes' not in row or current['bytes'] == row['bytes']), 'originalPhysicalIdentityAdopted': False})
    outputs.append(put(O / 'original-package-obligation-comparison.json', {'originalSource': original_path, 'originalVersions': original['versions'], 'prospectiveVerifiedInfrastructureVersions': {'node': 'v24.15.0', 'npm': '12.2.0', 'python': sys.version}, 'runtimeNodeDifference': 'ORIGINAL_DECLARES24.19_PROSPECTIVE24.15_REQUIRES_SOURCE_CONSUMER_DISPOSITION', 'rootLockVersions': {p['package']: p['version'] for p in packages}, 'compilerObligationVersion': '0.27.0', 'mandatoryCompilerSources': ['node_modules/esbuild/lib/main.js', 'node_modules/esbuild/package.json', 'node_modules/@esbuild/linux-x64/bin/esbuild'], 'compilerVersionsMatch': all(p['version'] == '0.27.0' for p in packages if p['package'] in ('esbuild', '@esbuild/linux-x64')), 'originalDeclaredPackageFiles': comparisons, 'packageHashConflicts': [r['originalDeclaredPath'] for r in comparisons if not r['exactHashMatch'] or not r['declaredSizeMatch']], 'dependentExecutionPermitted': False}))
    # Finite original operational source inspection, never source evaluation.
    commands_path = R / 'work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json'
    commands = read(commands_path)['commands']
    matches = []
    pattern = re.compile(r'24\.19\.0|versions\??\.node|process\.version|--version|toolchain-evidence')
    for path, row in sorted(logical.items()):
        if not path.endswith(('.mjs', '.cjs', '.js', '.ts', '.tsx')):
            continue
        lines = object_bytes(row['sha256']).decode().splitlines()
        for number, line in enumerate(lines, 1):
            if pattern.search(line):
                matches.append({'originalPath': path, 'sha256': row['sha256'], 'bytes': row['bytes'], 'line': number, 'text': line, 'context': [{'line': n + 1, 'text': lines[n]} for n in range(max(0, number - 4), min(len(lines), number + 3))], 'entryContractIDs': [c['id'] for c in commands if c['entrySha256'] == row['sha256']], 'sourceOnlyRuntimeAuthorityClassification': 'REQUIRES_INDEPENDENT_SOURCE_INTERPRETATION_NOT_EXECUTED'})
    outputs.append(put(O / 'runtime-version-source-consumers.json', {'originalDeclaredNode': original['versions']['node'], 'prospectiveNode': 'v24.15.0', 'allOriginalOperationalSourcesInspected': len(logical), 'matches': matches, 'originalAssertionsModified': False, 'candidateEvaluated': False}))
    history = read(P / 'historical70020-coverage.json')
    full8 = read(P / 'full8-demand-and-coverage.json')
    if history['rows'] != 70020 or history['regularPathBytes'] != 3001521619 or history['currentlyByteValidPhysicalPaths'] != 59756 or history['missingPhysicalPaths'] != 10264 or history['missingRequiredContents'] != 0 or full8['regularPathBytes'] != 3110990905:
        raise ValueError('EXACT_ORIGINAL_FINITE_COHORT_DEMAND')
    lineage = read(ROOT / 'input-metadata/work/resume/task04-c7-exact-identity-repair/candidate/mirror-source-transform-map.json')
    originals = sum(r['bytes'] for r in lineage['inputs'])
    comparisons_bytes = sum(r['legacyC6']['bytes'] for r in lineage['inputs'])
    expanded_packages = sum(p['expandedRegularBytes'] for p in packages)
    encoded_packages = sum(p['encodedBytes'] for p in packages)
    total = 3110990905 + 3001521619 + originals + comparisons_bytes + expanded_packages
    demand = {'FULL8': full8, 'HIST70020': {'rows': 70020, 'regularPathBytes': 3001521619}, 'original823': {'paths': 823, 'bytes': originals}, 'C6comparison823': {'paths': 823, 'bytes': comparisons_bytes}, 'sevenPackages': {'encodedTarBytes': encoded_packages, 'expandedRegularBytes': expanded_packages, 'regularPaths': sum(sum(m['type'] == 'regular' for m in p['members']) for p in packages)}, 'selectedBacking': {'objects': len(records), 'rawBytes': sum(r['bytes'] for r in records.values())}, 'nextPhysicalRegularSubtotalBytes': total, 'nextRAW_EXACT_PREIMAGEBytesForAllThoseSources': total, 'physicalPlusRawPrebytesSubtotalBytes': 2 * total, 'noCompressionRatioAssumed': True, 'subjectRawAndReceiptCapacity': {'compilerRaw': '32*(admittedGraphBytes+snapshotBytes)+8192*inputClosureRows+16384', 'compilerEncoded': 'rawLimit+ceil(rawLimit/65536)*64+1024', 'rootRaw': '32*closureBytes+16384', 'eachRootReceiptQuotaBytes': 1073741824, 'originalProcessOwnerRawLimitBytes': 256000, 'exactNumericalDispatchClosure': 'UNAVAILABLE_UNTIL_FRESH_CANONICAL_BINDINGS_EXIST', 'admission': 'HOLD_BEFORE_SUBJECT_DISPATCH_UNTIL_EXACT_CLOSURE_AND_FULL_RAW_LEDGER_RECEIPT_DEMAND_CALCULATED'}, 'currentPreflight': before_resources, 'originalTimingMs': {'nativeMinimum': 20000, 'wholeAbsolute': 120000}, 'materializedFULL8OrHIST70020': False}
    outputs.append(put(O / 'next-phase-demand-accounting.json', demand))
    aid_paths = [Path('work/resume/task04-c8-prospective-preparation/candidate') / p.name for p in (R / 'work/resume/task04-c8-prospective-preparation/candidate').iterdir() if p.is_file()]
    aid_paths += [Path(p) for p in ['convex-dev/runtimeModelPolicy.ts', 'convex-dev/runtimeModelPolicyBootstrap.ts', 'convex-dev/runtimeGateway.ts', 'convex-dev/runtimePolicySchema.ts', 'convex-dev/schema.ts', 'src/domain/model-policy.ts', 'src/domain/profile.ts', 'src/domain/index.ts', 'src/auth/verified.ts', 'tests/unit/runtimeMemory/fixture.ts', 'package.json', 'work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json', 'work/resume/task04-c7-full-partial-review/independent-eight-recipes.json', 'work/resume/task04-c8-prospective-preparation/semantic-501-residual.json']]
    aids = []
    for relative in sorted(aid_paths):
        chunks = []
        source = held(R / relative, chunks.append)
        destination = put(O / 'source-aids' / relative, b''.join(chunks))
        if source['sha256'] != destination['sha256'] or source['bytes'] != destination['bytes']:
            raise ValueError('FINITE_SOURCE_CONTENT_TRANSFER')
        aids.append({'readOnlyTransport': source, 'freshOwnedLinuxBaseline': destination, 'sourceImportedOrEvaluated': False})
    outputs.append(put(O / 'finite-source-baselines.json', aids))
    outputs.append(put(O / 'positive-object-pin-equality.json', object_pins))
    command_copy = O / 'source-aids/work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json'
    command_proof = held(command_copy, lambda _: None)
    semantic = read(O / 'source-aids/work/resume/task04-c8-prospective-preparation/semantic-501-residual.json')
    eight = read(O / 'source-aids/work/resume/task04-c7-full-partial-review/independent-eight-recipes.json')
    if command_proof['sha256'] != '4db94b3105073be227e2ac3ab461336e3927f3cffe17f901413ca3bf301445dd' or len(commands) != 122 or len({c['id'] for c in commands}) != 122 or len(eight['eightIds']) != 8 or eight['compilerMinimumSeconds'] != 20 or eight['wholeSeconds'] != 120 or len(semantic['allOriginalSiteIDs']) != 501 or semantic['C7UnresolvedInterpretations'] != 301:
        raise ValueError('ORIGINAL_GATES_AND_SEMANTIC_RESIDUAL_CONSERVATION')
    outputs.append(put(O / 'original-gate-conservation.json', {'original122ByteExact': command_proof, 'commandIDs': [c['id'] for c in commands], 'eightNativeRecipeIDs': eight['eightIds'], 'nativeMinimumMs': 20000, 'wholeDeadlineMs': 120000, 'originalOperationalBodies': 823, 'originalJSAndTSBodies': 741, 'allOriginalSiteIDs': semantic['allOriginalSiteIDs'], 'semanticResiduals': 301, 'sourceTiers': 'ORIGINAL_FULL_RPC_UNCHANGED', 'assertionsModified': False, 'ROOTApproval': 'ABSENT'}))
    post_resources = resources()
    tool_post = held(Path(__file__).resolve(), lambda _: None)
    interpreter_post = held(Path(sys.executable).resolve(), lambda _: None)
    if tool_pre != tool_post or interpreter_pre != interpreter_post:
        raise ValueError('COMPLETION_TOOL_OR_INTERPRETER_DRIFT')
    receipt = {'status': 'COMPLETE_BOUNDED_ACQUISITION_SOURCE_BASELINE_ONLY', 'elapsedSeconds': time.monotonic() - started, 'resourcePRE': before_resources, 'resourcePOST': post_resources, 'toolPRE': tool_pre, 'toolPOST': tool_post, 'interpreterPRE': interpreter_pre, 'interpreterPOST': interpreter_post, 'sources': sources, 'outputs': outputs, 'priorFailuresPreserved': True, 'selectedObjects': len(records), 'selectedObjectBytes': sum(r['bytes'] for r in records.values()), 'packageArchiveCount': len(packages), 'finiteSourceAids': len(aids), 'missingRequiredFULL8Contents': 0, 'missingRequiredHIST70020Contents': 0, 'candidateImportedOrEvaluated': False, 'largerPhysicalCohortsPrepared': False, 'newIndependentReviewRequired': True, 'original122': 'HELD', 'native20': 'HELD', 'whole120': 'HELD', 'ROOT': 'ABSENT'}
    put(O / 'completion-receipt.json', receipt)
    print(json.dumps({k: v for k, v in receipt.items() if k not in ('resourcePRE', 'resourcePOST', 'toolPRE', 'toolPOST', 'interpreterPRE', 'interpreterPOST', 'sources', 'outputs')}))

if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        if O.exists() and not (O / 'completion-failure.json').exists():
            put(O / 'completion-failure.json', {'status': 'FAILED_PRESERVED_NO_PIN_REFRESH', 'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc(), 'candidateEvaluated': False, 'ROOT': 'ABSENT'})
        raise
