import pathlib,json,hashlib,subprocess,difflib
R=pathlib.Path('/workspace/Project-Cortex');C=R/'work/resume/registry/candidate';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03b2b1-resume-cycle4';H=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03b2b1/history'
verified=[]
for cycle in ['cycle1','cycle2-final','cycle3-final']:
 m=json.loads((H/cycle/'preservation-manifest.json').read_text());count=0
 for x in m['records']:
  p=R/x['file'];b=p.read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],str(p);count+=1
 verified.append({'cycle':cycle,'records':count,'manifestSha256':hashlib.sha256((H/cycle/'preservation-manifest.json').read_bytes()).hexdigest()})
f=json.loads((H/'cycle3-final/candidate/qa/source-freeze.json').read_text());unchanged=[];changed=[]
for p,x in f['sourceRecords'].items():
 b=(C/p).read_bytes();new={'path':p,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
 (unchanged if new['sha256']==x['sha256'] else changed).append(new)
assert [x['path'] for x in changed]==['convex-dev/runtimeRegistryAuth.ts']
# Exact old sources, including schema, tests and native artifacts, preserved; only helper differs.
newtest=C/'tests/unit/runtimeRegistryAuth/identityReadBoundary.test.ts'
(Q/'preservation-final.json').write_text(json.dumps({'historicalManifests':verified,'unchangedFrozenRecords':unchanged,'changedFrozenRecords':changed,'additiveTest':{'path':str(newtest.relative_to(C)),'sha256':hashlib.sha256(newtest.read_bytes()).hexdigest()},'historicalWrites':0},indent=2)+'\n')
old=(H/'cycle3-final/candidate/source/convex-dev/runtimeRegistryAuth.ts.text').read_text();new=(C/'convex-dev/runtimeRegistryAuth.ts').read_text();(Q/'identity-boundary.patch').write_text(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/convex-dev/runtimeRegistryAuth.ts',tofile='b/convex-dev/runtimeRegistryAuth.ts')))
# Schema delta relative to immutable candidate base; no schema product correction this cycle.
base=subprocess.check_output(['git','show',f['pinnedBase']+':convex-dev/schema.ts'],cwd=R,text=True);schema=(C/'convex-dev/schema.ts').read_text();patch=''.join(difflib.unified_diff(base.splitlines(True),schema.splitlines(True),fromfile='a/convex-dev/schema.ts',tofile='b/convex-dev/schema.ts'));(Q/'schema-integration.patch').write_text(patch)
assert sum(1 for x in patch.splitlines() if x.startswith('+') and not x.startswith('+++'))==13
assert sum(1 for x in patch.splitlines() if x.startswith('-') and not x.startswith('---'))==0
print('Historical complete manifests verified:',verified);print('49 frozen source records unchanged, only helper differs; schema13+/0-')
