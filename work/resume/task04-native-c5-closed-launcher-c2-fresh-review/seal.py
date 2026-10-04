from pathlib import Path
import os,stat,json,hashlib
H=lambda b:hashlib.sha256(b).hexdigest()
def seal(root,name):
 rows=[]
 for dp,dn,fn in os.walk(root,followlinks=False):
  for n in fn+[n for n in dn if (Path(dp)/n).is_symlink()]:
   p=Path(dp)/n;rel=str(p.relative_to(root))
   if rel==name:continue
   s=p.lstat()
   if stat.S_ISLNK(s.st_mode):
    b=os.fsencode(os.readlink(p));rows.append({'path':rel,'kind':'literal-symlink','bytes':len(b),'targetHex':b.hex(),'sha256':H(b)})
   else:
    assert stat.S_ISREG(s.st_mode);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
    try:
     a=os.fstat(fd);h=hashlib.sha256();size=0
     while True:
      b=os.read(fd,1048576)
      if not b:break
      h.update(b);size+=len(b)
     keys=['st_dev','st_ino','st_size','st_mtime_ns','st_ctime_ns'];assert tuple(getattr(a,k)for k in keys)==tuple(getattr(os.fstat(fd),k)for k in keys)==tuple(getattr(p.lstat(),k)for k in keys)
    finally:os.close(fd)
    rows.append({'path':rel,'kind':'file','bytes':size,'sha256':h.hexdigest()})
 rows.sort(key=lambda x:x['path']);d={'files':rows,'selfExcludedOnly':name,'order':'GLOBAL_LEXICAL','scope':'EXACT_PHYSICAL_PACKET_NO_SYMLINK_FOLLOW'};p=root/name;p.write_text(json.dumps(d,indent=2)+'\n');return {'path':str(p),'bytes':p.stat().st_size,'sha256':H(p.read_bytes()),'rows':len(rows),'literalLinks':sum(x['kind']=='literal-symlink'for x in rows)}
if __name__=='__main__':
 import sys
 print(json.dumps(seal(Path(sys.argv[1]),sys.argv[2])))
