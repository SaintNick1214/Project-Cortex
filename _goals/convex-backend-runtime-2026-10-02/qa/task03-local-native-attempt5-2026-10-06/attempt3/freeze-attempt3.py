from pathlib import Path
import json,hashlib,re
q=Path(__file__).resolve().parents[1];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();old=q/'candidate-freeze-attempt2-repair1.json';assert sha(old)=='cd5e0c71e1839f079906becb9c5e0a90aba2261890ec4fb7997bc2981db966f5';f=json.loads(old.read_text());files=[]
for p in sorted(q.rglob('*')):
 if not p.is_file():continue
 rel=str(p.relative_to(q))
 if rel.startswith('tmp/') or rel in ['candidate-freeze-attempt3.json','independent-preparation-review.json'] or re.match(r'^managed-fixture/fixture/convex/_generated/(api\.d\.ts|api\.js|dataModel\.d\.ts|server\.d\.ts|server\.js)$',rel):continue
 assert not p.is_symlink() and p.stat().st_nlink==1;files.append({'path':rel,'sha256':sha(p),'bytes':p.stat().st_size})
request=json.loads((q/'project-request.json').read_text());f.update(preparationCycle='NEW_NATIVE_ATTEMPT3_AFTER_RETIRED_ATTEMPT2_PRIVATE_TRANSFER_FAILURE',nativeAttempt=3,operation=request['operation'],currentReceiptManifest='receipt-manifest-attempt3.json',previousAttempt={'namespace':'task03-local-native-attempt2-2026-10-05','acceptedBoundedPreparationFreezeSha256':sha(old),'operation':'511363b3-8cec-4e98-95d8-ecd4865457a8','targetRetired':'3156031/joyous-ostrich-974 POST200 GET404 2026-10-06T06:03:55.998Z','actualCLI':0,'nativeCases':0,'privateTransfer':'FAIL before copy; original private and volume untouched'},managementApproval='REQUIRES_FRESH_INDEPENDENT_ATTEMPT3_MANAGEMENT_REVIEW',privateTransport='Prospective selected-child stage/receiver helpers; actual public-dummy host5/Linux14 controls and13 negative destination postchecks, no real credential transport',files=files)
(q/'candidate-freeze-attempt3.json').write_text(json.dumps(f,indent=2)+'\n');print(json.dumps({'candidateSha256':sha(q/'candidate-freeze-attempt3.json'),'files':len(files)}))
