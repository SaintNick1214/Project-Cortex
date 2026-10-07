"""Finite HOST QA consumer; never import or execute operative R1 programs."""
import hashlib,json,math,os,re,stat,sys,time
from pathlib import Path
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
MATURITY_NS=60000000000
READ_MAX=16777216
TOTAL_MAX=67108864
MAX_INPUTS=4096
N=Path(__file__).resolve().parents[1];P=N.parent;R=P.parents[3]
R1=P/'task04-current-producer-native-public-repair1';J=P/'task04-current-producer-native-public-repair1-source-review2'

class BoundaryFailure(RuntimeError):
    pass

def require(value,code):
    if not value:raise BoundaryFailure(code)

def strict(raw):
    def pairs(items):
        result={}
        for key,value in items:
            require(key not in result,'DUPLICATE_JSON_KEY');result[key]=value
        return result
    def nonfinite(_):raise BoundaryFailure('NONFINITE_JSON_FORBIDDEN')
    def floating(token):
        value=float(token);require(math.isfinite(value),'NONFINITE_JSON_FORBIDDEN');return value
    return json.loads(raw,object_pairs_hook=pairs,parse_float=floating,parse_constant=nonfinite)

def identity(value):
    return {key:str(getattr(value,'st_'+key))for key in FIELDS}

def literal_identity(value):
    require(type(value)is dict,'LITERAL_NINE_DICT')
    if set(value)=={'schema','fields'}:
        require(value['schema']=='FS_IDENTITY_DECIMAL_V1','EXACT_IDENTITY_WIRE_SCHEMA');value=value['fields']
    require(type(value)is dict and set(value)==set(FIELDS),'EXACT_NINE_MEMBERSHIP')
    for key,token in value.items():
        require(type(token)is str and re.fullmatch('-?(0|[1-9][0-9]*)',token)is not None and token!='-0','EXACT_DECIMAL_STRING')
        require(not token.startswith('-')or key in ('mtime_ns','ctime_ns'),'EXACT_UNSIGNED_FIELD')
    return dict(value)

def check_row(row,expected=None):
    require(type(row)is dict,'STRICT_CURRENT_ROW')
    require(type(row['heldFD'])is int and row['heldFD']>=0,'STRICT_ACTUAL_HELD_FD')
    require(type(row['bytes'])is int and 0<=row['bytes']<=READ_MAX,'STRICT_EOF_BYTE_COUNT')
    require(type(row['sha256'])is str and re.fullmatch('[0-9a-f]{64}',row['sha256'])is not None,'STRICT_SHA256')
    require(row['EOF']is True,'FULL_EOF_LITERAL_TRUE')
    first=literal_identity(row['PRE'])
    for field in ('OPEN','POST','pathFINAL','heldFINAL'):
        require(literal_identity(row[field])==first,'LATE_CURRENT_NINE_DRIFT:'+field)
    require(first['nlink']=='1'and int(first['mode'])&0o170000==0o100000,'REGULAR_SINGLE_LINK')
    require(int(first['size'])==row['bytes'],'PHYSICAL_FULL_SIZE_EQUALS_EOF')
    if expected is not None:
        require(first==literal_identity(expected['identity']),'EXACT_CURRENT_BASELINE_NINE')
        require((row['bytes'],row['sha256'])==(expected['bytes'],expected['sha256']),'EXACT_CURRENT_BASELINE_BYTES')
    return first

def mature(pin,now_ns):
    require(type(now_ns)is int,'LITERAL_CLOCK_NS')
    pin=literal_identity(pin);age=now_ns-max(int(pin['mtime_ns']),int(pin['ctime_ns']))
    require(age>=MATURITY_NS,'INPUT_NOT_MATURE60_SECONDS')
    return age

