"""Meaningful MOCK/STATIC consumer checks; no operative R1 behavior execution."""
import copy,json
RESULTS=[]
def case(name,fn):
    try:detail=fn();RESULTS.append({'name':name,'status':'PASS','kind':'MOCK_STATIC','detail':detail})
    except BaseException as error:RESULTS.append({'name':name,'status':'FAIL','kind':'MOCK_STATIC','error':repr(error)})
def deny(fn):
    try:fn()
    except BoundaryFailure as error:return str(error)
    raise AssertionError('DENIAL_REQUIRED')
def row():
    pin={'dev':'1','ino':'2','mode':'33152','uid':'0','gid':'0','nlink':'1','size':'1','mtime_ns':'1','ctime_ns':'1'}
    return {'PRE':pin,'OPEN':copy.deepcopy(pin),'POST':copy.deepcopy(pin),'pathFINAL':copy.deepcopy(pin),'heldFINAL':copy.deepcopy(pin),'heldFD':123,'bytes':1,'sha256':'a'*64,'EOF':True}
def positive():
    r=row();assert check_row(r,{'identity':r['PRE'],'bytes':1,'sha256':'a'*64})==r['PRE'];return {'allNineAndEOFRequired':True}
case('complete-current-nine-fullEOF-positive',positive)
for field in FIELDS:
    def drift(field=field):
        r=row();r['heldFINAL'][field]='3';reason=deny(lambda:check_row(r));return {'field':field,'lateDriftDenied':True,'reason':reason}
    case('late-current-held-'+field+'-denied',drift)
for phase in ('OPEN','POST','pathFINAL'):
    def phase_drift(phase=phase):
        r=row();r[phase]['ctime_ns']='3';return {'reason':deny(lambda:check_row(r)),'phase':phase}
    case('late-current-'+phase+'-ctime-denied',phase_drift)
for key,value in [('heldFD',True),('heldFD',1.5),('bytes',True),('EOF',1),('sha256','a'*63)]:
    def alias(key=key,value=value):
        r=row();r[key]=value;return {'reason':deny(lambda:check_row(r)),'numericAliasAccepted':False}
    case('current-alias-'+key+'-'+str(value)+'-denied',alias)
for value in (None,False,{}, {'ctime_ns':'1'}):case('malformed-nine-'+str(value),lambda value=value:{'reason':deny(lambda:literal_identity(value))})
for value in ('01','1.0','1e0','-0',1,True):
    def bad_identity(value=value):
        pin=row()['PRE'];pin['ino']=value;return {'reason':deny(lambda:literal_identity(pin))}
    case('exact-decimal-'+str(value)+'-denied',bad_identity)
def bytes_drift():
    r=row();return {'reason':deny(lambda:check_row(r,{'identity':r['PRE'],'bytes':1,'sha256':'b'*64}))}
case('full-byte-hash-mismatch-denied',bytes_drift)
def maturity_positive():
    assert mature(row()['PRE'],60000000001)==60000000000;return {'exact60AgeRequired':True}
case('maturity60-exact-positive',maturity_positive)
case('maturity60-one-nanosecond-early-denied',lambda:{'reason':deny(lambda:mature(row()['PRE'],60000000000))})
def ctime_age():
    pin=row()['PRE'];pin['ctime_ns']='100';return {'reason':deny(lambda:mature(pin,60000000001))}
case('maturity-counts-latest-ctime-not-only-mtime',ctime_age)
def old_stays_failed():
    value=old_scope_status(119,True);assert value['historicalScope']=='FAILED'and value['newCurrentConsumerScope']=='MATCH_ONLY'and value['historicalCustodyRepaired']is False and value['runtimeAuthority']is False
    return value
case('new-current-success-never-repairs-old119-scope',old_stays_failed)
case('old-failure-scope-numeric-alias-denied',lambda:{'reason':deny(lambda:old_scope_status(True,True))})
case('current-success-numeric-alias-denied',lambda:{'reason':deny(lambda:old_scope_status(119,1))})
for raw in (b'{"a":1,"a":2}',b'{"a":{"x":1,"x":2}}',b'NaN',b'Infinity'):
    case('strict-json-'+raw.decode(),lambda raw=raw:{'reason':deny(lambda:strict(raw))})
def spec_alias(key,value):
    changed=copy.deepcopy(SPEC);changed[key]=value
    return {'deniedBeforeAnyReferencedFileRead':True,'reason':deny(lambda:validate_spec(changed))}
for key,value in [('minimumMaturitySeconds',60.0),('stableSourceCount',113.0),('originalPacketFailedCount',True),
                  ('runtimeAuthority',0),('old119OriginalPinsNowMatch',0),('semanticDelta',False)]:
    case('contract-numeric-alias-'+key+'-denied',lambda key=key,value=value:spec_alias(key,value))
def spec_unknown_path():
    changed=copy.deepcopy(SPEC);changed['anchors'][0]['relativeToP']='../private/.env'
    return {'referencedReads':0,'reason':deny(lambda:validate_spec(changed))}
case('unknown-private-path-anchor-denied-before-read',spec_unknown_path)
def partial_anchors():
    changed=copy.deepcopy(SPEC);changed['anchors'].pop()
    return {'reason':deny(lambda:validate_spec(changed))}
case('partial-complete-boundary-membership-denied',partial_anchors)
def duplicate_anchors():
    changed=copy.deepcopy(SPEC);changed['anchors'][1]=copy.deepcopy(changed['anchors'][0])
    return {'reason':deny(lambda:validate_spec(changed))}
case('duplicate-complete-boundary-membership-denied',duplicate_anchors)
value={'schema':'CONSUMER_BOUNDARY_MOCK_STATIC_OUTCOMES_V2','results':RESULTS,
       'PASS':sum(r['status']=='PASS'for r in RESULTS),'FAIL':sum(r['status']=='FAIL'for r in RESULTS),
       'candidateBehaviorExecuted':False,'prior83AssertionsConservedNotIndependentPASS':True,
       'sourceEligibility':False,'runtimeAuthority':False,'old119Scope':'FAILED','allOriginalFunctionalGates':'OPEN_HELD'}
output('controls/outcome-results1.json',value)
require(value['FAIL']==0,'MOCK_CONTROL_FAILURE')
print(json.dumps({'MOCK_STATIC_PASS':value['PASS'],'FAIL':value['FAIL']}))
