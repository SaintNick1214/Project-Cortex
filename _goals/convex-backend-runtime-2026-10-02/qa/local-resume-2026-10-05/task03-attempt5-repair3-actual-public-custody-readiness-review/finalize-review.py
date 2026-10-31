"""Finite independent report + evidence finalization; no Docker or private reads."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06'
O=Path(__file__).parent
A=O/'operational-r3'
FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
def identity(s):return {k:str(getattr(s,k)) for k in FIELDS}
def held(path):
    before=path.lstat(); assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_uid==501 and before.st_gid==20
    assert path.resolve()==path
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        pin=identity(before);assert identity(os.fstat(fd))==pin
        chunks=[];size=0
        while True:
            chunk=os.read(fd,65536)
            if not chunk:break
            size+=len(chunk);assert size<=4*1024*1024;chunks.append(chunk)
        raw=b''.join(chunks)
        assert size==before.st_size and identity(os.fstat(fd))==identity(path.lstat())==pin
        return {'path':str(path.relative_to(R)),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':size,'identityDecimal':pin,'fullEOF':True,'allNinePreOpenPostFinal':True},raw
    finally:os.close(fd)
def write(path,raw):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        view=memoryview(raw)
        while view:
            count=os.write(fd,view);assert count>0;view=view[count:]
        os.fsync(fd)
    finally:os.close(fd)
def write_json(path,value):write(path,(json.dumps(value,indent=2)+'\n').encode())

commands=json.loads(held(A/'commands.json')[1]);custody=json.loads(held(A/'actual-public-custody.json')[1]);readiness=json.loads(held(A/'actual-cli-compiler-readiness.json')[1])
assert commands['status']=='PASS' and commands['cleanupErrors']==[] and commands['ownedContainersRemoved'] is True
verifications=[]
for namespace,journal,raw_dir in [(Q/'coordinate-source/repair3/task03-attempt5-public-acquisition',Q/'coordinate-source/repair3/task03-attempt5-public-acquisition/commands.json',Q/'coordinate-source/repair3/task03-attempt5-public-acquisition'),(A,A/'commands.json',A/'raw')]:
    data=json.loads(held(journal)[1]);assert data['status']=='PASS' and data['cleanupErrors']==[]
    observed=[]
    for row in data['commands']:
        assert row['terminal'] is True and row['failureClass'] is None and row['closeErrors']==[] and type(row['exitCode']) is int
        receipt_meta,receipt_bytes=held(raw_dir/(row['label']+'.receipt.json'));assert json.loads(receipt_bytes)==row
        streams=[]
        for stream in ['stdout','stderr']:
            meta,raw=held(raw_dir/(row['label']+'.'+stream));assert meta['sha256']==row[stream+'Sha256']
            assert len(raw)==row['streamByteCounts'][stream] and len(raw)<=262144
            streams.append(meta)
        observed.append({'label':row['label'],'receipt':receipt_meta,'streams':streams,'terminal':True,'exitCode':row['exitCode']})
    verifications.append({'path':str(namespace.relative_to(R)),'count':len(observed),'commands':observed,'status':'PASS_FULL_EOF_HASH_SIZE_ALL9_CURRENT_RAW_RECEIPTS'})
assert [v['count'] for v in verifications]==[21,40]
write_json(O/'raw-receipt-verification.json',{'status':'PASS','verification':verifications,'privateReads':0,'serviceCalls':0})

rubric={'requirementFulfillment':5,'codeQuality':4,'testQuality':4,'patternAdherence':4,'completeness':4,'average':4.2}
verdict={
 'scope':'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY','verdict':'PASS','independent':True,'rubric':rubric,
 'operation':commands['operation'],'volume':commands['volume'],'publicFileCount':1912,
 'sourceFreezeSha256':custody['receiptMetadata'].get('sourceFreezeSha256','053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570'),
 'sourceReceiptManifestSha256':'f8486d1296f696924820c932199fcbf10e1dbf46f84de6162fadb1c2bba3d5cd',
 'publicBindingSha256':'531b6ee19136a00f03b560640a0ff6cc341f91ed2921be225bdac56ae9cf7209',
 'transferReceiptSha256':custody['receiptMetadata']['sha256'],'transferReceiptBytes':custody['receiptMetadata']['bytes'],
 'allCurrentDestinationIdentities':'PASS_ALL9','currentSourceDestinationFullContent':'PASS',
 'currentSourceAll9FullEOFHashSize':'PASS_1912_PRE_OPEN_POST_FINAL',
 'hostPublicProductOperativeCurrentBaseline':'PASS_ALL9_INITIAL_AND_FINAL',
 'exactMembership':'PASS_1905_FROZEN_PLUS_FREEZE_REVIEW_AND_5_BASELINE_GENERATED',
 'historicalSourceIdentity':'UNKNOWN_BIND_SESSION_ST_INO_DIFFERENCES_ALL1912_NOT_RESTORED',
 'credentialFreeReadiness':{'scope':'CREDENTIAL_FREE_ACTUAL_CLI_COMPILER_READINESS','verdict':'PASS','rubric':rubric,
    'dependencyVolume':commands['dependencyVolume'],'dependencyVolumeLabels':None,'dependencyVolumeOptions':None,
    'dependencyVolumeCreatedAt':'2026-10-06T04:10:52Z','node':'24.15.0','npm':'12.2.0','Convex':'1.46.0','TypeScript':'6.0.3',
    'fourManifestHashes':'PASS_CURRENT_SOURCE_AND_RETAINED_VOLUME','nativeEsbuildTransform':'PASS','sourcePreflightCounts':[161,138,1905],
    'actualCompilerDiscovery':'PASS_CWD_PROJECTED_114_FILES','oldPathOnlyLookup':'MISSING_AS_EXPECTED','fixtureTypecheck':'PASS_NO_EMIT',
    'memoryBytes':2147483648,'memorySwapBytes':2147483648,'addedHeapFlags':False,'OOMEvents':0,
    'actualExternalRequests':0,'actualServiceDeployments':0,'credentialReads':0},
 'boundedCommandCount':40,'allCommandReceiptsTerminal':True,'cleanupErrors':[],'ownedContainersRemoved':True,
 'daemonSourceMapping':'literal','historicalAcquisitionDaemonSourceMapping':'docker-desktop-host_mnt',
 'sourceMutationCount':0,'volumeMutationCount':0,'privateScratchReads':0,'privateScratchStats':0,'credentialReads':0,'APICalls':0,
 'serviceDeployments':0,'nativeTests':0,'inferenceCalls':0,'nativeFoundationAccepted':False,'privateOperationReleased':False,
 'cryptographicKeyJWKSEnvTargetAccepted':False,'Task04Pidfd38Qualified':False,'fullTask03':False,'goalAccepted':False,
 'allHistoricalC7MissingCustodyAndNewProductGates':'OPEN_UNCHANGED',
 'preservedAuditHarnessFailures':['commands.json:inferred_dependency_creation_date_before_container_creation','operational-r2/commands.json:volume_subpath_actual_Source_expectation_before_dependency_START'],
 'historicalFailedImplementer260CtimeSeal':'FAILED_PRESERVED_NOT_OPERATIVE_AUTHORITY',
 'originalDeadlinesAndAssertionsPreserved':True,'numericalCyclesOnlyWaived':True,
 'report':'report.md','actualReceipts':'operational-r3/commands.json','fullCustody':'operational-r3/actual-public-custody.json',
 'finalEvidenceManifest':'final-evidence-manifest.json','ownFinalSourcePin':'own-final-source-pin.json','mandatoryFinalAssessment':'final-source-assessment.json'
}
write_json(O/'verdict.json',verdict)
report='''# Task Judgment: Repair3 actual public Linux custody and credential-free readiness

## Verdict: PASS within each stated operational scope

The fresh independent audit qualifies prospective current public custody and credential-free installed-tool readiness only. It creates no private approval or parent enabling receipt. Full Task03, native/currentguard service acceptance, private crypto/env/target custody, Task04 pidfd38 qualification and the full backend goal remain incomplete.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Exact retained volume/image, new own operation,  immutable Linux amd64 image, 501:20, strict initial/terminal recipes | Yes | operational-r3/*-initial-recipe.json and raw/*-inspect.stdout |
| Full receipt body with complete hash/size/EOF/all 9 under unchanged limits | Yes | collected-public-transfer-receipt.json is 1,559,513 bytes, SHA256 9b7032447e363e23854f6c1aae9c479a994cae72adc0c0e64009dbd3657f55d8; raw collect-run.stdout encoded 198,355 bytes |
| Every 1912 destination current 9 exactly matches captured transfer identity, hash and bytes | Yes | operational-r3/actual-public-custody.json;200 candidate directories checked owner 501:20/mode 700, files 600/nlink 1/no aliases |
| Exact freeze 1905+7 membership and five officialCodegenMutable baseline bindings | Yes | same full custody report; freeze 053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570 |
| Every current source 1912 fullEOF/hash/size/pre/open/post/final identity and destination comparison | Yes | all 1912 observed rows in same custody report; host source/product/operative held baseline also matched initial/final all 9 |
| Historical source identity preserved honestly | Yes | all 1912 historical st_ino comparisons differ; UNKNOWN historical bind-session continuity; no history resealed |
| Exact current public source MF/binding and original source baseline | Yes | f8486d1296f696924820c932199fcbf10e1dbf46f84de6162fadb1c2bba3d5cd  / 531b6ee19136a00f03b560640a0ff6cc341f91ed2921be225bdac56ae9cf7209; current baseline 1c17fb942936adc3188aa7c4c9fdfd290c6cec6d39b1347dbd823b4a1436a08b |
| Prior dependency volume provenance vs current manifests/packages/native esbuild | Yes | operational-r3/actual-dependency-readiness.json; four full source/volume metadata receipts, Convex 1.46 / TS 6.0.3 / ws 8.21 / https-proxy-agent 7.0.6 / esbuild 0.27 |
| Actual readiness with absolute candidate and Linux node_modules subpaths, no inherited credentials | Yes | operational-r3/readiness-initial-recipe.json; env -i, HOME /tmp, tmpfs 501:20/0700, network none, root RO, cpus 2, pids 64 |
| Actual installed compiler discovery, 114 projected files,official version/help and fixture typing | Yes | operational-r3/actual-cli-compiler-readiness.json and actual-public-source-preflight.json 161/138/1905 |
| Readiness 2 GiB, no added heapflags, bounded 190 seconds, no OOM | Yes | readiness-run completed 21.16 seconds; three leaf exits 0; memory events all 0; 512 MiB full typing failure remains historical |
| Raw receipts, strict known terminal and owned-only cleanup, no volume writes | Yes | 40 commands, all terminal, cleanupErrors[], all own names absent exact stdout [] newline / exit 1/name-specific stderr; raw-receipt-verification.json also verifies retained acquisition 21 |

## Dimension Scores

| Dimension | Public custody | Readiness | Evidence |
|---|---|---|---|
| Requirement fulfillment |5/5|5/5| Every bounded operational requirement observed; excluded original Task03 outcomes explicitly remain open |
| Code quality |4/5|4/5| Finite gzip collectors, unchanged bounded supervisor, strict recipes and raw terminal receipts; two harness assumptions failed closed and were repaired in distinct preserved runs |
| Test quality |4/5|4/5| Actual all 1912 identity/content comparisons and installed official CLI/compiler/native esbuild results; no mocks promoted |
| Pattern adherence |4/5|4/5| Independent scope, private exclusion, unique owned cleanup, exact mount mapping and original assertions/limits retained |
| Completeness |4/5|4/5| Current public custody and offline readiness complete; mandatory own final evidence/source seal provided separately |

**Average: 4.2/5 for each bounded operational scope.**

## Issues Found

Critical within the two audited scopes: none after the successful observed run. Historical source inode identity remains UNKNOWN for all 1912 and is not restored by this PASS. Docker current bind mapping was literal in both mount views, distinct from the acquisition's historical host_mnt mapping. Docker volume-subpath remains exact in HostConfig.VolumeOptions.Subpath; actual Mounts.Source reports the retained volume root. Current file manifests/package execution confirm the mounted content.

Two initial harness failures are preserved: the first inferred the dependency creation date from the volume name; inspection proved 2026-10-06T04:10:52Z. The second expected a subpath suffix in actual Mounts.Source; it denied before dependency START. They are not missing product capabilities and do not alter limits/assertions. Retained dependency Labels and Options are null, Driver/Scope local; none were invented or changed.

The prior implementer 260-file ctime seal remains FAILED and is not operative authority. Previous C7/missing-custody histories and all unproved new product/full-goal outcomes remain open. No private scratch/credential/API/provision/env/deploy/native-test/inference operation was performed. Public script bodies were hashed as members; native/deploy code was not executed or treated as acceptance evidence.

## Recommendation

Accept only TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY and CREDENTIAL_FREE_ACTUAL_CLI_COMPILER_READINESS after final-source-assessment.json independently reports the unchanged finite evidence/source seal. Any private or native release requires its own fresh gates; this report does not release it.
'''
write(O/'report.md',report.encode())
print(json.dumps({'status':'REPORT_WRITERS_STOPPED','verdict':'PASS','scope':verdict['scope'],'operation':commands['operation']}))
