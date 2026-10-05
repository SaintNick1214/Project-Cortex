"""Read-only full recovered eight-root byte capture; never restores or mutates originals."""
from pathlib import Path
import os,stat,json,hashlib,gzip,datetime,uuid,sys,time
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c4';T=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1';PIN='a82fb82ad92d4a9753a9c7fe612ba880f82f4893a7a6d3e211dc8ec9a4fad869'
H=lambda b:hashlib.sha256(b).hexdigest();utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def metadata(s):return {k:getattr(s,'st_'+k)for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']}
def capture(label):
 start=utc();ib=(T/'index.json').read_bytes();assert H(ib)==PIN,'TRANSPORT_INDEX_DRIFT';index=json.loads(ib);back=[];parts=[]
 for family in ['mapParts','archiveParts']:
  for x in index[family]:
   p=T/x['path'];s=p.lstat();assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and not p.is_symlink();b=p.read_bytes();assert len(b)==x['bytes']and H(b)==x['sha256'];back.append({'path':str(p.relative_to(R)),**x,'pre':metadata(s),'post':metadata(p.lstat())});assert back[-1]['pre']==back[-1]['post']
   if family=='mapParts':parts.append(b)
 mb=gzip.decompress(b''.join(parts));assert len(mb)==index['mapDecodedBytes']and H(mb)==index['mapDecodedSha256'];mapping=json.loads(mb);expected={x['path']:x for x in mapping['files']};assert len(expected)==len(mapping['files'])==148325;assert len(mapping['roots'])==8
 actual=set()
 for root in mapping['roots']:
  base=R/root;assert base.is_dir()and not base.is_symlink()
  for dp,dn,fn in os.walk(base,followlinks=False):
   for n in fn+[n for n in dn if (Path(dp)/n).is_symlink()]:actual.add(str((Path(dp)/n).relative_to(R)))
 assert actual==set(expected),'ORIGINAL_LITERAL_SET_DRIFT'
 observed=[];total=0
 for name,row in sorted(expected.items()):
  p=R/name;s=p.lstat();pre=metadata(s)
  if row['kind']!='file':
   assert stat.S_ISLNK(s.st_mode);target=os.readlink(p);b=os.fsencode(target);assert b.hex()==row['targetHex'];assert H(b)==row['sha256'];kind='literal-symlink'
  else:
   assert stat.S_ISREG(s.st_mode)and not p.is_symlink();assert p.resolve()==p,'ORIGINAL_ANCESTOR_SYMLINK';fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
   try:
    assert metadata(os.fstat(fd))==pre;h=hashlib.sha256();size=0
    while True:
     block=os.read(fd,1048576)
     if not block:break
     h.update(block);size+=len(block)
    assert size==row['bytes']and h.hexdigest()==row['sha256'],'ORIGINAL_BYTES_DRIFT';assert metadata(os.fstat(fd))==pre
   finally:os.close(fd)
   total+=size;kind='file'
  post=metadata(p.lstat());assert pre==post,'ORIGINAL_IDENTITY_DRIFT';observed.append({'path':name,'kind':kind,'bytes':row.get('bytes',len(b)if kind!='file'else 0),'sha256':row['sha256'],'identity':pre,'beforeAfterIdentityEqual':True,'backingObject':row.get('sha256'),'backingIndex':str((T/'index.json').relative_to(R)),'originalNegativeFixtureHardlink':s.st_nlink!=1 if kind=='file'else False})
 result={'utcPRE':start,'utcPOST':utc(),'label':label,'rows':len(observed),'regularBytesRead':total,'literalLinks':mapping['literalLinks'],'roots':mapping['roots'],'transportIndex':{'path':str((T/'index.json').relative_to(R)),'sha256':PIN,'decodedMapSHA256':H(mb),'decodedMapBytes':len(mb),'parts':back},'files':observed,'historicalCustody':'BROKEN; six incident receipts omitted C4 scratch; this is new prospective recovered-state evidence only','status':'FULL_LITERAL_SET_AND_CURRENT_BYTES_VERIFIED_NOT_QUALIFICATION_ACCEPTANCE'}
 out=Path('/tmp/cortex-native-c5-closed-launcher-c4/captures')/(label+'--'+uuid.uuid4().hex+'.json.gz');out.parent.mkdir(parents=True,exist_ok=True);raw=json.dumps(result,separators=(',',':')).encode()+b'\n';out.write_bytes(gzip.compress(raw,mtime=0));return {'path':str(out),'bytes':out.stat().st_size,'sha256':H(out.read_bytes()),'decodedSha256':H(raw),'rows':len(observed),'utcPRE':start,'utcPOST':result['utcPOST']}
if __name__=='__main__':
 assert len(sys.argv)==2 and sys.argv[1]in ['synthetic-batch-before','synthetic-batch-after'];print(json.dumps(capture(sys.argv[1])))
