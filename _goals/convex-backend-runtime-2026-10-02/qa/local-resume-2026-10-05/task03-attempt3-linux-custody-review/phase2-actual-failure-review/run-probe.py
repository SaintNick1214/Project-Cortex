"""One bounded readonly metadata probe, preserving source and original evidence."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

OUT=Path(__file__).resolve().parent
REPO=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q=REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt3-2026-10-05'
EXPORT=Q/'tmp/actual-private-export-d98bad88-5157-4816-b458-4160e7945361'
IMAGE='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
VOLUME='cortex-task03-attempt3-fixture-20261005-d98bad88'
NAME='cortex-task03-attempt3-actual-failure-metadata-review-d98bad88'
records=[]
def run(label,argv,expected=0):
 start=time.monotonic();at=datetime.datetime.now(datetime.timezone.utc).isoformat();r=subprocess.run(argv,capture_output=True,cwd=REPO,timeout=60)
 assert len(r.stdout)<=2097152 and len(r.stderr)<=262144
 for suffix,data in [('stdout',r.stdout),('stderr',r.stderr)]:
  with (OUT/(label+'.'+suffix)).open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
 records.append({'label':label,'argv':argv,'startedAtUtc':at,'elapsedSeconds':time.monotonic()-start,'exitCode':r.returncode,'stdoutSha256':hashlib.sha256(r.stdout).hexdigest(),'stderrSha256':hashlib.sha256(r.stderr).hexdigest(),'timeoutSeconds':60,'credentialFileOpens':0,'readonlyMetadataOnly':True})
 t=OUT/'command-receipts.json.replacement';t.write_text(json.dumps({'scope':'RETIRED_ATTEMPT3_READONLY_METADATA_ONLY','commands':records,'credentialByteReads':0,'receiverReplay':False,'serviceRequests':0,'cliDispatches':0},indent=2)+'\n');os.replace(t,OUT/'command-receipts.json')
 assert r.returncode==expected,label
 return r
mem=int(run('docker-memory',['docker','info','--format','{{json .MemTotal}}']).stdout)
ids=run('running-container-ids',['docker','ps','-q']).stdout.decode().split();caps=[]
for i,cid in enumerate(ids):caps.append(json.loads(run('running-resource-'+str(i),['docker','inspect',cid,'--format','{"id":{{json .Id}},"memory":{{json .HostConfig.Memory}},"memorySwap":{{json .HostConfig.MemorySwap}}}']).stdout))
assert all(x['memory']>0 for x in caps) and mem-sum(x['memory'] for x in caps)-2147483648>=536870912
(OUT/'remaining-resources.json').write_text(json.dumps({'totalBytes':mem,'runningCaps':caps,'externalSiblingReserveBytes':2147483648,'reviewCeilingBytes':536870912},indent=2)+'\n')
for suffix in ['private','deploy','driver']:
 r=run('retired-'+suffix+'-container-absence',['docker','inspect','cortex-task03-attempt3-'+suffix+'-d98bad88','--format','{{json .State}}'],expected=1)
 assert b'no such object' in r.stderr.lower()
args=['docker','create','--platform','linux/amd64','--network','none','--memory','512m','--memory-swap','512m','--cpus','2','--user','501:20','--read-only','--name',NAME,'--label','cortex.operation=d98bad88-5157-4816-b458-4160e7945361','--mount','type=bind,source='+str(OUT/'metadata-probe.py')+',target=/probe.py,readonly','--mount','type=bind,source='+str(OUT.parent/'r3-public-custody.stdout')+',target=/public-baseline.json,readonly','--mount','type=bind,source='+str(EXPORT)+',target=/export,readonly','--mount','type=volume,source='+VOLUME+',target=/owned,readonly,volume-nocopy',IMAGE,'/usr/local/bin/python3.12','-B','/probe.py']
created=False
try:
 run('metadata-create',args);created=True
 obj=json.loads(run('metadata-inspect',['docker','inspect',NAME,'--format','{"image":{{json .Image}},"memory":{{json .HostConfig.Memory}},"memorySwap":{{json .HostConfig.MemorySwap}},"network":{{json .HostConfig.NetworkMode}},"user":{{json .Config.User}},"mounts":{{json .Mounts}}}']).stdout)
 assert obj['image']==IMAGE and obj['memory']==obj['memorySwap']==536870912 and obj['network']=='none' and obj['user']=='501:20'
 assert all(m['RW'] is False for m in obj['mounts'])
 assert next(m for m in obj['mounts'] if m['Destination']=='/export')['Source']==str(EXPORT)
 result=json.loads(run('actual-metadata-probe',['docker','start','--attach',NAME]).stdout)
 assert result['privateCredentialByteReads']==0 and result['sourceOrVolumeWrites']==0
 print(json.dumps({'status':'OBSERVED','currentFirstMetadataFence':result['currentFirstMetadataFence'],'privateDestinationEntries':result['destinationPrivateEntryCount'],'privateDestinationAll9Unchanged':result['destinationPrivateAll9EqualsPhase1EmptyBaseline'],'publicMetadataDeltaCount':len(result['publicCandidateMetadataDeltas']),'privateCredentialByteReads':0,'originalFailureStage':'UNKNOWN','operationRetiredNeverRetry':True}))
finally:
 if created:run('metadata-remove',['docker','rm',NAME])
