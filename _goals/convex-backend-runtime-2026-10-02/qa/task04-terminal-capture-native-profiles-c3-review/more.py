from pathlib import Path
import subprocess,json,datetime,time,shutil
r=Path('/workspace/Project-Cortex');base=r/'work/resume/task04-terminal-capture-native-profiles-c3-review';out=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-profiles-c3-review'
def run(name,argv):
 d=out/name;d.mkdir();t=time.monotonic();stamp=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=r,capture_output=True,text=True);(d/'stdout.txt').write_text(p.stdout);(d/'stderr.txt').write_text(p.stderr);(d/'command.json').write_text(json.dumps({'argv':argv,'cwd':str(r),'UTC':stamp,'exitCode':p.returncode,'elapsedSeconds':time.monotonic()-t},indent=2)+'\n');print(name,p.returncode,p.stdout[-500:]);return p
assert run('regression-43-offline-handlers',['node','--experimental-vm-modules','--test',str(base/'regression/scripts/offline-actual-core.mjs')]).returncode==0
for label in ['extension','regression']:
 assert run(label+'-strict-types',['node',str(r/'node_modules/typescript/bin/tsc'),'--noEmit','-p',str(base/label/'fixture/convex/tsconfig.json')]).returncode==0
run('supplement-hostiles',['node',str(base/'hostiles.mjs')])
run('toolchain',['bash','-c','node --version; PATH=/workspace/Project-Cortex/work/resume/toolchain-bin:$PATH npm --version'])
