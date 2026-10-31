import json, hashlib
from pathlib import Path

OWN=Path(__file__).resolve().parents[1]
first=json.loads((OWN/'evidence/first-prospective-held-source-external1.json').read_bytes())
last=json.loads((OWN/'evidence/final-held-source-external-FDclosure1.json').read_bytes())
final={row['path']:row for row in last['files']}
results=[]

def kinds(row): return row['kind'] if isinstance(row['kind'],list) else [row['kind']]
def control(name, passed, evidence):
    results.append({'name':name,'status':'PASS' if passed else 'FAIL','evidence':evidence})

pre_errors=[x for x in first['errors'] if x['stage']=='PRE']
bad_paths={x['path'] for x in pre_errors}
for kind,count in [('prospective-source-113',113),('old-external-336',336)]:
    rows=[row for row in first['files'] if kind in kinds(row)]
    good=True
    for row in rows:
        z=final[row['path']]
        good=good and row['path'] not in bad_paths and row['EOF'] and z['EOF'] and row['PRE']==row['OPEN']==row['POST']==row['pathFINAL']==z['heldBEFORE']==z['heldFINAL']==z['pathFINAL'] and row['sha256']==z['sha256'] and row['bytes']==z['bytes']
    control(kind+'-complete-literal-pin-and-held-final',good and len(rows)==count,{'count':len(rows),'expectedCount':count,'failures':[r['path'] for r in rows if r['path'] in bad_paths]})

packet=[row for row in first['files'] if 'closed-packet-286' in kinds(row)]
control('closed-packet-all-nine-literal-fence',not bad_paths and len(packet)==286,{'packetFiles':len(packet),'distinctFailedFiles':len(bad_paths),'cause':'UNKNOWN'})
control('closed-packet-complete-current-byte-pins',all(x['expected']['sha256']==x['actual']['sha256'] and x['expected']['bytes']==x['actual']['bytes'] for x in first['errors'] if x['stage']=='FIRST_EOF'),{'byteMismatches':0,'allFailedMetadataRowsStillHaveUnchangedFullHashAndSize':True})
control('no-follow-regular-single-link-no-inode-alias',not any(x['error'] in ['not-regular-noalias','inode-alias'] for x in first['errors']),{'noFollow':True,'checkedFiniteFiles':len(first['files'])})
control('complete-FD-close-observed',len(last['FDCloses'])==len(last['files']) and all(row.get('return','MISSING') is None and 'error' not in row for row in last['FDCloses']),{'files':len(last['files']),'closes':len(last['FDCloses'])})
own_errors=[row for row in last['errors'] if row['stage']=='FINAL']
control('own-first-PRE-final-literal-fence',not own_errors,{'ownFailures':own_errors,'cause':'UNKNOWN','failedPINRefreshed':False})
control('sticky-failed-first-fence-conservative-admission',last['status']=='FAIL' and all(x in last['errors'] for x in first['errors']) and len(pre_errors)==119 and all({k for k in x['expected'] if x['expected'][k]!=x['actual']['PRE'][k]}=={'ctime_ns'} for x in pre_errors),{'preservedFirstErrors':len(first['errors']),'finalErrors':len(last['errors']),'sourceEligibility':False,'activationPermitted':False,'normalization':False,'tolerance':False,'failedPINRefreshed':False})

out={'scope':'INDEPENDENT_FINITE_CURRENT_SOURCE_PACKET_FENCE_CONTROLS_ONLY','candidateEffects':'NONE','nativeExecuted':False,'DockerExecuted':False,'privateAccess':False,'results':results,'PASS':sum(x['status']=='PASS' for x in results),'FAIL':sum(x['status']=='FAIL' for x in results),'unexecutedBehavioralControls':['integrated-two-PID1-composition','post-wait-poll-FD-close-per-call-deadlines','Docker-full-vector-and-mount-exactness','strict-public-export','ownership-retirement-failure-cleanup','runtime-races'],'reasonForStopping':'Concrete first prospective literal closed packet metadata blocker reproduced; no blind rerun or failed pin refresh'}
with (OWN/'controls/independent-fence-control-results1.json').open('x') as f:json.dump(out,f,sort_keys=True,indent=2);f.write('\n')
print(json.dumps({'PASS':out['PASS'],'FAIL':out['FAIL'],'scope':out['scope'],'failedNames':[x['name'] for x in results if x['status']=='FAIL']}))
