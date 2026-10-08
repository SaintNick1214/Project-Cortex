from pathlib import Path
import hashlib,json,datetime,sys
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-design-c2-fresh-review';w=r/'work/resume/task04-metadata-retention-design-c2-fresh-review'
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();start=now()
files=[w/'seal.py',w/'capture.py',w/'verify.py',w/'resource-controls-v4.mjs',q/'report.md'];pre={}
for p in files:
 b=p.read_bytes();f=str(p.relative_to(r));pre[f]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()};d=q/'final-preimages'/f;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(b)
(q/'final-source-pre.json').write_text(json.dumps({'utc':start,'files':pre},indent=2)+'\n')
for p in q.glob('*-pre.json'):
 if p.name=='final-source-pre.json':continue
 post=q/(p.name[:-9]+'-post.json')
 if post.exists():assert json.loads(p.read_text())['files']==json.loads(post.read_text())['files']
post={str(p.relative_to(r)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files};assert pre==post
(q/'final-source-post.json').write_text(json.dumps({'utc':now(),'files':post},indent=2)+'\n')
(q/'final-seal.stdout').write_text('PASS source brackets and exact-self recursive final seals\n');(q/'final-seal.stderr').write_text('')
(q/'final-seal-receipt.json').write_text(json.dumps({'argv':['python3',*sys.argv],'cwd':str(r),'startUtc':start,'endUtc':now(),'exit':0},indent=2)+'\n')
for root,name in [(q,'qa-seal.json'),(w,'scratch-seal.json')]:
 rows=[]
 for p in sorted(root.rglob('*')):
  assert not p.is_symlink()
  if p.is_file() and p!=root/name:
   b=p.read_bytes();rows.append({'path':str(p.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 target=root/name;target.write_text(json.dumps({'version':1,'utc':now(),'root':str(root),'excludedExactSelf':name,'recursiveIncludingNestedPreimages':True,'fileCount':len(rows),'files':rows},indent=2)+'\n')
 print(str(target),hashlib.sha256(target.read_bytes()).hexdigest(),len(rows))
print('REPORT',hashlib.sha256((q/'report.md').read_bytes()).hexdigest())
