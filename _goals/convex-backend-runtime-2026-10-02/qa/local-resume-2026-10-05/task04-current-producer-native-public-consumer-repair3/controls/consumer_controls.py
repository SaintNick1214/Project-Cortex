"""Executor SOURCE/MOCK controls; no operative native bodies or external effects."""
import copy,json,math,types
from pathlib import Path
RESULTS=[]
def case(name,fn):
    try:RESULTS.append({'name':name,'status':'PASS','scope':'EXECUTOR_SOURCE_MOCK','detail':fn()})
    except BaseException as error:RESULTS.append({'name':name,'status':'FAIL','scope':'EXECUTOR_SOURCE_MOCK','error':repr(error)})
def denied(fn):
    try:fn()
    except BaseException as e:return e
    raise AssertionError('expected rejection')
def current_row():
    p={'dev':'1','ino':'2','mode':'33152','nlink':'1','uid':'0','gid':'0','size':'1','mtime_ns':'1','ctime_ns':'1'}
    return {'PRE':p,'OPEN':copy.deepcopy(p),'POST':copy.deepcopy(p),'heldFINAL':copy.deepcopy(p),'pathFINAL':copy.deepcopy(p),'heldFD':123,'bytes':1,'sha256':'a'*64,'EOF':True}
case('current_exact_nine_eof_positive',lambda:{'identity':C['check_row'](current_row())})
for phase in ('OPEN','POST','heldFINAL','pathFINAL'):
    for field in C['FIELDS']:
        def fault(phase=phase,field=field):
            row=current_row();row[phase][field]='3';assert isinstance(denied(lambda:C['check_row'](row)),C['BoundaryFailure']);return {'denied':True}
        case('current_'+phase+'_'+field+'_denied',fault)
case('exact60_maturity_positive',lambda:{'ageNs':C['mature'](current_row()['PRE'],60000000001)})
case('one_ns_premature_denied',lambda:{'reason':str(denied(lambda:C['mature'](current_row()['PRE'],60000000000)))})
for raw in (b'NaN',b'Infinity',b'-Infinity',b'1e309',b'-1e309',b'{"a":[1,{"b":1e309}]}',b'{"a":[-1e309]}',b'{"a":1,"a":2}',b'{"a":{"b":1,"b":2}}'):
    def bad_json(raw=raw):
        error=denied(lambda:C['strict'](raw));assert isinstance(error,C['BoundaryFailure']);return {'denied':str(error)}
    case('strict_denial_'+raw.decode(),bad_json)
def finite_positive():
    value=C['strict'](b'{"a":[0.0,1e308,-1e308,1.25e-4],"b":2}')
    assert value=={'a':[0.0,1e308,-1e308,0.000125],'b':2}and all(math.isfinite(x)for x in value['a'])
    return {'validFiniteNumbersPreserved':True}
case('finite_nested_numbers_positive',finite_positive)
def lifetime(stage):
    keys=('open_inputs','read_held','strict','close_inputs','output','check_row','final_fence')
    saved={k:C[k]for k in keys};opens=[];closes=[];outputs=[]
    good={'schema':'DISTINCT_FIRST_CURRENT_MATURE_BASELINE_V2','oldPacketScope':'FAILED','oldFailedCount':119,'runtimeAuthority':False,'sourceEligibility':False,'files':[{'path':'/mock/one','PRE':{},'bytes':1,'sha256':'a'*64},{'path':'/mock/two','PRE':{},'bytes':1,'sha256':'b'*64}]}
    def opening(paths):
        if len(opens)==1 and stage=='pending-open':raise C['BoundaryFailure']('INJECT_PENDING_OPEN')
        rows=[{'path':str(p),'heldFD':700+len(opens)+i}for i,p in enumerate(paths)];opens.extend(copy.deepcopy(rows));return rows
    def reading(row,*a,**k):
        if row['heldFD']==700:
            if stage=='baseline-read':raise C['BoundaryFailure']('INJECT_BASELINE_READ')
            return {'bytes':1,'sha256':'a'*64},b'{}'
        if stage=='pending-read':raise C['BoundaryFailure']('INJECT_PENDING_READ')
        return {'bytes':1,'sha256':'a'*64},None
    def parsing(raw):
        if stage=='baseline-parse':raise C['BoundaryFailure']('INJECT_BASELINE_PARSE')
        return {**good,'oldFailedCount':0}if stage=='baseline-scope'else good
    def closing(rows):
        attempts=[];bad=[]
        for row in rows:
            closes.append(row['heldFD']);attempts.append({'fd':row['heldFD'],'closeReturn':None})
            if stage in ('pending-close','both-close')and row['heldFD']==701:bad.append(row['heldFD'])
            if stage in ('baseline-close','both-close')and row['heldFD']==700:bad.append(row['heldFD'])
        if bad:
            error=C['BoundaryFailure']('INJECT_CLOSE');error.closeFailures=[{'fd':fd}for fd in bad];raise error
        return attempts
    try:
        C.update(open_inputs=opening,read_held=reading,strict=parsing,close_inputs=closing,output=lambda n,v:outputs.append((n,v))or v,check_row=lambda*a:None,final_fence=lambda*a:None)
        if stage=='complete':
            result=C['consume_baseline']({'bytes':1,'sha256':'a'*64});assert result['status']=='CURRENT_REFERENCE_MATCH'and result['count']==2 and len(outputs)==1
            error=None
        else:
            error=denied(lambda:C['consume_baseline']({'bytes':1,'sha256':'a'*64}));assert not outputs
        assert sorted(closes)==sorted(r['heldFD']for r in opens)and len(set(closes))==len(closes)
        if stage=='both-close':assert {r['fd']for r in error.closeFailures}=={700,701}and error.__cause__is not None
        return {'opened':len(opens),'closeAttempts':closes,'acceptanceWritten':bool(outputs),'failure':repr(error)if error else None}
    finally:C.update(saved)
