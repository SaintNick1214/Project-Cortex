from pathlib import Path
import datetime,hashlib,json,os,subprocess,time
r=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt3-2026-10-05';p=q.parent/'local-resume-2026-10-05'
image='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3';operation='d98bad88-5157-4816-b458-4160e7945361';volume='cortex-task03-attempt3-fixture-20261005-d98bad88'
helper=p/'task03-attempt3-linux-public-transfer.py';assert hashlib.sha256(helper.read_bytes()).hexdigest()=='c683d5d3bea7f26178c0e996aebe1aeedd989e4dd4cbd323d7b4cb0a52f7b168'
for f,scope in [(q/'independent-preparation-review.json','BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'),(p/'task03-attempt3-management-review.json','TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY')]:
 v=json.loads(f.read_bytes());assert v['verdict']=='PASS' and v['independent'] is True and v['scope']==scope and v['candidateSha256']=='2fb8d11a7e6c0bcaf92b2fe8d7ff228a6e554f9241c07c22079e6be8bcc870ef'
records=[]
def run(label,args,timeout=120):
 start=time.monotonic();at=datetime.datetime.now(datetime.timezone.utc).isoformat();a=subprocess.run(args,capture_output=True,timeout=timeout)
 assert len(a.stdout)<=262144 and len(a.stderr)<=262144
 for suffix,b in [('stdout',a.stdout),('stderr',a.stderr)]:
  path=p/('task03-attempt3-public-'+label+'.'+suffix)
  with path.open('xb') as f:f.write(b)
 records.append({'label':label,'argv':args,'startedAtUtc':at,'elapsedSeconds':time.monotonic()-start,'exitCode':a.returncode,'stdoutSha256':hashlib.sha256(a.stdout).hexdigest(),'stderrSha256':hashlib.sha256(a.stderr).hexdigest(),'publicOnly':True})
 path=p/'task03-attempt3-public-command-receipts.json';tmp=path.with_name(path.name+'.replacement');tmp.write_text(json.dumps({'operation':operation,'volume':volume,'image':image,'commands':records,'serviceCalls':0,'privateByteReads':False,'qualificationAccepted':False},indent=2)+'\n');os.replace(tmp,path)
 return a
probe=run('volume-absence',['docker','volume','inspect',volume]);assert probe.returncode==1 and b'no such volume' in probe.stderr.lower()
a=run('volume-create',['docker','volume','create','--label','cortex.goal=convex-backend-runtime-2026-10-02','--label','cortex.operation='+operation,volume]);assert a.returncode==0 and a.stdout.strip().decode()==volume
init="import os,json; from pathlib import Path; p=Path('/owned'); assert p.is_dir() and not p.is_symlink() and not list(p.iterdir()); os.chown(p,501,20); os.chmod(p,0o700); s=p.lstat(); assert s.st_uid==501 and s.st_gid==20 and (s.st_mode&0o777)==0o700; print(json.dumps({'status':'PASS','uid':s.st_uid,'gid':s.st_gid,'mode':'0700','sourceMounts':0}))"
base=['docker','run','--rm','--platform','linux/amd64','--network','none','--memory','512m','--memory-swap','512m','--cpus','2']
a=run('root-init',base+['--name','cortex-task03-attempt3-init-d98bad88','--label','cortex.operation='+operation,'--user','0:0','--mount','type=volume,source='+volume+',target=/owned,volume-nocopy',image,'/usr/local/bin/python3.12','-B','-c',init]);assert a.returncode==0
args=base+['--name','cortex-task03-attempt3-copy-d98bad88','--label','cortex.operation='+operation,'--user','501:20','--mount','type=bind,source='+str(q)+',target=/input,readonly','--mount','type=bind,source='+str(p)+',target=/helper,readonly','--mount','type=volume,source='+volume+',target=/owned,volume-nocopy',image,'/usr/local/bin/python3.12','-B','/helper/'+helper.name]
a=run('receiver',args);assert a.returncode==0
result=json.loads(a.stdout);assert result['files']==972 and result['sourceFreezeSha256']=='2fb8d11a7e6c0bcaf92b2fe8d7ff228a6e554f9241c07c22079e6be8bcc870ef' and result['actualServiceRequests']==0 and result['privateBytesCopied'] is False
print(json.dumps({'status':'PASS','scope':'ACTUAL_FINITE_PUBLIC_TRANSFER_ONLY','volume':volume,'files':result['files'],'bytes':result['bytes'],'privateBytesCopied':False,'nativeCases':0,'independentCustodyReview':'PENDING'}))
