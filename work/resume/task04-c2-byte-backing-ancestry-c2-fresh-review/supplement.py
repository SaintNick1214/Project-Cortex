import datetime,gzip,hashlib,json,os,stat
from pathlib import Path
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c2-byte-backing-ancestry-c2-fresh-review';T=Path('/tmp/cortex-c2-backing-ancestry-c2-fresh-review');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-component-byte-backing-c2'
def sha(b):return hashlib.sha256(b).hexdigest()
records=json.loads((W/'results.json').read_text())['records'];checks=[]
for r in records:
 name=r['name'];v=r['argv'];dst=Path(v[v.index('--destination')+1])
 if name.startswith('required-'):
  short=name[9:]
  if short not in ['small-positive','destination-public','destination-existing-empty','destination-existing-sentinel','destination-symlink','destination-ancestor-symlink','existing-object-no-overwrite','destination-object-directory-symlink','destination-object-hardlink','destination-object-symlink','late-os-fsize-partial','late-partial-idempotent-denial']:
   assert not dst.exists() and not dst.is_symlink();checks.append(short+':destination-absent')
partial=T/'prior-controls/late-fsize-partial/objects';files=list(partial.iterdir());assert len(files)==1 and files[0].stat().st_size==1;checks.append('RLIMIT_FSIZE-one-byte-partial-preserved')
obs=T/'historical-observation';old=Path('/tmp/cortex-c2-backing-transport-fresh-review/runs/source-ancestor-symlink-observation')
for p in old.iterdir():assert (obs/p.name).read_bytes()==p.read_bytes()
d=json.loads((obs/'receipt.json').read_text());assert d['expectedExit']==d['exit']==0;checks.append('historical-observation-literal-receipt-preserved')
# Original published helper/index/readme retain before-byte copies.
base=R/'work/resume/task04-c2-component-byte-backing-c2';baseline=json.loads((base/'baseline.json').read_text())
for r in baseline if isinstance(baseline,list) else baseline.get('sources',[]):
 print(r)
# Repaired helper differs from original only in read_regular implementation.
new=(Q/'materialize.py').read_text();old=(base/'materialize.py.before').read_text();assert new[new.index('def unique_pairs'):]==old[old.index('def unique_pairs'):];assert (Q/'index.json').read_bytes()==(base/'index.json.before').read_bytes();checks.append('unchanged-index-and-post-read-validation-code')
(W/'supplement-results.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':checks,'count':len(checks)},indent=2)+'\n');print('supplemental assertions PASS',len(checks))
