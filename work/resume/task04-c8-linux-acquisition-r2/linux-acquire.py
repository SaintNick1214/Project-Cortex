"""Finite archive/package acquisition and source reads only. No subject imports."""
import base64
import hashlib
import json
import os
from pathlib import Path
import platform
import stat
import sys
import tarfile
import time
import urllib.request
from acquire_lib import acquire_archive, Decoded, encoded_chunks, held, identity, read_json

R = Path('/inputs/Project-Cortex')
O = Path('/repair')
Q = '_goals/convex-backend-runtime-2026-10-02/qa'
HIST = ('fcba3f917eef5557eb6c3d4ed360e236f2bd9dfc9745d689d541c885768c3c62', 13909295)
PACKAGES = ['@esbuild/linux-x64', '@types/node', 'convex', 'esbuild', 'semver', 'typescript', 'zod']
FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')

def put(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    raw = data if isinstance(data, bytes) else (json.dumps(data, indent=2) + '\n').encode()
    with open(path, 'xb') as stream:
        os.chmod(path, 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    proof = held(path, lambda _: None)
    if proof['bytes'] != len(raw) or proof['sha256'] != hashlib.sha256(raw).hexdigest():
        raise ValueError('OWN_OUTPUT_READBACK')
    return proof

def resource(required_disk=0):
    raw = {n: Path('/sys/fs/cgroup', n).read_text() for n in ('memory.max', 'memory.current', 'memory.events', 'memory.stat')}
    maximum, current = raw['memory.max'].strip(), raw['memory.current'].strip()
    if not maximum.isdecimal() or not current.isdecimal():
        raise ValueError('FINITE_CGROUP_REQUIRED')
    reserve = int(maximum) - int(current)
    disk = os.statvfs(O)
    result = {'memory': raw, 'literalReserveBytes': reserve, 'pythonRequiredReserveBytes': 134217728, 'nodeLaterRequiredReserveBytes': 536870912, 'diskAvailableBytes': disk.f_bavail * disk.f_frsize, 'requiredPhaseDiskBytes': required_disk, 'monotonic': time.monotonic()}
    if reserve < 134217728 or result['diskAvailableBytes'] < required_disk:
        raise ValueError('MEASURED_RESOURCE_HOLD ' + json.dumps(result))
    return result

def collect_members(rows):
    members = {}
    for row in rows:
        h, n = row['sha256'], row['bytes']
        if h in members and members[h] != n:
            raise ValueError('CATALOG_SIZE_CONFLICT')
        members[h] = n
    return members

def main():
    if len(sys.argv) != 1 or platform.system() != 'Linux' or platform.machine() != 'x86_64' or sys.version_info[:2] != (3, 12):
        raise ValueError('FIXED_LINUX_X64_PYTHON312_ACQUISITION_ONLY')
    started = time.monotonic()
    sources, outputs, phases = [], [], []
    tools_pre = [held(p, lambda _: None) for p in sorted((O / 'tools').glob('*.py'))]
    interpreter_pre = held(Path(sys.executable).resolve(), lambda _: None)
    node_pre = held(Path('/usr/local/bin/node'), lambda _: None)
    result = {'status': 'IN_PROGRESS', 'scope': 'NEW_LINUX_CONTENT_AND_SOURCE_BASELINE_ONLY', 'historicalIdentityRestored': False, 'failedC8PinsPreserved': True, 'candidateImportedOrEvaluated': False, 'original122': 'HELD', 'native20': 'HELD', 'whole120': 'HELD', 'ROOT': 'ABSENT', 'phases': phases}
    try:
        result['resourcePRE'] = resource(256 * 1048576)
        def read(path):
            body, proof = read_json(path)
            sources.append(proof)
            raw_chunks = []
            second = held(path, raw_chunks.append)
            if any(second[k] != proof[k] for k in second):
                raise ValueError('SOURCE_METADATA_COPY_DRIFT')
            target = O / 'input-metadata' / path.relative_to(R)
            outputs.append(put(target, b''.join(raw_chunks)))
            return body
        transport = R / Q / 'task04-evidence-transport-c4-c1'
        index = read(transport / 'index.json')
        mapping = read(transport / index['mapParts'][0]['path'])
        map_proof = sources[-1]
        if map_proof['decodedSHA256'] != index['mapDecodedSha256'] or map_proof['decodedBytes'] != index['mapDecodedBytes'] or len(mapping['files']) != 148325 or len(mapping['roots']) != 8:
            raise ValueError('FULL8_MAPPING_HASH_SIZE_COUNT')
        regular = [r for r in mapping['files'] if r['kind'] == 'file']
        links = [r for r in mapping['files'] if r['kind'] != 'file']
        for row in links:
            raw = bytes.fromhex(row['targetHex'])
            if hashlib.sha256(raw).hexdigest() != row['sha256']:
                raise ValueError('LITERAL_LINK_TARGET_HASH')
        members = collect_members(regular)
        routes = [{'name': 'transport-c4-c1', 'format': 'raw-sha-be64', 'members': members, 'parts': [{'path': str((transport / p['path']).relative_to(R)), 'bytes': p['bytes'], 'sha256': p['sha256']} for p in index['archiveParts']], 'bytes': sum(p['bytes'] for p in index['archiveParts']), 'sha256': '291df9c9034a5354c8550b833a3e88a12a3fcc2e59433bd273ae352974af248c', 'decodedCap': index['archiveDecodedBytes']}]
        names = ['task04-c3-and-review-byte-backing', 'task04-c5-fresh-review-content-backing', 'task04-c6-frozen-content-backing', 'task04-c6-review-content-backing', 'task04-c5-delta-byte-backing']
        available = {h: (routes[0]['name'], n) for h, n in members.items()}
        for name in names:
            directory = R / Q / name
            body = read(directory / ('index.json' if (directory / 'index.json').exists() else 'index.json.gz'))
            rows = [r for r in body['objects'] if name == names[0] or r.get('backing') == 'delta']
            content = collect_members(rows)
            archive = body['archive']
            route = {'name': name, 'format': 'tar-gzip', 'members': content, 'parts': [{'path': r.get('repositoryPath', str((directory / r['name']).relative_to(R))), 'bytes': r['bytes'], 'sha256': r['sha256']} for r in archive['parts']], 'bytes': archive['bytes'], 'sha256': archive['sha256'], 'decodedCap': sum(content.values()) + len(content) * 2048 + 1048576}
            routes.append(route)
            for h, n in content.items():
                if h in available and available[h][1] != n:
                    raise ValueError('CROSS_CATALOG_SIZE_CONFLICT')
                available[h] = (name, n)
        sixth = routes[-1]
        if len(sixth['parts']) != 139 or len(sixth['members']) != 3652 or sixth['bytes'] != 727823685 or sixth['sha256'] != 'beadb619e93885dce23dcb45c465de6b2fe144c51def10d4720e90431eba6280' or sixth['members'].get(HIST[0]) != HIST[1]:
            raise ValueError('REQUIRED_SIXTH_ARCHIVE_CONTRACT')
        lineage = read(R / 'work/resume/task04-c7-exact-identity-repair/candidate/mirror-source-transform-map.json')
        if len(lineage['inputs']) != 823:
            raise ValueError('ORIGINAL823_CONTRACT')
        wanted, logical = {}, {}
        for row in lineage['inputs']:
            logical[row['source'].removeprefix('/workspace/Project-Cortex/')] = (row['sha256'], row['bytes'])
            for h, n in [(row['sha256'], row['bytes']), (row['legacyC6']['sha256'], row['legacyC6']['bytes'])]:
                if h in wanted and wanted[h] != n:
                    raise ValueError('OPERATIONAL_SIZE_CONFLICT')
                wanted[h] = n
        wanted[HIST[0]] = HIST[1]
        if len(wanted) != 485 or any(available.get(h, (None, None))[1] != n for h, n in wanted.items()):
            raise ValueError('FINITE485_COVERAGE')
        result['selectedObjectBytes'] = sum(wanted.values())
        contract = {'scope': 'CONTENT_HASH_SIZE_ONLY_ALL_LEGACY_IDENTITIES_NONAUTHORITATIVE', 'routes': routes, 'wanted': wanted, 'logicalOriginalInputs': {p: {'sha256': v[0], 'bytes': v[1]} for p, v in logical.items()}, 'mandatoryHistoricalObject': {'path': Q + '/task04-model-drift-native-source-preparation-c3-review/closure-audit.json', 'sha256': HIST[0], 'bytes': HIST[1]}, 'original122': 'HELD', 'eightNative20': 'HELD', 'whole120': 'HELD'}
        outputs.append(put(O / 'report/acquisition-contract.json', contract))
        acquired, proofs = {}, []
        for route in routes:
            phase = {'route': route['name'], 'resourcePRE': resource(sum(wanted.values()) + 128 * 1048576)}
            phases.append(phase)
            selected = {h: n for h, n in wanted.items() if available[h][0] == route['name']}
            directory = O / 'objects' / route['name']
            directory.mkdir(parents=True, mode=0o700)
            try:
                proof = acquire_archive(R, route, selected, directory)
            except BaseException as error:
                phase['partialAcquisition'] = getattr(error, 'qaAcquisitionProof', None)
                raise
            phase['resourcePOST'] = resource()
            proofs.append(proof)
            acquired.update({r['sha256']: r for r in proof['selected']})
        if set(acquired) != set(wanted):
            raise ValueError('SELECTED485_ACTUAL_SET')
        outputs.append(put(O / 'report/archive-stream-proofs.json', proofs))
        outputs.append(put(O / 'report/selected-object-baselines.json', {'scope': 'FRESH_OWNED_LINUX_FILES_NOT_HISTORICAL_OR_CANONICAL_RUNTIME_IDENTITIES', 'objects': list(acquired.values())}))
        plan_sizes = {}
        def data_for(relative, expected_hash=None, expected_size=None):
            path = R / relative
            if path.is_file() and not path.is_symlink():
                body, proof = read_json(path)
                sources.append(proof)
            else:
                pair = logical.get(relative)
                if pair is None:
                    raise ValueError('REQUIRED_SOURCE_PLAN_NOT_PHYSICAL ' + relative)
                prior = acquired[pair[0]]
                body, proof = read_json(Path(prior['path']))
                if any(proof[k] != prior[k] for k in prior):
                    raise ValueError('OWNED_PLAN_SOURCE_DRIFT')
            if expected_hash is not None and proof['sha256'] != expected_hash or expected_size is not None and proof['bytes'] != expected_size:
                raise ValueError('DECLARED_PLAN_BYTES ' + relative)
            plan_sizes[relative] = proof['bytes']
            return body
        history = {}
        manifests = []
        for kind in ('extension', 'regression', 'extra'):
            root = Q + '/task04-model-drift-native-' + kind + '-preparation-c5'
            preservation = data_for(root + '/historical-preservation.json')
            for packet in preservation['packets']:
                path = packet['path'] + '/' + packet['manifest']
                body = data_for(path, packet['manifestSHA256'])
                if len(body['files']) != packet['rows']:
                    raise ValueError('HISTORICAL_MANIFEST_ROW_COUNT')
                rows = body['files']
                manifests.append({'profile': kind, 'path': path, 'sha256': packet['manifestSHA256'], 'rows': len(rows)})
                history[path] = {'path': path, 'sha256': packet['manifestSHA256'], 'bytes': plan_sizes[path]}
                if 'fullClosure' in packet:
                    detail = packet['fullClosure']
                    rows = data_for(root + '/' + detail['path'], detail['sha256'], detail['bytes'])['files']
                    if len(rows) != detail['rows'] or len(rows) != 83:
                        raise ValueError('FULL83_HISTORY_COUNT')
                for row in rows:
                    relative = packet['path'] + '/' + row['path']
                    value = {'path': relative, 'bytes': row['bytes'], 'sha256': row['sha256']}
                    if relative in history and history[relative] != value:
                        raise ValueError('HISTORY_DUPLICATE_CONFLICT')
                    history[relative] = value
        if len(history) != 70020 or sum(r['bytes'] for r in history.values()) != 3001521619:
            raise ValueError('ORIGINAL_HIST70020_3001521619_CONTRACT')
        coverage, existing, missing = [], 0, 0
        phase = {'route': 'finite-historical-source-reads', 'resourcePRE': resource(128 * 1048576)}
        phases.append(phase)
        for relative, row in sorted(history.items()):
            path = R / relative
            current = None
            if path.is_file() and not path.is_symlink():
                current = held(path, lambda _: None)
                if current['bytes'] != row['bytes'] or current['sha256'] != row['sha256']:
                    raise ValueError('CURRENT_HISTORICAL_BYTES_DRIFT ' + relative)
                existing += 1
            else:
                missing += 1
            backing = available.get(row['sha256'])
            if current is None and (backing is None or backing[1] != row['bytes']):
                raise ValueError('REQUIRED_HISTORICAL_CONTENT_GAP ' + relative)
            coverage.append({'declared': row, 'freshReadOnlyTransportCapture': current, 'missingPhysicalPath': current is None, 'verifiedCatalogRoute': backing[0] if backing else None, 'historicalIdentityAdopted': False})
        phase['resourcePOST'] = resource()
        outputs.append(put(O / 'report/historical70020-coverage.json', {'rows': len(history), 'regularPathBytes': 3001521619, 'currentlyByteValidPhysicalPaths': existing, 'missingPhysicalPaths': missing, 'missingRequiredContents': 0, 'manifests': manifests, 'members': coverage, 'fullMaterialization': False}))
        outputs.append(put(O / 'report/full8-demand-and-coverage.json', {'rows': 148325, 'regularRows': len(regular), 'literalLinks': len(links), 'regularPathBytes': sum(r['bytes'] for r in regular), 'uniqueObjectBytes': sum(members.values()), 'uniqueObjects': len(members), 'missingRequiredContents': 0, 'physicalMaterialization': False, 'sourceMap': map_proof}))
        lock = read(R / 'package-lock.json')
        packages = []
        for name in PACKAGES:
            definition = lock['packages']['node_modules/' + name]
            url = definition['resolved']
            integrity = definition['integrity']
            if not url.startswith('https://registry.npmjs.org/') or not integrity.startswith('sha512-'):
                raise ValueError('EXACT_OFFICIAL_LOCK_PACKAGE_REQUIRED')
            path = O / 'packages' / (name.replace('/', '--').replace('@', '') + '.tgz')
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            digest, size = hashlib.sha512(), 0
            phase = {'route': 'package:' + name, 'resourcePRE': resource(128 * 1048576)}
            phases.append(phase)
            with urllib.request.urlopen(url, timeout=30) as response, open(path, 'xb') as stream:
                if not response.geturl().startswith('https://registry.npmjs.org/'):
                    raise ValueError('PACKAGE_REDIRECT_ORIGIN')
                os.chmod(path, 0o600)
                while block := response.read(1048576):
                    size += len(block)
                    if size > 128 * 1048576:
                        raise ValueError('PACKAGE_ENCODED_CAP')
                    digest.update(block)
                    stream.write(block)
                stream.flush()
                os.fsync(stream.fileno())
            if 'sha512-' + base64.b64encode(digest.digest()).decode() != integrity:
                raise ValueError('PACKAGE_LOCK_INTEGRITY')
            package_pre = held(path, lambda _: None)
            entries, seen, expanded, top_roots = [], set(), 0, set()
            package_definition = None
            with tarfile.open(path, mode='r:gz') as archive:
                for member in archive:
                    relative = member.name
                    parts = Path(relative).parts
                    if Path(relative).is_absolute() or not parts or any(p in ('.', '..') for p in parts) or relative in seen or not (member.isfile() or member.isdir()):
                        raise ValueError('PACKAGE_MEMBER_TYPE_PATH_SET')
                    top_roots.add(parts[0])
                    if len(top_roots) != 1:
                        raise ValueError('PACKAGE_SINGLE_LITERAL_ROOT')
                    seen.add(relative)
                    entry = {'path': relative, 'bytes': member.size, 'mode': member.mode, 'type': 'regular' if member.isfile() else 'directory'}
                    if member.isfile():
                        h = hashlib.sha256()
                        count = 0
                        root_metadata = len(parts) == 2 and parts[1] == 'package.json'
                        metadata_chunks = []
                        with archive.extractfile(member) as source:
                            while block := source.read(1048576):
                                h.update(block)
                                count += len(block)
                                if root_metadata:
                                    if count > 1048576:
                                        raise ValueError('PACKAGE_METADATA_CAP')
                                    metadata_chunks.append(block)
                        if count != member.size:
                            raise ValueError('PACKAGE_MEMBER_SIZE')
                        if root_metadata:
                            package_definition = json.loads(b''.join(metadata_chunks))
                        expanded += count
                        entry['sha256'] = h.hexdigest()
                    entries.append(entry)
            if package_definition is None or package_definition['name'] != name or package_definition['version'] != definition['version']:
                raise ValueError('LOCKED_PACKAGE_NAME_VERSION')
            if held(path, lambda _: None) != package_pre:
                raise ValueError('PACKAGE_SOURCE_DRIFT')
            gzip_proof = {'parts': []}
            package_part = {'path': str(path.relative_to(O)), 'bytes': package_pre['bytes'], 'sha256': package_pre['sha256']}
            reader = Decoded(encoded_chunks(O, [package_part], gzip_proof), expanded + len(entries) * 2048 + 1048576)
            try:
                while reader.read(1048576):
                    pass
                gzip_proof.update(decodedBytes=reader.total, decodedSHA256=reader.digest.hexdigest(), singleGzipEOFCRC=True)
            finally:
                reader.close()
            packages.append({'package': name, 'version': definition['version'], 'literalArchiveRoot': next(iter(top_roots)), 'resolved': url, 'lockIntegrity': integrity, 'encodedBytes': size, 'archive': package_pre, 'expandedRegularBytes': expanded, 'members': entries, 'gzipBoundary': gzip_proof, 'installScriptsExecuted': False, 'nativeBinaryExecuted': False})
            phase['resourcePOST'] = resource()
        outputs.append(put(O / 'report/seven-package-source-inventory.json', {'packages': packages, 'sourceOnly': True, 'packagePhysicalCohortInstalled': False}))
        current_package_files = {}
        for package in packages:
            root = package['literalArchiveRoot'] + '/'
            for member in package['members']:
                if member['type'] == 'regular':
                    current_package_files['node_modules/' + package['package'] + '/' + member['path'].removeprefix(root)] = member
        original_toolchain_path = Q + '/task04-model-drift-native-extra-preparation-c5/toolchain-evidence.json'
        original_toolchain = data_for(original_toolchain_path)
        comparisons = []
        for row in original_toolchain.get('files', []):
            path = row['path'].removeprefix('/workspace/Project-Cortex/')
            if not path.startswith('node_modules/'):
                continue
            current = current_package_files.get(path)
            comparisons.append({'originalDeclaredPath': path, 'originalSHA256': row['sha256'], 'originalBytes': row['bytes'], 'newPackageSource': current, 'exactByteMatch': current is not None and current['sha256'] == row['sha256'] and current['bytes'] == row['bytes'], 'originalPhysicalIdentityAdopted': False})
        outputs.append(put(O / 'report/original-package-obligation-comparison.json', {'originalSource': original_toolchain_path, 'rootLockVersions': {p['package']: p['version'] for p in packages}, 'compilerObligationVersion': '0.27.0', 'mandatoryCompilerSources': ['node_modules/esbuild/lib/main.js', 'node_modules/esbuild/package.json', 'node_modules/@esbuild/linux-x64/bin/esbuild'], 'esbuildAndLinuxX64VersionMatchOriginalContract': all(p['version'] == '0.27.0' for p in packages if p['package'] in ('esbuild', '@esbuild/linux-x64')), 'originalDeclaredPackageFiles': comparisons, 'byteConflicts': [r['originalDeclaredPath'] for r in comparisons if not r['exactByteMatch']], 'dependentExecutionPermitted': False, 'sourceVersionDriftDisposition': 'FRESH_INDEPENDENT_REVIEW_REQUIRED_BEFORE_DEPENDENT_EXECUTION'}))
        originals = sum(row['bytes'] for row in lineage['inputs'])
        comparisons = sum(row['legacyC6']['bytes'] for row in lineage['inputs'])
        encoded_packages = sum(p['encodedBytes'] for p in packages)
        expanded_packages = sum(p['expandedRegularBytes'] for p in packages)
        package_file_count = sum(sum(m['type'] == 'regular' for m in p['members']) for p in packages)
        finite_regular = sum(r['bytes'] for r in regular) + 3001521619 + originals + comparisons + expanded_packages
        # Source prebyte policy is RAW_EXACT_PREIMAGE: exact demand, no invented
        # compression ratio. Raw subject output has original graph-sized limits;
        # its final coefficient depends on future dispatch closure, not this run.
        demands = {'FULL8': {'regularPathBytes': sum(r['bytes'] for r in regular), 'regularPaths': len(regular), 'literalLinks': len(links)}, 'HIST70020': {'regularPathBytes': 3001521619, 'regularPaths': 70020}, 'original823': {'bytes': originals, 'paths': 823}, 'C6comparison823': {'bytes': comparisons, 'paths': 823}, 'sevenPackages': {'encodedBytes': encoded_packages, 'expandedRegularBytes': expanded_packages, 'regularPaths': package_file_count}, 'selected485Backing': {'rawBytes': sum(wanted.values()), 'objects': len(wanted)}, 'nextPhysicalRegularSubtotalBytes': finite_regular, 'nextFullRawSourcePrebytesBytes': finite_regular, 'sourceRawPrebytesEncoding': 'RAW_EXACT_PREIMAGE_NO_COMPRESSION_RATIO_ASSUMPTION', 'existingLinuxAcquisitionRawObjectBytes': sum(wanted.values()), 'subjectRawDemand': {'status': 'HOLD_UNTIL_EXACT_CURRENT_DISPATCH_CLOSURE_DERIVED', 'compilerRawFormula': '32*(admittedGraphBytes+snapshotBytes)+8192*inputClosureRows+16384', 'compilerEncodedFormula': 'rawLimit+ceil(rawLimit/65536)*64+1024', 'rootRawFormula': '32*closureBytes+16384', 'rootReceiptEachQuotaBytes': 1073741824, 'originalProcessOwnerRawLimit': 256000, 'valuesNotInventedOrReduced': True}, 'allNextPhaseDiskAdmission': 'HELD_PENDING_SOURCE_BINDINGS_AND_EXACT_RAW_LEDGER_RECEIPT_DEMAND', 'currentResource': resource(), 'largerCohortsMaterialized': False}
        outputs.append(put(O / 'report/next-phase-demand-accounting.json', demands))
        # Copy only finite source/contract aids, never old duplicate object sets.
        aid_paths = [Path('work/resume/task04-c8-prospective-preparation/candidate') / p.name for p in (R / 'work/resume/task04-c8-prospective-preparation/candidate').iterdir() if p.is_file()]
        aid_paths += [Path(p) for p in ['convex-dev/runtimeModelPolicy.ts', 'convex-dev/runtimeModelPolicyBootstrap.ts', 'convex-dev/runtimeGateway.ts', 'convex-dev/runtimePolicySchema.ts', 'convex-dev/schema.ts', 'src/domain/model-policy.ts', 'src/domain/profile.ts', 'src/domain/index.ts', 'src/auth/verified.ts', 'tests/unit/runtimeMemory/fixture.ts', 'package.json', 'work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json', 'work/resume/task04-c7-full-partial-review/independent-eight-recipes.json', 'work/resume/task04-c8-prospective-preparation/semantic-501-residual.json']]
        aids = []
        for relative in sorted(aid_paths):
            chunks = []
            source = held(R / relative, chunks.append)
            destination = put(O / 'source-aids' / relative, b''.join(chunks))
            aids.append({'newTransportRead': source, 'ownedLinuxSourceBaseline': destination, 'sourceSubjectImportedOrEvaluated': False})
        outputs.append(put(O / 'report/finite-source-baselines.json', aids))
        result.update(status='COMPLETE_BOUNDED_LINUX_ACQUISITION_SOURCE_BASELINE', selectedObjectCount=len(acquired), sourceAids=len(aids), historicalRows=len(history), packages=len(packages), full8RegularBytes=sum(r['bytes'] for r in regular), largerPreparationGate='FRESH_INDEPENDENT_REVIEW_REQUIRED')
    except BaseException as error:
        result.update(status='FAILED_PRESERVED_NO_IMPLICIT_REFRESH', primary={'type': type(error).__name__, 'message': str(error)})
        raise
    finally:
        result['elapsedSeconds'] = time.monotonic() - started
        result['sourceInputs'] = sources
        result['outputs'] = outputs
        try:
            result['toolsPRE'] = tools_pre
            result['toolsPOST'] = [held(p, lambda _: None) for p in sorted((O / 'tools').glob('*.py'))]
            result['interpreterPRE'] = interpreter_pre
            result['interpreterPOST'] = held(Path(sys.executable).resolve(), lambda _: None)
            result['nodeBinaryPRE'] = node_pre
            result['nodeBinaryPOST'] = held(Path('/usr/local/bin/node'), lambda _: None)
            result['ownedToolsAndRuntimeEqual'] = result['toolsPRE'] == result['toolsPOST'] and result['interpreterPRE'] == result['interpreterPOST'] and result['nodeBinaryPRE'] == result['nodeBinaryPOST']
            result['resourcePOST'] = resource()
            if not result['ownedToolsAndRuntimeEqual']:
                result['status'] = 'FAILED_OWNED_SOURCE_OR_RUNTIME_DRIFT'
        except BaseException as error:
            result['secondary'] = {'type': type(error).__name__, 'message': str(error)}
            result['status'] = 'FAILED_POST_PRESERVED'
        put(O / 'report/acquisition-receipt.json', result)
        print(json.dumps({k: v for k, v in result.items() if k not in ('sourceInputs', 'outputs', 'toolsPRE', 'toolsPOST', 'interpreterPRE', 'interpreterPOST', 'nodeBinaryPRE', 'nodeBinaryPOST', 'phases', 'resourcePRE', 'resourcePOST')}))
        if not result['status'].startswith('COMPLETE_'):
            raise SystemExit(1)

if __name__ == '__main__':
    main()
