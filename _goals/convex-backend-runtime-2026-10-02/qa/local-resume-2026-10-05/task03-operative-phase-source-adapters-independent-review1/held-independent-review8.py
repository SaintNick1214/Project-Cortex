"""Finite held reviewer Source capture and independent control executor."""
import os,stat,time,json,hashlib,traceback
from pathlib import Path
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
ATTRS=('st_dev','st_ino','st_mode','st_uid','st_gid','st_nlink','st_size','st_mtime_ns','st_ctime_ns')
def nine(s):return dict(zip(FIELDS,(str(getattr(s,k)) for k in ATTRS)))
def digest(raw):return hashlib.sha256(raw).hexdigest()
def run(root,review,output):
    R=Path(root);J=Path(review);P=J.parent;N=P/'task03-operative-phase-source-adapters1';E=N/'prospective-document-epoch2'
    started=time.monotonic();owned=[];rows=[];bodies={};events=[];failures=[];result=None;mf=None;controls_start=None
    limits={'files':4096,'bytes':67108864,'file':16777216,'singleDATA':2097152,'bodyDeadlineSeconds':48,'globalDeadlineSeconds':190}
    def deadline():
        if time.monotonic()-started>190:raise TimeoutError('REVIEW_GLOBAL_190S')
        if controls_start is not None and time.monotonic()-controls_start>48:raise TimeoutError('REVIEW_BODY_CONTROLS_48S')
    def path_physical(path):
        p=Path(path)
        if not p.is_absolute():p=R/p
        if p.resolve()!=p:raise ValueError('SYMLINK_OR_NORMALIZATION_CHANGED_PATH')
        return str(p)
    def open_row(path,size,sha,pin,basis,stop_ns=None):
        deadline();path=path_physical(path)
        if any(x['path']==path for x in rows):raise ValueError('DUPLICATE_PHYSICAL_NOT_SILENT_DEDUP')
        pre=os.lstat(path);now=time.time_ns();actual=nine(pre)
        if not stat.S_ISREG(pre.st_mode) or pre.st_nlink!=1 or pre.st_uid!=501 or pre.st_gid!=20:raise ValueError('PHYSICAL_OWNER_LINK_REGULAR')
        if actual!=pin:raise ValueError('DECLARED_NINE_CHANGED:'+path)
        if pre.st_size!=size or size>16777216:raise ValueError('SOURCE_FILE_SIZE_CAP')
        if now-max(pre.st_mtime_ns,pre.st_ctime_ns)<240000000000:raise ValueError('CURRENT_MAX_MTIME_CTIME_LT240:'+path)
        if stop_ns is not None and max(pre.st_mtime_ns,pre.st_ctime_ns)>stop_ns:raise ValueError('FILE_MODIFIED_AFTER_WRITER_STOP:'+path)
        if len(owned)>=4096 or sum(x['bytes'] for x in rows)+size>67108864:raise ValueError('LOCAL_SOURCE_UNION_CAP_BEFORE_OPEN')
        fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);record={'path':path,'bytes':size,'sha256':sha,'PRE9':pin,'OPEN9':None,'basis':basis,'minimumAgeSeconds':(now-max(pre.st_mtime_ns,pre.st_ctime_ns))/1e9,'fd':fd,'closeCount':0}
        owned.append((fd,record));rows.append(record);events.append({'event':'OPEN','path':path,'fd':fd});record['OPEN9']=nine(os.fstat(fd))
        if record['OPEN9']!=pin:raise ValueError('OPEN_NINE_CHANGED:'+path)
        return fd,record
    def read_row(fd,row,stage):
        deadline();raw=b'';offset=0
        while True:
            deadline();chunk=os.pread(fd,262144,offset)
            if not chunk:break
            raw+=chunk;offset+=len(chunk)
            if len(raw)>row['bytes']:raise ValueError('EOF_OVERRUN:'+row['path'])
        post=nine(os.fstat(fd));events.append({'event':'FULL_EOF','path':row['path'],'stage':stage,'bytes':len(raw)})
        if len(raw)!=row['bytes'] or digest(raw)!=row['sha256'] or post!=row['PRE9']:raise ValueError('EOF_HASH_SIZE_POST_NINE:'+row['path'])
        row['POST9']=post;row['fullEOF']=True;bodies[row['path']]=raw;return raw
    def current(path,size,sha,basis):
        p=Path(path);pre=os.lstat(p);return open_row(p,size,sha,nine(pre),basis)
    try:
        # Source entry is separately held by native bootstrap. Re-open it in
        # this full cohort so it remains held through all actual code use.
        own_names=('held-independent-review8.py','independent-controls6.py','independent-controls7.py','reviewer-fd-observer2.py','reviewer-fixture-module1.py','reviewer-fixture-data1.json','controls-writers-stopped6.json','controls-writers-stopped7.json','reviewer-observer-writers-stopped2.json','reviewer-source-writers-stopped1.json')
        own=[]
        for name in own_names:
            p=J/name;pre=os.lstat(p)
            # Native setup gives the exact pre-open digest; code pin fidelity
            # is independently checked against held STOP documents below.
            own.append(open_row(p,pre.st_size,None,nine(pre),'OWN_CURRENT_STOPPED_SOURCE_PROSPECTIVE'))
        # All own FDs before any own Source bytes. Set digest via one full
        # EOF under exact stable nine, then verify against STOP named pins.
        for fd,row in own:
            raw=b'';offset=0
            while True:
                deadline();x=os.pread(fd,262144,offset)
                if not x:break
                raw+=x;offset+=len(x)
            row['sha256']=digest(raw);row['POST9']=nine(os.fstat(fd));row['fullEOF']=True
            if len(raw)!=row['bytes'] or row['POST9']!=row['PRE9']:raise ValueError('OWN_EOF_NINE')
            bodies[row['path']]=raw;events.append({'event':'FULL_EOF','path':row['path'],'stage':'OWN_SOURCE','bytes':len(raw)})
        for stopname in ('controls-writers-stopped6.json','controls-writers-stopped7.json','reviewer-observer-writers-stopped2.json'):
            doc=json.loads(bodies[str(J/stopname)]);p=doc['source'];raw=bodies[p]
            if len(raw)!=doc['bytes'] or digest(raw)!=doc['sha256']:raise ValueError('OWN_STOP_SOURCE_PIN_CHANGED')
            rr=next(x for x in rows if x['path']==p)
            if max(int(rr['PRE9']['mtime_ns']),int(rr['PRE9']['ctime_ns']))>doc['stoppedAtUnixNs']:raise ValueError('OWN_SOURCE_NOT_STOPPED')
        headers=[]
        for name,size,sha in (
          ('closed-input-reference-manifest2.json',39128,'3da5f0d404bc449dd1441aad6beb22a45388cd79c781ca6aded4daf069a1e38a'),
          ('final-writers-stopped2.json',3638,'2530be1ab71957806feb65d45e17f017c74f0aa927ed99f68a7e16e12bc995ed')):
            headers.append(current(E/name,size,sha,'PROSPECTIVE_MATURE_HEADER_DISCOVERY_NOT_FIRST_ALL_FD_CLAIM'))
        mf=json.loads(read_row(*headers[0],'HEADER_DISCOVERY'));stopdoc=json.loads(read_row(*headers[1],'HEADER_DISCOVERY'))
        stop_ns=1791425131397080000
        if time.time_ns()-stop_ns<240000000000:raise ValueError('PUBLISHER_STOP_LT240')
        declarations=mf['members'];events.append({'event':'DECLARED_MEMBER_STAGE_START','count':len(declarations)})
        if len(declarations)!=43 or sum(r['bytes'] for r in declarations)!=594245:raise ValueError('FINITE_REFERENCE_COUNT_BYTES_CHANGED')
        changed={str(E/'native-author-entry2.txt'):'1791425131443096826',str(E/'preparation-report2.json'):'1791425131445134333'}
        member=[]
        for declared in declarations:
            path=path_physical(declared.get('physicalPath',declared['path']));pin=dict(declared['PRE9']);basis='STRICT_ORIGINAL_AUTHOR_PIN'
            if path in changed:
                pin['ctime_ns']=changed[path];basis='NEW_CURRENT_DOCUMENTARY_ADMISSION_OLD_INTERVAL_FAILED_UNKNOWN'
            member.append(open_row(path,declared['bytes'],declared['sha256'],pin,basis,stop_ns if path not in changed else None))
        events.append({'event':'ALL_43_MEMBER_FD_ACQUIRED_BEFORE_ANY_MEMBER_BODY'})
        controls_start=time.monotonic()
        for fd,row in member:read_row(fd,row,'MEMBER_BODIES')
        paths={'adapter':str(N/'source_adapters1.py'),'api':str(P/'task03-f2-phase-contract-repair5'/'phase_partition3.py')}
        ns={};codepath=str(J/'independent-controls7.py');exec(compile(bodies[codepath],codepath,'exec',dont_inherit=True),ns)
        result=ns['run'](bodies,paths,str(J));deadline()
    except BaseException as e:
        failures.append({'stage':'capture_or_controls','type':type(e).__name__,'error':str(e),'traceback':traceback.format_exc()})
    finally:
        # Final EOF/hash and literal final nine while every Source FD remains
        # held, then all owned FDs receive exactly one close, even failure.
        for fd,row in owned:
            try:
                raw=b'';offset=0
                while True:
                    x=os.pread(fd,262144,offset)
                    if not x:break
                    raw+=x;offset+=len(x)
                    if len(raw)>row['bytes']:raise ValueError('FINAL_EOF_OVERRUN')
                row['FINAL9']=nine(os.fstat(fd));row['finalBytes']=len(raw);row['finalSha256']=digest(raw)
                if len(raw)!=row['bytes'] or row['FINAL9']!=row['PRE9'] or (row['sha256'] is not None and digest(raw)!=row['sha256']):raise ValueError('FINAL_EOF_HASH_SIZE_NINE')
                row['finalEOF']=True
            except BaseException as e:failures.append({'stage':'final_source:'+row['path'],'type':type(e).__name__,'error':str(e)})
        for fd,row in owned:
            row['closeCount']+=1
            try:os.close(fd);row['closeSuccess']=True
            except BaseException as e:row['closeSuccess']=False;failures.append({'stage':'owned_source_close:'+row['path'],'type':type(e).__name__,'error':str(e)})
            events.append({'event':'CLOSE','path':row['path'],'fd':fd})
    packet={'scope':'INDEPENDENT_CODE_BEHAVIOR_HOST_SOURCE_ONLY','elapsedSeconds':time.monotonic()-started,'limits':limits,'failures':failures,'sourceRows':rows,'events':events,'ownedCloseCount':sum(r['closeCount'] for r in rows),'actualSourceCount':len(rows),'actualSourceBytes':sum(r['bytes'] for r in rows),'results':result,'oldE2PublicationFailuresPreserved':True,'distinctCurrentDocumentaryAdmissions':list(changed) if mf is not None else [],'additionalChangedVersionDebtBytes':9556,'earlierChangedVersionDebtBytes':10206,'refundOrReset':False,'wholeRootSharedSourceCensus':'PENDING_UNKNOWN_NOT_THIS_LOCAL_COHORT','sourceEligibility':False,'functionalAcceptance':False,'effects':0}
    Path(output).write_text(json.dumps(packet,indent=2,sort_keys=True)+'\n');return packet
