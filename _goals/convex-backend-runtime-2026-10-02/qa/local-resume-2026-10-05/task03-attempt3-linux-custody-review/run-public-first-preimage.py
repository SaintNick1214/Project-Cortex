"""Bounded readonly reviewer commands and exact raw command receipts."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

REPO = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q = REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt3-2026-10-05'
OUT = Q.parent/'local-resume-2026-10-05/task03-attempt3-linux-custody-review'
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
VOLUME = 'cortex-task03-attempt3-fixture-20261005-d98bad88'
OPERATION = 'd98bad88-5157-4816-b458-4160e7945361'
records = []

def run(label, argv, timeout=60, expected=0):
    start=time.monotonic()
    at=datetime.datetime.now(datetime.timezone.utc).isoformat()
    result=subprocess.run(argv,capture_output=True,timeout=timeout,cwd=REPO)
    assert len(result.stdout)<=4194304 and len(result.stderr)<=262144
    for suffix,data in [('stdout',result.stdout),('stderr',result.stderr)]:
        with (OUT/(label+'.'+suffix)).open('xb') as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
    records.append({'label':label,'argv':argv,'startedAtUtc':at,'elapsedSeconds':time.monotonic()-start,'exitCode':result.returncode,'stdoutSha256':hashlib.sha256(result.stdout).hexdigest(),'stderrSha256':hashlib.sha256(result.stderr).hexdigest(),'timeoutSeconds':timeout,'readonlyPublicOnly':True})
    temporary=OUT/'command-receipts.json.replacement'
    temporary.write_text(json.dumps({'operation':OPERATION,'commands':records,'privateByteReads':0,'serviceRequests':0,'compilerExecutions':0,'cliDispatches':0,'candidateOrVolumeMutations':0},indent=2)+'\n')
    os.replace(temporary,OUT/'command-receipts.json')
    assert result.returncode==expected, label
    return result

def container(label,mounts,command,env=None,tmp=False):
    name='cortex-task03-attempt3-review-'+label+'-d98bad88'
    argv=['docker','create','--platform','linux/amd64','--network','none','--memory','512m','--memory-swap','512m','--cpus','2','--user','501:20','--read-only','--name',name,'--label','cortex.operation='+OPERATION]
    if tmp: argv += ['--tmpfs','/tmp:rw,uid=501,gid=20,mode=0700']
    for key,value in (env or {}).items(): argv += ['--env',key+'='+value]
    for mount in mounts: argv += ['--mount',mount]
    argv += [IMAGE] + command
    created=False
    try:
        run(label+'-create',argv); created=True
        fmt='{"id":{{json .Id}},"image":{{json .Image}},"memory":{{json .HostConfig.Memory}},"memorySwap":{{json .HostConfig.MemorySwap}},"network":{{json .HostConfig.NetworkMode}},"user":{{json .Config.User}},"readonlyRootfs":{{json .HostConfig.ReadonlyRootfs}},"mounts":{{json .Mounts}},"tmpfs":{{json .HostConfig.Tmpfs}}}'
        inspect=json.loads(run(label+'-inspect',['docker','inspect',name,'--format',fmt]).stdout)
        assert inspect['image']==IMAGE and inspect['memory']==inspect['memorySwap']==536870912
        assert inspect['network']=='none' and inspect['user']=='501:20' and inspect['readonlyRootfs'] is True
        assert all(m['RW'] is False for m in inspect['mounts'])
        assert not any('private' in m['Destination'] for m in inspect['mounts'])
        return run(label,['docker','start','--attach',name])
    finally:
        if created: run(label+'-remove',['docker','rm',name])

mem=int(run('docker-memory',['docker','info','--format','{{json .MemTotal}}']).stdout)
running=run('running-container-ids',['docker','ps','-q']).stdout.decode().split()
usage=[]
for i,cid in enumerate(running):
    value=json.loads(run('running-resource-'+str(i),['docker','inspect',cid,'--format','{"id":{{json .Id}},"name":{{json .Name}},"memory":{{json .HostConfig.Memory}},"memorySwap":{{json .HostConfig.MemorySwap}}}']).stdout)
    usage.append(value)
assert not any(item['memory']==0 for item in usage), 'Unbounded running container requires parent resource review'
remaining=mem-sum(item['memory'] for item in usage)-2147483648
assert remaining>=536870912
(OUT/'remaining-resources.json').write_text(json.dumps({'status':'PASS','dockerMemoryTotalBytes':mem,'runningContainerCaps':usage,'externalSiblingReserveBytes':2147483648,'reviewerCeilingBytes':536870912,'remainingAfterCapsAndSiblingReserveBytes':remaining,'externalSiblingInspection':'ID/name/memory caps only; no logs/env/file reads or mutations'},indent=2)+'\n')
image=json.loads(run('image-inspect',['docker','image','inspect',IMAGE,'--format','{"id":{{json .Id}},"architecture":{{json .Architecture}},"os":{{json .Os}}}']).stdout)
assert image=={'id':IMAGE,'architecture':'amd64','os':'linux'}
volume=json.loads(run('volume-inspect',['docker','volume','inspect',VOLUME]).stdout)[0]
assert volume['Name']==VOLUME and volume['Driver']=='local'
assert volume['Labels']=={'cortex.goal':'convex-backend-runtime-2026-10-02','cortex.operation':OPERATION}
run('host-current-bindings',['python3','-B',str(OUT/'current-bindings.py')])
public_mounts=['type=bind,source='+str(Q)+',target=/source,readonly','type=bind,source='+str(OUT)+',target=/review,readonly','type=volume,source='+VOLUME+',target=/owned,readonly,volume-nocopy']
public=json.loads(container('public-custody',public_mounts,['/usr/local/bin/python3.12','-B','/review/public-custody.py']).stdout)
assert public['status']=='PASS' and public['fileCount']==972 and public['bytes']==25212514
source_mounts=['type=bind,source='+str(REPO)+',target='+str(REPO)+',readonly','type=volume,source=cortex-task03-deps-20261005-b681774e,target='+str(REPO/'node_modules')+',readonly,volume-nocopy,volume-subpath=node_modules','type=volume,source='+VOLUME+',target='+str(Q)+',readonly,volume-nocopy,volume-subpath=candidate']
env={'HOME':'/tmp','PATH':str(REPO/'node_modules/.bin')+':/usr/local/bin:/usr/bin:/bin','NO_UPDATE_NOTIFIER':'1','NPM_CONFIG_USERCONFIG':'/dev/null'}
binding=json.loads(container('linux-bindings',source_mounts,['/usr/local/bin/python3.12','-B',str(OUT/'current-bindings.py')],env,tmp=True).stdout)
assert binding['status']=='PASS' and binding['platform']=='linux'
source=json.loads(container('source-preflight',source_mounts,['/usr/local/bin/node',str(OUT/'source-preflight.mjs')],env,tmp=True).stdout)
assert source['status']=='PASS' and source['candidateFiles']==965 and source['compilerExecutions']==0
run('host-current-bindings-final',['python3','-B',str(OUT/'current-bindings.py')])
before=json.loads((OUT/'host-current-bindings.stdout').read_bytes())
after=json.loads((OUT/'host-current-bindings-final.stdout').read_bytes())
assert before['files']==after['files']
print(json.dumps({'status':'PASS','scope':'PUBLIC_CUSTODY_AND_CURRENT_SOURCE_ONLY','publicFiles':972,'sourcePins':161,'testPins':155,'compilerProjection':114,'privateByteReads':0,'serviceRequests':0,'compilerExecutions':0,'cliDispatches':0,'fullTask03':'OPEN'}))
