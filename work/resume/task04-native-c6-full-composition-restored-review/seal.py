from verify import *
# Reserve sole excluded file before recording root identity and membership.
for r in [Q,W,T]:
 for p in r.iterdir():
  if p.is_file():os.chmod(p,0o600)
 (r/'seal.json').write_text('RESERVED\n');os.chmod(r/'seal.json',0o600)
refs=[]
for p in [*Q.iterdir(),*W.iterdir(),*T.iterdir()]:
 if p.is_file() and p.name!='seal.json':refs.append({'path':str(p),**row(p)})
dump(Q/'evidence-references.json',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'directExactRefs':refs,'fullBackingIndexes':[str(T/'verified-backing-references.json'),str(T/'verified-inner-backing-references.json')],'sourceSnapshotRoots':[str(x) for x in ROOTS],'oldReviewSnapshotRoots':[str(OLDQ),str(OLDW),str(OLDE)],'soleOwnExclusion':'seal.json','noOriginalOrCandidateExecution':True})
summary=[]
for r in [Q,W,T]:
 rows=literal(r,True);dump(r/'seal.json',{'root':str(r),'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exclusion':'ONLY_OWN_ROOT_seal.json','literalNoLinkTraversal':True,'regularBytes':sum(x.get('bytes',0) for x in rows),'rows':rows});assert literal(r,True)==rows
 summary.append({'root':str(r),'sealSHA256':row(r/'seal.json')['sha256'],'rows':len(rows)})
print(json.dumps({'report':{'path':str(Q/'report.md'),**row(Q/'report.md')},'seals':summary,'originalFULLCriterionMet':False,'verdict':'REJECT','dimensionScores':[2,3,3,4,2],'average':2.8,'terminalNodeCensus':json.load(open(Q/'verification-POST.json'))['currentOWNNodeCensus']}))
