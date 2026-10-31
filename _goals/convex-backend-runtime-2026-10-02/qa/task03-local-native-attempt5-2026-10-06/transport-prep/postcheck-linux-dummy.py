import json, os
from pathlib import Path
assert os.getuid() == 0
rows = []
for case in sorted(Path('/owned/cases').iterdir()):
    files = sorted(p.name for p in (case / 'private').iterdir())
    assert files == (['owned-existing'] if case.name == 'destination-nonempty' else []), case.name
    rows.append({'case': case.name, 'baselineFiles': files, 'newOutputs': 0})
assert sorted(p.name for p in Path('/owned/healthy/private').iterdir()) == ['deploy.env', 'jwt-private.pem', 'private-receive-custody.json', 'target.json']
print(json.dumps({'scope': 'ACTUAL_DUMMY_ROOT_METADATA_POSTCHECK_ONLY', 'status': 'PASS', 'negativeCases': len(rows), 'results': rows, 'actualCredentialReads': 0, 'services': 0}))
