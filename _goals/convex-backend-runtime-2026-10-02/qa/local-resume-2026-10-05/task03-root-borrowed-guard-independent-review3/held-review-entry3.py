"""Finite independently owned held Source control actor; no external effects."""
import os,time,json,hashlib,stat,types,sys
from pathlib import Path

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
J=P/'task03-root-borrowed-guard-independent-review3'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(s):return dict(zip(FIELDS,map(str,(s.st_dev,s.st_ino,s.st_mode,s.st_uid,s.st_gid,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns))))
def eof(fd):
    parts=[]
    while True:
        chunk=os.read(fd,65536)
        if not chunk:return b''.join(parts)
        parts.append(chunk)
def mod(name,path,raw):
    m=types.ModuleType(name);m.__file__=path;sys.modules[name]=m
    exec(compile(raw,path,'exec',dont_inherit=True),m.__dict__);return m
def main(bootstrap_fds=None):
    began=time.monotonic();headers=[str(J/'review-source-input-plan2.json'),str(J/'review-writers-stopped2.json')]
    rows=[];fds={};bodies={};errors=[];events=[];result=None;ledger=None;owner=object()
    def checked(path,pin=None):
        s=os.lstat(path);now=time.time_ns();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20
        assert s.st_size<=16777216 and now-max(s.st_mtime_ns,s.st_ctime_ns)>=240000000000
        if pin is not None:assert nine(s)==pin
        return {'path':path,'bytes':s.st_size,'PRE9':nine(s),'ageSeconds':(now-max(s.st_mtime_ns,s.st_ctime_ns))/1e9}
    try:
        for path in headers:rows.append(checked(path))
        for row in rows:
            fd=os.open(row['path'],os.O_RDONLY|os.O_NOFOLLOW);fds[row['path']]=fd;row['OPEN9']=nine(os.fstat(fd));assert row['OPEN9']==row['PRE9'];events.append({'event':'header_open','path':row['path']})
        for row in rows:
            raw=eof(fds[row['path']]);assert len(raw)==row['bytes'];row['sha256']=hashlib.sha256(raw).hexdigest();row['fullEOF']=True;row['POST9']=nine(os.fstat(fds[row['path']]));assert row['POST9']==row['PRE9'];bodies[row['path']]=raw;events.append({'event':'header_body','path':row['path']})
        plan=json.loads(bodies[headers[0]]);stop=json.loads(bodies[headers[1]])
        assert stop['remainingWrites']==[] and stop['planSha256']==rows[0]['sha256'] and stop['planBytes']==rows[0]['bytes']
        assert time.time_ns()-int(stop['stoppedUnixNs'])>=240000000000
        members=plan['members'];assert len(members)==len({m['path']for m in members});assert not set(headers)&{m['path']for m in members}
        for m in members:
            row=checked(m['path'],m['PRE9']);assert row['bytes']==m['bytes'];row['sha256']=m['sha256'];row['basis']=m['basis'];rows.append(row)
        assert len(rows)<=4096 and sum(r['bytes']for r in rows)+7340032<=67108864
        assert time.monotonic()-began<=30
        for row in rows[2:]:
            fd=os.open(row['path'],os.O_RDONLY|os.O_NOFOLLOW);fds[row['path']]=fd;row['OPEN9']=nine(os.fstat(fd));assert row['OPEN9']==row['PRE9'];events.append({'event':'member_open','path':row['path']})
        body_start=time.monotonic()
        for row in rows[2:]:
            raw=eof(fds[row['path']]);assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'];row['fullEOF']=True;row['POST9']=nine(os.fstat(fds[row['path']]));assert row['POST9']==row['PRE9'] and nine(os.lstat(row['path']))==row['PRE9'];bodies[row['path']]=raw;events.append({'event':'member_body','path':row['path']})
        paths=plan['paths'];phase=mod('independent_G3_injected_unadopted_R8',paths['phase'],bodies[paths['phase']]);ledger=phase.Ledger(plan.get('inheritedReadDebts',()))
        # Native Source/bootstrap FDs stay held through this actor and share
        # this exact ledger. They close separately after this actor returns.
        if bootstrap_fds is not None:
            for fd in bootstrap_fds:
                ledger.own_fd(fd,owner)
        for row in rows:
            admission={'path':str(Path(row['path']).relative_to(R)),'bytes':row['bytes'],'sha256':row['sha256'],'nine':row['PRE9'],
                       'roles':['program']if row['path'].endswith('.py')else['document'],'nineBasis':'HELD_REVIEW_GRAPH_ACTUAL_SOURCE_BODY_DEBT'}
            ledger.admit(admission,debt=True,reason='INDEPENDENT_HELD_SOURCE_HEADER_BODY_IMPORT_COMPILE_DEBT')
            ledger.own_fd(fds[row['path']],owner)
        controls=mod('independent_G3_own_controls1',paths['ownControls'],bodies[paths['ownControls']])
        result=controls.run(bodies,paths,str(J),ledger,phase)
        assert time.monotonic()-body_start<=48 and time.monotonic()-began<=190
    except BaseException as error:errors.append({'stage':'primary','type':type(error).__name__,'error':str(error)})
    finally:
        for row in rows:
            path=row['path']
            if path not in fds:continue
            try:
                os.lseek(fds[path],0,os.SEEK_SET);raw=eof(fds[path]);assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']
                row['finalEOF']=True;row['finalBytes']=len(raw);row['finalSha256']=hashlib.sha256(raw).hexdigest();row['FINAL9']=nine(os.fstat(fds[path]));assert row['FINAL9']==row['PRE9'] and nine(os.lstat(path))==row['PRE9']
            except BaseException as error:errors.append({'stage':'final','path':path,'type':type(error).__name__,'error':str(error)})
        for row in rows:
            path=row['path']
            if path not in fds:continue
            success=False
            try:os.close(fds[path]);row['onceCloseCount']=1;row['closeSuccess']=True;success=True
            except BaseException as error:errors.append({'stage':'close','path':path,'type':type(error).__name__,'error':str(error)})
            finally:
                if ledger is not None and ledger.owned_fds.get(fds[path])is owner:
                    try:ledger.release_fd(fds[path],owner,success)
                    except BaseException as error:errors.append({'stage':'ledger_close','path':path,'type':type(error).__name__,'error':str(error)})
    output={'scope':'INDEPENDENT_G3_CODE_HOST_ONLY','stagedHeaderDiscovery':True,'allMemberFDsBeforeMemberBodies':True,'sourceCount':len(rows),'sourceBytes':sum(r['bytes']for r in rows),
            'sourceRecords':rows,'events':events,'results':result,'errors':errors,'elapsedSeconds':time.monotonic()-began,'SourceEligibility':False,'functionalAcceptance':False,
            'candidateWrites':0,'protectedEffects':0,'globalLedger':None if ledger is None else{'paths':len(ledger.paths),'byteCount':ledger.byte_count,'readDebts':len(ledger.read_debts),'unknownFromIntentionalFinalCloseControl':ledger.unknown_close,'remainingOwnedFDs':len(ledger.owned_fds)}}
    path=J/'independent-held-results2.json';assert not path.exists()
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o644)
    try:
        raw=(json.dumps(output,indent=2,sort_keys=True)+'\n').encode();offset=0
        while offset<len(raw):written=os.write(fd,raw[offset:]);assert written>0;offset+=written
        os.fsync(fd)
    finally:os.close(fd)
    brief={'sourceCount':len(rows),'sourceBytes':output['sourceBytes'],'minAgeSeconds':min(r['ageSeconds']for r in rows),'elapsedSeconds':output['elapsedSeconds'],'errors':errors,
           'onceCloses':sum(r.get('onceCloseCount',0)for r in rows),'globalLedger':output['globalLedger']}
    if result is not None:
        brief.update({'original18Failures':[r for r in result['original18']if not r.get('PASS',r.get('status')=='PASS')],
                      'original71Failures':[r for r in result['original71']if not r.get('PASS',r.get('status')=='PASS')],
                      'original14Failures':[r for r in result['original14']if not r.get('PASS',r.get('status')=='PASS')],
                      'author19Failures':[r for r in result['author19']if not r.get('PASS',r.get('status')=='PASS')],
                      'independentCount':result['independentCount'],'independentPassed':result['independentPassed'],'independentFailed':result['independentFailed'],
                      'independentFailures':[r for r in result['independent']if not r['PASS']]})
    print(json.dumps(brief,indent=2));return output,ledger,owner
