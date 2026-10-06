import os,stat,json,hashlib,subprocess,difflib
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');G=R/'_goals/convex-backend-runtime-2026-10-02';P=Path(__file__).parent
F=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns');rows={}
def ident(s):return {k:str(getattr(s,k)) for k in F}
def read(p):
 p=Path(p);pre=ident(p.lstat());assert stat.S_ISREG(p.lstat().st_mode);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert pre==ident(os.fstat(fd));data=b''
  while True:
   chunk=os.read(fd,1048576)
   if not chunk:break
   data+=chunk
  assert len(data)==int(pre['st_size']);assert pre==ident(os.fstat(fd))==ident(p.lstat())
 finally:os.close(fd)
 rows[str(p)]={'path':str(p),'identityDecimal':pre,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'EOF':True};return data
A=json.loads(read(G/'qa/task02a/evidence/changed-source-paths.json'));B=json.loads(read(G/'qa/task02b/source-inventory.json'))
assert len(A)==19 and len(B)==7
comparisons=[];deltas=[]
for kind,original,commit in [('A',{x['path']:x['sha256'] for x in A},'429d471d'),('B',B,'69396789')]:
 parent=json.loads(read(G/('qa/local-resume-2026-10-05/task02'+kind.lower()+'-parent-byte-comparison.json')));assert len(parent['rows'])==len(original)
 parentpins={x['path']:x for x in parent['rows']}
 for name,oldsha in original.items():
  current=read(R/name);sha=hashlib.sha256(current).hexdigest();pin=parentpins[name];assert pin['historicalSha256']==oldsha and pin['currentSha256']==sha
  historical=subprocess.run(['git','show',commit+':'+name],cwd=R,capture_output=True,check=True).stdout;assert hashlib.sha256(historical).hexdigest()==oldsha
  comparison={'scope':kind,'path':name,'historicalSha256':oldsha,'currentSha256':sha,'sameBytes':sha==oldsha,'historicalContentCommit':commit};assert comparison['sameBytes']==pin['sameBytes'];comparisons.append(comparison)
  if sha!=oldsha:
   file=P/'historical-source-content'/name;file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(historical)
   diff=''.join(difflib.unified_diff(historical.decode().splitlines(True),current.decode().splitlines(True),fromfile=commit+':'+name,tofile='current:'+name));dest=P/'deltas'/(name.replace('/','_')+'.diff');dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(diff);deltas.append({'path':name,'diff':str(dest.relative_to(P))})
 assert sum(x['sameBytes'] for x in comparisons if x['scope']==kind)==(17 if kind=='A' else 5)
for name in ['src/domain/model-policy.ts','convex-dev/runtimeAuth.ts','convex-dev/runtimeAuthSchema.ts','src/auth/verified.ts','convex-dev/_generated/server.js','convex-dev/_generated/server.d.ts','tests/unit/runtimeMemory/public-closure.test.ts','tests/unit/runtimeMemory/public-boundary.test.ts','jest.config.mjs','package.json']:
 read(R/name)
for root in [G/'qa/task02a',G/'qa/task02b']:
 for f in root.rglob('*'):
  if f.is_file():read(f)
for name in ['task02a-review-2.md','task02b-review-1.md','task02a/evidence/cycle1/review.md']:read(G/'qa'/name)
(P/'source-audit.json').write_text(json.dumps({'status':'PASS','sourceComparisons':comparisons,'deltas':deltas,'historicalAPins':19,'historicalASame':17,'historicalBPins':7,'historicalBSame':5,'allNineFullBytesEOFCurrent':True,'files':list(rows.values()),'historicalPhysicalIdentityRestored':False,'historicalReportsRecertified':False,'services':0},indent=2)+'\n')
print(json.dumps({'status':'PASS','APins':19,'ASame':17,'BPins':7,'BSame':5,'deltaFiles':len(deltas),'currentStableFiles':len(rows)}))
