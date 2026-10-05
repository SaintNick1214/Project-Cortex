from pathlib import Path
import json,hashlib,gzip,uuid,datetime,subprocess,importlib.util,sys
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c1';H=lambda b:hashlib.sha256(b).hexdigest();a=W/'runs'/uuid.uuid4().hex;a.mkdir(parents=True);store=a/'source-pre-gzip';store.mkdir();pre=[]
files=set(W.glob('*.py'))|set(W.glob('*.mjs'))
q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-extra-preparation-c5'
for name,key in [('runner-dependency-inventory.json','inputs'),('toolchain-evidence.json','files')]:
 for row in json.loads((q/name).read_text())[key]:
  p=R/row['path']
  if p.is_file():files.add(p)
for p in sorted(files):
 b=p.read_bytes();h=H(b);out=store/(h+'.gz')
 if not out.exists():out.write_bytes(gzip.compress(b,mtime=0))
 encoded=out.read_bytes();assert gzip.decompress(encoded)==b;pre.append({'path':str(p),'bytes':len(b),'sha256':h,'beforeByteBacking':str(out),'encodedSHA256':H(encoded),'beforeChildExactDecompression':True})
(a/'source-pre.json').write_text(json.dumps(pre,indent=2)+'\n');spec=importlib.util.spec_from_file_location('capture',W/'capture-originals.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
runtime=Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node');files.add(runtime);rawargv=[str(runtime),'--experimental-vm-modules',str(W/'controls.mjs')];receipt={'bootstrapHistoricalGap':'Earlier six C5 incident receipts omitted C4 scratch; no continuity claim','actualArgv':rawargv,'cwd':str(R),'recordedBeforeChildUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourcePRE':str(a/'source-pre.json')};primary=None
try:
 receipt['nodeRuntimePRE']={'path':str(runtime),'bytes':runtime.stat().st_size,'sha256':H(runtime.read_bytes())};receipt['original8PRE']=module.capture('synthetic-batch-before');tmp=W/'owned-tmp';tmp.mkdir(exist_ok=True,mode=0o700);childenv={'PATH':str(runtime.parent)+':/usr/bin:/bin','TMPDIR':str(tmp)};receipt['childEnvironment']={'PATH':'fixed reviewed Node directory plus /usr/bin:/bin','TMPDIR':str(tmp),'allOtherKeys':'OMITTED_NO_INHERITED_ENV'};receipt['childStartUTC']=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(rawargv,cwd=R,env=childenv,capture_output=True,timeout=120);receipt['exitCode']=p.returncode;receipt['childEndUTC']=datetime.datetime.now(datetime.timezone.utc).isoformat();(a/'stdout').write_bytes(p.stdout);(a/'stderr').write_bytes(p.stderr)
except BaseException as error:primary=error;receipt['primaryType']=type(error).__name__;receipt['primary']=str(error);receipt.setdefault('exitCode',1)
finally:
 try:receipt['original8POST']=module.capture('synthetic-batch-after')
 except BaseException as error:receipt['secondaryType']=type(error).__name__;receipt['secondary']=str(error);receipt['exitCode']=1
 receipt['sourcePOST']=[{'path':str(p),'bytes':p.stat().st_size,'sha256':H(p.read_bytes())}for p in sorted(files)];receipt['finishedUTC']=datetime.datetime.now(datetime.timezone.utc).isoformat();(a/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'run':str(a),'exitCode':receipt['exitCode'],'primary':receipt.get('primary'),'secondary':receipt.get('secondary')}))
sys.exit(receipt['exitCode'])
