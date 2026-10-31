"""Independent public-only process-group regression against exact frozen common source."""
import hashlib, importlib.util, json, os, signal, subprocess, sys, time
from pathlib import Path

O=Path(__file__).resolve().parent
P=O.parent
COMMON=P/'task03-attempt4-coordinate-common.py'
raw=COMMON.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='46a02cf65d5e4e58e94a9c86d69130f5b0b0a9e6483b6acdd76f1b394de1ef9d'
spec=importlib.util.spec_from_file_location('exact_common',COMMON)
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)
env={'PATH':'/usr/bin:/bin','CORTEX_COORDINATOR_CWD':str(O)}
observations=[]
for label,close_pipes in [('exited-parent-closed-descendant-pipes',True),('exited-parent-open-descendant-pipes',False)]:
    program='''import os,time,json
pid=os.fork()
if pid:
 os.write(1,(json.dumps({'parentPid':os.getpid(),'descendantPid':pid,'group':os.getpgrp(),'session':os.getsid(0)})+'\\n').encode())
 os._exit(0)
'''+('''for fd in (0,1,2):
 try:os.close(fd)
 except OSError:pass
''' if close_pipes else '')+'''time.sleep(15)
os._exit(0)
'''
    row,out,err=C.run(label,[sys.executable,'-B','-c',program],O,0.4,env,required=False)
    ids=json.loads(out);assert ids['parentPid']==ids['group']==ids['session'] and ids['descendantPid']!=ids['group']
    ps=subprocess.run(['/bin/ps','-p',str(ids['descendantPid']),'-o','pid=,ppid=,pgid=,uid=,stat=,command='],capture_output=True,timeout=3)
    C.durable(O/(label+'.descendant-before.stdout'),ps.stdout)
    fields=ps.stdout.decode().split(None,5)
    assert len(fields)==6 and int(fields[0])==ids['descendantPid'] and int(fields[2])==ids['group'] and int(fields[3])==os.getuid() and 'Z' not in fields[4]
    os.killpg(ids['group'],0)
    assert row['terminal'] is True and row['exitCode']==0
    if close_pipes:assert row['failureClass'] is None
    else:assert row['failureClass']=='TimeoutError'
    before={'directChildReceipt':row,'ownedIds':ids,'descendantAliveAfterRunReturned':True,'liveDescendantStat':fields[4],'closedPipes':close_pipes}
    try:
        os.killpg(ids['group'],signal.SIGKILL)
    finally:
        deadline=time.monotonic()+4
        while True:
            final=subprocess.run(['/bin/ps','-p',str(ids['descendantPid']),'-o','pid=,ppid=,pgid=,uid=,stat=,command='],capture_output=True,timeout=3)
            if not final.stdout.strip():break
            if time.monotonic()>deadline:raise AssertionError('owned descendant not reaped')
            time.sleep(0.05)
        C.durable(O/(label+'.descendant-after.stdout'),final.stdout)
    try:os.killpg(ids['group'],0);raise AssertionError('owned group still exists')
    except ProcessLookupError:pass
    before.update({'reviewerExactOwnedGroupCleanup':'SIGKILL','descendantAbsentAfterCleanup':True,'ownedGroupAbsentAfterCleanup':True})
    observations.append(before)
C.durable_json(O/'owned-descendant-observations.json',{'scope':'PUBLIC_HOST_CHILD_GROUP_ONLY','status':'CONFIRMED_COORDINATOR_DEFECT','observations':observations,'DockerCalls':0,'credentialReads':0,'serviceCalls':0,'nativeDispatches':0})
assert COMMON.read_bytes()==raw
print(json.dumps({'confirmedCases':2,'directChildTerminalWithLiveOwnedDescendant':True,'reviewerCleanup':'PASS_GROUPS_ABSENT','DockerCalls':0,'credentialReads':0,'services':0}))
