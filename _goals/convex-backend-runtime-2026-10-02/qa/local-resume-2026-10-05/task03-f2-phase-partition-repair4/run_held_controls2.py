"""Author-only mature held-code controls; bootstrap/publishers excluded.

The interpreter reads this runner before its four-member control cohort is
captured. That enabling read remains chargeable and is NOT Source qualified by
this runner. Independent later Root capture/review must include this runner,
its results, final pins/STOP and every other required packet input.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import sys
import time

sys.dont_write_bytecode=True
OWN=Path(__file__).absolute().parent
ROOT=OWN.parents[4]
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
NAMES=('phase_partition2.py','partition_controls2.py','prepare_partition.py','source_edge_probe.py')

def nine(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def encode(value):return (json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
def publish(name,value):
    with open(OWN/name,'xb')as out:out.write(encode(value))


def main():
    header=OWN/'source-code-writers-stopped2.json'
    hfd=os.open(header,os.O_RDONLY|os.O_NOFOLLOW);hpin=nine(os.fstat(hfd));hraw=b''
    try:
        while True:
            chunk=os.read(hfd,65536)
            if not chunk:break
            hraw+=chunk
        assert hpin==nine(os.fstat(hfd))==nine(os.lstat(header))
    finally:os.close(hfd)
    stop=json.loads(hraw);assert stop['sourceWriters']=='STOPPED' and stop['remainingCodeWrites']==[]
    assert stop['members']==list(NAMES)
    now=time.time_ns();assert now-int(stop['stoppedUnixNs'])>=240000000000
    held=[];rows=[];events=[];closes=[];failure=None;result=None;content={}
    try:
        for name in NAMES:
            path=OWN/name;pre=os.lstat(path);pin=nine(pre)
            assert max(pre.st_mtime_ns,pre.st_ctime_ns)<=int(stop['stoppedUnixNs'])
            assert now-max(pre.st_mtime_ns,pre.st_ctime_ns)>=240000000000
            fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);held.append((name,path,pin,fd))
            assert pin==nine(os.fstat(fd))==nine(os.lstat(path))
        events.append({'event':'ALL4_CODE_FDS_BEFORE_FIRST_CODE_MEMBER_BODY','count':len(held),
                       'headerDiscoveryBeforeMemberCaptureDisclosed':True})
        def qualify(name,path,pin,fd):
            chunks=[];offset=0
            while True:
                chunk=os.pread(fd,65536,offset)
                if not chunk:break
                offset+=len(chunk);chunks.append(chunk)
            raw=b''.join(chunks);assert len(raw)==int(pin['size'])
            assert pin==nine(os.fstat(fd))==nine(os.lstat(path))
            return raw,{'path':str(path.relative_to(ROOT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                        'PRE9':pin,'OPEN9':pin,'POST9':pin,'pathPOST9':pin,'fullEOF':True,
                        'currentAgeSeconds':(now-max(int(pin['mtime_ns']),int(pin['ctime_ns'])))/1e9,
                        'phase':'SOURCE','sourceQualification':False}
        for name,path,pin,fd in held:
            raw,row=qualify(name,path,pin,fd);content[name]=raw;rows.append(row)
        # Load exact held partition bytes. The controls module's finite import
        # loader is intercepted so that it reuses these same qualified bytes.
        part=type(sys)('prospective_phase_partition');part.__file__=str(OWN/'phase_partition2.py');part.__package__=''
        sys.modules[part.__name__]=part
        exec(compile(content['phase_partition2.py'],part.__file__,'exec',dont_inherit=True),part.__dict__)
        original_spec=importlib.util.spec_from_file_location
        class HeldLoader:
            def create_module(self,_spec):return part
            def exec_module(self,module):assert module is part
        def held_spec(name,location,*args,**kwargs):
            assert Path(location)==OWN/'phase_partition2.py'
            return importlib.util.spec_from_loader(name,HeldLoader(),origin=str(location))
        importlib.util.spec_from_file_location=held_spec
        try:
            controls=type(sys)('held_partition_controls');controls.__file__=str(OWN/'partition_controls2.py');controls.__package__=''
            exec(compile(content['partition_controls2.py'],controls.__file__,'exec',dont_inherit=True),controls.__dict__)
            result=controls.run_controls()
        finally:importlib.util.spec_from_file_location=original_spec
        assert result['passed']==result['executed']==result['discovered'] and result['failed']==result['skipped']==0
        events.append({'event':'MOCK_CONTROLS_AND_OWNED_FIXTURE_CLEANUP_COMPLETE_WITH4_CODE_FDS_RETAINED'})
        for name,path,pin,fd in held:
            raw,row=qualify(name,path,pin,fd);assert raw==content[name]
            assert row['sha256']==next(r['sha256']for r in rows if r['path']==str(path.relative_to(ROOT)))
        events.append({'event':'FINAL_FULL_EOF_HASH_SIZE_LITERAL9_ALL4_HELD'})
    except BaseException as error:
        failure={'type':type(error).__name__,'error':str(error)}
    finally:
        for name,path,_,fd in held:
            try:os.close(fd);error=None
            except BaseException as exception:error=type(exception).__name__
            closes.append({'path':str(path.relative_to(ROOT)),'attempt':1,'error':error})
    publish('poststop-held-control-results5.json',{
       'scope':'AUTHOR_ONLY_REAL_MATURE_4_CODE_HOLD_WITH_SOURCE_MOCK_CONTROLS_NOT_SOURCE_GRAPH_ACCEPTANCE',
       'STOPHeader':{'path':str(header.relative_to(ROOT)),'bytes':len(hraw),'sha256':hashlib.sha256(hraw).hexdigest(),
                     'PRE9':hpin,'fullEOF':True,'closeAttempts':1},
       'STOPAgeSeconds':(now-int(stop['stoppedUnixNs']))/1e9,'rows':rows,'events':events,
       'closeAttempts':closes,'closeErrors':sum(c['error']is not None for c in closes),
       'controlResult':result,'failure':failure,'bootstrapRunnerBodyReadIsUnqualifiedSourceDebt':True,
       'entirePacketGraphQualified':False,'independentReview':False,'sourceEligibility':False,'effects':0})
    if failure:raise RuntimeError(str(failure))
    if any(c['error']for c in closes):raise RuntimeError('close_errors')
    print(json.dumps({'passed':result['passed'],'heldCodeFiles':len(rows),
                       'minimumCurrentAgeSeconds':min(r['currentAgeSeconds']for r in rows),
                       'onceCloses':len(closes),'closeErrors':0,'sourceEligibility':False,'effects':0}))


if __name__=='__main__':main()
