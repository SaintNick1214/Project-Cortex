"""Finite author declaration builder; not independent Source authority."""
import hashlib
import json
import os
from pathlib import Path
import stat
import time

U=Path(__file__).parent
P=U.parent
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
class RegistrationFailure(BaseException):
    def __init__(self,primary,close_error):
        self.primary=primary;self.close_error=close_error
        super().__init__('registration='+repr(primary)+'; fallbackClose='+repr(close_error))
def nine(st):return {k:str(getattr(st,'st_'+k))for k in FIELDS}
def full(fd,limit):
    blocks=[];offset=0
    while True:
        block=os.pread(fd,65536,offset)
        if not block:break
        offset+=len(block)
        if offset>limit:raise ValueError('original Source per-file cap')
        blocks.append(block)
    return b''.join(blocks)
def run():
    # These are actual author assembly reads and are retained in the declared
    # union. They are not hidden behind supplemental/history labels.
    contexts=['strict-code-reference-rows1.json','current-comparand-acquisition1.json',
              'original-entry-context-acquisition1.json','n2-manifest-context-acquisition1.json']
    expected={}
    for name in contexts:
        doc=json.loads((U/name).read_bytes())
        rows=doc.get('rows',[doc])
        for row in rows:
            if 'path' not in row:continue
            pin={k:row[k]for k in ('path','sha256','bytes','PRE9')}
            if pin['path']in expected and expected[pin['path']]!=pin:raise ValueError('original reference conflict')
            expected[pin['path']]=pin
    own=[f for f in sorted(U.iterdir())if f.is_file()]
    paths=sorted(set(map(str,own))|set(expected));owned=[];errors=[];rows=[]
    try:
        for path in paths:
            fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
            try:owned.append((fd,path))
            except BaseException as primary:
                close_error=None
                try:os.close(fd)
                except BaseException as error:close_error=error
                raise RegistrationFailure(primary,close_error)
        for fd,path in owned:
            pre=nine(os.lstat(path));opened=nine(os.fstat(fd))
            if pre!=opened or not stat.S_ISREG(int(pre['mode']))or pre['uid']!='501'or pre['gid']!='20'or pre['nlink']!='1':raise ValueError('author path/type ownership')
            if time.time_ns()-max(int(pre[k])for k in ('mtime_ns','ctime_ns'))<240000000000:
                raise ValueError('author declaration source not yet240s mature:'+path)
            raw=full(fd,16777216);digest=hashlib.sha256(raw).hexdigest()
            if len(raw)!=int(pre['size'])or nine(os.lstat(path))!=pre or nine(os.fstat(fd))!=pre:raise ValueError('declaration EOF/nine drift')
            row={'path':path,'sha256':digest,'bytes':len(raw),'PRE9':pre,
                 'basis':'NEW_PROSPECTIVE_AUTHOR_SOURCE_PIN'if path not in expected else'STRICT_PRIOR_REFERENCE_PIN'}
            if path in expected and {k:row[k]for k in ('path','sha256','bytes','PRE9')}!=expected[path]:raise ValueError('original source pin drift:'+path)
            rows.append(row)
        if len(rows)+4>4096 or sum(row['bytes']for row in rows)+7340032>67108864:raise ValueError('one cumulative original Source budget with all reserves')
    except BaseException as error:errors.append(repr(error))
    finally:
        handles=owned;owned=[];closes=[]
        for fd,path in handles:
            error=None
            try:os.close(fd)
            except BaseException as exc:error=repr(exc);errors.append('close:'+path+':'+error)
            closes.append({'path':path,'attempt':1,'error':error})
    receipt={'scope':'AUTHOR_PROSPECTIVE_DECLARATION_READS_NOT_SOURCE_ACCEPTANCE',
             'rows':rows,'closes':closes,'errors':errors,'sourceEligibility':False,'effects':0}
    with(U/'source-plan-declaration-receipt1.json').open('x')as output:json.dump(receipt,output,indent=2);output.write('\n')
    if errors:raise RuntimeError('author declaration failed; no plan or STOP published')
    plan={'scope':'TASK03_U3_SOURCE_SEAM_AUTHOR_FINITE_HELD_REPLAY','inputs':rows,
          'executionSources':{'phase':str(P/'task03-f2-close-fence-repair6/phase_partition4.py'),
              'adapter':str(P/'task03-operative-phase-source-adapters2/source_adapters2.py'),
              'successor':str(U/'run-actual-review.py'),'entry':str(U/'actual-entry.py'),
              'controls':str(U/'source-controls2.py')},
          'originalCurrentRunner':str(U/'original-current-u4-runner.py'),
          'sourceEligibility':False,'effects':0,'full129Run':'INCOMPLETE_UNQUALIFIED_EXIT143',
          'N2AndR6':'UNADOPTED_SOURCE_MOCK_ONLY','originalReserves':7340032,
          'declarationReceiptNotMember':'source-plan-declaration-receipt1.json'}
    with(U/'source-input-plan1.json').open('x')as output:json.dump(plan,output,indent=2);output.write('\n')
    raw=(U/'source-input-plan1.json').read_bytes()
    stop={'scope':'U3_AUTHOR_SOURCE_PROGRAMS_WRITERS_STOPPED_FOR_SMALL16_REPLAY',
          'stoppedUnixNs':time.time_ns(),'sourcePlanSha256':hashlib.sha256(raw).hexdigest(),
          'remainingWrites':[],'laterExclusiveOutputs':['held-source-replay1.json','held-entry-close-receipt1.json',
              'entry-bootstrap-close1.json','finite-publication-report1.json','closed-source-reference-manifest1.json',
              'preparation-report1.md','final-writers-stopped1.json'],
          'sourceEligibility':False,'effects':0}
    with(U/'source-writers-stopped1.json').open('x')as output:json.dump(stop,output,indent=2);output.write('\n')
    return {'inputs':len(rows),'memberBytes':sum(row['bytes']for row in rows),'sourcePlanBytes':len(raw),
            'sourcePlanSha256':stop['sourcePlanSha256'],'stoppedUnixNs':stop['stoppedUnixNs']}
if __name__=='__main__':print(json.dumps(run()))
