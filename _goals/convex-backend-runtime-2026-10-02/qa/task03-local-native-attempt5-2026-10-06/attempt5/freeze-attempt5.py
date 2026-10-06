"""Finite public preparation freeze; coordinator sources independently bind this freeze."""
from pathlib import Path
import hashlib,json,re
Q=Path(__file__).resolve().parents[1]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
old=Q/'attempt5/ancestry/candidate-freeze-attempt4.json'
assert sha(old)=='1030329b0f57cfb98de6135c4b8de7031d11a5c856fe56fa2d1d57d05d144799'
prior=json.loads(old.read_bytes())
files=[]
for p in sorted(Q.rglob('*')):
 if not p.is_file():continue
 rel=str(p.relative_to(Q))
 if rel.startswith(('tmp/','coordinate-source/')) or rel in ['candidate-freeze-attempt5.json','independent-preparation-review.json'] or re.fullmatch(r'managed-fixture/fixture/convex/_generated/(api\.d\.ts|api\.js|dataModel\.d\.ts|server\.d\.ts|server\.js)',rel):continue
 assert not p.is_symlink() and p.stat().st_nlink==1
 files.append({'path':rel,'sha256':sha(p),'bytes':p.stat().st_size})
request=json.loads((Q/'project-request.json').read_bytes())
prior.update(preparationCycle='NEW_ATTEMPT5_STRICT_VERSION_REPAIR_ONLY_NO_SELF_ACCEPTANCE',nativeAttempt=5,operation=request['operation'],currentReceiptManifest='receipt-manifest-attempt5.json',
 previousAttempt4={'freezeSha256':sha(old),'members':1338,'manifestSha256':sha(Q/'attempt5/ancestry/receipt-manifest-attempt4.json'),'preparation':'REJECT_3.2_VERSION_TRUE_ACCEPTED','publicCommon':'REJECT_2.8_SAME_GROUP_DESCENDANTS','managementSource':'PASS_4.4_ONLY_NOT_RELEASE','actualProvisioning':0},
 coordinatorBundle='EXPLICIT_SEPARATE_COORDINATE_SOURCE_BUNDLE_BINDS_FINAL_FREEZE_NO_RECURSIVE_SELF_HASH',
 managementApproval='REQUIRES_FRESH_INDEPENDENT_ATTEMPT5_MANAGEMENT_REVIEW_PARENT_OWNS_HELPER',
 privateTransport='IMMUTABLE_ecb1eff9_NATIVE_ACQUISITION_EXACT_INTEGER_VERSION_ONE; HOST_AND_LINUX_PUBLIC_DUMMY_CONTROL_SCOPES_ONLY',
 newLocalVerification={'hostAcquisitionControls':46,'conservedSourceControls':47,'actualFilesystemControls':3,'cleanupDriverControls':28,'guardNegatives':41,'application1005':'EXACT_PRIOR_PINS_NOT_RERUN','LinuxCurrentControls':'SEE_ATTEMPT5_RECEIPTS_NEVER_INFER_FROM_ATTEMPT4'},files=files)
(Q/'candidate-freeze-attempt5.json').write_text(json.dumps(prior,indent=2)+'\n')
print(json.dumps({'candidateSha256':sha(Q/'candidate-freeze-attempt5.json'),'files':len(files),'memberBytes':sum(r['bytes'] for r in files)}))
