from pathlib import Path
import os,stat,json,gzip,hashlib,datetime,re
E=Path('/tmp/cortex-native-c6-independent-review-87eb6f28-3812-499b-ab08-09282d98678d')
Q=Path('/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa')
H=lambda b:hashlib.sha256(b).hexdigest()
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
  with os.fdopen(os.dup(fd),'rb') as f:b=f.read()
  keys=('st_dev','st_ino','st_mode','st_uid','st_gid','st_nlink','st_size','st_mtime_ns','st_ctime_ns')
  i={k:getattr(a,k) for k in keys};assert i=={k:getattr(os.fstat(fd),k) for k in keys}=={k:getattr(os.lstat(p),k) for k in keys}
  return b,H(b),i
 finally:os.close(fd)
rb,rh,ri=held(E/'outer-receipt.json');r=json.loads(rb)
bb,bh,bi=held(E/'before-node.json');before=json.loads(bb)
assert r['root']==str(E) and r['before']==str(E/'before-node.json')
assert before['argv']==r['argv'] and before['cwd']==r['cwd'] and before['env']==r['env'] and before['absoluteDeadline']==r['absoluteDeadline']
assert before['before']['fullGraphCaptured'] and before['before']['utcPOST']<r['startUTC']
assert r['exitCode']==1 and r['signal'] is None and r['closed'] and r['remaining']==[] and r['evidenceComplete'] is False and r['secondary']==[]
assert r['primary']['message']=='OWN_EXTERNAL_CHILD_EXIT_1_null'
objects={};paths={}
for row in before['before']['files']:
 assert row['path'] not in paths;paths[row['path']]=row
 ref=row['beforeByteBacking'];p=Path(ref['path']);assert p.is_relative_to(E) and ref['encoding']=='GZIP_EXACT_PREIMAGE'
 binding=(ref['bytes'],ref['sha256'],row['bytes'],row['sha256'])
 if str(p) in objects:assert objects[str(p)]['binding']==binding;continue
 enc,eh,ei=held(p);assert len(enc)==ref['bytes'] and eh==ref['sha256']
 decoded=gzip.decompress(enc);assert len(decoded)==row['bytes'] and H(decoded)==row['sha256']
 objects[str(p)]=dict(binding=binding,backingFreshIdentity=ei)
assert len(paths)==5342 and len(r['sourcePOST'])==5330
for row in r['sourcePOST']:
 pre=paths[row['path']];assert (pre['bytes'],pre['sha256'])==(row['bytes'],row['sha256'])
streams=[];stderr=''
for name,row in r['raw'].items():
 b,h,i=held(row['path']);assert len(b)==row['bytes'] and h==row['sha256'];streams.append(dict(name=name,path=row['path'],bytes=len(b),sha256=h,freshIdentity=i))
 if name=='stderr':stderr=b.decode()
assert 'QA_BRIDGE_COMPILER_OUTPUT_FAMILY' in stderr and 'allScheduledAttempted: true' in stderr
assert len(re.findall(r"status: 'SUCCESS'",stderr))==17 and 'qaCleanupSecondary: []' in stderr
initial=r['initial'];census={}
try:
 text=(Path('/proc')/str(initial['pid'])/'stat').read_text();f=text.rsplit(')',1)[1].strip().split()
 assert f[0] in ('Z','X') or f[19]!=initial['startTime'];census=dict(state=f[0],startTime=f[19],originalBindingNoLongerLive=True)
except FileNotFoundError:census=dict(absent=True)
out=dict(utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='ROOT_RETAINED_FAILED_EXTERNAL_BEFORE_NODE_CUSTODY_VERIFIED',root=str(E),receiptSHA256=rh,receiptFreshIdentity=ri,beforeNodeSHA256=bh,beforeNodeFreshIdentity=bi,beforeRowsVerified=len(paths),uniqueBeforeByteBackingsDecoded=len(objects),sourcePostRowsCompared=len(r['sourcePOST']),streams=streams,recordedExitCode=1,recordedRemaining=[],freshInitialProcessCensus=census,recordedCleanupSuccesses=17,evidenceComplete=False,qualification='NONE_EXTERNAL_FAILURE_RETAINED_ORIGINAL122_HELD',limits='Historical before-consumer records/backing and recorded sourcePOST checked; current originals/config not reread as retroactive custody. No service dispatch inferred and no VM or full gate success inferred from reaching output-family denial.')
with (Q/'task04-native-c6-root-external-failed-before-node-proof-inspection.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(dict(status=out['status'],rows=len(paths),objects=len(objects))))
