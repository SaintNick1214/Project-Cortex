"""Finite Source owner for review2. Entry parameters are separately declared.

This owner is compiled from a mature held bootstrap; all later declared member
FDs precede every later member body. Its Source budget retains earlier reviews.
"""
import hashlib
import json
import os
import stat
import time
import types
from pathlib import Path

FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')


def nine(s):return {k:str(getattr(s,'st_'+k)) for k in FIELDS}


def pread(fd):
    chunks=[];offset=0
    while True:
        b=os.pread(fd,65536,offset)
        if not b:break
        chunks.append(b);offset+=len(b)
        if offset>16777216:raise ValueError('SOURCE_FILE_READ_CAP')
    return b''.join(chunks)


def run(bootstrap_held,bootstrap_bodies,declared_rows,runtime_inputs,own_dir,prior_reservation_bytes):
    own_dir=Path(own_dir);held=list(bootstrap_held);bodies=dict(bootstrap_bodies)
    errors=[];primary=None;result=None;closes=[];final_rows=[];started=time.monotonic()
    original_bootstrap_count=len(held)
    def timing():
        if time.monotonic()-started>=48:raise TimeoutError('INDEPENDENT_SOURCE_BODY_48_SECONDS')
    try:
        if type(prior_reservation_bytes) is not int or prior_reservation_bytes<23000000:
            raise ValueError('NONRESETTING_PRIOR_REVIEW_RESERVATION_REQUIRED')
        existing={r['path']:r for r in held}
        for row in declared_rows:
            timing();path=row['path'];pin=row['PRE9']
            if path in existing:
                x=existing[path]
                if (x['pin'],x['bytes'],x['sha256'])!=(pin,row['bytes'],row['sha256']):
                    raise ValueError('NO_CHANGED_NINE_OR_CONTENT_DEDUP')
                continue
            if type(row['bytes']) is not int or not 0<=row['bytes']<=16777216:
                raise ValueError('SOURCE_MEMBER_FILE_CAP')
            if len(held)>=4096:raise ValueError('SOURCE_UNIQUE_AND_LIVE_FD_CAP')
            current=nine(os.lstat(path))
            if current!=pin:raise ValueError(('ORIGINAL_SOURCE_MEMBER_NINE_CHANGED',path,current,pin))
            if not stat.S_ISREG(int(pin['mode'])) or pin['uid']!='501' or pin['gid']!='20' or pin['nlink']!='1':
                raise ValueError('SOURCE_REGULAR_SINGLE_LINK_MAC_OWNER')
            if time.time_ns()-max(int(pin['mtime_ns']),int(pin['ctime_ns']))<240000000000:
                raise ValueError('CURRENT_SOURCE_MEMBER_MATURITY')
            projected=prior_reservation_bytes+sum(x['bytes'] for x in held)+row['bytes']+2097152
            if projected>67108864:raise ValueError('NONRESETTING_SOURCE_AGGREGATE_CAP')
            x={'path':path,'pin':pin,'bytes':row['bytes'],'sha256':row['sha256'],'fd':None,'kind':row.get('kind','MEMBER')}
            held.append(x);existing[path]=x
            fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);x['fd']=fd
            if nine(os.fstat(fd))!=pin:raise ValueError('SOURCE_OPEN_NINE')
        # Every declaration's owned handle exists before the first member body.
        for x in held[original_bootstrap_count:]:
            timing();b=pread(x['fd'])
            if len(b)!=x['bytes'] or hashlib.sha256(b).hexdigest()!=x['sha256']:raise ValueError(('SOURCE_FULL_EOF_HASH_SIZE',x['path']))
            if x['pin']!=nine(os.fstat(x['fd'])) or x['pin']!=nine(os.lstat(x['path'])):raise ValueError('SOURCE_POST_NINE')
            bodies[x['path']]=b
        controls_path=str(own_dir/'reviewer-controls2.py')
        if controls_path not in bodies:raise ValueError('OWN_CONTROLS_NOT_IN_HELD_DECLARATION')
        m=types.ModuleType('qualified_independent_successor_controls');m.__file__=controls_path
        exec(compile(bodies[controls_path],controls_path,'exec',dont_inherit=True),m.__dict__)
        result=m.run(held,bodies,{'runtimeInputs':runtime_inputs},own_dir)
        timing()
    except BaseException as e:primary={'type':type(e).__name__,'message':str(e)}
    finally:
        for x in held:
            if x['fd'] is None:continue
            failure=None;final=None
            try:
                b=pread(x['fd'])
                if len(b)!=x['bytes'] or hashlib.sha256(b).hexdigest()!=x['sha256']:raise ValueError('FINAL_SOURCE_FULL_EOF_HASH_SIZE')
                final=nine(os.fstat(x['fd']))
                if x['pin']!=final or x['pin']!=nine(os.lstat(x['path'])):raise ValueError('FINAL_SOURCE_LITERAL_NINE')
            except BaseException as e:failure={'type':type(e).__name__,'message':str(e)};errors.append(failure)
            final_rows.append({'path':x['path'],'bytes':x['bytes'],'sha256':x['sha256'],'PRE9':x['pin'],'OPEN9':x['pin'],'POST9':x['pin'],'FINAL9':final,'fullEOF':True if failure is None else None,'finalError':failure})
        for x in held:
            fd=x['fd'];x['fd']=None
            if fd is None:continue
            try:os.close(fd);closes.append({'path':x['path'],'attempts':1,'success':True})
            except BaseException as e:closes.append({'path':x['path'],'attempts':1,'success':False,'error':str(e)})
    return {'scope':'INDEPENDENT_REVIEW2_CODE_BEHAVIOR_SOURCE_MOCK_ONLY','result':result,'primary':primary,
      'sourceRows':final_rows,'sourceCloses':closes,'sourceFinalErrors':errors,'heldInputCount':len(held),
      'stagedBootstrapCount':original_bootstrap_count,'allLaterMemberFDsBeforeMemberBodies':primary is None,
      'notAllBeforeFirstBootstrapBody':True,'elapsedSeconds':time.monotonic()-started,
      'cumulativeSourceReservation':{'priorBytes':prior_reservation_bytes,'currentBytes':sum(x['bytes'] for x in held),'singlePublicationDataReservation':2097152,'limit':67108864,'reset':False},
      'sourceEligibility':False,'wholeF2SourceEligibility':False,'runtimeAuthority':False,'DockerRelease':False,
      'actualDockerEffects':0,'actualNetworkEffects':0,'actualPrivateReads':0,'actualLinuxFixture':False,'fullTask03':False,'fullGoal':False}
