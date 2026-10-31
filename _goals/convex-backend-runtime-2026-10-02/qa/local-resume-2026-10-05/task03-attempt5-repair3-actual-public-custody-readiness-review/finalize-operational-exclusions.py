"""Finalize bounded operational verdict; explicitly preserve failed QA seal and preimages."""
import hashlib
import json
import os
from pathlib import Path
import stat
O=Path(__file__).parent
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
F=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
def ident(s):return {k:str(getattr(s,k)) for k in F}
def held(path):
    s=path.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and path.resolve()==path
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        pin=ident(s);assert ident(os.fstat(fd))==pin;chunks=[];size=0
        while True:
            raw=os.read(fd,65536)
            if not raw:break
            size+=len(raw);assert size<=4*1024*1024;chunks.append(raw)
        body=b''.join(chunks);assert size==s.st_size and ident(os.fstat(fd))==ident(path.lstat())==pin
        return {'path':str(path.relative_to(R)),'sha256':hashlib.sha256(body).hexdigest(),'bytes':size,'identityDecimal':pin,'fullEOF':True,'allNinePreOpenPostFinal':True},body
    finally:os.close(fd)
def write(path,value,replace=False):
    raw=value if isinstance(value,bytes) else (json.dumps(value,indent=2)+'\n').encode()
    fd=os.open(path,os.O_WRONLY|os.O_NOFOLLOW|(os.O_TRUNC if replace else os.O_CREAT|os.O_EXCL),0o600)
    try:
        view=memoryview(raw)
        while view:
            count=os.write(fd,view);assert count>0;view=view[count:]
        os.fsync(fd)
    finally:os.close(fd)

mf_meta,mf_raw=held(O/'final-evidence-manifest.json')
assert mf_meta['sha256']=='20b655f1f79e3675a8d171edb63a9daba7dffe7ac9e983b393769989afd717a9'
manifest=json.loads(mf_raw)
by={r['path']:r for r in manifest['files']}
for name in ['report.md','verdict.json']:
    meta,raw=held(O/(name+'.first-manifest-preimage'));original=by[str((O/name).relative_to(R))]
    assert meta['sha256']==original['sha256'] and meta['bytes']==original['bytes']
assert not (O/'own-final-source-pin.json').exists()
final_dir=O/'final-operational-observation-r2'
final_meta,raw=held(final_dir/'commands.json');final=json.loads(raw)
assert final['status']=='PASS' and final['cleanupErrors']==[] and final['ownedContainersRemoved'] is True
assert final['results']=={'custody':'PASS','dependencies':'PASS'}
custody_meta,raw=held(final_dir/'final-public-custody-comparison.json');custody=json.loads(raw)
assert custody['files']==1912 and custody['allCurrentDestinationIdentities']=='PASS_ALL9' and custody['currentSourceDestinationFullContent']=='PASS_FULL_EOF_HASH_SIZE_ALL1912'
raw_receipts=[]
for row in final['commands']:
    assert row['terminal'] is True and row['failureClass'] is None and row['closeErrors']==[] and type(row['exitCode']) is int
    meta,raw=held(final_dir/'raw'/(row['label']+'.receipt.json'));assert json.loads(raw)==row
    streams=[]
    for stream in ['stdout','stderr']:
        sm,sr=held(final_dir/'raw'/(row['label']+'.'+stream));assert sm['sha256']==row[stream+'Sha256'] and sm['bytes']==row['streamByteCounts'][stream];streams.append(sm)
    raw_receipts.append({'label':row['label'],'receipt':meta,'streams':streams,'terminal':True})
write(O/'final-raw-receipt-comparison.json',{'status':'PASS_ALL9_FULL_EOF_HASH_SIZE','commandCount':len(raw_receipts),'commands':raw_receipts,'privateReads':0})
v=json.loads(held(O/'verdict.json.first-manifest-preimage')[1])
v.pop('ownFinalSourcePin',None)
v['ownFinalSourcePinExists']=False
v['ownEvidenceSeal']='FAILED_PRESERVED_NOT_OPERATIONAL_AUTHORITY'
v['failedFirstEvidenceManifestSha256']=mf_meta['sha256']
v['failedFirstEvidenceManifestRegularFiles']=280
v['firstEvidenceSealInitialDelta']='ONLY_PRE_MANIFEST_FINAL_ASSESSMENT_ST_CTIME_NS_CONTENT_UNCHANGED'
v['operationalVerdictIndependentOfOwnFailedQAEvidenceSeal']=True
v['finalOperationalComparison']={'status':'PASS','operation':final['operation'],'commands':len(final['commands']),
  'all1912CurrentDestinationIdentities':'PASS_ALL9','all1912CurrentSourceDestinationBytes':'PASS_FULL_EOF_HASH_SIZE',
  'currentHostPublicProductOperative':'PASS_ALL9_FULL_EOF_HASH_SIZE_BEFORE_AND_AFTER_DOCKER',
  'currentDependencyManifestPackageIdentityAndEsbuild':'PASS_IDENTICAL_TO_SUCCESSFUL_READINESS',
  'actualPriorCLICompilerResults':'PASS_UNCHANGED_RAW_RESULTS_AND_CURRENT_OPERATIVE_BINDINGS',
  'cleanupErrors':[],'ownedContainersRemoved':True,'receipt':'final-operational-observation-r2/commands.json',
  'receiptSha256':final_meta['sha256'],'custodySha256':custody_meta['sha256']}
