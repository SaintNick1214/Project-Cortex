import pathlib,os,json,hashlib,base64,sys
R=pathlib.Path('/workspace/Project-Cortex');plan=json.loads((R/'work/resume/connector-transfer-plan-46.json').read_text());row=plan['rows'][int(sys.argv[1])];assert row['sourceKind']=='CURRENT_HELD_LOCAL_BYTES';offset=int(sys.argv[2]);limit=int(sys.argv[3]);assert 0<=offset<=row['bytes'] and 0<limit<=600000
F=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in F}}
fd=os.open(row['sourcePath'],os.O_RDONLY|os.O_NOFOLLOW)
try:
 a=os.fstat(fd);assert ident(a)==row['identity'];h=hashlib.sha256();n=0;parts=[]
 while b:=os.read(fd,262144):
  h.update(b);lo=max(offset-n,0);hi=min(offset+limit-n,len(b))
  if lo<hi:parts.append(b[lo:hi])
  n+=len(b)
 assert n==row['bytes'] and h.hexdigest()==row['sha256'] and ident(a)==ident(os.fstat(fd))==ident(os.lstat(row['sourcePath']))
 raw=b''.join(parts);assert len(raw)==min(limit,n-offset);print(json.dumps({'offset':offset,'bytes':len(raw),'base64':base64.b64encode(raw).decode()},separators=(',',':')))
finally:os.close(fd)
