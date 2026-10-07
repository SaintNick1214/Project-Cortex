"""Bounded mature held SOURCE/MOCK execution; no native or service authority."""
import ast,hashlib,json,math,os,stat,time
from pathlib import Path
N=Path(__file__).resolve().parents[1];INPUT=N.parent;P=INPUT.parent
R3=P/'task04-current-producer-native-public-repair3'
C5=P/'task04-current-producer-native-public-consumer-repair3'
R4=P/'task04-current-producer-native-public-repair4'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(value):return {k:str(getattr(value,'st_'+k))for k in FIELDS}
def strict(raw):
    def pairs(rows):
        result={}
        for key,value in rows:
            if key in result:raise ValueError('DUPLICATE_AUTHOR_INPUT_KEY')
            result[key]=value
        return result
    def nonfinite(token):raise ValueError('NONFINITE_AUTHOR_INPUT')
    def floating(token):
        value=float(token)
        if not math.isfinite(value):raise ValueError('NONFINITE_AUTHOR_INPUT')
        return value
    return json.loads(raw,object_pairs_hook=pairs,parse_float=floating,parse_constant=nonfinite)

def publish(name,value):
    raw=(json.dumps(value,separators=(',',':'))+'\n').encode()
    if len(raw)>16777216:raise ValueError('FINITE_AUTHOR_OUTPUT')
    path=N/'evidence'/name;fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        view=memoryview(raw)
        while view:
            written=os.write(fd,view)
            if written<=0:raise ValueError('FULL_AUTHOR_OUTPUT')
            view=view[written:]
        os.fsync(fd)
    finally:os.close(fd)
    return {'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'selfExcludedUpstream':True}
def finite_header(path):
    pin=identity(path.lstat());fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        if not stat.S_ISREG(int(pin['mode']))or pin['nlink']!='1' or int(pin['size'])>16777216 or time.time_ns()-max(int(pin['mtime_ns']),int(pin['ctime_ns']))<60000000000:raise ValueError('MATURE_FINITE_HEADER')
        if identity(os.fstat(fd))!=pin:raise ValueError('HEADER_OPEN_NINE')
        chunks=[];size=0
        while block:=os.read(fd,65536):
            size+=len(block)
            if size>int(pin['size']):raise ValueError('HEADER_SIZE')
            chunks.append(block)
        if size!=int(pin['size'])or identity(os.fstat(fd))!=pin or identity(path.lstat())!=pin:raise ValueError('HEADER_FULL_EOF_NINE')
        raw=b''.join(chunks);return strict(raw),raw,pin
    finally:os.close(fd)

plan,planraw,planpin=finite_header(N/'source-inputs-plan.json')
stop,stopraw,stoppin=finite_header(N/'observed-source-writers-stopped.json')
assert plan['scope']=='TASK04_R4_C6_AUTHOR_FINITE_SOURCE_CONTROL_REFERENCE_LIST_ONLY'
assert stop['sourceWriters']=='STOPPED'and stop['remainingWrites']==[]
assert time.time_ns()-int(stop['stoppedUnixNs'])>=60000000000
expected={row['path']:row for row in plan['members']}
assert len(expected)==len(plan['members'])
for path,raw,pin in ((N/'source-inputs-plan.json',planraw,planpin),(N/'observed-source-writers-stopped.json',stopraw,stoppin)):
    assert str(path)not in expected
    expected[str(path)]={'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'headerPin':pin}
assert len(expected)<=4096
owned=[];observed=[];bodies={};total=0;closes=[];failures=[];primary=None
try:
    # Every complete graph FD is acquired before the first referenced body read.
    for name in sorted(expected):
        path=Path(name);assert path.is_absolute()and path.resolve()==path
        pin=identity(path.lstat());size=int(pin['size']);total+=size
        if 'unchangedRoot197PRE9'in expected[name]:assert pin==expected[name]['unchangedRoot197PRE9']
        assert stat.S_ISREG(int(pin['mode']))and pin['nlink']=='1'and pin['uid']=='501'and pin['gid']=='20'
        assert 0<=size<=16777216 and total<=67108864
        assert time.time_ns()-max(int(pin['mtime_ns']),int(pin['ctime_ns']))>=60000000000
        assert path==N/'observed-source-writers-stopped.json'or max(int(pin['mtime_ns']),int(pin['ctime_ns']))<=int(stop['stoppedUnixNs'])
        row={'path':name,'pin':pin,'fd':None};fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
        try:row['fd']=fd;owned.append(row)
        except BaseException as error:
            row.pop('fd',None)
            try:os.close(fd)
            except BaseException as cleanup:raise RuntimeError('UNREGISTERED_AUTHOR_SOURCE_CLOSE_FAILED')from error
            raise
    for held in owned:
        path=Path(held['path']);fd=held['fd'];pin=held['pin'];parts=[];size=0;h=hashlib.sha256()
        assert identity(os.fstat(fd))==pin
        while block:=os.read(fd,65536):
            size+=len(block);assert size<=int(pin['size'])<=16777216;h.update(block);parts.append(block)
        ref=expected[held['path']]
        assert size==int(pin['size'])and(size,h.hexdigest())==(ref['bytes'],ref['sha256'])
        assert identity(os.fstat(fd))==pin and identity(path.lstat())==pin
        if 'headerPin'in ref:assert ref['headerPin']==pin
        bodies[held['path']]=b''.join(parts)
        observed.append({'path':held['path'],'bytes':size,'sha256':h.hexdigest(),'PRE':pin,'OPEN':pin,'POST':pin,'pathFINAL':pin,'fullEOF':True})
    candidate=strict(bodies[str(INPUT/'candidate-source-plan.json')])
    sources={row['path']:bodies[row['sourcePath']].decode()for row in candidate['files']}
    current=bodies[str(INPUT/'programs/consumer.py')].decode()
    C={'__name__':'source_mock','__file__':str(INPUT/'programs/consumer.py')};exec(compile(current,str(INPUT/'programs/consumer.py'),'exec',dont_inherit=True),C)
    proof=strict(bodies[str(R3/'original100-conservation-reference.json')]);assert proof['originalCount']==100 and len(proof['rows'])==100
    old_root=Path(proof['originalProof']['path']).parents[1]
    for row in proof['rows']:
        raw=bodies[str(old_root/row['newExactConservationBacking'])]
        assert(len(raw),hashlib.sha256(raw).hexdigest())==(row['bytes'],row['sha256'])
    controls=[]
    programs=[(R3/'controls'/name,{'SOURCES':sources,'SOURCE_ROOT':str(INPUT/'runtime-stage/generated-candidate/source')})for name in ('independent-r1-controls.py','independent-r1-extra-controls.py','public_disposition_controls.py')]
    programs += [(C5/'controls/consumer_controls2.py',{'C':C}),(C5/'controls/bootstrap_close_controls.py',{'SOURCE':bodies[str(C5/'infrastructure/final-close3.py')].decode()}),(INPUT/'controls/repair4_fault_controls2.py',{'SOURCES':sources,'CONSUMER_SOURCE':current,'CONSUMER_PATH':str(INPUT/'programs/consumer.py')})]
    programs += [(INPUT/'controls/repair4_extra_controls2.py',{'SOURCES':sources,'OLD_SOURCES':{name:bodies[str(R3/'source'/name)].decode()for name in ('ci-run.py','native_export.py')},'CONSUMER_SOURCE':current,'OLD_CONSUMER_SOURCE':bodies[str(C5/'programs/consumer.py')].decode(),'GENERATOR_SOURCE':bodies[str(INPUT/'infrastructure/prepare.py')].decode(),'GENERATOR_PATH':str(INPUT/'infrastructure/prepare.py'),'PLAN':candidate})]
    assert len(programs)==7
    for (path,context),expectedCount in zip(programs,(30,20,42,66,6,49,40)):
        context.update(__name__='qualified_author_source_mock',__file__=str(path))
        exec(compile(bodies[str(path)],str(path),'exec',dont_inherit=True),context)
        result=context['RESULT'];assert result['FAIL']==0 and result['PASS']==expectedCount
        controls.append({'program':str(path),'sourceSha256':hashlib.sha256(bodies[str(path)]).hexdigest(),'result':result})
    syntax=[]
    for path,raw in bodies.items():
        if path.endswith('.py'):ast.parse(raw,path);syntax.append(path)
    for held in owned:assert identity(os.fstat(held['fd']))==held['pin']and identity(Path(held['path']).lstat())==held['pin']
except BaseException as error:primary=error
finally:
    for row in owned:
        fd=row.pop('fd',None)
        if fd is None:continue
        try:os.close(fd);closes.append({'path':row['path'],'fd':fd,'closeReturn':None})
        except BaseException as error:failures.append({'path':row['path'],'fd':fd,'error':repr(error),'retryForbidden':True})

if primary is not None or failures:
    failure=publish('qualified-source-acquisition-failure.json',{'scope':'FAILED_NEW_SOURCE_EPOCH2_NOT_ACCEPTANCE','primary':repr(primary)if primary is not None else None,'openedSourceRows':[{k:v for k,v in row.items()if k!='fd'}for row in owned],'readObservedRows':observed,'closeAttempts':closes,'closeErrors':failures,'sourceGraphPaths':len(expected),'acquiredSourceBytes':total,'allOwnedClosesAttempted':True,'noUnknownRetry':True,'sourceEligibility':False,'runtimeAuthority':False})
    error=RuntimeError('AUTHOR_SOURCE_EPOCH2_FAILED_STICKY');error.primaryFailure=primary;error.closeFailures=failures
    raise error from primary

closure=publish('qualified-source-input-FDclosure.json',{'scope':'CURRENT_AUTHOR_SOURCE_INTERVAL_ONLY_NOT_RUNTIME_AUTHORITY','members':observed,'count':len(observed),'bytes':total,'allGraphFDsBeforeReferencedBodies':True,'everyInputFullEOFHashSizeNineFinal':True,'FDCloses':closes,'closeErrors':failures,'sourceGraphLedger':{'paths':len(expected),'bytes':total,'limits':{'paths':4096,'bytes':67108864,'fileBytes':16777216},'reset':False},'sourceInputsClosedBeforeThisPublication':True,'outputsSelfExcluded':True,'historicalCustodyRepaired':False})
result=publish('qualified-source-control-results.json',{'scope':'TASK04_R4_C6_MATURE_HELD_AUTHOR_SOURCE_MOCK_OUTCOMES_ONLY','programs':controls,'PASS':sum(row['result']['PASS']for row in controls),'FAIL':0,'original164Assertions':164,'newFaultRegistrationGeneratorAssertions':89,'original100FullBodiesConserved':True,'syntax':syntax,'sourceClosure':closure,'nativeEffects':0,'Docker':False,'privateAccess':0,'sourceEligibility':False,'runtimeAuthority':False,'Task04Functional':{'complete':0,'total':3},'original122':'HELD','native20':'HELD','whole120':'HELD'})
print(json.dumps({'sourceOnly':True,'PASS':253,'FAIL':0,'sourcePaths':len(expected),'sourceBytes':total,'sourceClosure':closure,'result':result}))
