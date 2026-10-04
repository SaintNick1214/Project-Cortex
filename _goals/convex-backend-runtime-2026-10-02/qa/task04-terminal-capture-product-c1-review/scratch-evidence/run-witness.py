from pathlib import Path
import subprocess,json,hashlib,datetime,os,shutil
r=Path('/workspace/Project-Cortex'); q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-product-c1-review'; w=r/'work/resume/task04-terminal-capture-product-c1-review'
env=os.environ.copy(); env['PATH']=str(r/'work/resume/toolchain-bin')+':'+env['PATH']
files=json.loads((q/'binding-files.json').read_text())
def snapshot(name):
 d=q/name; d.mkdir(exist_ok=True); rows=[]
 for f in files:
  b=(r/f).read_bytes(); (d/f.replace('/','--')).write_bytes(b); rows.append({'path':f,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 return rows
commands=[('hostile-witness',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(w/'jest.config.mjs'),'--runInBand','--runTestsByPath',str(w/'hostile.test.ts'),'--json','--outputFile',str(q/'hostile-witness.results.json')])]
for name,argv in commands:
 pre=snapshot(name+'-pre'); start=datetime.datetime.now(datetime.timezone.utc).isoformat(); p=subprocess.run(argv,cwd=r,env=env,capture_output=True); end=datetime.datetime.now(datetime.timezone.utc).isoformat(); post=snapshot(name+'-post')
 (q/(name+'.stdout')).write_bytes(p.stdout); (q/(name+'.stderr')).write_bytes(p.stderr)
 (q/(name+'.command.json')).write_text(json.dumps({'argv':argv,'cwd':str(r),'startUTC':start,'endUTC':end,'exitCode':p.returncode,'pre':pre,'post':post,'unchanged':pre==post},indent=2)); print(name,p.returncode,flush=True)
