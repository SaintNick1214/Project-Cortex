import os,hashlib,base64,json,pathlib
p=pathlib.Path('work/resume/task04-c7-partial-content-backing/spool/objects.part-0000');fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);a=os.fstat(fd);n=4*((a.st_size+2)//3);h=hashlib.sha1(b'blob '+str(n).encode()+b'\0');total=0
while raw:=os.read(fd,600000):
 s=base64.b64encode(raw);h.update(s);total+=len(s)
assert total==n and os.fstat(fd)==a and os.lstat(p)==a
os.close(fd);print(json.dumps({'gitSHA':h.hexdigest(),'bytes':n}))
