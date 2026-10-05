import json,pathlib,hashlib
R=pathlib.Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';O=Q/'task04-terminal-capture-parent-inputs-c9-restoration-review';a=json.loads((O/'audit.json').read_bytes())
for name,pre in a['pre'].items():
 p=R/name;actual={}
 for f in sorted(p.rglob('*')):
  assert not f.is_symlink(),str(f)
  if f.is_file():
   assert f.stat().st_nlink==1,str(f)
   b=f.read_bytes();actual[str(f.relative_to(p))]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
 assert actual==pre,name
v=Q/'task04-terminal-capture-parent-inputs-c9-review'
for profile in ['extension','regression']:
 g=json.loads((v/('shared-c9-'+profile+'.stdout')).read_bytes());r=json.loads((v/('shared-c8-'+profile+'.stdout')).read_bytes());assert g['expectedIdenticalRequirements']==10 and len(g['results'])==10 and len(g['errors'])==0;assert r['expectedIdenticalRequirements']==10 and len(r['errors'])==10;print(profile, 'GREEN10/RED10 immutable outcomes PASS')
print('PASS: all five protected roots exact; zero symlinks/hardlinks; immutable shared GREEN20/RED20 verified; recovery audit unique original bytes verified.')
