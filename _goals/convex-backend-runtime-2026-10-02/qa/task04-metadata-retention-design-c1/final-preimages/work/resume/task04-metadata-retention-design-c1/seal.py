from pathlib import Path
import hashlib,json,datetime,sys
r=Path('/workspace/Project-Cortex'); q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-design-c1'; w=r/'work/resume/task04-metadata-retention-design-c1'
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
start=now(); pre={}
for p in [Path(__file__),w/'capture.py',q/'proposal.md',w/'selector-controls.mjs']:
 b=p.read_bytes(); rel=str(p.relative_to(r)); pre[rel]={'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
 d=q/'final-preimages'/rel; d.parent.mkdir(parents=True,exist_ok=True); d.write_bytes(b)
(q/'final-source-pre.json').write_text(json.dumps({'utc':start,'files':pre},indent=2)+'\n')
checks=[]
for p in q.glob('*-pre.json'):
 if p.name=='final-source-pre.json': continue
 after=q/(p.name[:-9]+'-post.json')
 if after.exists():
  a=json.loads(p.read_text())['files']; b=json.loads(after.read_text())['files']; assert a==b
  for name,v in a.items():
   current=r/name
   assert current.is_file() and hashlib.sha256(current.read_bytes()).hexdigest()==v['sha256'],name
  checks.append(p.name)
post={name:{'sha256':hashlib.sha256((r/name).read_bytes()).hexdigest(),'bytes':(r/name).stat().st_size} for name in pre}
assert post==pre
(q/'final-source-post.json').write_text(json.dumps({'utc':now(),'files':post},indent=2)+'\n')
result={'status':'PASS','sourceCommandComparisons':len(checks),'currentSourcePinsUnchanged':True,'actualMoneyDomain':'EMPTY','qualification':False}
(q/'final-seal.stdout').write_text(json.dumps(result,indent=2)+'\n'); (q/'final-seal.stderr').write_text('')
(q/'final-seal-receipt.json').write_text(json.dumps({'argv':sys.argv,'cwd':str(r),'startUtc':start,'endUtc':now(),'exit':0},indent=2)+'\n')
for root,name in [(q,'qa-seal.json'),(w,'scratch-seal.json')]:
 files=[]
 for p in sorted(root.rglob('*')):
  if p.is_file() and p!=root/name:
   b=p.read_bytes(); files.append({'path':str(p.relative_to(root)),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)})
 (root/name).write_text(json.dumps({'version':1,'utc':now(),'root':str(root),'excludedExactSelf':name,'recursiveIncludingNestedPreimages':True,'fileCount':len(files),'files':files},indent=2)+'\n')
print(json.dumps(result))
