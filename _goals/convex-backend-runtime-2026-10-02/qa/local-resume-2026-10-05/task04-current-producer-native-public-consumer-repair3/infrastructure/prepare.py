"""Finite preparation from held mature source bytes; no subject dispatch."""
import ast,hashlib,json,math,os,stat,time
from pathlib import Path
N=Path(__file__).resolve().parents[1];P=N.parent;R=P.parents[3]
OLD=P/'task04-current-producer-native-public-repair1'
C4=P/'task04-current-producer-native-public-consumer-repair2'
J=P/'task04-current-producer-native-public-consumer-repair2-source-review3'
NEW=P/'task04-current-producer-native-public-repair3'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def put(path,raw):
    if not isinstance(raw,bytes):raw=(json.dumps(raw,sort_keys=True,separators=(',',':'))+'\n').encode()
    assert len(raw)<=16777216
    path.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(path,os.O_RDWR|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        view=memoryview(raw)
        while view:
            count=os.write(fd,view);assert count>0;view=view[count:]
        os.fsync(fd);pin=ident(os.fstat(fd));os.lseek(fd,0,0);parts=[]
        while block:=os.read(fd,65536):parts.append(block)
        assert b''.join(parts)==raw and ident(os.fstat(fd))==pin and ident(path.lstat())==pin
    finally:os.close(fd)
    return {'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'writeReadbackNotInputAuthority':True,'selfExcludedUpstream':True}
paths=sorted(set([p for p in (OLD/'source').rglob('*')if p.is_file()]+[p for p in (OLD/'evidence/preimages').rglob('*')if p.is_file()]+[p for p in C4.rglob('*')if p.is_file()]+[p for p in J.rglob('*')if p.is_file()]+[OLD/'task04-current-producer-native-public.yml.proposed',OLD/'admission-proposal.json',OLD/'qualification-map.json',OLD/'evidence/original-conservation-proof1.json',P/'root-task04-native-consumer-repair2-source-review3-mature-readback1.json']))
held=[];data={};rows=[];total=0;closes=[]
try:
    # All descriptors in this finite preparation phase precede every content read.
    for p in paths:
        before=ident(p.lstat());age=time.time_ns()-max(int(before['mtime_ns']),int(before['ctime_ns']))
        assert age>=60000000000 and before['nlink']=='1'and stat.S_ISREG(int(before['mode']))
        total+=int(before['size']);assert total<=67108864 and int(before['size'])<=16777216 and len(held)<4096
        fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);held.append((p,fd,before,age));assert ident(os.fstat(fd))==before
    for p,fd,before,age in held:
        parts=[]
        while b:=os.read(fd,65536):parts.append(b)
        raw=b''.join(parts);assert len(raw)==int(before['size'])and ident(os.fstat(fd))==before and ident(p.lstat())==before
        data[str(p)]=raw;rows.append({'path':str(p),'PRE':before,'OPEN':before,'POST':before,'heldFD':fd,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'EOF':True,'ageNsAtFirstOpen':age})
    mf=json.loads(data[str(OLD/'source/source-manifest.json')]);assert len(mf['files'])==112 and mf['sourceBytes']==2136695
    for row in mf['files']:
        raw=data[str(OLD/'source'/row['path'])];assert (len(raw),hashlib.sha256(raw).hexdigest())==(row['bytes'],row['sha256'])
    pub=data[str(OLD/'source/public_export_contract.py')].decode()
    pub=pub.replace("    for key in ('fileCount'", "    if data['primaryFailure'] is not None and type(data['primaryFailure']) is not str:\n        raise ValueError('STRICT_PUBLIC_PRIMARY_FAILURE_NONE_OR_STRING')\n    for key in ('fileCount'",1)
    pub+='''

def validate_public_outcome(data,process_exit,result=None):
    """Transported failures remain data; only consistent exact success is accepted."""
    validate_public(data)
    if type(process_exit) is not int or not 0<=process_exit<=255:
        raise ValueError('STRICT_PUBLIC_PROCESS_EXIT')
    if process_exit!=0:raise ValueError('PUBLIC48_FAILED_STICKY')
    if data['primaryFailure'] is not None:raise ValueError('PUBLIC48_MANIFEST_FAILURE_STICKY')
    required={'scope','controls','count','nativeClaims','original122','ROOT','whole120'}
    if type(result) is not dict or not required<=set(result):raise ValueError('EXACT_UNCHANGED48_PUBLIC_OUTCOMES')
    if result['scope']!='PUBLIC_SYNTHETIC_SOURCE_CONTROLS_ONLY' or result['nativeClaims'] is not False or result['original122']!='HELD' or result['ROOT']!='ABSENT' or result['whole120']!='HELD':
        raise ValueError('EXACT_UNCHANGED48_PUBLIC_SCOPE')
    if type(result['count']) is not int or result['count']!=48 or type(result['controls']) is not list or len(result['controls'])!=48:
        raise ValueError('EXACT_UNCHANGED48_PUBLIC_OUTCOMES')
    names=[]
    for row in result['controls']:
        if type(row) is not dict or type(row.get('name')) is not str or not row['name'] or type(row.get('status')) is not str or row['status']!='PASS':
            raise ValueError('EXACT_UNCHANGED48_PUBLIC_OUTCOMES')
        names.append(row['name'])
    if len(set(names))!=48:raise ValueError('EXACT_UNCHANGED48_PUBLIC_UNIQUE_NAMES')
    return {'processExit':0,'primaryFailure':None,'count':48,'scope':'PUBLIC_SOURCE_MOCK_OUTCOME_ONLY','nativeAuthority':False}
'''
    ci=data[str(OLD/'source/ci-run.py')].decode()
    ci=ci.replace('from public_export_contract import validate_public','from public_export_contract import validate_public,validate_public_outcome')
    ci=ci.replace('def export_phase(mode):','def export_phase(mode,process_exit=None):')
    ci=ci.replace("    export_copy(remote,target,16777216 if mode=='native20'else 65536)","    public_terminal=None\n    if mode=='public48':public_terminal=public_terminal_fence(process_exit)\n    export_copy(remote,target,16777216 if mode=='native20'else 65536)")
    ci=ci.replace('    copied=[];remote_targets={}\n','    copied=[];remote_targets={};remote_pins={}\n')
    ci=ci.replace('        remote_targets[path]=target\n','        remote_targets[path]=target;remote_pins[path]=row[\'current\']\n')
    begin=ci.index("    if mode=='public48'and data['primaryFailure'] is None:")
    end=ci.index('    remaining();COMBINED_EXPORT_BYTES',begin)
    ci=ci[:begin]+'''    if mode=='public48':
        result=None
        if type(process_exit) is int and process_exit==0 and data['primaryFailure'] is None:
            path='/var/tmp/task04-c8-current-canonical-input-producers/controls/linux-public-repair2/results.json'
            if path not in remote_targets:raise ValueError('EXACT_UNCHANGED48_PUBLIC_RESULT_REQUIRED')
            # This independently held read retains the transport byte/hash pin and
            # fences full bytes and all nine fields before and after strict parse.
            h=Held(str(remote_targets[path]),1048576,remote_pins[path])
            try:
                os.lseek(h.fd,0,os.SEEK_SET);raw=os.read(h.fd,1048577)
                if len(raw)!=h.size:raise ValueError('PUBLIC_RESULT_FULL_EOF')
                h.fence(full=True);result=strict(raw);h.fence(full=True)
            finally:h.close()
        remaining()
        if public_terminal_fence(process_exit)!=public_terminal:raise ValueError('PUBLIC_TERMINAL_EXPORT_RACE')
        validate_public_outcome(data,process_exit,result)
'''+ci[end:]
    ci=ci.replace("    export_phase('public48')","    export_phase('public48',process_exit=public_exit)")
    marker='\ndef export_phase(mode,process_exit=None):'
    ci=ci.replace(marker,'''
def public_terminal_fence(process_exit):
    if type(process_exit) is not int or not 0<=process_exit<=255:raise ValueError('STRICT_PUBLIC_PROCESS_EXIT')
    row=inspect();validate(row,EXPECTED,started=True)
    state=row['State']
    if state['Running'] is not False or type(state['Pid']) is not int or state['Pid']!=0 or state['Status']!='exited' or type(state['ExitCode']) is not int or state['ExitCode']!=process_exit:
        raise ValueError('PUBLIC_PROCESS_TERMINAL_EXPORT_INCONSISTENCY')
    remaining();return row
'''+marker)
    deltas=[];newmf=[]
    for row in mf['files']:
        raw=data[str(OLD/'source'/row['path'])]
        if row['path']=='public_export_contract.py':raw=pub.encode()
        if row['path']=='ci-run.py':raw=ci.encode()
        pin=put(NEW/'source'/row['path'],raw);newmf.append({k:pin[k]for k in ('bytes','sha256')}|{'path':row['path']})
        if pin['sha256']!=row['sha256']:deltas.append({'path':row['path'],'old':row,'new':newmf[-1]})
    assert [r['path']for r in deltas]==['ci-run.py','public_export_contract.py']
    put(NEW/'source/source-manifest.json',{**mf,'files':newmf,'sourceBytes':sum(r['bytes']for r in newmf)})
    workflow=data[str(OLD/'task04-current-producer-native-public.yml.proposed')].decode().replace(OLD.name,NEW.name)
    put(NEW/'task04-current-producer-native-public.yml.proposed',workflow.encode())
    put(NEW/'admission-proposal.json',data[str(OLD/'admission-proposal.json')])
    put(NEW/'qualification-map.json',data[str(OLD/'qualification-map.json')])
    put(NEW/'semantic-delta.json',{'schema':'R1_SEPARATELY_OWNED_REPAIR3_SEMANTIC_DELTA','changedExecutableFiles':deltas,'sourceFileCount':112,'unchangedFiles':110,'original100Conserved':True,'bootstrapPublic48OWN20Unchanged':True,'oldPinsRefreshed':False,'deadlinesResourcesAssertionsChanged':False,'runtimeAuthority':False,'sourceEligibility':False,'workflow':'TOP_LEVEL_PROPOSED_ONLY'})
    proof=json.loads(data[str(OLD/'evidence/original-conservation-proof1.json')])
    for row in proof['rows']:
        raw=data[str(OLD/row['newExactConservationBacking'])]
        assert (len(raw),hashlib.sha256(raw).hexdigest())==(row['bytes'],row['sha256'])
        assert row['newExactConservationBacking'] not in ('source/ci-run.py','source/public_export_contract.py')
    put(NEW/'original100-conservation-reference.json',{'originalCount':100,'originalProof':{'path':str(OLD/'evidence/original-conservation-proof1.json'),'bytes':len(data[str(OLD/'evidence/original-conservation-proof1.json')]),'sha256':hashlib.sha256(data[str(OLD/'evidence/original-conservation-proof1.json')]).hexdigest()},'rows':proof['rows'],'copyScope':'ONLY_FINITE112_EXECUTABLE_PROPOSAL','oldLiteralPinsUntouched':True,'historicalCustodyRepaired':False})
    for rel in ('independent-r1-controls.py','independent-r1-extra-controls.py'):
        raw=data[str(J/rel)].decode().replace('INDEPENDENT_SOURCE_MOCK','EXECUTOR_SOURCE_MOCK_REPLAY').replace('INDEPENDENT_R1','EXECUTOR_R1')
        if rel=='independent-r1-controls.py':raw=raw.replace('lambda m:event("export:"+m)','lambda m,**k:event("export:"+m)')
        put(NEW/'controls'/rel,raw.encode())
    text=data[str(C4/'programs/consumer.py')].decode()
    # Retain literal legacy scope functions for inspection; entry points below use
    # a distinct current plan with the old pins represented as immutable data.
    text=text.replace('import hashlib,json,os,re,stat,time','import hashlib,json,math,os,re,stat,sys,time').replace('MAX_INPUTS=2048','MAX_INPUTS=4096')
    text=text.replace("    return json.loads(raw,object_pairs_hook=pairs,parse_constant=nonfinite)","    def floating(token):\n        value=float(token);require(math.isfinite(value),'NONFINITE_JSON_FORBIDDEN');return value\n    return json.loads(raw,object_pairs_hook=pairs,parse_float=floating,parse_constant=nonfinite)")
    text=text.replace("    except BaseException:\n        for row in pending:os.close(row['heldFD'])\n        raise","    except BaseException as primary:\n        try:close_inputs(pending)\n        except BaseException as cleanup:raise cleanup from primary\n        raise",1)
    start=text.index('def close_inputs(rows):');end=text.index('\ndef output(',start)
    text=text[:start]+'''def close_inputs(rows):
    """Attempt each owned FD exactly once. A failed close is sticky and never retried."""
    closed=[];failures=[]
    for row in rows:
        fd=row.pop('heldFD',None)
        if fd is None:continue
        try:
            returned=os.close(fd);closed.append({'path':row['path'],'fd':fd,'closeReturn':returned})
        except BaseException as error:
            failures.append({'path':row['path'],'fd':fd,'failure':repr(error),'retryForbidden':True})
        finally:
            if 'LEDGER' in globals():LEDGER.active=max(0,LEDGER.active-1)
    if failures:
        error=BoundaryFailure('OWNED_FD_CLOSE_FAILED_STICKY');error.closeFailures=failures;error.closeAttempts=closed+failures;raise error
    return closed

def close_scope(rows):
    primary=sys.exc_info()[1]
    try:return close_inputs(rows)
    except BaseException as cleanup:
        if primary is not None:
            cleanup.primaryFailure=repr(primary)
            cleanup.closeFailures=getattr(primary,'closeFailures',[])+getattr(cleanup,'closeFailures',[])
            raise cleanup from primary
        raise
'''+text[end:]
    start=text.index('def consume_baseline(')
    text=text[:start]+'''class InputLedger:
    """One aggregate graph reservation, never reset by an anchor or consumer phase."""
    def __init__(self):self.paths={};self.total=0;self.active=0;self.peak=0
    def reserve(self,path,pin):
        size=int(pin['size']);require(0<=size<=READ_MAX,'FINITE_PER_FILE_METADATA_CAP')
        prior=self.paths.get(str(path))
        if prior is not None:require(prior==pin,'SAME_GRAPH_REOPEN_NINE_DRIFT')
        else:
            require(len(self.paths)<MAX_INPUTS and self.total+size<=TOTAL_MAX,'FINITE_AGGREGATE_GRAPH_CAP')
            self.paths[str(path)]=dict(pin);self.total+=size
        require(self.active<MAX_INPUTS,'FINITE_OWNED_FD_CAP_BEFORE_OPEN')
    def opened(self):self.active+=1;self.peak=max(self.peak,self.active)
LEDGER=InputLedger()

def capture_plan(plan,bootstrap_rows=()):
    require(type(plan)is dict and plan['schema']=='FINITE_REPAIR3_REFERENCE_PLAN','EXACT_REPAIR3_PLAN')
    require(plan['sourceEligibility']is False and plan['runtimeAuthority']is False,'NO_PLAN_AUTHORITY')
    expected={r['path']:r for r in plan['files']}
    require(len(expected)==len(plan['files'])and len(expected)<=MAX_INPUTS,'FINITE_UNIQUE_PLAN')
    pending=open_inputs([Path(p)for p in sorted(expected)]);observed=[];total=0
    try:
        for held in pending:
            pin=expected[held['path']];row,_=read_held(held,pin)
            if pin.get('stableLiteral')is not None:require(row['PRE']==literal_identity(pin['stableLiteral']),'ORIGINAL_STABLE_LITERAL_CONSERVED')
            observed.append({**row,'roles':pin['roles'],'stableLiteral':pin.get('stableLiteral'),'oldPacketLiteral':pin.get('oldPacketLiteral')});total+=row['bytes']
        failed=[r for r in observed if r['oldPacketLiteral']is not None and r['PRE']!=r['oldPacketLiteral']]
        require(len(failed)==119 and all([f for f in FIELDS if r['PRE'][f]!=r['oldPacketLiteral'][f]]==['ctime_ns']for r in failed),'OLD119_LITERAL_FAILURES_RETAINED')
        require(sum('STABLE_OPERATIVE113'in r['roles']for r in observed)==113 and sum('STABLE_ORIGINAL336'in r['roles']for r in observed)==336,'UNCHANGED_ORIGINAL_STABLE_COHORTS')
        for row in observed:final_fence(row)
        for row in bootstrap_rows:final_fence(row)
        result={'schema':'DISTINCT_FIRST_CURRENT_MATURE_BASELINE_V2','scope':'REPAIR3_CURRENT_PLAN_ONLY','files':observed,'count':len(observed),'bytes':total,'oldPacketScope':'FAILED','oldFailedCount':119,'runtimeAuthority':False,'sourceEligibility':False,'historicalCustodyRepaired':False,'aggregateLedger':{'paths':len(LEDGER.paths),'bytes':LEDGER.total,'peakFDs':LEDGER.peak},'newOutputsSelfExcludedUpstream':True}
    finally:closes=close_inputs(pending)
    result['FDCloses']=closes
    return output('evidence/first-current-mature-baseline1.json',result)

def consume_baseline(baseline_byte_pin):
    baseline_path=N/'evidence/first-current-mature-baseline1.json'
    baseline_held=open_inputs([baseline_path])
    try:
        baseline_row,raw=read_held(baseline_held[0],baseline_byte_pin,collect=True);data=strict(raw)
        require(data['schema']=='DISTINCT_FIRST_CURRENT_MATURE_BASELINE_V2'and data['oldPacketScope']=='FAILED'and data['oldFailedCount']==119,'EXACT_NEW_BASELINE_OLD_FAILURE_SCOPE')
        require(data['runtimeAuthority']is False and data['sourceEligibility']is False,'NO_BASELINE_AUTHORITY_ALIAS')
        require(type(data['files'])is list and len(data['files'])<=MAX_INPUTS,'FINITE_BASELINE_MEMBERSHIP')
        pending=open_inputs([Path(row['path'])for row in data['files']]);observed=[]
        try:
            for held,expected in zip(pending,data['files']):
                row,_=read_held(held,expected)
                check_row(row,{'identity':expected['PRE'],'bytes':expected['bytes'],'sha256':expected['sha256']});observed.append(row)
            for row in observed:final_fence(row)
            final_fence(baseline_held[0])
        finally:closes=close_scope(pending)
    finally:baseline_closes=close_scope(baseline_held)
    result={'schema':'DISTINCT_MATURE_BASELINE_CURRENT_CONSUMER_REPAIR3','scope':'CURRENT_REFERENCE_MATCH_ONLY','status':'CURRENT_REFERENCE_MATCH','baselineFirstMatureConsumerObservation':baseline_row,'files':observed,'count':len(observed),'FDCloses':closes,'baselineFDCloses':baseline_closes,'old119Scope':'FAILED_IMMUTABLE','historicalCustodyRepaired':False,'sourceEligibility':False,'runtimeAuthority':False,'allOriginalSixTask04Criteria':'OPEN','Task03':'OPEN','full17Goal':'OPEN','aggregateLedger':{'paths':len(LEDGER.paths),'bytes':LEDGER.total,'peakFDs':LEDGER.peak},'newReportOutputsSelfExcludedUpstream':True}
    return output('evidence/current-consumer1.json',result)
'''
    text=text.replace("            fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)\n            entry={'path':str(path),'PRE':before,'OPEN':identity(os.fstat(fd)),'heldFD':fd,'ageNsAtFirstOpen':age}\n            pending.append(entry);require(entry['OPEN']==before,'FIRST_OPEN_NINE_DRIFT')", "            if 'LEDGER'in globals():LEDGER.reserve(path,before)\n            fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)\n            if 'LEDGER'in globals():LEDGER.opened()\n            entry={'path':str(path),'PRE':before,'heldFD':fd,'ageNsAtFirstOpen':age};pending.append(entry)\n            entry['OPEN']=identity(os.fstat(fd));require(entry['OPEN']==before,'FIRST_OPEN_NINE_DRIFT')")
    put(N/'programs/consumer.py',text.encode())
    put(N/'data/legacy-reference-contract.json',data[str(C4/'data/reference-contract.json')])
    put(N/'data/semantic-delta.json',{'consumerRepairs':['outerBaselineLifetime','separatePendingLifetime','allCloseAttemptsOnceStickyFailure','finiteParseFloat','oneAggregateGraphLedger'],'oldC4ProgramSHA256':'cf30a4b10274e16acfbeae8492a8887caee39fa66ffc5db917fb3f49b77ee7a0','operativeRepairNamespace':NEW.name,'originalAssertionsDeadlinesResourcesChanged':False,'oldLiteralPinsRefreshed':False,'sourceEligibility':False,'runtimeAuthority':False})
    put(NEW/'source-writer-stop.json',{'writersStopped':True,'scope':'SOURCE112_MF_WORKFLOW_AND_DECLARED_DELTA','stopTimeNs':time.time_ns(),'nativeActions':False,'newOutputsRequireDistinctMatureConsumer':True})
    put(N/'evidence/preparation-first-source-readback.json',{'schema':'FINITE_PREPARATION_FIRST_MATURE_SOURCE_READBACK','files':rows,'allFDsBeforeContents':True,'sourceOnly':True,'sourceEligibility':False,'runtimeAuthority':False,'totalBytes':total})
    for p,fd,before,age in held:
        os.lseek(fd,0,0);h=hashlib.sha256();size=0
        while b:=os.read(fd,65536):h.update(b);size+=len(b)
        assert (size,h.hexdigest())==(len(data[str(p)]),hashlib.sha256(data[str(p)]).hexdigest())and ident(os.fstat(fd))==before and ident(p.lstat())==before
finally:
    for p,fd,before,age in held:
        try:ret=os.close(fd);closes.append({'path':str(p),'fd':fd,'closeReturn':ret})
        except BaseException as error:closes.append({'path':str(p),'fd':fd,'closeError':repr(error)})
put(N/'evidence/preparation-final-source-FDclosure.json',{'files':rows,'FDCloses':closes,'allExplicitCloseReturnsObserved':all('closeReturn'in r for r in closes),'outputsNotInputAuthority':True})
print(json.dumps({'prepared':True,'sourceCount':112,'semanticDeltaFiles':2,'sourceInputFiles':len(held),'bytes':total,'runtimeAuthority':False}))
