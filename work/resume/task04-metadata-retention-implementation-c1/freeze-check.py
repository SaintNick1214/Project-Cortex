from pathlib import Path
import json,hashlib,gzip
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c1';w=r/'work/resume/task04-metadata-retention-implementation-c1'
h=lambda b:hashlib.sha256(b).hexdigest()
map=json.loads((q/'requirements-outcomes.json').read_text());assert h((q/'report.md').read_bytes())==map['reportSha256']
count=0
for row in map['rows']:
 receipt=json.loads((q/row['receipt']).read_text());assert receipt['exit']==row['observedExit']
 assert h((q/row['rawStdout']).read_bytes())==row['stdoutSha256']
 pre=json.loads((q/row['sourceBefore']).read_text())
 for name,pin in pre['files'].items():
  p=r/name
  # Operative executable source pins at final control time must still be exact.
  if str(p).startswith(str(q)) and p.suffix in (['.ts','.mts'] if row['receipt'].startswith('strict-types') else ['.ts','.mjs','.mts']) and p.is_file():
   assert h(p.read_bytes())==pin['sha256'],(row['receipt'],name)
   count+=1
cap=json.loads((q/'candidate-installation.json').read_text());mods=cap['exactSourceModules']
for name,pin in mods.items():assert h((q/'fixture/convex'/name).read_bytes())==pin,name
v=json.loads((q/'verification.json').read_text())
for name,pin in v['leaves'].items():assert h((q/'fixture/convex'/name).read_bytes())==pin,name
for base in [q,w]:
 for p in base.rglob('*'):
  assert not p.is_symlink(),p
  if p.is_file():assert p.stat().st_nlink==1,p
for p in (q/'source-byte-store').glob('*.gz'):assert h(gzip.decompress(p.read_bytes()))==p.stem
print(json.dumps({'scope':'final readonly control/source currentness, no actual qualification','pass':True,'operativeControlSourcePins':count,'reportSha256':map['reportSha256'],'actual':'EMPTY, null key, uninstalled','expectedOriginalFailuresPreserved':True}))
