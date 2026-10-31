from pathlib import Path
import json,hashlib
q=Path(__file__).resolve().parents[1];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();paths=[]
for p in sorted(q.glob('*')):
 if p.is_file() and p.name not in ['candidate-freeze-cycle2.json','receipt-manifest-cycle2.json'] and (p.suffix in ['.json','.stdout','.stderr'] or p.name.endswith('.md')):paths.append(p)
paths.extend(p for p in sorted((q/'repair-cycle2').rglob('*')) if p.is_file())
paths.extend(p for p in sorted((q/'tmp').glob('network*.json')) if p.is_file())
rows=[{'path':str(p.relative_to(q)),'sha256':sha(p),'bytes':p.stat().st_size} for p in paths]
(q/'receipt-manifest-cycle2.json').write_text(json.dumps({'state':'CYCLE2_REPAIR_PREPARATION_ONLY_AWAITING_FRESH_INDEPENDENT_REVIEW','firstFailedCandidate':'candidate-freeze.json','firstFailedCandidateSha256':'55021f56ef02023578d2965a6c0290aba84cdef74a4b8725dc236d82de9fc976','firstReceiptManifestPreserved':'receipt-manifest.json','newCandidate':'candidate-freeze-cycle2.json','candidateDigest':'Read final SHA256 independently; not recursively embedded.','sourceInventory':'source-inventory.json','report':'repair-cycle2/repair-report.md','actualSourceFaultInjections':28,'guardNegatives':38,'scopedLintFiles':5,'typingProjects':3,'officialCodegen':'NOT_RUN','liveQualification':'NOT_RUN','actualDeployments':0,'paidCalls':0,'files':rows},indent=2)+'\n');print(json.dumps({'cycle2ReceiptRows':len(rows),'actualServices':0}))
