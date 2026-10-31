from pathlib import Path
import json,hashlib,re
q=Path(__file__).resolve().parents[1];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();files=[]
for p in sorted(q.rglob('*')):
 if not p.is_file():continue
 rel=str(p.relative_to(q))
 if rel.startswith('tmp/') or rel in ['candidate-freeze-attempt2.json','independent-preparation-review.json'] or re.match(r'^managed-fixture/fixture/convex/_generated/(api\.d\.ts|api\.js|dataModel\.d\.ts|server\.d\.ts|server\.js)$',rel):continue
 assert not p.is_symlink() and p.stat().st_nlink==1
 files.append({'path':rel,'sha256':sha(p),'bytes':p.stat().st_size})
accepted=json.loads((q/'candidate-freeze-cycle2.json').read_text());request=json.loads((q/'project-request.json').read_text())
freeze={k:v for k,v in accepted.items() if k!='files'}
freeze.update(state='FROZEN_AWAITING_INDEPENDENT_PREPARATION_REVIEW',nativeAttempt=2,operation=request['operation'],currentReceiptManifest='receipt-manifest-attempt2.json',acceptedPreparationAncestry={'namespace':'task03-local-current-delta-2026-10-05','freezeSha256':'2fa7ddfd9898216a84ac5079edd0661604b709d09384d847ced94e6c725e4c55','entries':559,'custody':'New copied filesystem identities; original accepted namespace and first failed native volume untouched'},preparationCycle='NEW_NATIVE_ATTEMPT2_AFTER_RETIRED_FAILED_CLI_ATTEMPT1',compilerProjection={'file':'attempt2/compiler-projection.json','files':114,'version':'6.0.3','installations':0,'wrappers':0,'links':0},requiredRuntimeMemoryBytes=2147483648,requiredLinuxHome={'path':'/tmp','uid':501,'gid':20,'mode':'0700','scope':'Owned disposable container tmpfs only; host HOME unchanged'},newLocalVerification='PASS_CREDENTIAL_FREE_NATIVE_LINUX_CLI_COMPILER_READINESS',officialCodegen='NOT_RUN',liveQualification='NOT_RUN',actualExternalRequests=0,actualDeployments=0,files=files)
(q/'candidate-freeze-attempt2.json').write_text(json.dumps(freeze,indent=2)+'\n');print(json.dumps({'status':'FROZEN_FOR_REVIEW_ONLY','sha256':sha(q/'candidate-freeze-attempt2.json'),'files':len(files),'liveEffects':0}))
