import os,json,stat,hashlib,gzip,pathlib,datetime
R=pathlib.Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c6-full-composition-restored-review';W=R/'work/resume/task04-native-c6-full-composition-restored-review';T=pathlib.Path('/dev/shm/cortex-native-c6-restored-review');S=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c6-closed-launcher-c6';C=R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6';OLDQ=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c6-full-composition-fresh-review';OLDW=R/'work/resume/task04-native-c6-full-composition-fresh-review';OLDE=pathlib.Path('/tmp/cortex-native-c6-independent-review-a4bf5535-2d53-44fe-a92c-42bace827faa');ROOTS=[S,C,pathlib.Path('/dev/shm/cortex-native-c6-closed-launcher-c6'),pathlib.Path('/tmp/cortex-native-c6-independent-review-87eb6f28-3812-499b-ab08-09282d98678d')]
H=lambda b:hashlib.sha256(b).hexdigest()
def identity(s):return {k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']}
def row(p):
 s=os.lstat(p);d={'identity':identity(s)}
 if stat.S_ISDIR(s.st_mode):d['kind']='directory'
 elif stat.S_ISLNK(s.st_mode):d.update(kind='symlink',target=os.readlink(p))
 else:
  assert stat.S_ISREG(s.st_mode);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
  try:
   assert identity(os.fstat(fd))==identity(s);h=hashlib.sha256();n=0
   while True:
    b=os.read(fd,1048576)
    if not b:break
    h.update(b);n+=len(b)
   assert identity(os.fstat(fd))==identity(s);d.update(kind='file',bytes=n,sha256=h.hexdigest())
  finally:os.close(fd)
 assert identity(os.lstat(p))==identity(s);return d
def literal(root,exclude=False):
 out=[]
 def walk(p):
  d=row(p);d['path']=str(p.relative_to(root));out.append(d)
  if d['kind']=='directory':
   d['members']=sorted(os.listdir(p))
   for n in d['members']:
    if exclude and p==root and n=='seal.json':continue
    walk(p/n)
 walk(root);return out
def dump(p,d):p.write_text(json.dumps(d,indent=2)+'\n');os.chmod(p,0o600)
def pin(r):
 d=row(r['path']);assert d['bytes']==r['bytes'] and d['sha256']==r['sha256'],r['path']
 if 'identity' in r:assert d['identity']==r['identity'],r['path']
 return d
def backing(p,n,h,encoded=None):
 p=pathlib.Path(p);a=row(p)
 if encoded:assert a['bytes']==encoded[0] and a['sha256']==encoded[1]
 dig=hashlib.sha256();count=0
 opener=gzip.open if p.suffix=='.gz' else open
 with opener(p,'rb') as f:
  while True:
   b=f.read(1048576)
   if not b:break
   dig.update(b);count+=len(b)
 assert count==n and dig.hexdigest()==h,str(p)
 assert row(p)==a
 return {'path':str(p),**a,'decodedBytes':count,'decodedSHA256':dig.hexdigest()}
def census():
 out=[]
 for p in pathlib.Path('/proc').iterdir():
  if p.name.isdigit():
   try:
    argv=(p/'cmdline').read_bytes().split(b'\0');st=(p/'stat').read_text();f=st[st.rfind(')')+2:].split()
    if argv and b'node' in argv[0] and any(str(r).encode() in b'\0'.join(argv) for r in [*ROOTS,OLDE,T]):out.append({'pid':int(p.name),'argv':[a.decode(errors='replace') for a in argv if a],'state':f[0],'pgid':int(f[2]),'starttime':f[19]})
   except (FileNotFoundError,PermissionError,ProcessLookupError):pass
 return out
if __name__=='__main__':
 import sys
 phase=sys.argv[1]
 if phase=='pre':
  dump(T/'reader-before.json',{'path':str(W/'verify.py'),**row(W/'verify.py')});(T/'verify.py.preimage').write_bytes((W/'verify.py').read_bytes())
  for r,name in [(OLDQ,'old-Q'),(OLDW,'old-W'),(OLDE,'old-E')]:dump(T/(name+'-PRE.json'),{'root':str(r),'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'claims':'CURRENT_RESTORED_LITERAL_SNAPSHOT_NOT_EARLIER_IDENTITY_OR_DISPATCH','rows':literal(r)})
  summaries=[]
  for r in ROOTS:
   s=json.load(open(r/'seal.json'));a=literal(r,True);o={x['path']:x for x in s['rows']};assert set(o)=={x['path'] for x in a}
   for x in a:
    for k,v in o[x['path']].items():
     if k in x:assert x[k]==v,(str(r),x['path'],k)
   dump(T/(('source-'+str(len(summaries)))+'-PRE.json'),{'root':str(r),'rows':a});summaries.append({'root':str(r),'sealSHA256':H((r/'seal.json').read_bytes()),'rows':len(a)})
  dump(Q/'verification-PRE.json',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':summaries,'census':census()});print('PRE verified',summaries)
 elif phase=='facts':
  refs=[];pins=json.load(open(S/'sourcepins.json'));cnt=0
  for p in pins['W']:
   pin(p);b=p['actualFinalBatchBeforeByteEvidence']
   if b:refs.append(backing(b['beforeByteBacking'],p['bytes'],p['sha256'],(b['encodedBytes'],b['encodedSHA256'])));cnt+=1
  for k in ['exactFinalBatchSourcePRE','exactFinalBatchReceipt']:pin(pins[k])
  bindings=json.load(open(S/'prepared122bindings.json'));contract=json.load(open(bindings['contract']['path']));old={c['id']:c for c in contract['commands']};assert len(bindings['commands'])==122 and set(old)=={c['id'] for c in bindings['commands']}
  for k in ['contract','mirrorMap','finiteProducerRules']:pin(bindings[k])
  for c in bindings['commands']:
   assert c['originalArgv']==old[c['id']]['proposedArgv'];assert H(pathlib.Path(c['originalEntry']).read_bytes())==c['originalEntrySHA256'];pin(c['ownedEntry']);assert c['preparedArgv'][3:]==[('/dev/shm/cortex-native-c6-closed-launcher-c6/mirror/'+a[len(str(R))+1:]) if a.startswith(str(R)+'/') else a for a in c['originalArgv'][3:]]
  for p in json.load(open(S/'external-backing-refs.json'))['exactRefs']:pin(p)
  before=json.load(open(OLDE/'outer-before.json'))
  for f in before['files']:
   b=f['beforeByteBacking'];refs.append(backing(b['path'],f['bytes'],f['sha256'],(b['bytes'],b['sha256'])))
  for name,key in [('recorder-before.json','backing'),('adverse-before.json','beforeBacking')]:
   for f in json.load(open(OLDE/name))['files']:refs.append(backing(f[key],f['bytes'],f['sha256']))
  outer=json.load(open(OLDE/'outer-process-receipt.json'));result=json.load(open(OLDE/'review-result.json'));assert len(outer['commands'])==2
  for c in outer['commands']:
   assert c['exitCode']==0 and not c['timeout'] and not c['groupMembers'];assert c['absoluteDeadline']==outer['singleAbsoluteDeadline']
   for p in c['raw']:pin(p)
  assert (OLDE/'control.mjs').read_bytes()==(C/'external-control-template.mjs').read_bytes();assert len(result['cleanup']['attempted'])==17
  assert not (OLDE/'adverse-result.json').exists();failure=json.load(open(OLDE/'adverse-failure.json'));assert failure['timeoutSeconds']==.001 and failure['actualExitCode'] is None
  analysis=json.load(open(S/'whole07-timing-analysis.json'))
  for p in analysis['pins']:pin(p);refs.append(backing(p['backing'],p['bytes'],p['sha256'],(p['encodedBytes'],p['encodedSHA256'])))
  batch=json.load(open(analysis['recordedBatch']));cmd=batch['commands'][-1];assert cmd['exitCode'] is None and cmd['status']=='TIMEOUT_EXIT_NOT_CAPTURED';assert batch['sourceByteHashesEqual'] and batch['original8LiteralRowsAndIdentitiesEqual']
  pre=json.load(gzip.open(OLDQ/'original8-PRE.json.gz'));post=json.load(gzip.open(OLDQ/'original8-POST.json.gz'));assert pre['rows']==post['rows'];n=len(pre['rows']);del pre,post
  index=json.load(open(S/'evidence-index.json'));latest=next(b for b in index['batches'] if '9e3a0' in b['run']);controls=[]
  for c in latest['commands']:
   for p in c['raw']:pin(p)
   controls.append({'argv':c['argv'],'exitCode':c['exitCode'],'raw':c['raw']})
  dump(T/'verified-backing-references.json',{'refs':refs,'note':'Existing exact backed files, streamed and freshly hashed; no original earlier custody fabricated.'})
  dump(Q/'verified-facts.json',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourcePins':len(pins['W']),'finalBeforeBackings':cnt,'lateAdministrative':len(pins['W'])-cnt,'exact122MechanicalBindings':True,'original8RecordedPREPOSTRowsEqual':n,'priorOuterCommands':outer['commands'],'priorRestorationAttempts':len(result['cleanup']['attempted']),'priorBeforeRows':len(before['files']),'priorAdverse':failure,'whole07':cmd,'wholeBatchSourceEqual':True,'wholeBatchOriginalEqual':True,'currentCohortRawControls':controls,'backingsVerified':len(refs),'currentOWNNodeCensus':census(),'noNewCandidateExecution':True});print('FACTS verified',len(refs),n)
 elif phase=='post':
  for r,name in [(OLDQ,'old-Q'),(OLDW,'old-W'),(OLDE,'old-E')]:assert literal(r)==json.load(open(T/(name+'-PRE.json')))['rows']
  for i,r in enumerate(ROOTS):assert literal(r,True)==json.load(open(T/('source-'+str(i)+'-PRE.json')))['rows']
  dump(Q/'verification-POST.json',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'allFourSourcesLiteralPREPOSTEqual':True,'allThreePriorReviewRootsLiteralPREPOSTEqual':True,'currentOWNNodeCensus':census(),'noCandidateOrOriginalDispatch':True});print('POST verified')
