import gzip,hashlib,json,os,stat,datetime
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex')
T=Path('/dev/shm/cortex-native-c6-closed-launcher-c6/runs')
def held(p):
 p=Path(p); fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd); assert stat.S_ISREG(a.st_mode)
  with os.fdopen(os.dup(fd),'rb') as f: raw=f.read()
  b=os.fstat(fd); c=os.lstat(p)
  keys=('st_dev','st_ino','st_mode','st_uid','st_gid','st_nlink','st_size','st_mtime_ns','st_ctime_ns')
  assert all(getattr(a,k)==getattr(b,k)==getattr(c,k) for k in keys)
  return raw,dict(zip(keys,(getattr(a,k) for k in keys)))
 finally: os.close(fd)
def sha(b): return hashlib.sha256(b).hexdigest()
results=[]
for batch in ('fd2c9157eebd4b2fbc22271a25aa2713',):
 receiptPath=T/batch/'receipt.json'; raw,ident=held(receiptPath); d=json.loads(raw)
 captures=[]
 for kind in ('original8PRE','original8POST'):
  row=d[kind]; enc,ci=held(row['path']); assert len(enc)==row['bytes'] and sha(enc)==row['sha256']
  decoded=gzip.decompress(enc); assert sha(decoded)==row['decodedSha256']
  parsed=json.loads(decoded); assert len(parsed['files'])==row['rows']==148325
  captures.append(parsed)
 assert captures[0]['files']==captures[1]['files']
 pre=d['commands'][0]['sourcePRE']; post=d['sourcePOST']
 oldrows={r['path']:r for r in pre};newrows={r['path']:r for r in post};assert set(oldrows)==set(newrows)
 delta=[p for p in sorted(oldrows) if (oldrows[p]['bytes'],oldrows[p]['sha256'])!=(newrows[p]['bytes'],newrows[p]['sha256'])]
 W=ROOT/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6'
 assert delta==sorted(str(W/n) for n in ('finite-producer-rules.json','prepared-source-inputs.json'))
 versions={}
 for name in ('finite-producer-rules.json','prepared-source-inputs.json'):
  p=str(W/name);old=oldrows[p];enc,_=held(old['beforeByteBacking']);assert sha(enc)==old['encodedSHA256']
  oldbytes=gzip.decompress(enc);assert sha(oldbytes)==old['sha256'];newbytes,ni=held(p);assert sha(newbytes)==newrows[p]['sha256'] and len(newbytes)==newrows[p]['bytes']
  versions[name]=(json.loads(oldbytes),json.loads(newbytes),ni)
 oldrules,newrules,_=versions['finite-producer-rules.json'];assert oldrules['kind']==newrules['kind']
 assert set(newrules['perId'])==set(oldrules['perId'])
 assert [k for k in oldrules['perId'] if oldrules['perId'][k]!=newrules['perId'][k]]==['OWN_EXTERNAL_REVIEW']
 assert all(newrules['perId'][k]==v for k,v in oldrules['perId'].items() if k!='OWN_EXTERNAL_REVIEW')
 assert len(oldrules['perId'])==124 and sum(len(v['calls']) for k,v in oldrules['perId'].items() if k!='OWN_EXTERNAL_REVIEW')==244
 producerRaw,producerIdentity=held(W/'external-review-executor.mjs');producerSHA=sha(producerRaw)
 astProof=json.loads(held(ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c6-root-external-own-callsite-ast-inspection.json')[0]);assert astProof['status']=='ROOT_EXACT_OLD_AND_NEW_OWN_CALLSITE_AST_BINDINGS_VERIFIED'
 astVersions={r['version']:r for r in astProof['results']}
 for ordinal,(a,b) in enumerate(zip(oldrules['perId']['OWN_EXTERNAL_REVIEW']['calls'],newrules['perId']['OWN_EXTERNAL_REVIEW']['calls'])):
  assert b['producerSHA256']==producerSHA
  assert {k:v for k,v in a.items() if k not in ('producerSHA256','columnStart','columnEnd')}=={k:v for k,v in b.items() if k not in ('producerSHA256','columnStart','columnEnd')}
  for version,row in (('old',a),('new',b)):
   assert astVersions[version]['sourceSHA256']==row['producerSHA256']
   assert all(astVersions[version]['nodes'][ordinal][k]==row[k] for k in ('kind','line','columnStart','columnEnd','argumentExpression'))
 assert len(newrules['perId']['OWN_EXTERNAL_REVIEW']['calls'])==2
 oldpins,newpins,_=versions['prepared-source-inputs.json'];oa={r['path']:r for r in oldpins['files']};na={r['path']:r for r in newpins['files']}
 assert set(oa)==set(na) and [p for p in oa if oa[p]!=na[p]]==[str(W/'finite-producer-rules.json')]
 assert na[str(W/'finite-producer-rules.json')]['sha256']==newrows[str(W/'finite-producer-rules.json')]['sha256']
 backing={}
 for cmd in d['commands']:
  for r in cmd['sourcePRE']:
   name=r['beforeByteBacking']
   if name in backing: assert backing[name]==(r['bytes'],r['sha256']); continue
   enc,_=held(name); assert len(enc)==r['encodedBytes'] and sha(enc)==r['encodedSHA256']
   decoded=gzip.decompress(enc); assert len(decoded)==r['bytes'] and sha(decoded)==r['sha256']
   backing[name]=(r['bytes'],r['sha256'])
 streams=[]
 for f in sorted(receiptPath.parent.iterdir()):
  if f.suffix in ('.stdout','.stderr'):
   b,i=held(f); streams.append({'path':str(f),'bytes':len(b),'sha256':sha(b),'identity':i,'text':b.decode('utf-8')})
 commands=[]
 for c in d['commands']:
  row={k:c[k] for k in ('argv','utcStart','utcEnd','utcTimeoutObserved','exitCode','status','rawPartialOnly') if k in c}
  if 'timeoutOwnershipCleanup' in c:
   cleanup=c['timeoutOwnershipCleanup']; assert cleanup['complete'] and not cleanup['errors']
   assert cleanup['observations'][-1]['remainingLive']==[]
   row['recordedCleanupComplete']=True; row['recordedRemainingLive']=[]
  commands.append(row)
 assert d['original8LiteralRowsAndIdentitiesEqual'] and d['sourceByteHashesEqual'] is False
 assert d.get('primaryFailure') is None and all(c['exitCode']==0 for c in commands)
 results.append({'batch':batch,'receiptSHA256':sha(raw),'receiptIdentity':ident,'commands':commands,'streams':streams,'fullLiteralRowsCompared':148325,'sourceRowsCompared':len(pre),'uniqueBeforeByteBackingsDecoded':len(backing),'beforeByteBackingRawBytes':sum(x[0] for x in backing.values()),'declaredDeltas':delta,'priorProducerEntriesPreserved':123,'priorProducerCallsPreserved':244,'changedOwnEntry':'OWN_EXTERNAL_REVIEW','existingOwnCalls':2,'currentProducerSHA256':producerSHA,'assessment':'Declared two-file rules/pin setup exited0, all prior entries/calls preserved. No whole body in this batch; no full qualification inferred. Recorded cleanup is historical, not a fresh process census.'})
out={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_READ_ONLY_RETAINED_FAILURE_INSPECTION','results':results,'currentSourceQualification':'NOT_PERFORMED: candidate changed after these batches','original122':'HELD'}
dest=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c6-root-external-corrective-rule-setup-batch-inspection.json'
assert not dest.exists(); dest.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'status':out['status'],'batches':[{'batch':r['batch'],'commands':len(r['commands']),'backings':r['uniqueBeforeByteBackingsDecoded']} for r in results]}))