v['finalSerializedObservationInitialHold']='FOREIGN_TASK04_METHOD1_RUNNING_BEFORE_OWN_CONTAINER_CREATION_PRESERVED_UNTOUCHED'
v['rawEvidenceIntegrity']='COMPLETE_CURRENT_FULL_EOF_HASH_SIZE_AND_ALL9_READS_OF_ACTUAL_OPERATIONAL_RECEIPTS'
v['runtimeEnablingFilesWritten']=False
v['writersStoppedAfterFinalExclusionAssessment']=True
v['mandatoryFinalAssessment']='final-source-assessment.json:FAILED_OWN_SEAL_DISTINCT_FROM_OPERATIONAL_PASS'
write(O/'verdict.json',v,True)
report=held(O/'report.md.first-manifest-preimage')[1].decode()
report=report.replace('mandatory own final evidence/source seal provided separately','own evidence seal FAILED and excluded from operational authority')
report=report.replace('Accept only TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY and CREDENTIAL_FREE_ACTUAL_CLI_COMPILER_READINESS after final-source-assessment.json independently reports the unchanged finite evidence/source seal. Any private or native release requires its own fresh gates; this report does not release it.',
 'Accept only the independently observed TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY and CREDENTIAL_FREE_ACTUAL_CLI_COMPILER_READINESS outcomes, based on complete current raw contents and the final operative comparisons. The first own QA evidence seal is FAILED and excluded from operational authority. There is no own-final-source-pin.json. Any private or native release requires its own fresh gates; this report does not release it.')
report+='''

## Final operative comparisons and failed own QA seal

The final serialized Linux observation repeated all 1912 destination all-nine-field identities against the immutable captured transfer rows and repeated all current source full EOF/hash/size/all-nine-field reads. Retained dependencies and all four manifest/package identity rows plus native esbuild result are identical to the successful readiness run. Current host public/product/operative sources match the original baseline in all nine fields and full bytes before and after Docker. Exact final operation and raw hashes are in verdict.json and final-raw-receipt-comparison.json. The actual 2 GiB CLI/compiler outcomes are unchanged and their operative source/package bindings still pass. All owned containers are removed with exact absence receipts; no volume mutation, credentials, private data, service deployment or inference occurred.

An initial supplemental final observation stopped before container creation because a foreign Cortex Task04 method1 container was running. It was not inspected, signalled or removed. Its held resource receipt remains separate from the subsequent serialized comparison.

Own first finite manifest 20b655f1f79e3675a8d171edb63a9daba7dffe7ac9e983b393769989afd717a9 remains FAILED and unchanged. Its sole initial failure was a delayed st_ctime_ns change in pre-manifest-final-assessment.json; hash, size and the other eight identity fields remained equal. first-manifest-pin-failure.json records the exact expected/current values. No own-final-source-pin.json was written; no failed pin was refreshed and no second copied evidence cohort was created. The exact first-manifest report/verdict bytes are retained as explicit preimages before these exclusions were amended. Later report/verdict deltas and new receipt files are accounted for by final-source-assessment.json, whose FAILED own-seal status is separate from the operational PASS. Neither the old failed QA seal nor these complete raw observations certifies historical source continuity, private custody, functional/native Task03, Task04 qualification or the full backend goal.
'''
write(O/'report.md',report.encode(),True)
write(O/'final-operative-evidence-anchors.json',{'scope':'CURRENT_RAW_OPERATIONAL_CONTENT_ANCHORS_ONLY_NOT_OWN_QA_SEAL',
 'status':'PASS','files':[held(final_dir/n)[0] for n in ['commands.json','final-public-custody-comparison.json','final-dependency-comparison.json','final-host-source-comparison.json','final-source-after-docker.json']]
 +[held(O/'operational-r3'/n)[0] for n in ['commands.json','actual-cli-compiler-readiness.json','actual-public-source-preflight.json','actual-dependency-readiness.json','collected-public-transfer-receipt.json']],
 'failedEvidenceManifestExcluded':True,'ownSourcePinExists':False})
print(json.dumps({'operationalVerdict':'PASS','ownEvidenceSeal':'FAILED_PRESERVED','ownSourcePinExists':False,'finalOperation':final['operation'],'commands':len(final['commands'])}))
