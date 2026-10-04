from pathlib import Path
import json,subprocess,time,datetime,hashlib,shutil
r=Path('/workspace/Project-Cortex');base=r/'work/resume/task04-terminal-capture-native-profiles-c3-review';out=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-profiles-c3-review';q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-c3';sha=lambda b:hashlib.sha256(b).hexdigest();ad=[]
for source,label,entry in [(q,'extension','offline-extension.mjs'),(q/'regression','regression','offline-check.mjs')]:
 clone=base/label;clone.mkdir(exist_ok=True)
 for name in ['scripts','fixture']:shutil.copytree(source/name,clone/name,dirs_exist_ok=True)
 for f in source.iterdir():
  if f.is_file():shutil.copyfile(f,clone/f.name)
 for f in (clone/'scripts').glob('*.mjs'):
  original=f.read_text();s=original.replace('work/resume/task04-terminal-capture-native-extension-preparation-c3', 'work/resume/task04-terminal-capture-native-profiles-c3-review').replace("repo=resolve(root,'../../../..')", "repo='/workspace/Project-Cortex'").replace("repo=resolve(root,'../../../../..')", "repo='/workspace/Project-Cortex'")
  if f.name=='guard.mjs':s=s.replace("export const scratch=resolve(repo,'work/backend-runtime/task04-terminal-capture-native-extension-c3');", "export const scratch=resolve(repo,'work/resume/task04-terminal-capture-native-profiles-c3-review/scratch-extension');").replace("export const scratch=resolve(repo,'work/backend-runtime/task04-terminal-capture-regression-c3');", "export const scratch=resolve(repo,'work/resume/task04-terminal-capture-native-profiles-c3-review/scratch-regression');")
  if s!=original:f.write_text(s);ad.append({'path':str(f.relative_to(r)),'originalSHA256':sha(original.encode()),'adaptedSHA256':sha(s.encode()),'reason':'Reviewer-only repo/work/scratch relocation; cases/assertions/product bytes unchanged.'})
 name=label+'-offline-handlers';d=out/name;d.mkdir();argv=['node','--experimental-vm-modules','--test',str(clone/'scripts'/entry)];start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic();p=subprocess.run(argv,cwd=r,text=True,capture_output=True);(d/'stdout.txt').write_text(p.stdout);(d/'stderr.txt').write_text(p.stderr);(d/'command.json').write_text(json.dumps({'argv':argv,'cwd':str(r),'UTC':start,'exitCode':p.returncode,'elapsedSeconds':time.monotonic()-t},indent=2)+'\n');print(label,p.returncode,p.stdout[-700:]);
 if p.returncode:break
(out/'clone-adaptations.json').write_text(json.dumps(ad,indent=2)+'\n')
