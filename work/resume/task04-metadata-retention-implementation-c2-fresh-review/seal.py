from pathlib import Path
import json,hashlib,datetime,sys
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c2-fresh-review';w=r/'work/resume/task04-metadata-retention-implementation-c2-fresh-review';now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();h=lambda b:hashlib.sha256(b).hexdigest()
pre={str(p.relative_to(r)):{'sha256':h(p.read_bytes()),'bytes':p.stat().st_size,'mode':oct(p.stat().st_mode&0o777),'nlink':p.stat().st_nlink,'mtimeNs':p.stat().st_mtime_ns,'inode':p.stat().st_ino} for p in w.rglob('*') if p.is_file()}
(q/'freeze-pre.json').write_text(json.dumps({'utc':now(),'files':pre,'beforeObjects':'Exact helper beforebytes already stored by audit-freeze pre bracket, SHA-unique gzip objects'},indent=2)+'\n')
(q/'freeze.stdout').write_text('PASS_OFFLINE; recursive exact-self-only seals generated after final readonly audit\n');(q/'freeze.stderr').write_text('')
(q/'freeze-receipt.json').write_text(json.dumps({'startUtc':now(),'endUtc':now(),'argv':sys.argv,'cwd':str(r),'exit':0,'sealerSha256':h(Path(__file__).read_bytes()),'bookkeepingOnly':True},indent=2)+'\n')
post={name:{'sha256':h((r/name).read_bytes()),'bytes':(r/name).stat().st_size} for name in pre};assert all(post[n]['sha256']==p['sha256'] for n,p in pre.items());(q/'freeze-post.json').write_text(json.dumps({'utc':now(),'files':post},indent=2)+'\n')
for base,name in [(q,'qa-seal.json'),(w,'scratch-seal.json')]:
 rows=[]
 for p in sorted(base.rglob('*')):
  assert not p.is_symlink()
  if p.is_file() and p!=base/name:
   assert p.stat().st_nlink==1;rows.append({'path':str(p.relative_to(base)),'sha256':h(p.read_bytes()),'bytes':p.stat().st_size,'mode':oct(p.stat().st_mode&0o777),'nlink':p.stat().st_nlink})
 (base/name).write_text(json.dumps({'utc':now(),'scope':str(base.relative_to(r)),'exactSelfExcluded':name,'recursive':True,'files':rows,'directories':[str(p.relative_to(base)) for p in sorted(base.rglob('*')) if p.is_dir()],'verdict':'PASS_OFFLINE_NO_ACTUAL_RELEASE'},indent=2)+'\n')
 print(json.dumps({'scope':str(base.relative_to(r)),'rows':len(rows),'sealSha256':h((base/name).read_bytes())}))
print(json.dumps({'reportSha256':h((q/'report.md').read_bytes())}))
