"""Finite author capture/replay actor; called only from held byte bootstrap."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import time
import types

FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(s):return {k:str(getattr(s,'st_'+k)) for k in FIELDS}
def run(bootstrap,plan_raw,stop_raw,output):
    # Shared owner list is transferred by reference. Caller finally handles
    # anything left in it; this finally detaches it before attempting closes.
    owned=bootstrap;plan={};stop={};records=[];failures=[]
    output=Path(output);bodies={};result=None;started=time.time_ns()
    def retain(path,fd,row):
        try:owned.append((path,fd,row))
        except BaseException as error:
            failures.append({'stage':'registration','error':repr(error)})
            try:os.close(fd);close_error=None
            except BaseException as failure:close_error=repr(failure)
            records.append({'path':path,'attempt':1,'closeError':close_error,'registrationFallback':True})
            raise
    def raw_read(path,fd,row):
        raw=b'';offset=0
        while True:
            chunk=os.pread(fd,65536,offset)
            if not chunk:break
            raw+=chunk;offset+=len(chunk)
            if offset>row['bytes']:raise RuntimeError('perfile_size_overflow')
        if len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']:
            raise RuntimeError('EOF_hash_size_changed:'+path)
        if nine(os.fstat(fd))!=row['PRE9'] or nine(os.lstat(path))!=row['PRE9']:
            raise RuntimeError('original_nine_changed:'+path)
        return raw
    try:
        plan=json.loads(plan_raw);stop=json.loads(stop_raw)
        if stop['writers']!='STOPPED' or stop['remainingSourceWrites']!=[]:
            raise RuntimeError('source_writers_not_stopped')
        if hashlib.sha256(plan_raw).hexdigest()!=stop['planSha256']:
            raise RuntimeError('plan_stop_binding')
        canonical={}
        for row in plan['inputs']:
            path=row['path']
            if path in canonical and any(canonical[path][k]!=row[k] for k in ('sha256','bytes','PRE9')):
                raise RuntimeError('conflicting_duplicate_before_open')
            canonical[path]=row
        for path,fd,row in tuple(owned):
            if path in canonical and any(canonical[path][k]!=row[k] for k in ('sha256','bytes','PRE9')):
                raise RuntimeError('bootstrap_duplicate_conflict')
            canonical[path]=row
        if (len(canonical)>4096 or sum(r['bytes'] for r in canonical.values())+plan['priorUnknownOrReservedBytes']>67108864
                or any(type(r['bytes']) is not int or not 0<=r['bytes']<=16777216 for r in canonical.values())):
            raise RuntimeError('one_Source_ledger_overflow')
        existing={p for p,fd,row in owned}
        for path,row in canonical.items():
            if path in existing:continue
            p=Path(path)
            if p.resolve()!=p:raise RuntimeError('alias_path')
            pre=os.lstat(path)
            if (not stat.S_ISREG(pre.st_mode) or pre.st_nlink!=1 or pre.st_uid!=501 or pre.st_gid!=20
                    or nine(pre)!=row['PRE9']):raise RuntimeError('original_PRE9_changed')
            age=time.time_ns()-max(pre.st_mtime_ns,pre.st_ctime_ns)
            if age<240000000000 or time.time_ns()-stop['stoppedUnixNs']<240000000000:
                raise RuntimeError('current_Source_maturity_denial')
            fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);retain(path,fd,row)
            if nine(os.fstat(fd))!=row['PRE9'] or nine(os.lstat(path))!=row['PRE9']:
                raise RuntimeError('OPEN9_changed')
        minimum_age=min(time.time_ns()-max(int(r['PRE9']['mtime_ns']),int(r['PRE9']['ctime_ns'])) for p,fd,r in owned)
        for path,fd,row in owned:
            raw=raw_read(path,fd,row);bodies[path]=raw
            records.append({'path':path,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                            'PRE9':row['PRE9'],'OPEN9':row['PRE9'],'POST9':row['PRE9'],'fullEOF':True})
        modules={}
        for key,path in plan['executionSources'].items():
            if path not in bodies:raise RuntimeError('undeclared_compile')
            module=types.ModuleType('source_adapter_author_'+key);module.__file__=path
            sys.modules[module.__name__]=module
            exec(compile(bodies[path],path,'exec',dont_inherit=True),module.__dict__);modules[key]=module
        result=modules['controls'].run(modules['adapter'],modules['phase'])
        if result['FAIL']:raise RuntimeError('author_controls_failed')
        result.update({'qualifiedAuthorHeldInterval':True,'minimumCaptureAgeNs':minimum_age,
                       'bootstrapAndWholeInputFDCount':len(owned),'sourceMemberBytes':sum(r['bytes'] for p,fd,r in owned),
                       'allSourceFDsBeforeFirstMemberBody':True,'SourceAcceptance':False})
        for path,fd,row in owned:
            raw_read(path,fd,row)
            next(r for r in records if r.get('path')==path and 'fullEOF' in r).update(
                {'FINAL9':row['PRE9'],'PATH_FINAL9':row['PRE9'],'finalFullEOFHash':True})
        (output/'author-held-control-results1.json').write_text(json.dumps(result,indent=2)+'\n')
    except BaseException as error:
        failures.append({'stage':'source_capture_or_controls_or_publication','error':repr(error)})
    finally:
        detached=tuple(owned);owned.clear()
        for path,fd,row in detached:
            try:os.close(fd);error=None
            except BaseException as failure:error=repr(failure);failures.append({'stage':'close:'+path,'error':error})
            records.append({'path':path,'fd':fd,'attempt':1,'closeError':error})
        receipt={'scope':'AUTHOR_HELD_SOURCE_MOCK_ONLY_NO_ROOT_QUALIFICATION','startedUnixNs':started,
                 'finishedUnixNs':time.time_ns(),'records':records,'failures':failures,'result':result,
                 'sameLedgerPriorReservedBytes':plan.get('priorUnknownOrReservedBytes'),'sourceEligibility':False,
                 'effects':0,'allOwnedClosesAttemptedOnce':True}
        (output/'author-held-input-closure1.json').write_text(json.dumps(receipt,indent=2)+'\n')
    if failures:raise RuntimeError('author_interval_failed_no_refresh:'+repr(failures))
    return result
