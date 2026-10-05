from pack import *
def scalarobjects(p,chunksize=65536):
 binary,s=held(p);f=io.TextIOWrapper(binary,encoding='utf-8');buf='';pos=0;stack=[];key=None;decoder=json.JSONDecoder()
 with f:
  eof=False
  while True:
   if pos>=len(buf)-1 and not eof:buf=buf[pos:]+f.read(chunksize);pos=0
   if pos>=len(buf):break
   c=buf[pos]
   if c.isspace() or c in ',:':pos+=1;continue
   if c in '{[':
    stack.append({'kind':c,'data':{},'key':None,'wantkey':c=='{'});pos+=1;continue
   if c in '}]':
    item=stack.pop();pos+=1
    if item['kind']=='{' and item['data']:yield item['data']
    if stack and stack[-1]['kind']=='{':stack[-1]['key']=None;stack[-1]['wantkey']=True
    continue
   while True:
    try:
     v,end=decoder.raw_decode(buf,pos)
     if end==len(buf) or buf[end] not in ' \t\r\n,:}]':
      chunk=f.read(chunksize)
      if chunk:buf=buf[pos:]+chunk;pos=0;continue
     break
    except json.JSONDecodeError:
     chunk=f.read(chunksize)
     if not chunk:raise AssertionError((str(p),pos,buf[max(0,pos-100):pos+100]))
     buf=buf[pos:]+chunk;pos=0
   pos=end
   if stack and stack[-1]['kind']=='{':
    cur=stack[-1]
    if cur['wantkey']:assert isinstance(v,str),(str(p),v,buf[max(0,pos-100):pos+100]);cur['key']=v;cur['wantkey']=False
    else:cur['data'][cur['key']]=v;cur['key']=None;cur['wantkey']=True
   if pos>65536:buf=buf[pos:];pos=0
  assert not stack
  assert ident(s)==ident(os.fstat(f.fileno()))==ident(Path(p).lstat())
