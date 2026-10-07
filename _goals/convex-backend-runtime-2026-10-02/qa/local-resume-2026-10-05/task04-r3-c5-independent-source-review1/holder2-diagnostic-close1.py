"""Close original holder2 as FAILED/UNKNOWN; never refresh any original pin."""
import hashlib,json,os,time
from pathlib import Path
J=Path(__file__).resolve().parent;P=J.parent
B=P/'task04-current-producer-native-public-consumer-repair3'
def nine(s):return {k:str(getattr(s,'st_'+k))for k in ('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')}
def wire(v):return (json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
def main():
    rows=[];mismatches=[];closeErrors=[];closes=[]
    # Diagnostic reads retain the original EXPECTED tuple and classify every gap.
    # A changed file is forensic DATA only; it cannot pass its old source gate.
    for i,(path,pin)in enumerate(sorted(cohort_pins.items())):
        expected=dict(pin['PRE9']);before=nine(os.fstat(pin['fd']));now=time.time_ns()
        row={'inputIndex':i,'path':path,'expectedOriginalNine':expected,'heldBefore':before,
             'originalCapturedUnixNs':pin['capturedUnixNs'],'expectedSha256':pin['sha256'],'expectedBytes':pin['bytes']}
        age=now-max(int(before['mtime_ns']),int(before['ctime_ns']));row['currentMaxMetadataAgeNs']=age
        if age<60000000000:
            row['status']='UNKNOWN_CURRENT_IMMATURE_FORENSIC_CONTENT_NOT_READ'
        else:
            os.lseek(pin['fd'],0,os.SEEK_SET);h=hashlib.sha256();n=0
            while b:=os.read(pin['fd'],65536):n+=len(b);assert n<=16777216;h.update(b)
            held=nine(os.fstat(pin['fd']));pathnow=nine(Path(path).lstat())
            row.update(heldAfter=held,pathAfter=pathnow,fullEOF=n==int(before['size']),bytes=n,sha256=h.hexdigest())
            row['changedFields']=[k for k in expected if expected[k]!=held[k]]
            row['status']='EXACT_ORIGINAL_HELD_FINAL'if before==held==pathnow==expected and(n,h.hexdigest())==(pin['bytes'],pin['sha256'])else'FAILED_ORIGINAL_EXPECTATION_NOT_REPAIRED'
        if row['status']!='EXACT_ORIGINAL_HELD_FINAL':mismatches.append(row)
        rows.append(row)
    originalGraph=[{'path':r['path'],'PRE9':r['expectedOriginalNine'],'bytes':r['expectedBytes'],'sha256':r['expectedSha256']}for r in rows]
    # Compact current/reference proof; all changed rows retain complete nine fields.
    value={'scope':'ORIGINAL_HOLDER2_FINAL_FAILED_UNKNOWN_NOT_REPAIRED','status':'FAILED_UNKNOWN'if mismatches else'EXACT',
      'inputCount':len(rows),'sourceLedger':source_ledger(),'completeOriginalGraphSha256':hashlib.sha256(wire(originalGraph)).hexdigest(),
      'upstreamMFByReference':str(B/'final-current-combined-closure.json'),'Root197ByReference':str(P/'root-task04-r3-c5-mature-readback2.json'),
      'originalExpectationMismatches':mismatches,'unchangedFinalCount':len(rows)-len(mismatches),
      'inputOrder':'SORTED_ABSOLUTE_PATHS_UNION_OF_UPSTREAM_ROOT197_DECLARED_BOOTSTRAP_AND_ALL_ADDED_SOURCE_CONTROL_DATA',
      'allFinalChecksByInputIndex':[[r['inputIndex'],r['status'],r.get('fullEOF',False),r.get('sha256'),r.get('bytes')]for r in rows],
      'additionalOriginalRows':[{k:v for k,v in r.items()if k!='inputIndex'}for r in rows if r['path'].startswith(str(J)+'/')],
      'sourceEligibility':False,'runtimeAuthority':False,'verdictNotPublished':True,'historicalPinsRefreshed':False,'actualEffects':False}
    for i,(path,pin)in enumerate(sorted(cohort_pins.items())):
        assert not pin['closeAttempted'];pin['closeAttempted']=True
        try:returned=os.close(pin['fd']);closes.append([i,pin['fd'],returned])
        except BaseException as e:closeErrors.append({'inputIndex':i,'path':path,'fd':pin['fd'],'failure':repr(e),'retryForbidden':True})
    value.update(closeCallsByInputIndex=closes,closeErrors=closeErrors,allAttemptedExactlyOnce=True,attempts=len(closes)+len(closeErrors))
    raw=wire(value);target=J/'holder2-final-UNKNOWN-closure1.json';target.write_bytes(raw)
    return {'path':str(target),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'status':value['status'],
            'mismatches':mismatches,'sourceLedger':source_ledger(),'explicitCloseAttempts':value['attempts'],'closeErrors':closeErrors}

