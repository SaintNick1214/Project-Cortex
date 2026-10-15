"""Read-only eligibility proof; no extraction, build, pack, network or source writes."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import subprocess
import sys
import tarfile

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q = Path(__file__).resolve().parent
PRIOR = '3875d3238705a90cb191abbf824d3fa3517e42e5'
OLD = Path('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-memory-effort-singleton-2026-10-15')
commit = sys.argv[1] if len(sys.argv) > 1 else 'SOURCE_COMMIT_PENDING'
assert commit == 'SOURCE_COMMIT_PENDING' or len(commit) == 40 and all(c in '0123456789abcdef' for c in commit)
sha = lambda b: hashlib.sha256(b).hexdigest()
git = lambda *args: subprocess.check_output(['git', *args], cwd=R)
at = lambda name: (R/name).read_bytes() if commit == 'SOURCE_COMMIT_PENDING' else git('show', commit+':'+name)
manifest = json.loads((OLD/'image/archives/manifest.json').read_text())
assert manifest['sourceCommit'] == PRIOR
assert sha((OLD/'image/archives/manifest.json').read_bytes()) == 'e38e51f1077712ae49322f133656be6194a65363ccadfa03c0322cf66d0853cc'
specs = {'cli': ('packages/cortex-cli', ['src', 'scripts', 'package.json', 'README.md', 'tsconfig.json']),
         'provider': ('packages/vercel-ai-provider', ['src', 'react', 'package.json', 'README.md', 'LICENSE.md', 'tsconfig.json']),
         'catalog': ('packages/cortex-templates', ['package.json', 'catalog.json', 'payloads', 'README.md'])}
# One bounded Git object batch avoids a subprocess for each immutable payload.
def blobs(revision, paths):
    tree = git('ls-tree', '-r', '-z', revision, '--', *paths).decode().rstrip('\0').split('\0')
    entries = [(line.split('\t', 1)[1], line.split('\t', 1)[0].split()[2]) for line in tree if line]
    raw = subprocess.check_output(['git', 'cat-file', '--batch'], input=('\n'.join(oid for _, oid in entries)+'\n').encode(), cwd=R)
    offset, out = 0, {}
    for name, oid in entries:
        end = raw.index(b'\n', offset); header = raw[offset:end].decode().split(); assert header[:2] == [oid, 'blob']
        size = int(header[2]); offset = end+1; out[name] = raw[offset:offset+size]; offset += size
        assert raw[offset:offset+1] == b'\n'; offset += 1
    assert offset == len(raw)
    return out
selected = ['package-lock.json', 'package.json', 'tsconfig.json'] + [prefix+'/'+name for prefix, selected in specs.values() for name in selected]
baseline = blobs(PRIOR, selected)
current = baseline if commit == 'SOURCE_COMMIT_PENDING' else blobs(commit, selected)
def at(name):
    return (R/name).read_bytes() if commit == 'SOURCE_COMMIT_PENDING' else current[name] if name in current else git('show', commit+':'+name)
result = []
for role, (prefix, selected) in specs.items():
    row = next(x for x in manifest['packages'] if x['role'] == role)
    archive = OLD/'image/archives'/row['filename']
    assert sha(archive.read_bytes()) == row['sha256']
    paths = [prefix+'/'+name for name in selected]
    closure = git('ls-tree', '-r', '--name-only', '-z', PRIOR if commit == 'SOURCE_COMMIT_PENDING' else commit, '--', *paths).decode().rstrip('\0').split('\0')
    # Root compiler/config/lock versions are part of the recorded build closure.
    closure = sorted(set(closure + ['package-lock.json', 'package.json', 'tsconfig.json']))
    changes, inputs = [], []
    prior_names = set(git('ls-tree', '-r', '--name-only', '-z', PRIOR, '--', *paths).decode().rstrip('\0').split('\0')) | {'package-lock.json', 'package.json', 'tsconfig.json'}
    if prior_names != set(closure):
        changes.append({'sourceMembershipAdded': sorted(set(closure)-prior_names), 'sourceMembershipRemoved': sorted(prior_names-set(closure))})
    for name in closure:
        actual = sha(at(name)); inputs.append({'path': name, 'sha256': actual})
        original_hash = sha(baseline[name]) if name in baseline else None
        if actual != original_hash: changes.append({'source': name, 'prior': original_hash, 'current': actual})
    published, generated, mismatches, pins, external_sdk_edges, current_mismatches = [], [], [], [], [], []
    published_root = Path(row['publishedComparisonRoot'])
    with tarfile.open(archive, 'r:gz') as tar:
        for member in tar.getmembers():
            if member.isdir(): continue
            assert member.isfile() and member.name.startswith('package/')
            name = member.name[len('package/'):]
            assert not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts
            data = tar.extractfile(member).read()
            published.append({'path': name, 'sha256': sha(data), 'bytes': len(data)})
            original_path = published_root/name
            if not original_path.is_file() or original_path.is_symlink() or sha(original_path.read_bytes()) != sha(data):
                mismatches.append({'publishedFile': name, 'matchesAcceptedPublishedFile': False})
            current_path = R/prefix/name
            if not current_path.is_file() or sha(current_path.read_bytes()) != sha(data):
                current_mismatches.append(name)
            if name.startswith('dist/'):
                generated.append({'path': name, 'sha256': sha(data)})
                if name.endswith(('.js', '.cjs')) and b'@cortexmemory/sdk' in data:
                    external_sdk_edges.append(name)
            if name == 'package.json':
                package = json.loads(data)
                assert package['name'] == row['name'] and package['version'] == row['version']
                for key in ['gitHead', 'sourceCommit', 'buildCommit', 'commitSha', 'artifactRevision']:
                    if key in package: pins.append({'key': key, 'value': package[key]})
    if role != 'catalog':
        actual_generated = sorted(str(p.relative_to(published_root)).replace('\\', '/') for p in (published_root/'dist').rglob('*') if p.is_file())
        if actual_generated != sorted(x['path'] for x in generated): mismatches.append({'generatedMembershipChanged': True})
        assert external_sdk_edges, 'The existing dependent package must retain an external SDK boundary'
    assert sha(json.dumps(published, separators=(',', ':')).encode()) == row['publishedClosureSha256']
    if not changes: assert sha(json.dumps(inputs, separators=(',', ':')).encode()) == row['sourceClosureSha256'], role+' accepted source closure changed'
    eligible = not changes and not mismatches and not pins
    result.append({**row, 'action': 'reuse-exact-archive' if eligible else 'fresh-pack-required', 'eligibleNow': eligible,
      'archive': str(archive), 'originSourceCommit': row.get('originSourceCommit', PRIOR), 'lastAcceptedCompatibilityCommit': PRIOR, 'publishedComparisonRoot': str(published_root), 'originManifestSha256': sha((OLD/'image/archives/manifest.json').read_bytes()),
      'sourceClosure': inputs, 'sourceClosureSha256': sha(json.dumps(inputs, separators=(',', ':')).encode()),
      'sourceChanges': changes, 'publishedClosureSha256': sha(json.dumps(published, separators=(',', ':')).encode()),
      'publishedFiles': len(published), 'generatedClosure': generated, 'acceptedPublishedMismatches': mismatches, 'currentWorkingPublishedMismatches': current_mismatches,
      'packageCommitPins': pins, 'externalSdkEdges': external_sdk_edges,
      'condition': 'Exact accepted source inputs plus all accepted artifact members must match; local stale generated files are disclosed, never rebuilt or silently claimed fresh. Four actual new-SDK packed consumer groups remain required.'})

snapshot_file = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else None
sdk = {'action': 'fresh-pack-with-root-fresh-build-outputs', 'eligibleNow': False, 'sourceCommit': commit,
       'condition': 'Root performs one accepted-source SDK/backend build, then provides its real output snapshot; no build is performed by this eligibility reader.'}
if snapshot_file:
    snapshot = json.loads(snapshot_file.read_text())
    assert snapshot['sourceCommit'] == commit and commit != 'SOURCE_COMMIT_PENDING'
    assert sha(Path(snapshot['rootBuildReceipt']).read_bytes()) == snapshot['rootBuildReceiptSha256']
    assert sha(Path(snapshot['rootBuildLog']).read_bytes()) == snapshot['rootBuildLogSha256']
    changes = []
    names = git('ls-tree', '-r', '--name-only', '-z', commit, '--', *snapshot['selected']).decode().rstrip('\0').split('\0')
    if sorted(names) != sorted(x['path'] for x in snapshot['inputs']): changes.append({'inputMembershipChanged': True})
    for item in snapshot['inputs']:
        if sha(at(item['path'])) != item['sha256'] or sha((R/item['path']).read_bytes()) != item['sha256']:
            changes.append({'source': item['path']})
    outputs = sorted(p.relative_to(R).as_posix() for p in (R/'dist').rglob('*') if not p.is_dir())
    if outputs != sorted(x['path'] for x in snapshot['outputs']): changes.append({'outputMembershipChanged': True})
    for item in snapshot['outputs']:
        target = R/item['path']
        if not target.is_file() or target.is_symlink() or sha(target.read_bytes()) != item['sha256']:
            changes.append({'output': item['path']})
    sdk.update(eligibleNow=not changes, snapshot=str(snapshot_file), snapshotSha256=sha(snapshot_file.read_bytes()),
       rootBuildReceipt=snapshot['rootBuildReceipt'], rootBuildReceiptSha256=snapshot['rootBuildReceiptSha256'],
       inputClosureSha256=snapshot['inputClosureSha256'], outputClosureSha256=snapshot['outputClosureSha256'],
       backendManifestSha256=snapshot['backendManifestSha256'], inputFiles=len(snapshot['inputs']), outputFiles=len(snapshot['outputs']), changes=changes)
print(json.dumps({'version': 1, 'mode': 'READ_ONLY_REUSE_ELIGIBILITY', 'sourceCommit': commit,
 'sourceAccepted': commit != 'SOURCE_COMMIT_PENDING', 'sdk': sdk, 'packages': result,
 'builds': 0, 'packs': 0, 'images': 0, 'serviceCalls': 0, 'archiveExtractions': 0}, indent=2))
