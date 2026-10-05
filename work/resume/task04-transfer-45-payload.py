from pathlib import Path
import os,json,hashlib,base64,sys,stat
R=Path('/workspace/Project-Cortex');plan=json.loads((R/'work/resume/connector-transfer-plan-45.json').read_text());row=plan['rows'][int(sys.argv[1])];offset=int(sys.argv[2]);limit=int(sys.argv[3]);assert 0<=offset<=row['bytes'] and 0<limit<=600000
K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k)) for k in K}
p=Path(row['sourcePath']);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
try:
 assert stat.S_ISREG(os.fstat(fd).st_mode) and ident(os.fstat(fd))==row['identity'];h=hashlib.sha256();n=0;selected=[]
 while True:
  b=os.read(fd,1048576)
  if not b:break
  h.update(b);start=max(offset-n,0);end=min(offset+limit-n,len(b))
  if start<end:selected.append(b[start:end])
  n+=len(b)
 assert n==row['bytes'] and h.hexdigest()==row['sha256'] and ident(os.fstat(fd))==ident(os.lstat(p))==row['identity']
 b=b''.join(selected);assert len(b)==min(limit,row['bytes']-offset)
 print(json.dumps({'offset':offset,'bytes':len(b),'sourceBytes':n,'sourceSHA256':h.hexdigest(),'base64':base64.b64encode(b).decode()}))
finally:os.close(fd)
