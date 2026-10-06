"""Independently bind the enabling attestations to the finalized reviews and source."""
import hashlib
import json
import os
from pathlib import Path
import stat

ROOT=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa'
OUT=Path(__file__).resolve().parent
FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
rows=[]

def read(relative):
    p=QA/relative
    before=p.lstat()
    assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and not p.is_symlink()
    fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
    identity=lambda s:{key:str(getattr(s,key)) for key in FIELDS}
    try:
        assert identity(before)==identity(os.fstat(fd))
        data=bytearray()
        while True:
            part=os.read(fd,1048576)
            if not part:break
            data.extend(part)
        assert len(data)==before.st_size
        assert identity(before)==identity(os.fstat(fd))==identity(p.lstat())
    finally:os.close(fd)
    digest=hashlib.sha256(data).hexdigest()
    rows.append({'path':str(p.relative_to(ROOT)),'bytes':len(data),'sha256':digest,'identityDecimal':identity(before),'heldFdFullReadAndAllNineStable':True})
    return bytes(data),digest

q='task03-local-native-attempt2-2026-10-05/'
p='local-resume-2026-10-05/'
freeze_bytes,freeze_hash=read(q+'candidate-freeze-attempt2-repair1.json')
assert freeze_hash=='cd5e0c71e1839f079906becb9c5e0a90aba2261890ec4fb7997bc2981db966f5'
prep_bytes,_=read(q+'independent-preparation-review.json')
prep=json.loads(prep_bytes)
assert (prep['scope'],prep['verdict'],prep['independent'],prep['candidateSha256'],prep['average'])==('BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION','PASS',True,freeze_hash,4.2)
_,prep_report_hash=read(p+'task03-attempt2-repair1-preparation-review/report.md')
assert prep_report_hash==prep['reportSha256']
prep_original,_=read(p+'task03-attempt2-repair1-preparation-review/verdict.json')
prep_original=json.loads(prep_original)
assert prep_original['verdict']=='PASS' and prep_original['candidateSha256']==freeze_hash
management_bytes,_=read(p+'task03-attempt2-management-review.json')
management=json.loads(management_bytes)
assert management['scope']=='TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY' and management['verdict']=='PASS' and management['independent'] is True
assert management['candidateSha256']==freeze_hash and management['average']==4.4
_,management_report_hash=read(p+'task03-attempt2-repair1-management-review/report.md')
assert management_report_hash==management['reportSha256']
management_original,_=read(p+'task03-attempt2-repair1-management-review/review-receipt.json')
management_original=json.loads(management_original)
assert management_original['verdict']=='PASS' and management_original['candidateSha256']==freeze_hash
_,guard_hash=read(q+'scripts/guard.mjs')
assert guard_hash=='8c99c99ff562d7c8cdc23a8870dd0461774b2aeeae92b1fc789e4dc8a1dcc9b5'==management['guardSha256']==management_original['guardSourceSha256']
_,helper_hash=read(p+'task03-attempt2-target-management.mjs')
assert helper_hash=='213739458a90078a164cb4b87a583364109d43c2e2ee6687b8a2c97a0600a457'==management['managementSourceSha256']==management_original['managementSourceSha256']
request_bytes,_=read(q+'project-request.json')
request=json.loads(request_bytes)
request_hash=hashlib.sha256(json.dumps(request,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
assert request_hash=='e085a6822de67476645f04d89f5ca6b8951ab845ae1b0663382abfbef95a13c2'==management['requestSha256']==management_original['requestSha256']
assert request['operation']=='511363b3-8cec-4e98-95d8-ecd4865457a8'
assert request['projectSlug']=='cortex-foundation-delta-cd358019d808'
_,transfer_hash=read(p+'task03-attempt2-linux-public-transfer.py')
assert transfer_hash=='7aae094c5a6789268c1c86bc08fb78a84c3a50236dc5ad1f7d2a6cd5eb161cc8'==prep['linuxTransportSourceSha256']
for name in ['task03-attempt2-linux-public-transfer-command.json','task03-attempt2-linux-public-transfer.stderr','task03-attempt2-linux-public-transfer.stdout','task03-attempt2-linux-public-transfer-r1-command.json','task03-attempt2-linux-public-transfer-r1.stdout','task03-attempt2-linux-public-transfer-r1.stderr','task03-attempt2-linux-owned-volume-init.stdout','task03-attempt2-linux-owned-volume-init.stderr','task03-attempt2-public-owner-diagnosis.json','task03-attempt2-public-source-owner-probe501.stdout','task03-attempt2-public-source-owner-probe501.stderr']:
    read(p+name)
result={'scope':'INDEPENDENT_PUBLIC_PARENT_ATTESTATION_BINDINGS_ONLY','verdict':'PASS','files':rows,'freezeSha256':freeze_hash,'preparationReportSha256':prep_report_hash,'managementReportSha256':management_report_hash,'managementHelperSha256':helper_hash,'guardSha256':guard_hash,'requestSha256':request_hash,'publicTransferHelperSha256':transfer_hash,'operation':request['operation'],'projectSlug':request['projectSlug'],'sourcePreservation':'ALL_CURRENT_HELD_READS_FULL_AND_ALL_NINE_STABLE','privateReads':0,'serviceCalls':0,'enablingAttestationWrittenByJudge':False}
(OUT/'actual-parent-bindings.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='files'}))
