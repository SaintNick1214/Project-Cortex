"""Held header bootstrap; no source authority, service or target effects."""
import hashlib
import json
import os
import time
import types
from pathlib import Path
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
class RegistrationFailure(BaseException):
    def __init__(self,primary,close_error):
        self.primary=primary;self.close_error=close_error
        super().__init__('registration='+repr(primary)+'; fallbackClose='+repr(close_error))
def register(owned,fd,path,cap,pin):
    try:owned.append((fd,path,cap,pin))
    except BaseException as primary:
        close_error=None
        try:os.close(fd)
        except BaseException as failure:close_error=failure
        raise RegistrationFailure(primary,close_error)
def nine(st):return {k:str(getattr(st,'st_'+k)) for k in FIELDS}
def read(fd,limit):
    result=[];offset=0
    while True:
        raw=os.pread(fd,65536,offset)
        if not raw:break
        offset+=len(raw)
        if offset>limit:raise ValueError('header cap')
        result.append(raw)
    return b''.join(result)
def run(namespace):
    n=Path(namespace);owned=[];errors=[];headers={};result=None
    try:
        for name,cap in (('source-input-plan3.json',4194304),('source-writers-stopped3.json',1048576)):
            path=n/name;fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
            # Own before the first fallible fstat; the pin is filled afterward.
            register(owned,fd,path,cap,None)
            pin=nine(os.fstat(fd));owned[-1]=(fd,path,cap,pin)
        for fd,path,cap,pin in owned:
            maximum=max(int(pin[k]) for k in ('mtime_ns','ctime_ns'))
            if nine(os.lstat(path))!=pin or time.time_ns()-maximum<240000000000:raise ValueError('header current240s mature nine')
            raw=read(fd,cap)
            if len(raw)!=int(pin['size']) or nine(os.lstat(path))!=pin or nine(os.fstat(fd))!=pin:raise ValueError('header full EOF native nine')
            headers[path.name]=(raw,{'path':str(path),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'PRE9':pin})
        plan=json.loads(headers['source-input-plan3.json'][0]);row=next(r for r in plan['inputs'] if r['path']==str(n/'held_runner3.py'))
        # The runner is a member of the fully opened cohort below; hold it before
        # compiling its first bytes, and keep this bootstrap fd through the run.
        runner_path=Path(row['path']);fd=os.open(runner_path,os.O_RDONLY|os.O_NOFOLLOW)
        register(owned,fd,runner_path,row['bytes'],row['PRE9'])
        if nine(os.lstat(row['path']))!=row['PRE9'] or nine(os.fstat(fd))!=row['PRE9']:raise ValueError('runner strict original nine')
        maximum=max(int(row['PRE9'][k]) for k in ('mtime_ns','ctime_ns'))
        stop=json.loads(headers['source-writers-stopped3.json'][0])
        if maximum>stop['stoppedUnixNs'] or time.time_ns()-maximum<240000000000:raise ValueError('runner first-use stopped240s maturity')
        raw=read(fd,row['bytes'])
        if len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise ValueError('runner exact held EOF hash')
        module=types.ModuleType('adapter2_exact_held_runner');exec(compile(raw,row['path'],'exec',dont_inherit=True),module.__dict__)
        result=module.run(*headers['source-input-plan3.json'],*headers['source-writers-stopped3.json'],str(n/'held-source-replay3.json'))
    except BaseException as error:errors.append({'stage':'primary','error':repr(error)})
    finally:
        handles=owned;owned=[];closes=[]
        for fd,path,cap,pin in handles:
            try:
                raw=read(fd,cap)
                if pin is None:raise ValueError('partial setup had no accepted header pin')
                if len(raw)!=int(pin['size']) or nine(os.lstat(path))!=pin or nine(os.fstat(fd))!=pin:raise ValueError('header/runner final EOF nine')
                if path.name in headers and hashlib.sha256(raw).hexdigest()!=headers[path.name][1]['sha256']:raise ValueError('header final full EOF hash')
                if path.name=='held_runner3.py' and hashlib.sha256(raw).hexdigest()!=row['sha256']:raise ValueError('runner final hash')
            except BaseException as error:errors.append({'stage':'final:'+str(path),'error':repr(error)})
            error=None
            try:os.close(fd)
            except BaseException as failure:error=repr(failure);errors.append({'stage':'close:'+str(path),'error':error})
            closes.append({'path':str(path),'attempt':1,'error':error})
    receipt={'scope':'AUTHOR_HEADER_BOOTSTRAP_HELD_REPLAY_ONLY','errors':errors,'closes':closes,
             'remainingOwned':len(owned),'sourceEligibility':False,'effects':0}
    path=n/'held-entry-close-receipt3.json'
    with path.open('x') as output:json.dump(receipt,output,indent=2);output.write('\n')
    if errors:raise RuntimeError('entry failed; original/final/close errors retained')
    return result
