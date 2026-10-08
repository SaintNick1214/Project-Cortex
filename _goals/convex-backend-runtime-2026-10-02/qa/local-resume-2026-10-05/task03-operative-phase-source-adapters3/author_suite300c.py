"""Root-authorized additional author-only300s wrapper; no Common invocation.

All original case timers/source assertions remain unchanged. A timer interrupts
only this known process; no other PID is discovered or signaled. Deadline
failure is sticky even when a lower-level test catches that interruption.
"""
import hashlib
import json
import os
from pathlib import Path
import signal
import threading
import time
import types
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(st):return {k:str(getattr(st,'st_'+k))for k in FIELDS}
def read(fd,limit):
    chunks=[];offset=0
    while True:
        chunk=os.pread(fd,65536,offset)
        if not chunk:break
        offset+=len(chunk)
        if offset>limit:raise ValueError('author first-use input overflow')
        chunks.append(chunk)
    return b''.join(chunks)
def run(namespace,entry_row,start,deadline):
    assert type(start)is float and type(deadline)is float and deadline==start+300 and start<=time.monotonic()<deadline
    owned=[];errors=[];triggered=[];finished=threading.Event();result=None
    def expire():
        triggered.append(time.monotonic());os.kill(os.getpid(),signal.SIGINT)
    timer=threading.Timer(deadline-time.monotonic(),expire);timer.daemon=True
    def heartbeat():
        while not finished.wait(25):
            print(json.dumps(dict(scope='AUTHOR_ONLY300_NOT_COMMON190',ownedPID=os.getpid(),elapsed=time.monotonic()-start,remaining=deadline-time.monotonic(),caseProgress='see condition output; in-flight case may be pending',deadlineTriggered=bool(triggered))),flush=True)
    beat=threading.Thread(target=heartbeat,daemon=True)
    print(json.dumps(dict(scope='AUTHOR_ONLY300_NOT_COMMON190',ownedPID=os.getpid(),startedMonotonic=start,deadlineMonotonic=deadline,originalCase120=True,CommonInvoked=False)),flush=True)
    original_sigint=signal.getsignal(signal.SIGINT)
    try:
        signal.signal(signal.SIGINT,signal.default_int_handler)
        timer.start();beat.start()
        path=Path(entry_row['path']);fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
        try:owned.append((fd,path,entry_row))
        except BaseException:
            os.close(fd);raise
        assert nine(os.fstat(fd))==entry_row['PRE9']and nine(os.lstat(path))==entry_row['PRE9']
        assert time.time_ns()-max(int(entry_row['PRE9'][k])for k in ('mtime_ns','ctime_ns'))>=240000000000
        raw=read(fd,entry_row['bytes']);assert len(raw)==entry_row['bytes']and hashlib.sha256(raw).hexdigest()==entry_row['sha256']
        assert time.monotonic()<deadline
        module=types.ModuleType('n3_exact_held_source_entry');exec(compile(raw,str(path),'exec',dont_inherit=True),module.__dict__)
        result=module.run(namespace)
        assert time.monotonic()<deadline and not triggered,'author-only300 deadline exceeded; never Common190 PASS'
    except BaseException as error:errors.append(dict(stage='primary',error=repr(error)))
    finally:
        handles=owned;owned=[]
        for fd,path,row in handles:
            try:
                raw=read(fd,row['bytes']);assert len(raw)==row['bytes']and hashlib.sha256(raw).hexdigest()==row['sha256']and nine(os.fstat(fd))==row['PRE9']and nine(os.lstat(path))==row['PRE9']
            except BaseException as error:errors.append(dict(stage='final',error=repr(error)))
            try:os.close(fd)
            except BaseException as error:errors.append(dict(stage='close',error=repr(error)))
        timer.cancel();finished.set()
        try:
            if beat.ident is not None:beat.join(timeout=1)
            signal.signal(signal.SIGINT,original_sigint)
        except BaseException as error:errors.append(dict(stage="timer_or_signal_cleanup",error=repr(error)))
    elapsed=time.monotonic()-start
    if elapsed>=300 or triggered:errors.append(dict(stage='whole-suite-deadline',error='AUTHOR_ONLY300 exceeded including final/once-close'))
    receipt=dict(scope='AUTHOR_ONLY_COMPLETE162_VIRTUAL_CODE_BEHAVIOR_NOT_COMMON190',ownedPID=os.getpid(),startedMonotonic=start,deadlineMonotonic=deadline,elapsed=elapsed,remainingCleanupReserveAtReturn=deadline-time.monotonic(),deadlineTriggered=triggered,entryFirstUse=entry_row,entryOnceCloseAttempts=len(handles),errors=errors,conditions=162 if result is not None else None,authorSuiteWithin300=not errors,actualCommon190Acceptance=False,sourceEligibility=False,effects=0)
    with (Path(namespace)/'author-suite300-receipt.json').open('x')as output:json.dump(receipt,output,indent=2);output.write('\n')
    if errors:raise RuntimeError('author-only suite failure; all original failures retained')
    return receipt
