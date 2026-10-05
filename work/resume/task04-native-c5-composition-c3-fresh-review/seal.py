import pathlib,os,stat,json,hashlib,datetime
R=pathlib.Path('/workspace/Project-Cortex');roots=[R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-composition-c3-fresh-review',R/'work/resume/task04-native-c5-composition-c3-fresh-review',pathlib.Path('/tmp/cortex-native-c5-independent-review-c3-fresh-20261004a')]
for root in roots:
 seal=root/'literal-self-seal.json';rows=[]
 def walk(p):
  for c in sorted(p.iterdir()):
   if c==seal:continue
   s=c.lstat();r=dict(path=str(c.relative_to(root)),mode=s.st_mode,uid=s.st_uid,dev=s.st_dev,ino=s.st_ino,nlink=s.st_nlink)
   if stat.S_ISREG(s.st_mode):b=c.read_bytes();r.update(type='file',bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
   elif stat.S_ISLNK(s.st_mode):r.update(type='symlink',target=os.readlink(c))
   elif stat.S_ISDIR(s.st_mode):r.update(type='directory');rows.append(r);walk(c);continue
   else:raise RuntimeError('unsupported literal type')
   rows.append(r)
 walk(root);rows.sort(key=lambda r:r['path']);seal.write_text(json.dumps(dict(UTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),root=str(root),selfOnlyExclusion=str(seal),literalNoFollow=True,rows=rows,verdict='REJECT_ORIGINAL_CRITERION'),indent=2)+'\n');print(json.dumps({'path':str(seal),'rows':len(rows),'bytes':seal.stat().st_size,'sha256':hashlib.sha256(seal.read_bytes()).hexdigest()}))
