import pathlib,json,hashlib,datetime,gzip,sys
root=pathlib.Path('/workspace/Project-Cortex')
q=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c1-fresh-review'
s=root/'work/resume/task04-metadata-retention-implementation-c1-fresh-review'
sha=lambda b:hashlib.sha256(b).hexdigest()
def precheck():
 count=0
 for p in q.glob('*-receipt.json'):
  d=json.loads(p.read_text());tag=p.name[:-len('-receipt.json')]
  assert sha((q/(tag+'.stdout')).read_bytes())==d['stdoutSha256']
  assert sha((q/(tag+'.stderr')).read_bytes())==d['stderrSha256']
  before=q/(tag+'-pre.json');after=q/(tag+'-post.json')
  read=lambda f:json.loads(f.read_text()) if f.exists() else json.loads(gzip.decompress(f.with_suffix('.json.gz').read_bytes()))
  a=read(before);b=read(after)
  for x in a['files']:
   p=q/x['beforeimage'];raw=gzip.decompress(p.read_bytes());assert sha(raw)==x['sha256'] and len(raw)==x['bytes'] and sha(p.read_bytes())==x['encodedSha256'];count+=1
  assert [x['sha256'] for x in a['files']]==[x['sha256'] for x in b['files']]
 for p in q.rglob('*'):
  assert not p.is_symlink()
  if p.is_file():assert p.stat().st_nlink==1
 print(json.dumps({'reviewBeforeimageReferencesVerified':count,'reportSha256':sha((q/'report.md').read_bytes()),'verdict':'NEEDS_FIXES','currentAllUnique':True}))
def seal(base,name):
 rows=[]
 for p in sorted(base.rglob('*')):
  if p==base/name:continue
  assert not p.is_symlink()
  if p.is_file():
   st=p.stat();assert st.st_nlink==1;raw=p.read_bytes();rows.append({'path':str(p.relative_to(base)),'bytes':len(raw),'sha256':sha(raw),'mode':oct(st.st_mode&0o777),'nlink':st.st_nlink})
 d={'scope':str(base.relative_to(root)),'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exactSelfExcluded':name,'recursive':True,'files':rows};(base/name).write_text(json.dumps(d,indent=2)+'\n');print(name,len(rows),sha((base/name).read_bytes()))
if sys.argv[1]=='check':precheck()
else:seal(q,'qa-seal.json');seal(s,'scratch-seal.json')
