import pathlib,json,datetime,sys,hashlib
profile=sys.argv[1]
assert profile in ['extension','regression','extra']
s=pathlib.Path('work/backend-runtime/task04-model-drift-native-'+profile+'-c3')
rows=[]
for p in s.glob('journal-*.jsonl'):
    for line in p.read_text().splitlines():
        try: rows.append(json.loads(line))
        except json.JSONDecodeError as error: raise RuntimeError('QA_PROGRESS_JOURNAL_INVALID_JSON') from error
last=rows[-1] if rows else {}
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'profile':profile,'journalRows':len(rows),'nativeTickets':len(list(s.glob('ticket-native-*.json'))),'corePasses':[r['caseId'] for r in rows if r.get('phase')=='case' and r.get('status')=='PASS'],'publicDenials':sum(r.get('phase')=='security' and r.get('observedCategory')=='authorization-denied' for r in rows),'wholeStateChecks':sum(r.get('noEffect') is True for r in rows),'createdWitnesses':len(list(s.glob('owned-created-*.json'))),'deletedWitnesses':len(list(s.glob('owned-deleted-*.json'))),'currentBothIdReceipt':(s/'current-physical-id-input-receipt.json').exists(),'lastEvent':{k:last.get(k) for k in ['phase','caseId','status','failureClass']},'aggregateAcceptance':'PENDING','scriptSHA256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()}
with pathlib.Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-c3-coordinator-progress.jsonl').open('a') as f:f.write(json.dumps(result)+'\n')
print(json.dumps(result))
