from pathlib import Path
import json,os,stat,hashlib
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6';T=Path('/dev/shm/cortex-native-c6-closed-launcher-c6');M=T/'mirror';H=lambda b:hashlib.sha256(b).hexdigest()
packages=['@esbuild/linux-x64','@types/node','convex','esbuild','semver','typescript','zod'];graph=json.loads((T/'package-graph.json').read_bytes());assert graph['packages']==packages
identity=lambda s:{k:getattr(s,'st_'+k)for k in ['dev','ino','mode','uid','nlink','size','mtime_ns','ctime_ns']}
aliasRoot=M/'node_modules';aliasRoot.mkdir(mode=0o700);rows=[];directories=[]
for scope in ['@esbuild','@types']:(aliasRoot/scope).mkdir(mode=0o700)
for p in [aliasRoot,aliasRoot/'@esbuild',aliasRoot/'@types']:directories.append({'path':str(p),'identity':identity(p.lstat())})
for package in packages:
 target=R/'node_modules'/package;assert target.resolve()==target and stat.S_ISDIR(target.lstat().st_mode)
 expected=sorted(r['path']for r in graph['files']if r['path'].startswith(str(target)+'/'));actual=[]
 for base,dirs,files in os.walk(target,followlinks=False):
  for n in dirs:assert stat.S_ISDIR((Path(base)/n).lstat().st_mode)
  for n in files:
   p=Path(base)/n;s=p.lstat();assert stat.S_ISREG(s.st_mode)and s.st_nlink==1;actual.append(str(p))
 assert sorted(actual)==expected and expected
 link=aliasRoot/package;link.symlink_to(target,target_is_directory=True);s=link.lstat();assert stat.S_ISLNK(s.st_mode)and s.st_nlink==1 and os.readlink(link)==str(target)
 rows.append({'package':package,'path':str(link),'target':str(target),'literalTargetBytes':len(str(target).encode()),'literalTargetSHA256':H(str(target).encode()),'identity':identity(s),'capturedPackageRows':len(expected)})
manifest={'kind':'OPERATIVE_OWN_FIXED_SEVEN_PACKAGE_RESOLVER_LINKS_NOT_HISTORICAL_TRANSPORT','packageGraphSHA256':H((T/'package-graph.json').read_bytes()),'directories':directories,'links':rows,'wholeNodeModulesAlias':False,'NODE_PATH':'ABSENT','buildOptions':'UNCHANGED','sourceTiers':'ORIGINAL_FULL_RPC_UNCHANGED'}
p=T/'package-aliases.json';p.write_text(json.dumps(manifest,indent=2)+'\n');p.chmod(0o600)
pin=W/'prepared-source-inputs.json';before=pin.read_bytes();x=json.loads(before);assert not any(r['path']==str(p)for r in x['files']);x['files'].append({'path':str(p),'bytes':p.stat().st_size,'sha256':H(p.read_bytes())});pin.write_text(json.dumps(x,indent=2)+'\n');print(json.dumps({'status':'SETUP_ONLY','packages':len(rows),'sourceRows':sum(r['capturedPackageRows']for r in rows),'preparedInputDeclaredGeneratedDelta':{'path':str(pin),'beforeSHA256':H(before),'afterSHA256':H(pin.read_bytes())},'original122':'HELD'}))
