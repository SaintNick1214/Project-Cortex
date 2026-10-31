"""Finite author held Source replay. Never independent or protected authority."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import time
import types

FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
CAPS={'paths':4096,'bytes':67108864,'file':16777216,'MF':4194304,'approval':1048576,'DATA':2097152}
class RegistrationFailure(BaseException):
    def __init__(self,primary,close_error):
        self.primary=primary;self.close_error=close_error
        super().__init__('registration='+repr(primary)+'; fallbackClose='+repr(close_error))
def nine(st):return {k:str(getattr(st,'st_'+k)) for k in FIELDS}
def digest(raw):return hashlib.sha256(raw).hexdigest()
def strict(raw):
    def pairs(items):
        result={}
        for k,v in items:
            if k in result:raise ValueError('duplicate JSON key')
            result[k]=v
        return result
    def nonfinite(_):raise ValueError('nonfinite JSON')
    return json.loads(raw,object_pairs_hook=pairs,parse_constant=nonfinite)
def read_full(fd,maximum):
    chunks=[];offset=0
    while True:
        chunk=os.pread(fd,65536,offset)
        if not chunk:break
        offset+=len(chunk)
        if offset>maximum:raise ValueError('over declared body size')
        chunks.append(chunk)
    return b''.join(chunks)
def run(plan_raw,plan_pin,stop_raw,stop_pin,output_path):
    """Header bytes are already held by the exact caller throughout this call."""
    plan=strict(plan_raw);stop=strict(stop_raw);errors=[];owned=[];bodies={};records=[];closes=[];result=None
    if plan['scope']!='TASK03_U3_SOURCE_SEAM_AUTHOR_FINITE_HELD_REPLAY':raise ValueError('wrong scope')
    if stop['remainingWrites']!=[] or stop['sourcePlanSha256']!=digest(plan_raw):raise ValueError('not stopped exact plan')
    rows=plan['inputs'];seen={};total=0
    for r in [plan_pin,stop_pin]+rows:
        if r['path'] in seen:raise ValueError('duplicate physical source path')
        if type(r['bytes']) is not int or not 0<=r['bytes']<=CAPS['file']:raise ValueError('original per file cap')
        if set(r['PRE9'])!=set(FIELDS) or r['PRE9']['size']!=str(r['bytes']):raise ValueError('exact native nine')
        seen[r['path']]=r;total+=r['bytes']
    if len(seen)+3>CAPS['paths'] or total+CAPS['MF']+CAPS['approval']+CAPS['DATA']>CAPS['bytes']:
        raise ValueError('one cumulative source union plus all original reserves')
    try:
        # No member body until every member fd is opened and registered.
        for r in rows:
            fd=os.open(r['path'],os.O_RDONLY|os.O_NOFOLLOW)
            try:owned.append((fd,r))
            except BaseException as primary:
                close_error=None
                try:os.close(fd)
                except BaseException as failure:close_error=failure
                raise RegistrationFailure(primary,close_error)
            observed=nine(os.lstat(r['path']));opened=nine(os.fstat(fd));maximum=max(int(observed[k]) for k in ('mtime_ns','ctime_ns'))
            if observed!=r['PRE9'] or opened!=r['PRE9']:raise ValueError('literal original source nine drift')
            if not stat.S_ISREG(int(observed['mode'])) or observed['nlink']!='1' or observed['uid']!='501' or observed['gid']!='20':raise ValueError('source owner type links')
            if maximum>stop['stoppedUnixNs'] or time.time_ns()-maximum<240000000000:raise ValueError('source not stopped and currently240s mature')
        for fd,r in owned:
            raw=read_full(fd,r['bytes'])
            if len(raw)!=r['bytes'] or digest(raw)!=r['sha256'] or nine(os.lstat(r['path']))!=r['PRE9'] or nine(os.fstat(fd))!=r['PRE9']:
                raise ValueError('source full EOF size hash nine failure')
            bodies[r['path']]=raw;records.append({'path':r['path'],'sha256':r['sha256'],'bytes':r['bytes'],'PRE9':r['PRE9'],
                    'OPEN9':nine(os.fstat(fd)),'fullEOF':True,'POST9':nine(os.lstat(r['path']))})
        modules={}
        for name,path in plan['executionSources'].items():
            module=types.ModuleType('u3_source_held_'+name);sys.modules[module.__name__]=module
            exec(compile(bodies[path],path,'exec',dont_inherit=True),module.__dict__);modules[name]=module
        modules['successor']._SOURCE_RAW=bodies[plan['executionSources']['successor']]
        modules['entry'].__file__=plan['executionSources']['entry']
        outcome=modules['controls'].run(modules['successor'],modules['entry'],modules['adapter'],modules['phase'],bodies[plan['originalCurrentRunner']])
        if outcome['PASS']!=16 or outcome['FAIL']:
            raise AssertionError('16 bounded Source/MOCK conditions failed')
        result={'scope':'AUTHOR_ACTUAL_HELD_U3_SMALL_SOURCE_MOCK_REPLAY_ONLY','conditions':outcome,
                'PASS':16,'FAIL':0,'full129PartitionControls':'INCOMPLETE_UNQUALIFIED_CANCELLED143',
                'sourceEligibility':False,'effects':0}
    except BaseException as error:errors.append({'stage':'capture_or_execution','error':repr(error)})
    finally:
        for fd,r in owned:
            try:
                raw=read_full(fd,r['bytes'])
                if digest(raw)!=r['sha256'] or len(raw)!=r['bytes'] or nine(os.lstat(r['path']))!=r['PRE9'] or nine(os.fstat(fd))!=r['PRE9']:
                    raise ValueError('final fullEOF hash size original nine drift')
                for record in records:
                    if record['path']==r['path']:record['FINAL9']=nine(os.fstat(fd));record['finalFullEOF']=True
            except BaseException as error:errors.append({'stage':'final:'+r['path'],'error':repr(error)})
        # Detach handles before every once-only attempt; no error abandons later handles.
        handles=owned;owned=[]
        for fd,r in handles:
            error=None
            try:os.close(fd)
            except BaseException as failure:error=repr(failure);errors.append({'stage':'close:'+r['path'],'error':error})
            closes.append({'path':r['path'],'attempt':1,'error':error})
    receipt={'scope':'AUTHOR_FINITE_HELD_SOURCE_REPLAY_NO_INDEPENDENT_AUTHORITY','sourcePlanSha256':digest(plan_raw),
             'inputs':records,'inputCount':len(rows),'memberBytes':sum(r['bytes'] for r in rows),
             'cumulativeHeaderMemberBytes':total,'totalWithOriginalReserves':total+7340032,
             'sourceFDPeakIncludingHeldHeadersRunnerAndEntry':len(rows)+4,
             'firstUseRunnerBootstrapHeldSeparatelyBeforeMemberCohort':True,
             'allMemberFDsBeforeThisCohortMemberBodies':True,
             'result':result,'errors':errors,'closes':closes,
             'remainingOwned':len(owned),'sourceEligibility':False,'effects':0}
    # Exclusive new output, never overwrite a failed receipt.
    fd=os.open(output_path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    try:
        raw=(json.dumps(receipt,sort_keys=True,indent=2,allow_nan=False)+'\n').encode();offset=0
        while offset<len(raw):
            wrote=os.write(fd,raw[offset:])
            if wrote<=0:raise OSError('short output write')
            offset+=wrote
        os.fsync(fd)
    finally:os.close(fd)
    if errors:raise RuntimeError('held replay failed; all errors retained in exclusive receipt')
    return receipt