def open_inputs(paths):
    pending=[];seen=set()
    try:
        for path in paths:
            require(type(path)is Path or isinstance(path,Path),'EXACT_LITERAL_PATH_OBJECT')
            require(path.is_absolute()and path.resolve()==path,'NO_LITERAL_PATH_ALIAS')
            before=identity(os.lstat(path));age=mature(before,time.time_ns())
            require(before['nlink']=='1'and int(before['mode'])&0o170000==0o100000,'REGULAR_SINGLE_LINK_BEFORE_OPEN')
            key=(before['dev'],before['ino']);require(key not in seen,'NO_DISTINCT_PATH_INODE_ALIAS');seen.add(key)
            if 'LEDGER'in globals():LEDGER.reserve(path,before)
            fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
            if 'LEDGER'in globals():LEDGER.opened()
            entry={'path':str(path),'PRE':before,'heldFD':fd,'ageNsAtFirstOpen':age};pending.append(entry)
            entry['OPEN']=identity(os.fstat(fd));require(entry['OPEN']==before,'FIRST_OPEN_NINE_DRIFT')
        return pending
    except BaseException as primary:
        try:close_inputs(pending)
        except BaseException as cleanup:raise cleanup from primary
        raise

def read_held(entry,expected_bytes=None,collect=False):
    fd=entry['heldFD'];os.lseek(fd,0,os.SEEK_SET);h=hashlib.sha256();size=0;chunks=[]
    while block:=os.read(fd,65536):
        size+=len(block);require(size<=READ_MAX,'FINITE_PER_FILE_READ_CAP');h.update(block)
        if collect:chunks.append(block)
    row={**entry,'POST':identity(os.fstat(fd)),'pathFINAL':identity(os.lstat(entry['path'])),
         'heldFINAL':identity(os.fstat(fd)),'bytes':size,'sha256':h.hexdigest(),'EOF':True}
    check_row(row)
    if expected_bytes:
        require((size,row['sha256'])==(expected_bytes['bytes'],expected_bytes['sha256']),'CONSERVE_EXACT_REFERENCED_BYTES')
    return row,b''.join(chunks)if collect else None

def final_fence(row):
    require(identity(os.fstat(row['heldFD']))==row['PRE'],'FINAL_HELD_NINE_DRIFT')
    require(identity(os.lstat(row['path']))==row['PRE'],'FINAL_PATH_NINE_DRIFT')

def close_inputs(rows):
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

