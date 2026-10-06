"""Both actual exited-command descendants, plus a labeled ownership-unknown seam."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

P=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('repaired_common','/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06/coordinate-source/task03-attempt5-coordinate-common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)
OUT=Path(os.environ.get('CORTEX_COORDINATOR_TEST_OUT',str(P/'fresh-descendant-controls')))
OUT.mkdir(mode=0o700)
ENV={'PATH':'/usr/bin:/bin','CORTEX_COORDINATOR_CWD':str(P)}
results=[]
for label,closed in [('exited-parent-closed-descendant-pipes',True),('exited-parent-open-descendant-pipes',False)]:
    program='''import os,time,json
pid=os.fork()
if pid:
 os.write(1,(json.dumps({'parentPid':os.getpid(),'descendantPid':pid,'group':os.getpgrp(),'session':os.getsid(0)})+'\\n').encode())
 os._exit(0)
'''+('''for fd in (0,1,2):
 try:os.close(fd)
 except OSError:pass
''' if closed else '')+'''time.sleep(15)
os._exit(0)
'''
    row,stdout,stderr=C.run(label,[sys.executable,'-B','-c',program],OUT,.6,ENV,required=False)
    ids=json.loads(stdout)
    identity=row['ownedGroup']['anchorIdentity']
    assert row['exitCode']==0 and row['terminal'] and not row['closeErrors']
    assert ids['parentPid']==row['ownedGroup']['commandPid'] and ids['parentPid']!=identity['pid']
    assert ids['group']==ids['session']==identity['pid'] and ids['descendantPid']!=ids['parentPid']
    assert row['failureClass']==('OwnedGroupResidual' if closed else 'TimeoutError')
    reconciliation=row['ownedGroup']['reconciliation']
    assert reconciliation and any(r['pid']==ids['descendantPid'] for r in reconciliation['before'])
    assert any(r['pid']==ids['descendantPid'] and r['signal']=='SIGKILL' and r['identity']['group']==ids['group'] for r in reconciliation['signals'])
    assert [r['pid'] for r in reconciliation['final']]==[identity['pid']]
    assert row['ownedGroup']['absenceObserved']
    if sys.platform=='linux':
        assert not Path('/proc/'+str(ids['descendantPid'])).exists()
        C.durable_json(OUT/(label+'.descendant-after.json'),{'nativeProcEntryAbsent':True,'descendantPid':ids['descendantPid']})
    else:
        after=subprocess.run(['/bin/ps','-p',str(ids['descendantPid']),'-o','pid=,ppid=,pgid=,uid=,stat=,command='],capture_output=True,timeout=2)
        C.durable(OUT/(label+'.descendant-after.stdout'),after.stdout)
        assert after.stdout.strip()==b''
    try:os.killpg(ids['group'],0);raise AssertionError('owned group remained')
    except ProcessLookupError:pass
    results.append({'name':label,'closedPipes':closed,'status':'PASS','functionReceipt':label+'.receipt.json','ownedIds':ids,
                    'originalFailureRemainsSticky':True,'exactOwnedDescendantKilled':True,'descendantAbsent':True,'groupAbsent':True})
# Force the ownership fence to reject only after the actual command exits. This
# is an injected seam; it must not signal a group whose identity is unknown.
old_matches=C.anchor_matches
old_killpg=C.os.killpg
calls={'matches':0,'activeSignals':0}
def reject_after_spawn(process,identity):
    calls['matches']+=1
    return old_matches(process,identity) if calls['matches']<=2 else False
def record_signal(group,sig):
    if sig!=0:calls['activeSignals']+=1
    return old_killpg(group,sig)
try:
    C.anchor_matches=reject_after_spawn;C.os.killpg=record_signal
    row,stdout,stderr=C.run('unknown-anchor-identity',[sys.executable,'-B','-c','print("PUBLIC COMMAND FINISHED")'],OUT,3,ENV,required=False)
finally:
    C.anchor_matches=old_matches;C.os.killpg=old_killpg
assert row['exitCode']==0 and stdout==b'PUBLIC COMMAND FINISHED\n'
assert row['failureClass']=='OwnedGroupUnknown' and row['terminal'] is False and row['closeErrors']
assert calls['activeSignals']==0 and row['ownedGroup']['absenceObserved'] is False
identity=row['ownedGroup']['anchorIdentity']
deadline=time.monotonic()+3
while C.group_members(identity['pid']):
    assert time.monotonic()<deadline
    time.sleep(.02)
try:os.killpg(identity['pid'],0);raise AssertionError('unknown seam resource remained')
except ProcessLookupError:pass
results.append({'name':'unknown-anchor-identity','status':'PASS','instrumented':True,'terminalReceiptRejected':True,
                'activeGroupSignals':0,'actualResourceAbsenceAfterControllerEOF':True,'dispatchAccepted':False})
C.durable_json(OUT/'controls.json',{'status':'PASS','scope':'PUBLIC_HOST_OR_LINUX_OWNED_CHILD_GROUP_ONLY','actualExitedParentVariants':2,
    'injectedUnknownOwnershipControls':1,'results':results,'sourceSha256':C.digest('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06/coordinate-source/task03-attempt5-coordinate-common.py'),
    'DockerCalls':0,'credentialReads':0,'serviceCalls':0,'privateCoordinatorExecuted':False})
print(json.dumps({'status':'PASS','actualDescendantVariants':2,'unknownOwnershipControl':1,'exactOwnedGroupsAbsent':True}))
