from pathlib import Path
import os,json,hashlib,subprocess,datetime,sys
r=Path('/workspace/Project-Cortex');w=r/'work/resume/task04-native-error-boundary-repair-review-01';q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-error-boundary-repair-review';p=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-error-boundary-repair'
paths=list(json.loads((p/'manifest.json').read_text())['finalProductSources'])+['package.json','package-lock.json','jest.config.mjs','eslint.config.js','tsconfig.json']
sha=lambda x:hashlib.sha256(x.read_bytes()).hexdigest()
snapshot=lambda:{x:sha(r/x) for x in paths}
name=sys.argv[1];argv=sys.argv[2:];env=os.environ.copy();env['PATH']=str(r/'work/resume/toolchain-bin')+':'+env['PATH'];d=q/name;d.mkdir(exist_ok=False);rec={'argv':argv,'cwd':str(r),'startUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceConfigBefore':snapshot(),'checkInputsBefore':{x.name:sha(x) for x in w.iterdir() if x.is_file()}}
(d/'pre.json').write_text(json.dumps(rec,indent=2))
with (d/'stdout').open('w') as out,(d/'stderr').open('w') as err: ret=subprocess.run(argv,cwd=r,env=env,stdout=out,stderr=err)
rec.update(exitCode=ret.returncode,endUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceConfigAfter=snapshot());rec['unchanged']=rec['sourceConfigBefore']==rec['sourceConfigAfter'];(d/'result.json').write_text(json.dumps(rec,indent=2));print(name,ret.returncode,rec['unchanged']);sys.exit(ret.returncode)
