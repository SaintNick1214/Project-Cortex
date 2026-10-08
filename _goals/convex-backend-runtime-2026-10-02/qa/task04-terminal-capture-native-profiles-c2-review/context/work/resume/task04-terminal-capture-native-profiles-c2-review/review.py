import pathlib,hashlib,json,subprocess,os,datetime,shutil
R=pathlib.Path('/workspace/Project-Cortex'); W=R/'work/resume/task04-terminal-capture-native-profiles-c2-review'; Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-profiles-c2-review'; P=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-c2'
def h(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
def inventory():
 out=[]
 for base in [P,P/'regression']:
  m=json.loads((base/'qa-manifest.json').read_text()); problems=[]
  for row in m['files']:
   f=base/row['path']
   if f.stat().st_size!=row['bytes'] or h(f)!=row['sha256']:problems.append(row['path'])
  paths=sorted(str(x.relative_to(base)) for x in base.rglob('*') if x.is_file() and x!=base/'qa-manifest.json')
  out.append({'profile':str(base.relative_to(R)),'manifestSHA256':h(base/'qa-manifest.json'),'freezeSHA256':h(base/'runtime-freeze.json'),'reportSHA256':h(base/'report.md'),'rows':len(m['files']),'mismatches':problems,'setEqual':paths==[x['path'] for x in m['files']]})
 return out
write(Q/'frozen-pre.json',inventory())
mods=[]
for label,base in [('extension',P),('regression',P/'regression')]:
 dest=W/label;dest.mkdir(exist_ok=True)
 for name in ['scripts','fixture']:shutil.copytree(base/name,dest/name,dirs_exist_ok=True)
 for x in base.glob('*'):
  if x.is_file():shutil.copy2(x,dest/x.name)
 for f in (dest/'scripts').glob('*.mjs'):
  before=f.read_text();after=before.replace("repo=resolve(root,'../../../..')","repo='/workspace/Project-Cortex'").replace("repo=resolve(root,'../../../../..')","repo='/workspace/Project-Cortex'")
  after=after.replace('work/resume/task04-terminal-capture-native-extension-preparation-c2','work/resume/task04-terminal-capture-native-profiles-c2-review/generated')
  after=after.replace("resolve(repo,'work/backend-runtime/task04-terminal-capture-native-extension-c2')",f"resolve(repo,'work/resume/task04-terminal-capture-native-profiles-c2-review/{label}-synthetic')").replace("resolve(repo,'work/backend-runtime/task04-terminal-capture-native-regression-c2')",f"resolve(repo,'work/resume/task04-terminal-capture-native-profiles-c2-review/{label}-synthetic')")
  if after!=before:f.write_text(after);mods.append({'source':str((base/'scripts'/f.name).relative_to(R)),'clone':str(f.relative_to(R)),'before':hashlib.sha256(before.encode()).hexdigest(),'after':h(f)})
 (W/'generated/regression').mkdir(parents=True,exist_ok=True)
 freeze=json.loads((dest/'runtime-freeze.json').read_text())
 for row in freeze['files']:
  f=dest/row['path'];row['sha256']=h(f)
  if 'bytes' in row:row['bytes']=f.stat().st_size
 write(dest/'runtime-freeze.json',freeze)
write(Q/'clone-adaptations.json',mods)
ENV=dict(os.environ);ENV['PATH']=str(R/'work/resume/toolchain-bin')+':'+ENV['PATH']
def run(name,argv):
 d=Q/name;d.mkdir();pre=[]
 for folder in [W/'extension',W/'regression']:
  for x in sorted(folder.rglob('*')):
   if x.is_file():pre.append({'path':str(x.relative_to(R)),'sha256':h(x),'bytes':x.stat().st_size})
 write(d/'source-pre.json',pre)
 start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 r=subprocess.run(argv,cwd=R,env=ENV,capture_output=True,timeout=100)
 (d/'stdout.txt').write_bytes(r.stdout);(d/'stderr.txt').write_bytes(r.stderr)
 write(d/'command.json',{'argv':argv,'cwd':str(R),'startedAt':start,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'PATHPrefix':str(R/'work/resume/toolchain-bin'),'sourceBindings':[dict(row,sha256After=h(R/row['path'])) for row in pre]})
 print(name,r.returncode,r.stdout.decode()[-600:],r.stderr.decode()[-350:],flush=True)
 return r
if __name__=='__main__':
 run('node-version',['node','--version']);run('npm-version',['npm','--version'])
 run('extension-handlers',['node','--experimental-vm-modules','--test',str(W/'extension/scripts/offline-extension.mjs')])
 run('regression-handlers',['node','--experimental-vm-modules','--test',str(W/'regression/scripts/offline-actual-core.mjs')])
 for label in ['extension','regression']:run(label+'-types',['node','node_modules/typescript/bin/tsc','-p',str(W/label/'fixture/convex/tsconfig.json'),'--noEmit'])
 run('hostile-window-errors',['node','--experimental-vm-modules','--test',*[str(W/'extension/scripts'/f) for f in ['offline-window.mjs','offline-error-boundary.mjs','offline-diagnostics.mjs']]])
 write(Q/'frozen-post.json',inventory())
