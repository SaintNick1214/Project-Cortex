"""Hash explicit public receipt membership and five mutable baselines separately."""
from pathlib import Path
import ast
import hashlib
import json
import re

Q = Path(__file__).resolve().parents[1]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
files = []
for p in sorted(Q.rglob('*')):
    if not p.is_file():
        continue
    rel = str(p.relative_to(Q))
    if rel.startswith('tmp/') or rel in ['candidate-freeze-attempt4.json', 'receipt-manifest-attempt4.json', 'independent-preparation-review.json'] or re.fullmatch(r'managed-fixture/fixture/convex/_generated/(api\.d\.ts|api\.js|dataModel\.d\.ts|server\.d\.ts|server\.js)', rel):
        continue
    files.append({'path': rel, 'sha256': sha(p), 'bytes': p.stat().st_size})
syntax = []
for p in sorted((Q / 'attempt4').glob('*.py')):
    ast.parse(p.read_text(), filename=str(p))
    syntax.append({'path': str(p.relative_to(Q)), 'sha256': sha(p)})
checks = {'scope': 'NEW_ATTEMPT4_SOURCE_PREPARATION_ONLY_NO_SELF_ACCEPTANCE', 'state': 'FROZEN_AWAITING_FRESH_INDEPENDENT_PREPARATION_AND_MANAGEMENT', 'report': 'attempt4/preparation-report.md', 'reportSha256': sha(Q / 'attempt4/preparation-report.md'), 'recipe': 'attempt4/runner-and-private-transport-recipe.md', 'recipeSha256': sha(Q / 'attempt4/runner-and-private-transport-recipe.md'), 'conservation': 'attempt4/conservation-receipt.json', 'conservationSha256': sha(Q / 'attempt4/conservation-receipt.json'), 'candidate': 'candidate-freeze-attempt4.json', 'currentGuardSha256': sha(Q / 'scripts/guard.mjs'), 'acceptedPrivateHelperUnchangedSha256': sha(Q / 'transport-prep/private-transport.py'), 'acquisitionSourceSha256': sha(Q / 'attempt4/source-acquisition.py'), 'freshRequestFileSha256': sha(Q / 'project-request.json'), 'sourcePins': 161, 'testInputs': 155, 'managedCopies': 138, 'compilerProjection': 114, 'historicalReferences': 23, 'previousQ3Members': 965, 'currentExactQ3Members': 955, 'exactPreimages': 10, 'sourceControls': 47, 'realFilesystemControls': 3, 'cleanupDriverControls': 28, 'newHostSourceControls': 39, 'newLinuxSourceControls': 39, 'newGuardNegatives': 41, 'mjsLint': 6, 'mjsSyntax': 4, 'qaPythonSyntax': syntax, 'actualLinuxPublicDummyReceipt': 'attempt4/dummy4/linux-dummy-result.json', 'actualLinuxPublicDummyReceiptSha256': sha(Q / 'attempt4/dummy4/linux-dummy-result.json'), 'actualNativeSourceCustodySha256': sha(Q / 'attempt4/dummy4/actual-native-source-custody.json'), 'originalThreeDummyFailuresRemainFAIL': True, 'allFourDummyResourcesAbsentReceipt': 'attempt4/dummy-cleanup2/result.json', 'allFourDummyResourcesAbsentReceiptSha256': sha(Q / 'attempt4/dummy-cleanup2/result.json'), 'fiveMutableBaselinePreimages': json.loads((Q / 'attempt4/generated-baseline-preimages.json').read_bytes())['files'], 'reused1005TestsAndTypes': 'EXACT_SOURCE_TEST_DISCOVERY_DEPENDENCY_COMPILER_PINS_NOT_RERUN', 'actualCredentialReads': 0, 'services': 0, 'provisioning': 0, 'officialCLI': 'NOT_RUN', 'codegen': 'NOT_RUN', 'nativeCases': 'NOT_RUN', 'paidCalls': 0, 'fullTask03': 'OPEN', 'files': files}
(Q / 'receipt-manifest-attempt4.json').write_text(json.dumps(checks, indent=2) + '\n')
print(json.dumps({'manifestSha256': sha(Q / 'receipt-manifest-attempt4.json'), 'files': len(files), 'qaPythonSyntax': len(syntax)}))