for stage in ('baseline-read','baseline-parse','baseline-scope','pending-open','pending-read','pending-close','baseline-close','both-close','complete'):
    case('baseline_lifetime_'+stage,lambda stage=stage:lifetime(stage))
def all_close(fail):
    saved=C['os'];saved_ledger=C['LEDGER'];C['LEDGER']=C['InputLedger']();calls=[]
    def close(fd):
        calls.append(fd)
        if fd==fail:raise OSError('INJECT_CLOSE')
    rows=[{'path':'/mock/'+str(fd),'heldFD':fd}for fd in (10,11,12)]
    try:
        C['os']=types.SimpleNamespace(close=close)
        if fail is None:assert len(C['close_inputs'](rows))==3
        else:
            error=denied(lambda:C['close_inputs'](rows));assert len(error.closeFailures)==1
        assert calls==[10,11,12]and all('heldFD'not in r for r in rows)
        assert C['close_inputs'](rows)==[]and calls==[10,11,12]
        return {'allThreeAttempts':calls,'retryUnknownFDs':False,'failureSticky':fail is not None}
    finally:C['os']=saved;C['LEDGER']=saved_ledger
for fail in (None,10,11,12):case('all_owned_closes_once_'+str(fail),lambda fail=fail:all_close(fail))
def partial_open(stage):
    saved={k:C[k]for k in ('os','time','LEDGER')};opened=[];closed=[]
    def statrow(ino):return types.SimpleNamespace(**{'st_'+k:int(v)for k,v in {**current_row()['PRE'],'ino':str(ino)}.items()})
    def opening(path,flags):
        if stage=='second-open'and opened:raise OSError('INJECT_OPEN')
        fd=20+len(opened);opened.append(fd);return fd
    def fstat(fd):
        if stage=='first-fstat':raise OSError('INJECT_FSTAT')
        if stage=='second-drift'and fd==21:return statrow(999)
        return statrow(fd-19)
    try:
        C.update(os=types.SimpleNamespace(lstat=lambda p:statrow(1 if str(p).endswith('one')else 2),open=opening,fstat=fstat,close=lambda fd:closed.append(fd),O_RDONLY=0,O_NOFOLLOW=0),time=types.SimpleNamespace(time_ns=lambda:60000000001),LEDGER=C['InputLedger']())
        denied(lambda:C['open_inputs']([Path('/mock/one'),Path('/mock/two')]))
        assert closed==opened and len(closed)==len(set(closed))
        return {'opened':opened,'explicitCloseAttempts':closed}
    finally:C.update(saved)
for stage in ('second-open','first-fstat','second-drift'):case('partial_open_cleanup_'+stage,lambda stage=stage:partial_open(stage))
def ledger_caps():
    ledger=C['InputLedger']();p=current_row()['PRE'];ledger.reserve('/one',p);ledger.reserve('/one',p);assert ledger.total==1
    error=denied(lambda:ledger.reserve('/one',{**p,'size':'2'}));assert 'REOPEN'in str(error)
    ledger.total=C['TOTAL_MAX'];assert isinstance(denied(lambda:ledger.reserve('/two',p)),C['BoundaryFailure'])
    ledger.active=C['MAX_INPUTS'];assert isinstance(denied(lambda:ledger.reserve('/one',p)),C['BoundaryFailure'])
    assert isinstance(denied(lambda:C['InputLedger']().reserve('/huge',{**p,'size':str(C['READ_MAX']+1)})),C['BoundaryFailure'])
    return {'oneAggregateLedger':True,'capFDs':4096,'capBytes':67108864,'capOneFile':16777216,'noGraphReset':True}
case('aggregate_graph_caps_and_reopen_drift',ledger_caps)
RESULT={'schema':'EXECUTOR_CONSUMER_REPAIR3_SOURCE_MOCK','results':RESULTS,'PASS':sum(r['status']=='PASS'for r in RESULTS),'FAIL':sum(r['status']=='FAIL'for r in RESULTS),'nativeEffects':False,'sourceEligibility':False,'runtimeAuthority':False,'old119':'FAILED_IMMUTABLE'}
