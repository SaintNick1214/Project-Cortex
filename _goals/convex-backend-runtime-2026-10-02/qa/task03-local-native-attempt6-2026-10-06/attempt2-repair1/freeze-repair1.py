from pathlib import Path
import json,hashlib,re
q=Path(__file__).resolve().parents[1];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();old=q/'candidate-freeze-attempt2.json';assert sha(old)=='7d633bd5e2e6588b9650c6a8b717e4f9eaab9528b6e988ccd3d3746a6b65db7c';files=[]
for p in sorted(q.rglob('*')):
 if not p.is_file():continue
 rel=str(p.relative_to(q))
 if rel.startswith('tmp/') or rel in ['candidate-freeze-attempt2-repair1.json','independent-preparation-review.json'] or re.match(r'^managed-fixture/fixture/convex/_generated/(api\.d\.ts|api\.js|dataModel\.d\.ts|server\.d\.ts|server\.js)$',rel):continue
 assert not p.is_symlink() and p.stat().st_nlink==1
 files.append({'path':rel,'sha256':sha(p),'bytes':p.stat().st_size})
freeze=json.loads(old.read_text());freeze.update(preparationCycle='NATIVE_ATTEMPT2_REPAIR1_AFTER_INDEPENDENT_NEEDS_REVISION_3_2',currentReceiptManifest='receipt-manifest-attempt2-repair1.json',rejectedPreviousCandidate={'path':'candidate-freeze-attempt2.json','sha256':sha(old),'verdict':'NEEDS REVISION','average':3.2,'review':'attempt2-repair1/rejected-review/report.md'},managementApproval='REQUIRES_NEW_INDEPENDENT_REVIEW_FOR_CHANGED_GUARD_FREEZE_REFERENCES; old helper PASS cannot be carried',files=files)
(q/'candidate-freeze-attempt2-repair1.json').write_text(json.dumps(freeze,indent=2)+'\n');print(json.dumps({'state':'FROZEN_AWAITING_FRESH_INDEPENDENT_PREPARATION_REVIEW','candidateSha256':sha(q/'candidate-freeze-attempt2-repair1.json'),'files':len(files),'oldRejectedFreezeExact':sha(old)}))
