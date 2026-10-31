"""One combined mature final packet/reference receipt, without duplicate row graphs."""
import hashlib,json,os,stat,time
from pathlib import Path
N=Path(__file__).resolve().parents[1];P=N.parent
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
bootstrap=[];raws={};first=[]
try:
    for p in (N/'programs/consumer.py',N/'data/inputs-plan2.json'):
        pin=ident(p.lstat());age=time.time_ns()-max(int(pin['mtime_ns']),int(pin['ctime_ns']))
        assert age>=60000000000 and pin['nlink']=='1'and stat.S_ISREG(int(pin['mode']))
        fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);bootstrap.append({'path':str(p),'PRE':pin,'OPEN':ident(os.fstat(fd)),'heldFD':fd,'ageNsAtFirstOpen':age});assert bootstrap[-1]['OPEN']==pin
    for entry in bootstrap:
        parts=[]
        while b:=os.read(entry['heldFD'],65536):parts.append(b)
        raw=b''.join(parts);assert len(raw)==int(entry['PRE']['size'])and ident(os.fstat(entry['heldFD']))==entry['PRE']and ident(os.lstat(entry['path']))==entry['PRE']
        raws[entry['path']]=raw;first.append({**entry,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'EOF':True})
except BaseException:
    for row in bootstrap:os.close(row['heldFD'])
    raise
C={'__file__':str(N/'programs/consumer.py'),'__name__':'final_finite_current_consumer'}
exec(compile(raws[str(N/'programs/consumer.py')],str(N/'programs/consumer.py'),'exec'),C)
for row in first:C['LEDGER'].reserve(row['path'],row['PRE']);C['LEDGER'].opened()
plan=C['strict'](raws[str(N/'data/inputs-plan2.json')]);expected={r['path']:r for r in plan['files']}
names=sorted(set([Path(p)for p in expected]+[p for p in N.rglob('*')if p.is_file()]))
held=C['open_inputs'](names);rows=[];raw_data={}
try:
    # All graph FDs precede any referenced graph contents. The header phase shares
    # this same aggregate ledger; no reset occurs at the graph boundary.
    for entry in held:
        row,raw=C['read_held'](entry,expected.get(entry['path']),collect=True)
        pin=expected.get(entry['path'])
        if pin and pin.get('stableLiteral')is not None:assert row['PRE']==pin['stableLiteral']
        rows.append(row);raw_data[row['path']]=raw
    baseline=C['strict'](raw_data[str(N/'evidence/first-current-mature-baseline1.json')])
    current=C['strict'](raw_data[str(N/'evidence/current-consumer1.json')])
    assert baseline['count']==current['count']==1500 and current['status']=='CURRENT_REFERENCE_MATCH'and current['old119Scope']=='FAILED_IMMUTABLE'
    bypath={r['path']:r for r in rows}
    for old in baseline['files']:
        now=bypath[old['path']];assert now['PRE']==old['PRE']and(now['bytes'],now['sha256'])==(old['bytes'],old['sha256'])
    final=[]
    for entry,row in zip(held,rows):
        again,_=C['read_held'](entry,{'bytes':row['bytes'],'sha256':row['sha256']});assert again['PRE']==row['PRE'];C['final_fence'](again)
        final.append({**row,'heldFINAL':again['heldFINAL'],'pathFINAL':again['pathFINAL'],'finalFullEOF':True,'finalBytes':again['bytes'],'finalSHA256':again['sha256']})
    for entry in bootstrap:
        again,_=C['read_held'](entry);C['final_fence'](again)
    own_paths=[r['path']for r in final if Path(r['path']).is_relative_to(N)]
    reference_bytes=sum(r['bytes']for r in final)
finally:
    try:closes=C['close_scope'](held)
    finally:bootstrap_closes=C['close_scope'](bootstrap)
value={'schema':'FIRST_MATURE_REPAIR3_FINAL_PACKET_AND_FULL_REFERENCES_COMBINED','scope':'CURRENT_DATA_MATCH_ONLY','files':final,'count':len(final),'bytes':reference_bytes,'ownFirstMatureCurrentPaths':own_paths,'FDCloses':closes,'bootstrapFirstMature':first,'bootstrapFDCloses':bootstrap_closes,'allGraphFDsBeforeReferencedContents':True,'allFinalFullEOFFencesBeforeExplicitCloses':True,'minimumAgeNs':min(r['ageNsAtFirstOpen']for r in final),'aggregateLedger':{'paths':len(C['LEDGER'].paths),'bytes':C['LEDGER'].total,'peakFDs':C['LEDGER'].peak,'activeAfterClose':C['LEDGER'].active},'old119':'FAILED_IMMUTABLE','historicalCustodyRepaired':False,'sourceEligibility':False,'runtimeAuthority':False,'allOriginalSixTask04':'OPEN','Task03':'OPEN','full17Goal':'OPEN','sourceSyntaxFailurePlan1':'PRESERVED_SUPPLEMENTAL_DATA','publicationOutputsSelfExcludedUpstream':True}
pin=C['output']('final-current-combined-closure.json',value)
print(json.dumps({'count':len(final),'graphBytes':reference_bytes,'closure':pin,'sourceEligibility':False}))
