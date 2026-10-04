from pathlib import Path
import os,stat,hashlib,json,datetime
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-native-c5-closed-launcher-c1-fresh-review';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-closed-launcher-c1-fresh-review';T=Path('/tmp/cortex-native-c5-closed-launcher-c1-fresh-review');H=lambda b:hashlib.sha256(b).hexdigest()
def seal(root,name):
 rows=[]
 for dp,dn,fn in os.walk(root,followlinks=False):
  for n in fn+[n for n in dn if (Path(dp)/n).is_symlink()]:
   p=Path(dp)/n;relative=str(p.relative_to(root))
   if relative==name:continue
   s=p.lstat();r={'path':relative,'mode':stat.S_IMODE(s.st_mode),'uid':s.st_uid,'nlink':s.st_nlink}
   if stat.S_ISLNK(s.st_mode):b=os.fsencode(os.readlink(p));r.update(kind='literal-symlink',targetHex=b.hex())
   else:
    assert stat.S_ISREG(s.st_mode);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
    try:
     before=os.fstat(fd);blocks=[]
     while True:
      x=os.read(fd,1048576)
      if not x:break
      blocks.append(x)
     after=os.fstat(fd);assert before.st_dev==after.st_dev==s.st_dev and before.st_ino==after.st_ino==s.st_ino;b=b''.join(blocks)
    finally:os.close(fd)
    r['kind']='file'
   r.update(bytes=len(b),sha256=H(b));rows.append(r)
 rows.sort(key=lambda x:x['path']);p=root/name;p.write_text(json.dumps({'root':str(root),'excludeONLY':name,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':rows},indent=2)+'\n');return {'path':str(p),'bytes':p.stat().st_size,'sha256':H(p.read_bytes()),'rows':len(rows),'literalLinks':sum(r['kind']=='literal-symlink' for r in rows),'regularBytes':sum(r['bytes'] for r in rows if r['kind']=='file')}
tmp=seal(T,'tmp-manifest.json');(Q/'scratch-references.json').write_text(json.dumps({'workSeal':str(W/'work-manifest.json'),'tmpSeal':tmp,'scope':'self-only physical closures; existing original8 backing remains authenticated external reference'},indent=2)+'\n');work=seal(W,'work-manifest.json');refs=json.loads((Q/'scratch-references.json').read_bytes());refs['workSeal']=work;(Q/'scratch-references.json').write_text(json.dumps(refs,indent=2)+'\n');qa=seal(Q,'qa-manifest.json');print(json.dumps({'tmp':tmp,'work':work,'qa':qa}))
