import gzip,hashlib,json,os,stat,datetime
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex')
T=Path('/dev/shm/cortex-native-c6-closed-launcher-c6/runs')
def held(p):
 p=Path(p)
 if not p.exists():
  base=Path('/dev/shm/cortex-native-c6-closed-launcher-c6'); assert p.is_relative_to(base)
  summary=json.loads((base/'completed-evidence-compression.json').read_bytes())
  index=Path(summary['index']).read_bytes(); assert sha(index)==summary['indexSHA256']
  row=next(json.loads(line) for line in index.splitlines() if json.loads(line)['path']==str(p))
  assert row['custody']=='CONTENT_ONLY_OLD_INODE_ENDS_ON_UNLINK'
  encoded,fresh=held(row['backing']); assert len(encoded)==row['encodedBytes'] and sha(encoded)==row['encodedSHA256']
  raw=gzip.decompress(encoded); assert len(raw)==row['decodedBytes'] and sha(raw)==row['decodedSHA256']
  return raw,{'contentOnlyMappedOriginal':str(p),'oldInodeContinuity':'ENDS_AT_UNLINK_NOT_REVERIFIED','freshBackingIdentity':fresh,'mappingSHA256':sha(index)}
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
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
for batch in ('9bada5d46d1e4e27add5886cb691b45d',):
 p=T/batch/'receipt.json'; raw,ident=held(p); d=json.loads(raw)
 captures=[]
 for kind in ('original8PRE','original8POST'):
  row=d[kind]; enc,ci=held(row['path']); assert len(enc)==row['bytes'] and sha(enc)==row['sha256']
  decoded=gzip.decompress(enc); assert sha(decoded)==row['decodedSha256']
  parsed=json.loads(decoded); assert len(parsed['files'])==row['rows']==148325
  captures.append(parsed)
 assert captures[0]['files']==captures[1]['files']
 pre=d['commands'][0]['sourcePRE']; post=d['sourcePOST']
 assert [(r['path'],r['bytes'],r['sha256']) for r in pre]==[(r['path'],r['bytes'],r['sha256']) for r in post]
 backing={}
 for cmd in d['commands']:
  for r in cmd['sourcePRE']:
   name=r['beforeByteBacking']
   if name in backing: assert backing[name]==(r['bytes'],r['sha256']); continue
   enc,_=held(name); assert len(enc)==r['encodedBytes'] and sha(enc)==r['encodedSHA256']
   decoded=gzip.decompress(enc); assert len(decoded)==r['bytes'] and sha(decoded)==r['sha256']
   backing[name]=(r['bytes'],r['sha256'])
 streams=[]
 for f in sorted(p.parent.iterdir()):
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
 assert d['original8LiteralRowsAndIdentitiesEqual'] and d['sourceByteHashesEqual']
 assert commands[-1]['exitCode']==-9 and d.get('primaryFailure') is None
 results.append({'batch':batch,'receiptSHA256':sha(raw),'receiptIdentity':ident,'commands':commands,'streams':streams,'fullLiteralRowsCompared':148325,'sourceRowsCompared':len(pre),'uniqueBeforeByteBackingsDecoded':len(backing),'beforeByteBackingRawBytes':sum(x[0] for x in backing.values()),'assessment':'Focused command exits observed. Whole route actual exit -9; no body or terminal completion inferred. No pre-batch OOM counter, therefore attribution unproven. Recorded cleanup is historical, not a fresh process census.'})
out={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_READ_ONLY_RETAINED_FAILURE_INSPECTION','results':results,'currentSourceQualification':'NOT_PERFORMED: candidate changed after these batches','original122':'HELD'}
dest=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c6-root-sigkill-compressed-batch-inspection.json'
assert not dest.exists(); dest.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'status':out['status'],'batches':[{'batch':r['batch'],'commands':len(r['commands']),'backings':r['uniqueBeforeByteBackingsDecoded']} for r in results]}))
