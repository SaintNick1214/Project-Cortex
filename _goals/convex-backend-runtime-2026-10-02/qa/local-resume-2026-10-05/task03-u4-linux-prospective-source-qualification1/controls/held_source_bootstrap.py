"""Initial stdlib-only byte verifier. Invoked from separately verified held bytes.

Owns all five header descriptors before any header body. Compiles only verified C
and collector bytes, retains headers through member replay, closes every owned FD.
"""
import hashlib
import json
import os
import stat
import time
import types

FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
LIMIT=16777216

def nine(st):return {k:str(getattr(st,'st_'+k)) for k in FIELDS}
def execute(rows,directory):
    if set(rows)!={'C','collector','bootstrap','plan','stop'}:raise ValueError('EXACT_FIVE_HEADER_SET')
    entries=[{'name':n,'row':r,'fd':None,'closeAttempted':False} for n,r in rows.items()]
    errors=[None]*24;count=0;bodies={};result=None;ledger=None;header_close=[]
    try:
        if len({r['path'] for r in rows.values()})!=5:raise ValueError('UNIQUE_HEADERS')
        if sum(r['bytes'] for r in rows.values())>67108864:raise ValueError('HEADER_SOURCE_BYTE_CAP')
        for entry in entries:
            r=entry['row'];pin=nine(os.lstat(r['path']))
            if pin!=r['expectedNine'] or int(pin['uid'])!=501 or int(pin['gid'])!=20 or pin['nlink']!='1' or not stat.S_ISREG(int(pin['mode'])):
                raise ValueError('HEADER_NINE_TYPE_OWNER')
            if time.time_ns()-max(int(pin['mtime_ns']),int(pin['ctime_ns']))<60000000000:raise ValueError('HEADER_CURRENT_MATURITY')
            if type(r['bytes'])is not int or not 0<=r['bytes']<=LIMIT or int(pin['size'])!=r['bytes']:raise ValueError('HEADER_SIZE_CAP')
            fd=os.open(r['path'],os.O_RDONLY|os.O_NOFOLLOW)
            try:entry['fd']=fd;entry['pin']=pin
            except BaseException as primary:
                entry['fd']=None;entry['closeAttempted']=True
                try:os.close(fd)
                except BaseException as close:raise RuntimeError(repr(primary)+'; '+repr(close)) from primary
                raise
            if nine(os.fstat(fd))!=pin:raise ValueError('HEADER_OPEN_NINE')
        for entry in entries:
            r=entry['row'];fd=entry['fd'];parts=[];total=0;h=hashlib.sha256()
            while True:
                chunk=os.read(fd,65536)
                if not chunk:break
                total+=len(chunk)
                if total>r['bytes'] or total>LIMIT:raise ValueError('HEADER_READ_CAP')
                h.update(chunk);parts.append(chunk)
            if total!=r['bytes'] or h.hexdigest()!=r['sha256'] or nine(os.fstat(fd))!=entry['pin'] or nine(os.lstat(r['path']))!=entry['pin']:
                raise ValueError('HEADER_FULL_EOF_HASH_NINE')
            bodies[r['path']]=b''.join(parts)
        C=types.ModuleType('verified_source_contract');C.__file__=rows['C']['path']
        exec(compile(bodies[C.__file__],C.__file__,'exec',dont_inherit=True),C.__dict__)
        ledger=C.Ledger()
        for entry in entries:
            r=entry['row'];ledger.admit(r['path'],entry['pin'],r['sha256'],r['bytes'],'SOURCE_HEADER')
            ledger.own(entry['fd'],r['path'])
        collector=types.ModuleType('verified_source_collector');collector.__file__=rows['collector']['path'];collector.C=C
        exec(compile(bodies[collector.__file__],collector.__file__,'exec',dont_inherit=True),collector.__dict__)
        result=collector.collect(dict(rows,ownedEntries=entries),bodies,ledger,directory)
    except BaseException as error:errors[count]=repr(error);count+=1
    finally:
        for entry in entries:
            fd=entry['fd']
            if fd is None:continue
            try:
                if nine(os.fstat(fd))!=entry['pin'] or nine(os.lstat(entry['row']['path']))!=entry['pin']:raise ValueError('HEADER_FINAL_NINE')
            except BaseException as error:errors[count]=repr(error);count+=1
        for entry in entries:
            fd=entry['fd']
            if fd is None:continue
            entry['fd']=None;entry['closeAttempted']=True
            if ledger is not None and fd in ledger.live:
                try:ledger.detach(fd)
                except BaseException as error:errors[count]=repr(error);count+=1
            try:os.close(fd)
            except BaseException as error:
                if ledger is not None:ledger.failed_close=True
                errors[count]=repr(error);count+=1
            header_close.append(entry['row']['path'])
    return {'scope':'L_FINITE_HEADER_MEMBER_AUTHOR_SOURCE_REPLAY_ONLY','result':result,
        'headerRows':[{**e['row'],'fullEOF':e['row']['path'] in bodies,'closeAttempted':e['closeAttempted']} for e in entries],
        'headerCloseAttempts':header_close,'errors':errors[:count],'ledger':ledger.snapshot() if ledger is not None else None,
        'allHeaderFDsBeforeHeaderBodies':True,'sourceEligibility':False,'runtimeAuthority':False,'fullTask03':False,'fullGoal':False}
