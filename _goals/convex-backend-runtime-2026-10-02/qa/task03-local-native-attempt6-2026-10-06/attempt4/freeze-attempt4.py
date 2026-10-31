"""Exact candidate membership; five generated baselines separate, no self acceptance."""
from pathlib import Path
import hashlib
import json
import re

Q = Path(__file__).resolve().parents[1]
hash_file = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
old = Q / 'attempt4/ancestry/candidate-freeze-attempt3.json'
assert hash_file(old) == '2fb8d11a7e6c0bcaf92b2fe8d7ff228a6e554f9241c07c22079e6be8bcc870ef'
candidate = json.loads(old.read_bytes())
files = []
for path in sorted(Q.rglob('*')):
    if not path.is_file():
        continue
    name = str(path.relative_to(Q))
    if name.startswith('tmp/') or name in ['candidate-freeze-attempt4.json', 'independent-preparation-review.json'] or re.fullmatch(r'managed-fixture/fixture/convex/_generated/(api\.d\.ts|api\.js|dataModel\.d\.ts|server\.d\.ts|server\.js)', name):
        continue
    assert not path.is_symlink() and path.stat().st_nlink == 1
    files.append({'path': name, 'sha256': hash_file(path), 'bytes': path.stat().st_size})
request = json.loads((Q / 'project-request.json').read_bytes())
candidate.update(preparationCycle='NEW_NATIVE_ATTEMPT4_SOURCE_ACQUISITION_ONLY_AFTER_RETIRED_ATTEMPT3_ACTUAL_FAIL', nativeAttempt=4, operation=request['operation'], currentReceiptManifest='receipt-manifest-attempt4.json', previousAttempt={'namespace': 'task03-local-native-attempt3-2026-10-05', 'acceptedBoundedPreparationFreezeSha256': hash_file(old), 'members': 965, 'operation': 'd98bad88-5157-4816-b458-4160e7945361', 'targetRetired': '3156409/gallant-mastiff-565 POST200 GET404 2026-10-06T07:23:57.250Z', 'actualCLI': 0, 'nativeCases': 0, 'privateTransfer': 'FAIL; precise original tuple/stage and credential byte-read count UNKNOWN/UNAVAILABLE; no cause reconstruction'}, managementApproval='REQUIRES_FRESH_INDEPENDENT_ATTEMPT4_MANAGEMENT_REVIEW_PARENT_OWNS_HELPER', privateTransport='NEW held-host-FD framed stdin into native501:20/0700 source, unchanged accepted helper all9/fullbytes/final after receipt; host39/Linux39 actual PUBLIC dummy only; real credentials/services/CLI/native HELD', newLocalVerification={'conservedSource': 47, 'actualFilesystem': 3, 'cleanupDriver': 28, 'hostSource': 39, 'actualLinuxSource': 39, 'guardNegatives': 41, 'lintFiles': 6, 'mjsSyntax': 4, 'allFourNewOwnedDummyResourcesAbsent': True, 'reused1005TestsAndTypes': 'EXACT_PINS_NOT_RERUN'}, files=files)
(Q / 'candidate-freeze-attempt4.json').write_text(json.dumps(candidate, indent=2) + '\n')
print(json.dumps({'candidateSha256': hash_file(Q / 'candidate-freeze-attempt4.json'), 'files': len(files), 'bytes': sum(row['bytes'] for row in files)}))
