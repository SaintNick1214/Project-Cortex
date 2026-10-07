"""Later distinct finite packet readback; no source acceptance or historical repair."""
import hashlib,json,os,stat,time
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05';J=P/'task03-attempt6-highfd-public-repair3-independent-source-review1';U=P/'task03-attempt6-actual-public-custody-readiness-repair3'
F=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns');owned=list(BOOTSTRAP_OWNERS);by={r['path']:r for r in owned};raws=dict(BOOTSTRAP_DATA);total=sum(int(r['PRE9']['size']) for r in owned);failures=[];closes=[];close_errors=[]
def nine(s):return {k:str(getattr(s,'st_'+k)) for k in F}
def capture(p,expected=None):
 global total
 key=str(p)
 if key in by:
  o=by[key]
  if expected:assert expected['PRE9']==o['PRE9'] and expected['bytes']==int(o['PRE9']['size'])
  return o
 assert p.is_absolute() and p.resolve()==p and p.is_relative_to(R)
 cur=R
 for part in p.relative_to(R).parts:
  cur/=part;s=cur.lstat();assert not stat.S_ISLNK(s.st_mode) and cur.resolve()==cur
  if cur!=p:assert stat.S_ISDIR(s.st_mode)
 pre=nine(p.lstat());age=time.time_ns()-max(int(pre['mtime_ns']),int(pre['ctime_ns']));n=int(pre['size'])
 assert age>=60000000000 and stat.S_ISREG(int(pre['mode'])) and pre['nlink']=='1' and pre['uid']=='501' and pre['gid']=='20'
 assert 0<=n<=16777216 and len(owned)+1<=4096 and total+n<=67108864
 if expected and 'PRE9'in expected:assert pre==expected['PRE9'],'original pin never refreshed'
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);o={'path':key,'fd':fd,'PRE9':pre,'ageNs':str(age),'expected':expected};owned.append(o);by[key]=o;total+=n;assert nine(os.fstat(fd))==pre
 return o
def read(o):
 fd=o['fd'];os.lseek(fd,0,0);b=b''
 while q:=os.read(fd,65536):b+=q;assert len(b)<=int(o['PRE9']['size'])<=16777216
 assert len(b)==int(o['PRE9']['size']) and nine(os.fstat(fd))==nine(Path(o['path']).lstat())==o['PRE9']
 digest=hashlib.sha256(b).hexdigest();e=o['expected']
 if e:assert e['bytes']==len(b) and e['sha256']==digest
 if 'sha256'in o:assert o['sha256']==digest
 o.update(bytes=len(b),sha256=digest,fullEOF=True,finalAllNineEqual=True);raws[o['path']]=b;return b