def output(name,value):
    """Current write/readback only. Output never manufactures an upstream PRE."""
    raw=(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
    require(len(raw)<=READ_MAX,'FINITE_OUTPUT_CAP')
    path=N/name;path.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(path,os.O_RDWR|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        view=memoryview(raw)
        while view:
            count=os.write(fd,view);require(count>0,'OUTPUT_WRITE_RETURN');view=view[count:]
        os.fsync(fd);before=identity(os.fstat(fd));os.lseek(fd,0,os.SEEK_SET)
        h=hashlib.sha256();size=0
        while block:=os.read(fd,65536):size+=len(block);h.update(block)
        require((size,h.hexdigest())==(len(raw),hashlib.sha256(raw).hexdigest()),'OUTPUT_FULL_EOF_READBACK')
        require(identity(os.fstat(fd))==before and identity(os.lstat(path))==before,'OUTPUT_WITHIN_READ_NINE_DRIFT')
    finally:returned=os.close(fd)
    return {'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
        'closeReturn':returned,'physicalWriteReadback':'CURRENT_WRITE_ONLY_NOT_FUTURE_INPUT_PIN',
        'upstreamSelfExcluded':True,'requiresMatureFirstCaptureBeforeLaterInputUse':True}

def old_scope_status(failed_count,current_match=True):
    require(type(failed_count)is int and failed_count>=0 and type(current_match)is bool,'STRICT_SCOPE_INPUTS')
    return {'historicalScope':'FAILED'if failed_count else'UNPROVED',
            'newCurrentConsumerScope':'MATCH_ONLY'if current_match else'FAILED',
            'historicalCustodyRepaired':False,'runtimeAuthority':False,'sourceEligibility':False}

def validate_source_mf(data):
    require(type(data)is dict and set(data)=={'schema','scope','files','fileCount','sourceBytes','historicalCustody'},'EXACT_SOURCE_MF_KEYS')
    require(data['schema']=='NATIVE_PUBLIC_SOURCE_MANIFEST_V1'and data['scope']=='SOURCE_ONLY_PROPOSAL_NOT_RELEASE'and data['historicalCustody']=='NOT_ADOPTED','EXACT_SOURCE_MF_SCOPE')
    require(type(data['fileCount'])is int and data['fileCount']==112 and type(data['sourceBytes'])is int and data['sourceBytes']==2136695,'EXACT_OPERATIVE_SOURCE_COUNTS')
    require(type(data['files'])is list and len(data['files'])==112,'EXACT_SOURCE_FILES')
    names=[];total=0
    for row in data['files']:
        require(type(row)is dict and set(row)=={'path','bytes','sha256'},'STRICT_SOURCE_MF_ROW')
        require(type(row['path'])is str and not Path(row['path']).is_absolute()and '..'not in Path(row['path']).parts and row['path']!='source-manifest.json','EXACT_RELATIVE_SOURCE_NAME')
        require(type(row['bytes'])is int and 0<=row['bytes']<=READ_MAX and type(row['sha256'])is str and re.fullmatch('[0-9a-f]{64}',row['sha256'])is not None,'EXACT_SOURCE_BYTE_PIN')
        names.append(row['path']);total+=row['bytes']
    require(names==sorted(names)and len(set(names))==112 and total==2136695,'EXACT_SOURCE_MEMBERSHIP_SUM')
    return data

def validate_spec(spec):
    required={'schema','minimumMaturitySeconds','anchors','operativeNamespace','reviewNamespace','newNamespace',
      'stableSourceCount','stableOriginalExternalCount','originalPacketCount','originalPacketFailedCount','matureReviewOwnCount',
      'oldPacketScope','newScope','oldExpectationsPreserved','old119OriginalPinsNowMatch','historicalCustodyRepaired',
      'futureRootApproval','sourceEligibilityAuthored','runtimeAuthority','noRecopyOperativeSource','noDuplicateByteBackings',
      'semanticDelta','originalAssertionsDeadlinesResourcesChanged'}
    require(type(spec)is dict and set(spec)==required,'EXACT_CONSUMER_CONTRACT_KEYS')
    literals={'schema':'DISTINCT_PROSPECTIVE_CONSUMER_REFERENCE_CONTRACT_V2','minimumMaturitySeconds':60,
      'operativeNamespace':R1.name,'reviewNamespace':J.name,'newNamespace':N.name,
      'stableSourceCount':113,'stableOriginalExternalCount':336,'originalPacketCount':286,'originalPacketFailedCount':119,
      'matureReviewOwnCount':639,'oldPacketScope':'FAILED_HISTORY_NEVER_CURRENT_AUTHORITY',
      'newScope':'DISTINCT_CURRENT_MATURE_REGULAR_FILES_ONLY','oldExpectationsPreserved':True,
      'old119OriginalPinsNowMatch':False,'historicalCustodyRepaired':False,
      'futureRootApproval':'ABSENT_REQUIRED_AFTER_NEW_FRESH_JUDGE_AND_PUBLICATION_BINDING',
      'sourceEligibilityAuthored':False,'runtimeAuthority':False,'noRecopyOperativeSource':True,
      'noDuplicateByteBackings':True,'semanticDelta':0,'originalAssertionsDeadlinesResourcesChanged':False}
    for key,value in literals.items():require(type(spec[key])is type(value)and spec[key]==value,'LITERAL_CONTRACT_'+key)
    allowed={R1.name+'/'+rel for rel in ('closed-handoff.json','source/source-manifest.json','evidence/source-consumer1.json',
      'evidence/external-current1.json','packet-manifest1.json','final-current-closure.json')}
    allowed|={J.name+'/'+rel for rel in ('report.md','verdict.json','writer-stop.json','evidence/first-metadata-before-source-contents1.json',
      'evidence/first-prospective-held-source-external1.json','evidence/final-held-source-external-FDclosure1.json',
      'evidence/independent-literal-final-mismatch1.json','own-output-first-prospective-capture1.json','final-current-closure.json','hold-review.py')}
    require(type(spec['anchors'])is list and len(spec['anchors'])==16,'EXACT_ANCHOR_COUNT')
    names=[]
    for row in spec['anchors']:
        require(type(row)is dict and set(row)=={'relativeToP','role','bytes','sha256'},'STRICT_ANCHOR_ROW')
        require(type(row['relativeToP'])is str and row['relativeToP']in allowed,'NO_UNKNOWN_ANCHOR_BEFORE_READ')
        require(type(row['role'])is str and type(row['bytes'])is int and 0<=row['bytes']<=READ_MAX and type(row['sha256'])is str and re.fullmatch('[0-9a-f]{64}',row['sha256'])is not None,'STRICT_ANCHOR_PIN')
        names.append(row['relativeToP'])
    require(set(names)==allowed and len(set(names))==16,'COMPLETE_UNIQUE_ANCHORS')
    return spec

def build_plan(spec,anchors):
    validate_spec(spec)
    require(type(spec['minimumMaturitySeconds'])is int and spec['minimumMaturitySeconds']==60,'EXACT_MATURITY_ASSERTION')
    require(spec['runtimeAuthority']is False and spec['sourceEligibilityAuthored']is False and spec['old119OriginalPinsNowMatch']is False,'NO_AUTHORITY_ALIAS')
    require(spec['oldPacketScope']=='FAILED_HISTORY_NEVER_CURRENT_AUTHORITY'and spec['semanticDelta']==0 and type(spec['semanticDelta'])is int,'EXACT_SCOPE_AND_SEMANTIC_ZERO')
    mf=validate_source_mf(anchors[str(R1/'source/source-manifest.json')])
    source=anchors[str(R1/'evidence/source-consumer1.json')]['files']
    original=anchors[str(R1/'evidence/external-current1.json')]['files']
    packet=anchors[str(R1/'packet-manifest1.json')]['files']
    own=anchors[str(J/'own-output-first-prospective-capture1.json')]
    failures=anchors[str(J/'evidence/independent-literal-final-mismatch1.json')]['files']
    first=anchors[str(J/'evidence/first-prospective-held-source-external1.json')]
    final=anchors[str(J/'evidence/final-held-source-external-FDclosure1.json')]
    require(len(source)==113 and len(original)==336 and len(packet)==286 and len(own['files'])==639 and len(failures)==119,'EXACT_REFERENCE_COUNTS')
    require(len(first['errors'])==238 and len(final['errors'])==239 and len(final['FDCloses'])==634,'PRESERVE_FIRST_FINAL_FAILURE_COUNTS')
    require(all(r['changedFields']==['ctime_ns']and r['expected']!=r['heldFINAL']for r in failures),'PRESERVE119_LITERAL_FAILED_HISTORY')
    require(own['errors']==[]and own['notHistoricalPRE']is True,'SEPARATE_MATURE_REVIEW_OUTPUT_SCOPE')
    inputs={}
    def add(path,role,pin=None,stable=None,old=None):
        path=str(Path(path));require(path.startswith(str(R)+'/')and '..'not in Path(path).parts,'FINITE_PUBLIC_REFERENCE_ROOT')
        row=inputs.setdefault(path,{'path':path,'roles':[],'bytes':None,'sha256':None,'stableLiteral':None,'oldPacketLiteral':None})
        if role not in row['roles']:row['roles'].append(role)
        if pin:
            b=pin.get('bytes',pin.get('size'));sha=pin['sha256']
            require(type(b)is int and type(sha)is str,'STRICT_REFERENCE_BYTE_PIN')
            if row['bytes']is not None:require((row['bytes'],row['sha256'])==(b,sha),'CONFLICTING_REFERENCE_BYTES')
            row.update(bytes=b,sha256=sha)
        if stable:
            stable=literal_identity(stable)
            if row['stableLiteral']is not None:require(row['stableLiteral']==stable,'CONFLICTING_STABLE_LITERAL')
            row['stableLiteral']=stable
        if old:row['oldPacketLiteral']=literal_identity(old)
    for row in packet:
        require(row['path'].startswith(str(R1)+'/'),'EXACT_R1_PACKET_ROOT')
        add(row['path'],'OLD_FAILED_PACKET_DATA',row,old=row['PRE'])
    for row in source:add(row['path'],'STABLE_OPERATIVE113',row,stable=row['PRE'])
    for row in original:add(row['path'],'STABLE_ORIGINAL336',row,stable=row['PRE'])
    for row in own['files']:
        require(row['path'].startswith(str(J)+'/'),'EXACT_SOURCE2_MATURE_ROOT')
        add(row['path'],'SOURCE2_NEW_MATURE639_DATA',row,stable=row['PRE'])
    for row in spec['anchors']:add(P/row['relativeToP'],'CURRENT_MATURE_ANCHOR_DATA',row)
    # R1 cycle metadata/hand-off and Source2 excluded cycle/setup bytes remain DATA,
    # with new mature current identities; none reuses their failed historical PRE.
    for row in anchors[str(R1/'closed-handoff.json')]['exactPins']:
        add(R1/row['path'],'R1_HANDOFF_MEMBER_DATA',row)
    own_excluded=set(own['excludedFiles'])
    require(own_excluded=={'hold-review.py','own-output-first-prospective-capture1.json','final-current-closure.json','writer-stop.json'},'EXACT_SOURCE2_EXCLUDED_HISTORY')
    for rel in own_excluded:
        require(str(J/rel)in inputs,'ALL_EXCLUDED_LINEAGE_REFERENCED')
    expected_names=sorted([row['path']for row in mf['files']]+['source-manifest.json'])
    require(sorted(Path(row['path']).relative_to(R1/'source').as_posix()for row in source)==expected_names,'PRECISE_OPERATIVE_SOURCE_MF')
    require(len(inputs)<=MAX_INPUTS,'FINITE_REFERENCE_INPUT_COUNT')
    return inputs,failures

def capture_baseline(initial_rows,spec_raw):
    spec=validate_spec(strict(spec_raw))
    anchor_paths=[P/row['relativeToP']for row in spec['anchors']]
    anchor_held=open_inputs(anchor_paths);anchors={};anchor_observed=[]
    try:
        for held,pin in zip(anchor_held,spec['anchors']):
            observed,raw=read_held(held,pin,collect=True);anchor_observed.append(observed);anchors[held['path']]=strict(raw)if held['path'].endswith('.json')else None
        inputs,failures=build_plan(spec,anchors)
        for row in initial_rows:
            inputs[row['path']]={'path':row['path'],'roles':['NEW_MATURE_SOURCE_CONSUMER_PROGRAM_OR_DATA'],
                'bytes':row['bytes'],'sha256':row['sha256'],'stableLiteral':row['PRE'],'oldPacketLiteral':None}
        pending=open_inputs([Path(p)for p in sorted(inputs)]);observed=[];total=0
        try:
            for held in pending:
                expected=inputs[held['path']];row,_=read_held(held,expected)
                if expected['stableLiteral']is not None:require(row['PRE']==expected['stableLiteral'],'STABLE_OLD_ORIGINAL_LITERAL_NINE_REQUIRED')
                total+=row['bytes'];require(total<=TOTAL_MAX,'FINITE_TOTAL_REFERENCE_READ_BYTES')
                observed.append({**row,**{k:expected[k]for k in ('roles','stableLiteral','oldPacketLiteral')}})
            for row in observed:final_fence(row)
            legacy=[r for r in observed if r['oldPacketLiteral']is not None and r['PRE']!=r['oldPacketLiteral']]
            require(len(legacy)==119 and {r['path']for r in legacy}=={r['path']for r in failures},'119_OLD_EXPECTATIONS_STILL_FAILED')
            for row in legacy:
                require([key for key in FIELDS if row['PRE'][key]!=row['oldPacketLiteral'][key]]==['ctime_ns'],'OLD_FAILURE_FIELD_CHANGE_PRESERVED')
            for row in anchor_held:final_fence(row)
        finally:closes=close_inputs(pending)
    finally:anchor_closes=close_inputs(anchor_held)
    value={'schema':'DISTINCT_FIRST_CURRENT_MATURE_BASELINE_V2','scope':'CURRENT1268_REFERENCES_PLUS_NEW_INPUTS_ONLY_NOT_PAST_CUSTODY',
      'files':observed,'count':len(observed),'bytes':total,'allInputsAgeAtFirstCaptureAtLeastNs':min(r['ageNsAtFirstOpen']for r in observed),
      'anchorsObservedBeforeReferencedContents':anchor_observed,'FDCloses':closes,'anchorFDCloses':anchor_closes,
      'oldPacketScope':'FAILED','oldFailedCount':119,'old119LiteralExpectations':failures,
      'historicalCustodyRepaired':False,'runtimeAuthority':False,'sourceEligibility':False,'semanticDelta':0,
      'newOutputsLogicallyExcludedFromUpstreamHistoricalPins':True}
    return output('evidence/first-current-mature-baseline1.json',value)

class InputLedger:
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
