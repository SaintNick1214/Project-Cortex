import os,json,pathlib,sys,hashlib,base64
R=pathlib.Path('/workspace/Project-Cortex');B=R/'work/resume/task04-c7-partial-content-backing';name=sys.argv[1];assert name.startswith('objects.part-') and name[13:].isdigit() and len(name)==17
offset=int(sys.argv[2]);limit=int(sys.argv[3]);assert 0<=offset and 0<limit<=600000
p=B/'part-manifests'/(name+'.json');m=json.loads(p.read_text());source=pathlib.Path(m['path']);assert source==B/'spool'/name
F=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in F}}
fd=os.open(source,os.O_RDONLY|os.O_NOFOLLOW)
try:
 a=os.fstat(fd);assert ident(a)==m['observedIdentity'];h=hashlib.sha256();g=hashlib.sha1(b'blob '+str(m['bytes']).encode()+b'\0');n=0;selected=[]
 while b:=os.read(fd,262144):
  h.update(b);g.update(b);lo=max(offset-n,0);hi=min(offset+limit-n,len(b))
  if lo<hi:selected.append(b[lo:hi])
  n+=len(b)
 assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(source)) and n==m['bytes'] and h.hexdigest()==m['sha256'] and g.hexdigest()==m['gitBlobSHA']
 raw=b''.join(selected);assert len(raw)==min(limit,n-offset)
 print(json.dumps({'bytes':len(raw),'offset':offset,'base64':base64.b64encode(raw).decode()},separators=(',',':')))
finally:os.close(fd)