def durable(name,value):
 p=J/name;b=(json.dumps(value,separators=(',',':'))+'\n').encode();fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  v=memoryview(b)
  while v:v=v[os.write(fd,v):]
  os.fsync(fd)
 finally:os.close(fd)
 return {'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
publishers=[('closed-source-manifest.json',73411,'16e009fb9bee0eea993ce02c4cd32ed47e4ffd807cdb3837ca720d9b295daca6'),('preparation-report.json',6351,'bc8ef6dcc577bbd966074871424fe336f9c49896c2c5b3db96488c1560704aad'),('final-writer-stop.json',1219,'84485ff8d73f956161e7b726e55de7a52d847450278c46eb88172320049b26b5')]
denied={'independent-contract-controls1.py','independent-contract-controls1-writer-stop.json','independent-interpreter-controls1.py','packet-final-readback1.json','final-review-writer-stop.json'}
try:
 own=sorted(p for p in J.rglob('*') if p.is_file() and p.name not in denied)
 for p in own:capture(p)
 for name,n,h in publishers:capture(U/name,{'bytes':n,'sha256':h})
 root=P/'root-task03-attempt6-highfd-public-repair2-closed-mature-readback1.json';capture(root,{'bytes':47005,'sha256':'0df4f88dc6e5e7de755d2dc6a0969e8626e0eb5178e8301fa60b15d1354ed31f'})
 # Explicit MF/Root/closed-review control bootstraps only; all target FDs follow before target bodies.
 mf=json.loads(read(by[str(U/'closed-source-manifest.json')]));rp={r['path']:r for r in json.loads(read(by[str(root)]))['files']};assert len(rp)==68 and len(mf['members'])==85
 for m in mf['members']:
  e={'PRE9':m['PRE9'],'bytes':m['bytes'],'sha256':m['sha256']}
  if m['path']in rp:assert all(rp[m['path']][k]==e[k] for k in ('PRE9','bytes','sha256'))
  capture(Path(m['path']),e)
 closure=json.loads(read(by[str(J/'u3-prospective-held-through-verdict-FDclosure2.json')]))
 assert closure['published'] is True and closure['finalQualificationFailures']==[] and closure['closeErrors']==[]
 prior={r['path']:r for r in closure['inputRows']}
 for path,row in prior.items():
  if path in by:assert row['PRE9']==by[path]['PRE9'],'no prospective nine refresh'
 external=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06/integrated/coordinate-common.py'
 capture(external,{'PRE9':prior[str(external)]['PRE9'],'bytes':21309,'sha256':'1f8f6005c668401b63681e28002715d977abcc02312a199a468e32c2505fa0a2'})
 for o in owned:read(o)
 for o in owned:read(o)
except BaseException as e:failures.append({'class':type(e).__name__,'reason':str(e)})
finally:
 for o in owned:
  fd=o.pop('fd');closes.append({'path':o['path'],'fd':fd})
  try:os.close(fd)
  except BaseException as e:close_errors.append({'path':o['path'],'fd':fd,'class':type(e).__name__,'reason':str(e)})
rows=[]
for o in owned:
 ref=prior.get(o['path']) if 'prior'in globals() else None
 row={k:v for k,v in o.items() if k not in ('expected','PRE9')}
 if ref:row['originalNineRef']={'closure':'u3-prospective-held-through-verdict-FDclosure2.json','index':list(prior).index(o['path']),'allNineComparedEqual':o['PRE9']==ref['PRE9']}
 else:row['PRE9']=o['PRE9']
 rows.append(row)
result={'scope':'LATER_DISTINCT_MATURE_U3_REJECT_PACKET_BYTE_CLOSURE_ONLY','files':len(owned),'bytes':total,'allFDsBeforeTargetContent':True,'MFRootReviewControlBootstrapExplicit':True,'allWritersStoppedMaxMetadataAge60':True,'inputRows':rows,'original85AuthorNineHashSizeAndReferencedRootPinsPreserved':not failures,'fullEOFHashSizeAllNineFinal':not failures,'closeAttempts':closes,'explicitCloses':len(closes),'closeErrors':close_errors,'failures':failures,'excludedPaths':sorted(denied),'failedOldOwnThreePinsExcludedNeverRefreshed':True,'oldFailedIntervalsNeverRepaired':True,'sourceEligibility':False,'publisherOutputsSelfExcluded':True,'fullTask03':False,'fullGoal':False}
pin=durable('packet-final-readback1.json',result)
assert pin['bytes']<=262144
stop=durable('final-review-writer-stop.json',{'scope':'U3_INDEPENDENT_SOURCE_REVIEW_FINAL_WRITER_STOP','remainingWrites':[],'stoppedUnixNs':time.time_ns(),'packetReadback':pin,'files':len(owned),'explicitCloses':len(closes),'failures':failures,'closeErrors':close_errors,'laterDistinctMaturePublisherConsumptionRequired':True,'sourceEligibility':False,'fullTask03':False,'fullGoal':False})
print(json.dumps({'packet':pin,'stop':stop,'files':len(owned),'bytes':total,'explicitCloses':len(closes),'failures':failures,'closeErrors':close_errors}))
