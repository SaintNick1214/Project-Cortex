"""Explicit receipt membership; fresh independent acceptance remains absent."""
from pathlib import Path
import hashlib,json,re
Q=Path(__file__).resolve().parents[1]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=[]
for p in sorted(Q.rglob('*')):
 if not p.is_file():continue
 rel=str(p.relative_to(Q))
 if rel.startswith(('tmp/','coordinate-source/')) or rel in ['candidate-freeze-attempt5.json','receipt-manifest-attempt5.json','independent-preparation-review.json'] or re.fullmatch(r'managed-fixture/fixture/convex/_generated/(api\.d\.ts|api\.js|dataModel\.d\.ts|server\.d\.ts|server\.js)',rel):continue
 assert not p.is_symlink() and p.stat().st_nlink==1
 files.append({'path':rel,'sha256':sha(p),'bytes':p.stat().st_size})
conservation=json.loads((Q/'attempt5/conservation-receipt.json').read_bytes())
result={'scope':'NEW_ATTEMPT5_STRICT_VERSION_AND_OWNED_GROUP_SOURCE_REPAIR_ONLY','state':'FROZEN_AWAITING_FRESH_INDEPENDENT_PREPARATION_AND_SOURCE_REVIEW','candidate':'candidate-freeze-attempt5.json',
 'report':'attempt5/preparation-report.md','reportSha256':sha(Q/'attempt5/preparation-report.md'),'conservation':'attempt5/conservation-receipt.json','conservationSha256':sha(Q/'attempt5/conservation-receipt.json'),
 'currentGuardSha256':sha(Q/'scripts/guard.mjs'),'acceptedPrivateHelperUnchangedSha256':sha(Q/'transport-prep/private-transport.py'),'acquisitionSourceSha256':sha(Q/'attempt5/source-acquisition.py'),
 'commonOwnedGroupSourceSha256':sha(Q/'coordinate-source/task03-attempt5-coordinate-common.py'),'freshRequestFileSha256':sha(Q/'project-request.json'),'parsedRequestSha256':conservation['parsedRequestSha256'],
 'sourcePins':161,'testInputs':155,'managedCopies':138,'compilerProjection':114,'historicalReferences':23,'previousQ4Members':1338,'currentQ4ExactMembers':1329,'exactQ4Preimages':9,'all1338PreimagesRecoverable':True,'previousQ3Members':965,'currentQ3ExactMembers':955,'exactQ3Preimages':10,
 'sourceControls':47,'realFilesystemControls':3,'cleanupDriverControls':28,'newHostSourceControls':46,'newLinuxSourceControls':46,'conservedHostAndLinuxSourceControls':39,'newInvalidVersionControls':7,'guardNegatives':41,
 'hostAndLinuxCoordinatorControls':{'actualOutcomes':9,'invalidBounds':4,'actualExitedParentVariants':2,'injectedUnknownOwnership':1},'mjsLint':6,'mjsSyntax':4,'qaPythonSyntax':conservation['qaPythonSyntax'],
 'actualLinuxPublicDummy':'attempt5/linux-window3/result.json','actualLinuxPublicDummySha256':sha(Q/'attempt5/linux-window3/result.json'),'LinuxFailedDummiesRemainFAIL':['attempt5/linux-window/result.json','attempt5/linux-window2/result.json'],
 'LinuxDummy2InnerCommonRaw':'UNKNOWN_UNAVAILABLE_NOT_EXPORTED_BEFORE_OWNED_CLEANUP_NO_RECONSTRUCTION','allThreeOwnedDummyContainersAndVolumesAbsent':True,'DockerWindow':'RELEASED_TO_PARENT',
 'reused1005Tests17Suites':'EXACT_SOURCE_DISCOVERY_SKIP_DEPENDENCY_COMPILER_PINS_NOT_RERUN','fiveMutableBaselinePreimages':json.loads((Q/'attempt4/generated-baseline-preimages.json').read_bytes())['files'],
 'requiredConservedCounts':conservation['requiredConservedCounts'],'requiredRuntimeBounds':conservation['requiredRuntimeBounds'],'actualCredentialReads':0,'services':0,'provisioning':0,'officialCLI':'NOT_RUN','codegen':'NOT_RUN','nativeCases':'NOT_RUN','paidCalls':0,'actualCandidateTransfer':False,'fullTask03':'OPEN','selfAccepted':False,
 'separateCoordinatorBundle':'coordinate-source/source-receipt-manifest.json; excluded from preparation member traversal to bind this final freeze without a recursive hash cycle','files':files}
(Q/'receipt-manifest-attempt5.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'manifestSha256':sha(Q/'receipt-manifest-attempt5.json'),'members':len(files),'sourceControls':47,'hostAcquisition':46,'LinuxAcquisition':46}))
