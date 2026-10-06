from pathlib import Path
import json,hashlib
q=Path(__file__).resolve().parent;sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();rows=[]
for p in sorted(q.glob('*')):
 if p.is_file() and p.name not in ['candidate-freeze.json','receipt-manifest.json'] and (p.suffix in ['.json','.stdout','.stderr'] or p.name.endswith('.md')):rows.append({'path':p.name,'sha256':sha(p),'bytes':p.stat().st_size})
for p in sorted((q/'tmp').glob('network*.json')):rows.append({'path':str(p.relative_to(q)),'sha256':sha(p),'bytes':p.stat().st_size,'scope':'OFFLINE_NETWORK_PRELOADER_COUNTER'})
(q/'receipt-manifest.json').write_text(json.dumps({'state':'PREPARATION_RECEIPTS_ONLY_NO_ACTUAL_MANAGED_EXECUTION','root':'task03-local-current-delta-2026-10-05','currentSource':'source-inventory.json','candidate':'candidate-freeze.json','candidateDigest':'Read final SHA256 independently after final freeze; not embedded recursively.','officialCodegen':'NOT_RUN','liveQualification':'NOT_RUN','actualDeployments':0,'actualPaidCalls':0,'files':rows},indent=2)+'\n');print(json.dumps({'receiptRows':len(rows),'liveQualification':'NOT_RUN'}))
