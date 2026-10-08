import pathlib,json,hashlib,subprocess,difflib
R=pathlib.Path('/workspace/Project-Cortex'); C=R/'work/resume/registry/candidate'; E=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03b2b1-resume-cycle4'; Q=E.with_name(E.name+'-review'); H=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03b2b1/history'
sha=lambda b:hashlib.sha256(b).hexdigest()
out={}
f=json.loads((E/'source-freeze.json').read_text());out['freeze']=[]
for x in f['records']:
 b=(C/x['path']).read_bytes();assert sha(b)==x['sha256'] and len(b)==x['bytes'];out['freeze'].append(x)
out['histories']=[]
for cycle in ['cycle1','cycle2-final','cycle3-final']:
 p=H/cycle/'preservation-manifest.json';m=json.loads(p.read_text())
 for x in m['records']:
  b=(R/x['file']).read_bytes();assert sha(b)==x['sha256'] and len(b)==x['bytes']
 out['histories'].append({'cycle':cycle,'count':len(m['records']),'manifestSha':sha(p.read_bytes())})
old=json.loads((H/'cycle3-final/candidate/qa/source-freeze.json').read_text());changes=[]
for p,x in old['sourceRecords'].items():
 if sha((C/p).read_bytes())!=x['sha256']:changes.append(p)
assert changes==['convex-dev/runtimeRegistryAuth.ts'];out['changedOriginal50']=changes
oldhelper=(H/'cycle3-final/candidate/source/convex-dev/runtimeRegistryAuth.ts.text').read_text();newhelper=(C/'convex-dev/runtimeRegistryAuth.ts').read_text()
expected=oldhelper.replace('await ctx.auth.getUserIdentity(), requirement','await controlRead(async () => await ctx.auth.getUserIdentity()), requirement');assert newhelper==expected
out['exactIdentityPatch']=True
out['acceptedMainDependencies']=[]
for p in ['convex-dev/runtimeAuth.ts','src/auth/verified.ts','tests/unit/runtimeAuth/provisioning.test.ts']:
 a=(C/p).read_bytes();b=(R/p).read_bytes();assert a==b,p;out['acceptedMainDependencies'].append({'path':p,'sha256':sha(a),'byteEqual':True})
base=subprocess.check_output(['git','show',old['pinnedBase']+':convex-dev/schema.ts'],cwd=R,text=True);patch=''.join(difflib.unified_diff(base.splitlines(True),(C/'convex-dev/schema.ts').read_text().splitlines(True),fromfile='a/convex-dev/schema.ts',tofile='b/convex-dev/schema.ts'))
assert patch==(E/'schema-integration.patch').read_text();assert sum(x.startswith('+') and not x.startswith('+++') for x in patch.splitlines())==13;assert not any(x.startswith('-') and not x.startswith('---') for x in patch.splitlines());out['schema']={'added':13,'deleted':0,'sha256':sha(patch.encode())}
(Q/'integrity.json').write_text(json.dumps(out,indent=2));print('Verified51 freeze records, historical450/970/890, exact identity-only delta, accepted-main authority dependencies, schema13+/0-')
