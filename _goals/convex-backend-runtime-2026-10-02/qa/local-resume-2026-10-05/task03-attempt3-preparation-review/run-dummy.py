import datetime,importlib.util,json,os,subprocess,sys,uuid
from pathlib import Path
sys.dont_write_bytecode=True
out=Path(__file__).resolve().parent;q=out.parent.parent/'task03-local-native-attempt3-2026-10-05';p=q/'transport-prep'
assert os.getuid()==501 and os.getgid()==20
spec=importlib.util.spec_from_file_location('exact_transport',p/'private-transport.py');t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
root=out/'tmp/independent-public-dummy';root.mkdir(mode=0o700);source=root/'public-source';source.mkdir(mode=0o700);export=root/'export';export.mkdir(mode=0o700);child=export/'selected';child.mkdir(mode=0o700)
template=json.loads((p/'dummy-selected-template.json').read_bytes())['files'];binding=json.loads((p/'transport-binding.json').read_bytes())
for name in t.NAMES:
    f=source/name;f.write_bytes(bytes.fromhex(template[name]));f.chmod(0o600)
before=len(list(Path('/dev/fd').iterdir()));receipt=t.copy_private(source,child,binding,stage=True);assert len(list(Path('/dev/fd').iterdir()))==before
(out/'host-stage-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
(out/'dummy-template.json').write_text(json.dumps({'scope':'PUBLIC_DUMMY_ONLY','files':{f.name:f.read_bytes().hex() for f in child.iterdir()}},indent=2)+'\n')
volume='cortex-task03-independent-attempt3-dummy-'+uuid.uuid4().hex[:12];image='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3';commands=[]
def run(name,argv):
    start=datetime.datetime.now(datetime.timezone.utc).isoformat();r=subprocess.run(argv,capture_output=True,text=True,timeout=45)
    (out/(name+'.stdout')).write_text(r.stdout);(out/(name+'.stderr')).write_text(r.stderr)
    commands.append({'name':name,'argv':argv,'startedAt':start,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'stdout':name+'.stdout','stderr':name+'.stderr'})
    (out/'dummy-command-receipts.json').write_text(json.dumps({'scope':'PUBLIC_DUMMY_ONLY','volume':volume,'image':image,'commands':commands,'network':'none','memoryMaxBytes':536870912,'actualPrivateReads':0,'serviceCalls':0},indent=2)+'\n')
    print(json.dumps({'phase':name,'exitCode':r.returncode}),flush=True);assert r.returncode==0,name;return r.stdout
run('dummy-create-volume',['docker','volume','create','--label','cortex-task03-independent-public-dummy='+binding['operation'],volume])
common=['docker','run','--rm','--network','none','--platform','linux/amd64','--memory','512m','--memory-swap','512m','--mount','type=bind,source='+str(out)+',target=/review,readonly','--mount','type=volume,source='+volume+',target=/owned,volume-nocopy','--entrypoint','/usr/local/bin/python3.12']
run('dummy-root-setup',common+['--user','0:0',image,'-B','/review/dummy-setup.py'])
receiver=common+['--mount','type=bind,source='+str(p)+',target=/prep,readonly','--mount','type=bind,source='+str(export)+',target=/export,readonly','--user','501:20',image,'-B','/review/dummy-receiver.py']
r=json.loads(run('dummy-receiver',receiver));assert r['status']=='PASS' and r['cases']==26 and r['memoryMaxBytes']=='536870912' and r['actualUid']==501 and r['actualGid']==20 and r['selectedChild']=={'uid':501,'gid':20,'mode':'0o700'}
post=json.loads(run('dummy-root-postcheck',common+['--user','0:0',image,'-B','/review/dummy-postcheck.py']));assert post['cases']==25 and post['exportMounted'] is False
# Remove only this review's uniquely created public-dummy volume after all checks succeed.
run('dummy-remove-volume',['docker','volume','rm',volume])
(out/'dummy-summary.json').write_text(json.dumps({'scope':'PUBLIC_DUMMY_TRANSPORT_ONLY','status':'PASS','hostStage':{'privateNamesArePublicDummyOnly':True,'files':3,'descriptorsClosed':True},'linuxCases':26,'rootPostchecks':25,'nineIdentityFieldSeams':9,'memoryBytes':536870912,'network':'none','newOwnedDummyVolumeRemoved':True,'actualPrivateReads':0,'serviceCalls':0,'liveNativeAcceptance':False},indent=2)+'\n')
print(json.dumps({'status':'PASS','linuxCases':26,'rootPostchecks':25,'volumeRemoved':True}))
