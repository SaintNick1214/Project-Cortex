from pathlib import Path
import json,hashlib,subprocess,datetime,time,shutil
r=Path('/workspace/Project-Cortex');base=r/'work/resume/task04-terminal-capture-native-profiles-c3-review';out=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-profiles-c3-review';q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-c3';sha=lambda b:hashlib.sha256(b).hexdigest()
for name,argv in [('fresh-profile-controls',['node','--experimental-vm-modules',str(base/'profile-controls.mjs')]),('fresh-imported-output-counterexample',['node','--experimental-vm-modules',str(base/'late-output.mjs')]),('fresh-supplement-hostiles',['node',str(base/'hostiles.mjs')])]:
 d=out/name;d.mkdir();t=time.monotonic();stamp=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=r,text=True,capture_output=True);(d/'stdout.txt').write_text(p.stdout);(d/'stderr.txt').write_text(p.stderr);(d/'command.json').write_text(json.dumps({'argv':argv,'cwd':str(r),'UTC':stamp,'exitCode':p.returncode,'elapsedSeconds':time.monotonic()-t},indent=2)+'\n');assert p.returncode==0,(name,p.stderr)
for f in base.glob('*.mjs'):shutil.copyfile(f,out/f.name)
for f in base.glob('*.py'):shutil.copyfile(f,out/f.name)
checks=[]
for pp,label in [(q,'extension'),(q/'regression','regression')]:
 m=json.loads((pp/'qa-manifest.json').read_text());actual=sorted(str(f.relative_to(pp)) for f in pp.rglob('*') if f.is_file() and f!=pp/'qa-manifest.json');assert actual==[x['path'] for x in m['files']];
 for row in m['files']:
  f=pp/row['path'];b=f.read_bytes();assert f.stat().st_nlink==1 and not f.is_symlink();assert len(b)==row['bytes'] and sha(b)==row['sha256']
 checks.append({'profile':label,'rows':len(m['files']),'manifestSHA256':sha((pp/'qa-manifest.json').read_bytes()),'freezeSHA256':sha((pp/'runtime-freeze.json').read_bytes()),'mismatches':0})
original=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c8/scripts/cases.mjs'
for file in [q/'scripts/original-b-cases.mjs',q/'regression/scripts/cases.mjs']:assert file.read_bytes()==original.read_bytes()
for pp in [q,q/'regression']:
 for file in ['cases.mjs','driver.mjs','ownership.mjs','peer.mjs','cleanup.mjs','fault-driver.mjs','fault-recovery.mjs','publication-contract.mjs','arguments.mjs','window-evidence.mjs']:
  old=q.parent/'task04-terminal-capture-native-extension-preparation-c2';old=old/'regression' if pp.name=='regression' else old;assert (pp/'scripts'/file).read_bytes()==(old/'scripts'/file).read_bytes(),file
checks.append({'unchangedC2BranchSources':['cases','driver','ownership','peer','cleanup','fault-driver','fault-recovery','publication-contract','arguments','window-evidence'],'original43ByteExactSHA256':sha(original.read_bytes())})
(out/'integrity-after-and-inheritance.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps(checks,indent=2))
