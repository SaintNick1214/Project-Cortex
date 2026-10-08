from pathlib import Path
import json,hashlib,gzip
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c2';w=r/'work/resume/task04-metadata-retention-implementation-c2'
h=lambda b:hashlib.sha256(b).hexdigest()
map=json.loads((q/'requirements-outcomes.json').read_text());assert h((q/'report.md').read_bytes())==map['reportSha256']
v=json.loads((q/'verification.json').read_text());cap=json.loads((q/'candidate-installation.json').read_text())
for n,pin in cap['exactSourceModules'].items():assert h((q/'fixture/convex'/n).read_bytes())==pin
for n,pin in v['leafPins'].items():assert h((q/'fixture/convex'/n).read_bytes())==pin
for row in map['rows']:
 receipt=json.loads((q/row['receipt']).read_text());assert receipt['exit']==row['exit'];assert h((q/row['rawStdout']).read_bytes())==row['stdoutSha256']
for tag,pin in v['finalControls'].items():
 assert h((q/(tag+'.stdout')).read_bytes())==pin['stdoutSha256']
 assert h((q/(tag+'.stderr')).read_bytes())==pin['stderrSha256']
for base in [q,w]:
 for p in base.rglob('*'):
  assert not p.is_symlink()
  if p.is_file():assert p.stat().st_nlink==1
for p in (q/'source-byte-store').glob('*.gz'):assert h(gzip.decompress(p.read_bytes()))==p.stem
print(json.dumps({'pass':True,'reportSha256':map['reportSha256'],'reviewCandidateOnly':True,'metadata16':'14PASS2FAIL preserved','original40':'37PASS3FAIL preserved','actualMoney':'EMPTY','native':'NOT_RUN'}))
