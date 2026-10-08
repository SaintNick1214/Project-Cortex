from pathlib import Path
import json,hashlib
r=Path('/workspace/Project-Cortex')
items=[('_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-design-c2-fresh-review','qa-seal.json',107,'3226be097d923c1bffdf2963ee3835d5a59a40d2efc2fbd3111efeb18a675fa8'),('work/resume/task04-metadata-retention-design-c2-fresh-review','scratch-seal.json',4,'e054de6497e753760b1f557d848b42db3594722a93574f0125db99a210c52dcd'),('_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-design-c2','qa-seal.json',101,'55e6095e3d1fc96d2f29621e56248291b992ee92d2819ab53ce8526daeda6761'),('work/resume/task04-metadata-retention-design-c2','scratch-seal.json',6,'356faab562a02d096c477c91069d030b1e9bcd396dabbe76f3cce17ed1ca4b29')]
for rel,name,n,want in items:
 root=r/rel;p=root/name;assert hashlib.sha256(p.read_bytes()).hexdigest()==want;x=json.loads(p.read_text());assert x['excludedExactSelf']==name and x['root']==str(root);listed=set()
 for row in x['files']:
  f=root/row['path'];assert not f.is_symlink();b=f.read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'];assert row['path'] not in listed;listed.add(row['path'])
 assert len(listed)==len(x['files'])==x['fileCount']==n;assert listed=={str(f.relative_to(root)) for f in root.rglob('*') if f.is_file() and f!=p};print('PASS exact-self recursive byte closure',rel,n,want)
print('No shared-tree metadata preservation certified')
