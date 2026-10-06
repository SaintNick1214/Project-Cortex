from pathlib import Path
import importlib.util, sys, json, os, hashlib, subprocess, datetime, shutil
sys.dont_write_bytecode=True
q=Path(__file__).resolve().parents[1];p=q/'transport-prep';tmp=q/'tmp/transport';tmp.mkdir(mode=0o700)
spec=importlib.util.spec_from_file_location('transport',p/'private-transport.py');t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
request=json.loads((q/'project-request.json').read_text());binding={'operation':request['operation'],'requestSha256':hashlib.sha256(json.dumps(request,separators=(',',':')).encode()).hexdigest(),'projectSlug':request['projectSlug'],'projectName':request['projectName'],'teamId':325340,'privateEnvironmentFile':request['privateEnvironmentFile'],'forbiddenRetiredDeployments':['efficient-ox-979','fiery-setter-784','admired-walrus-730','quaint-jellyfish-819','joyous-ostrich-974']};(p/'transport-binding.json').write_text(json.dumps(binding,indent=2)+'\n')
source=tmp/'dummy-input';source.mkdir(mode=0o700);target={**{k:v for k,v in binding.items() if k!='forbiddenRetiredDeployments'},'kind':'cloud','deploymentType':'dev','active':True,'retired':False,'deleted':False,'isolationVerified':True,'freshManagedProject':True,'productionDeployment':False,'sharedCiTarget':False,'deploymentName':'dummy-transport-only-123'}
data={'jwt-private.pem':b'DUMMY_PUBLIC_BYTES_NOT_A_PRIVATE_KEY\n','target.json':(json.dumps(target)+'\n').encode(),'deploy.env':b'CONVEX_DEPLOY_KEY=DUMMY_PUBLIC_NONCREDENTIAL\nCONVEX_DEPLOYMENT=dev:dummy-transport-only-123\nCONVEX_URL=https://dummy-transport-only-123.invalid\n'}
for name,b in data.items():
 fd=os.open(source/name,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.write(fd,b);os.fsync(fd);os.close(fd)
export=tmp/'host-export-parent';export.mkdir(mode=0o700);child=export/'selected';child.mkdir(mode=0o700)
rows=[];commands=[]
def fds():return len(list(Path('/dev/fd').iterdir()))
before=fds();receipt=t.copy_private(source,child,binding,stage=True);assert fds()==before;rows.append({'name':'actual-host-held-source-stage','status':'PASS','privateFiles':3,'heldDescriptorsClosed':True,'actualCredentialReads':0})
for name in ['host-source-directory-mode','host-source-file-mode','host-source-hardlink','host-source-symlink']:
 root=tmp/name;root.mkdir(mode=0o700);src=root/'source';src.mkdir(mode=0o700);dst=root/'selected';dst.mkdir(mode=0o700)
 for n,b in data.items():(src/n).write_bytes(b);os.chmod(src/n,0o600)
 if name=='host-source-directory-mode':os.chmod(src,0o750)
 elif name=='host-source-file-mode':os.chmod(src/'deploy.env',0o640)
 elif name=='host-source-hardlink':os.link(src/'deploy.env',root/'peer')
 elif name=='host-source-symlink':(src/'deploy.env').unlink();(src/'deploy.env').symlink_to(src/'target.json')
 before=fds()
 try:t.copy_private(src,dst,binding,stage=True)
 except ValueError:pass
 else:raise AssertionError(name)
 assert not list(dst.iterdir()) and fds()==before;rows.append({'name':name,'status':'PASS','outputFiles':0,'heldDescriptorsClosed':True})
(p/'host-dummy-controls.json').write_text(json.dumps({'scope':'ACTUAL_HOST_DUMMY_SOURCE_ONLY','status':'PASS','cases':len(rows),'results':rows,'stageReceipt':receipt,'hostExportParent':{'uid':export.stat().st_uid,'gid':export.stat().st_gid,'mode':oct(export.stat().st_mode&0o777)},'actualCredentialReads':0,'serviceCalls':0},indent=2)+'\n')
image='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3';volume='cortex-task03-attempt3-dummy-20261005-'+binding['operation'].split('-')[0]
def run(name,argv):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();result=subprocess.run(argv,capture_output=True,text=True,timeout=45);(p/(name+'.stdout')).write_text(result.stdout);(p/(name+'.stderr')).write_text(result.stderr);commands.append({'phase':name,'argv':argv,'startedAt':start,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':result.returncode,'stdout':name+'.stdout','stderr':name+'.stderr'});(p/'dummy-command-receipts.json').write_text(json.dumps({'scope':'ACTUAL_DUMMY_TRANSPORT_ONLY','image':image,'volume':volume,'literalMemoryBytes':536870912,'compilerInvocations':0,'actualCredentialReads':0,'serviceCalls':0,'commands':commands},indent=2)+'\n');assert result.returncode==0,name;return result.stdout
run('create-owned-dummy-volume',['docker','volume','create','--label','cortex-task03-dummy='+binding['operation'],volume])
common=['docker','run','--rm','--network','none','--platform','linux/amd64','--memory','512m','--memory-swap','512m','--mount','type=bind,source='+str(export)+',target=/export,readonly','--mount','type=bind,source='+str(p)+',target=/prep,readonly','--mount','type=volume,source='+volume+',target=/owned,volume-nocopy','--entrypoint','/usr/local/bin/python3.12']
run('linux-dummy-setup',common+['--user','0:0',image,'-B','/prep/setup-linux-dummy.py'])
raw=run('linux-dummy-receiver',common+['--user','501:20',image,'-B','/prep/probe-linux.py']);j=json.loads(raw);assert j['status']=='PASS' and j['cases']==14 and j['selectedChildRequiredAndObserved']=={'uid':501,'gid':20,'mode':'0o700'} and j['memoryMaxBytes']=='536870912'
print(json.dumps({'scope':'DUMMY_TRANSPORT_PREPARATION_ONLY','status':'PASS','hostControls':len(rows),'linuxReceiverControls':j['cases'],'volume':volume,'bindRootObserved':j['bindRootObserved'],'selectedChildRequiredAndObserved':j['selectedChildRequiredAndObserved'],'actualCredentialReads':0,'serviceCalls':0}))
