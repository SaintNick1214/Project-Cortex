from pathlib import Path
import json,hashlib,os
r=Path.cwd();w=r/'work/resume/task04-model-drift-native-parent-preparation-c2-review';q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-parent-preparation-c2-review';H=lambda b:hashlib.sha256(b).hexdigest()
def manifest(root,negativeFixtures=False):
 rows=[]
 for p in sorted(root.rglob('*'),key=lambda p:p.relative_to(root).as_posix()):
  if p==root/'qa-manifest.json':continue
  if p.is_symlink():
   assert negativeFixtures,str(p)
   target=os.readlink(p);assert str(w) in target and 'case-' in target;body=os.fsencode(target);rows.append({'path':p.relative_to(root).as_posix(),'bytes':len(body),'sha256':H(body),'kind':'owned-negative-fixture-symlink','linkTarget':target})
  elif p.is_file():
   b=p.read_bytes();rows.append({'path':p.relative_to(root).as_posix(),'bytes':len(b),'sha256':H(b)})
 return {'files':rows}
(w/'qa-manifest.json').write_text(json.dumps(manifest(w,True),indent=2)+'\n')
rows=manifest(w,True)['files'];b=(w/'qa-manifest.json').read_bytes();(q/'scratch-complete-closure.json').write_text(json.dumps({'path':str(w.relative_to(r)),'rootManifestSHA256':H(b),'rootManifestBytes':len(b),'files':rows,'excludedOnlyOwnRootSelf':True,'allNestedIncluded':True,'negativeFixtureSymlinks':'Every deliberate symbolic-link denial fixture included by exact link-target bytes/hash; not dereferenced, removed or excluded. All real subject/historical manifests remain regular files only.'},indent=2)+'\n')
(q/'qa-manifest.json').write_text(json.dumps(manifest(q),indent=2)+'\n')
for root in [w,q]:
 data=json.loads((root/'qa-manifest.json').read_bytes());assert data==manifest(root,root==w)
 print(json.dumps({'path':str(root.relative_to(r)),'files':len(data['files']),'manifestSHA256':H((root/'qa-manifest.json').read_bytes()),'exactRecursiveBytesVerified':True}))
print(json.dumps({'reportSHA256':H((q/'report.md').read_bytes()),'verdictSHA256':H((q/'verdict.json').read_bytes())}))
