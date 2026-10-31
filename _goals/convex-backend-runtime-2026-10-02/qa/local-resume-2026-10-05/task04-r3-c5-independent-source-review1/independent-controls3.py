"""Distinct original harness reference correction; previous attempt immutable."""
import hashlib,json,types,ast,os,time
from pathlib import Path
J=Path(__file__).resolve().parent;P=J.parent
A=P/'task04-current-producer-native-public-repair3';B=P/'task04-current-producer-native-public-consumer-repair3'
OLD=P/'task04-current-producer-native-public-repair1'

def main():
    ns={'__file__':str(J/'independent-controls1.py'),'__name__':'independent_corrected_reference',
        'held_source':held_source,'cohort_pins':cohort_pins,'source_ledger':source_ledger}
    exec(compile(held_source(str(J/'independent-controls1.py')),str(J/'independent-controls1.py'),'exec'),ns)
    record=ns['record']
    def conservation():
        ref=json.loads(held_source(str(A/'original100-conservation-reference.json')));fail=[];refs=[]
        proof=ref['originalProof'];pr=held_source(proof['path']);assert(len(pr),hashlib.sha256(pr).hexdigest())==(proof['bytes'],proof['sha256'])
        for row in ref['rows']:
            path=str(A/row['newExactConservationBacking'])
            if path not in cohort_pins:
                assert row['runtimeSameBytes']is False
                path=str(OLD/row['newExactConservationBacking'])
                refs.append({'original':row['originalSource'],'actualByReference':path,'newCopy':False})
            raw=held_source(path)
            if(len(raw),hashlib.sha256(raw).hexdigest())!=(row['bytes'],row['sha256']):fail.append(row['originalSource'])
        record('Conservation.original100.exactBytes',len(ref['rows'])==100 and not fail,count=len(ref['rows']),failures=fail,byReferencePreimages=refs,historicalCustodyRepaired=False)
        current=json.loads(held_source(str(A/'source/source-manifest.json')));old=json.loads(held_source(str(OLD/'source/source-manifest.json')))
        om={r['path']:r for r in old['files']};changed=[];unchanged=0
        for row in current['files']:
            raw=held_source(str(A/'source'/row['path']));assert(len(raw),hashlib.sha256(raw).hexdigest())==(row['bytes'],row['sha256'])
            if row==om[row['path']]:unchanged+=1
            else:changed.append(row['path'])
        record('Conservation.R3.onlyTwoChanges',unchanged==110 and changed==['ci-run.py','public_export_contract.py'],unchanged=unchanged,changed=changed,whole112Exact=True)
        plans=[p for p in cohort_pins if p.startswith(str(B)+'/data/')and 'plan'in Path(p).name and p.endswith('.json')];summaries=[]
        for path in plans:
            plan=json.loads(held_source(path));files=plan.get('files',[])
            if files and isinstance(files,list)and isinstance(files[0],dict)and 'roles'in files[0]:
                s113=sum('STABLE_OPERATIVE113'in r['roles']for r in files);s336=sum('STABLE_ORIGINAL336'in r['roles']for r in files);old119=[];bad=[]
                for row in files:
                    held=cohort_pins[row['path']]['PRE9']
                    if row.get('stableLiteral')is not None and row['stableLiteral']!=held:bad.append(row['path'])
                    prior=row.get('oldPacketLiteral')
                    if prior is not None and prior!=held:old119.append([k for k in held if held[k]!=prior[k]])
                summaries.append({'path':path,'stable113':s113,'stable336':s336,'oldMismatches':len(old119),'changedFieldSets':sorted(set(tuple(v)for v in old119)),'stableMismatch':bad})
        record('Conservation.stable113.336.old119',bool(summaries)and all(x['stable113']==113 and x['stable336']==336 and x['oldMismatches']==119 and x['changedFieldSets']==[('ctime_ns',)]and not x['stableMismatch']for x in summaries),plans=summaries)
    ns['conservation']=conservation
    # The original harness's exact actual candidate AST/functions are retained.
    # Only its author-owned conservation locator is corrected by explicit reference.
    result=ns['main']()
    raw=held_source(str(B/'programs/consumer.py'));cn=ns['consumer'](raw)
    for label,action in [
      ('perFile',lambda L:L.reserve(Path('/owned/a'),{'size':str(16777217)})),
      ('aggregate',lambda L:[L.reserve(Path('/owned/'+str(i)),{'size':str(16777216)})for i in range(5)]),
      ('distinctCount',lambda L:[L.reserve(Path('/owned/'+str(i)),{'size':'0'})for i in range(4097)]),
      ('activeFDs',lambda L:(setattr(L,'active',4096),L.reserve(Path('/owned/a'),{'size':'1'}))),
      ('repeatNineDrift',lambda L:(L.reserve(Path('/owned/a'),{'size':'1'}),L.reserve(Path('/owned/a'),{'size':'2'})))]:
        L=cn['InputLedger']();err=None
        try:action(L)
        except BaseException as e:err=e
        record('C5.ledger.denial.'+label,err is not None,bytes=L.total,paths=len(L.paths),errorChain=ns['chain'](err))
    L=cn['InputLedger']();L.reserve(Path('/owned/a'),{'size':'10'});L.reserve(Path('/owned/a'),{'size':'10'})
    record('C5.ledger.reopenDoesNotReset',L.total==10 and len(L.paths)==1,bytes=L.total,paths=len(L.paths))
    value={'scope':'INDEPENDENT_CORRECTED_ISOLATED_SOURCE_CONTROLS_ONLY','rows':ns['ROWS'],
           'pass':sum(r['status']=='PASS'for r in ns['ROWS']),'fail':sum(r['status']=='FAIL'for r in ns['ROWS']),
           'ledger':source_ledger(),'priorReferenceFailureImmutable':True,'candidateProgramsExecuted':False,
           'Docker':False,'private':False,'native':False,'fixtureFDsAllClosedByHarness':True}
    target=J/'independent-controls3.json';target.write_text(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n')
    return {'path':str(target),'pass':value['pass'],'fail':value['fail'],'failNames':[r['name']for r in ns['ROWS']if r['status']=='FAIL']}
