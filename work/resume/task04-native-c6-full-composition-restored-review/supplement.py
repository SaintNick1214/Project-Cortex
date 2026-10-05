from verify import *
refs=[];seen=set()
def visit(x):
 if isinstance(x,dict):
  b=x.get('beforeByteBacking')
  if isinstance(b,dict) and 'path'in b and 'sha256'in x and 'bytes'in x:
   key=(b['path'],x['bytes'],x['sha256'])
   if key not in seen:refs.append(backing(b['path'],x['bytes'],x['sha256'],(b['bytes'],b['sha256'])));seen.add(key)
  for v in x.values():visit(v)
 elif isinstance(x,list):
  for v in x:visit(v)
result=json.load(open(OLDE/'review-result.json'));before=json.load(open(result['before']));visit(before);visit(result)
for c in result['compilerReceipts']:
 assert c['effectiveDeadline']==min(c['parentAbsoluteDeadline'],c['invocationStart']+20000);assert c['service']['rawComplete'] and c['service']['evidenceComplete']
 for s in c['service']['streams']:refs.append(backing(s['path'],s['rawBytes'],s['rawSHA256'],(s['encodedBytes'],s['encodedSHA256'])))
for p in result['sourcePOST']:
 a=row(p['path']);assert a['bytes']==p['bytes'] and a['sha256']==p['sha256'];i=p['identity']
 for k in ['dev','ino','mode','uid','size','nlink']:assert float(a['identity'][k])==float(i[k]),p['path']
 for ns,ms in [('mtime_ns','mtimeMs'),('ctime_ns','ctimeMs')]:assert abs(a['identity'][ns]/1000000-i[ms])<=.001,p['path']
assert all(a['status']=='SUCCESS' for a in result['cleanup']['attempted'])
bindings=json.load(open(S/'prepared122bindings.json'));matrix=[]
for c in bindings['commands']:
 matrix.append({'id':c['id'],'outcome':'UNEXECUTED_HELD_NOT_ACCEPTED','originalArgv':c['originalArgv'],'preparedArgv':c['preparedArgv'],'originalEntry':c['originalEntry'],'originalEntrySHA256':c['originalEntrySHA256'],'ownedEntry':c['ownedEntry'],'vmSelectors':c.get('vmSelectors'),'requirementScope':'All applicable B01-B10, original source assertions/tier/caps intact; preparation and OWN controls do not prove this original outcome.'})
dump(Q/'original122-requirements-matrix.json',{'scope':'FULL_FINITE_ORIGINAL122','rows':matrix,'count':len(matrix),'executedOriginalIDs':0})
dump(T/'verified-inner-backing-references.json',{'refs':refs,'currentVerificationOnly':True})
dump(Q/'inner-raw-verification.json',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'priorReviewRoot':str(OLDE),'priorBeforeInstallRows':len(before['files']),'currentStreamedInnerBackingRefs':len(refs),'priorCompilerDeadlineFormulaVerified':True,'allPrior17RestoreSuccessesVerified':True,'priorCurrentSourcePOSTBytesSHAVerified':True,'priorRecordedIdentityComparison':'JS_NUMBER_PRECISION_ONLY_NOT_EXACT_INTEGER_CUSTODY','currentCensus':census(),'noNewCandidateDispatch':True})
print('INNER verified',len(refs))
