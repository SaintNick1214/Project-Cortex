from pack import *
import re
# Streaming scalar-object reader; retains no whole array, source ledger, or archive.
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
def main():
 objects=json.loads((T/'objects.json').read_bytes());prior=json.loads((T/'union-catalog.json').read_bytes())['objects'];decl=[];seen=set();unresolved=[];newbytes=estimate=0
 ledger=(T/'external-references-06.jsonl').open('x')
 def external(path,h,n,context,kind):
  nonlocal newbytes,estimate
  if any(path==str(root) or path.startswith(str(root)+'/') for root,_,_ in SOURCES):return
  if (path,h,kind) in seen:return
  seen.add((path,h,kind));p=Path(path);row={'literalPath':path,'expectedSHA256':h,'declaredBytes':n,'context':context,'classification':kind}
  # Only explicit byte-backing paths and frozen contract are read externally. Historical sources are resolved by authenticated content.
  if kind=='LITERAL_BACKING' and p.exists() and not p.is_symlink():
   a,s,e=read(p,estimate=True);assert a==h,(path,a,h)
   if n is not None:assert s.st_size==n
   n=s.st_size;row.update(currentIdentity=ident(s),bytes=n,freshFullStreamVerified=True)
   if h not in objects:
    if h in prior:assert prior[h]['bytes']==n
    else:newbytes+=n;estimate+=e
    objects[h]={'path':path,'bytes':n,'backing':prior[h]['backing'] if h in prior else 'delta','estimate':e if h not in prior else 0}
  elif h in objects or h in prior:
   obj=objects.get(h,prior.get(h));assert n is None or obj['bytes']==n,(path,'size');n=obj['bytes'];row.update(bytes=n,resolution='AUTHENTICATED_EXACT_CONTENT_ONLY_NO_CURRENT_ORIGINAL_IDENTITY',backing=obj['backing'])
   if h not in objects:objects[h]={'path':None,'bytes':n,'backing':prior[h]['backing'],'estimate':0}
  else:row['resolution']='UNRESOLVED_LITERAL_EXTERNAL_CONTENT';unresolved.append(row)
  ledger.write(json.dumps(row,separators=(',',':'))+'\n')
 for line in (T/'source-rows.jsonl').open():
  r=json.loads(line);row=r['row'];p=Path(r['root'])/row['path']
  if row['kind']!='file' or p.suffix not in ('.json','.jsonl') or p.name in ('seal.json','exact-files-sha256.json') or 'capture-performance-source-aid' in str(p):continue
  # Every JSON declaration is streamed, including large original-read maps; historical source paths do not cause mutable rereads.
  for d in scalarobjects(p):
   for field,hfield,nfield in [('beforeByteBacking','encodedSHA256','encodedBytes'),('backing','backingSHA256','backingBytes'),('encodedPath','encodedSHA256','encodedBytes'),('sourcePath','sha256','bytes'),('index','indexSHA256','indexBytes'),('summary','summarySHA256','summaryBytes'),('archivePath','archiveSHA256','archiveBytes'),('gzipPath','encodedSHA256','encodedBytes')]:
    path=d.get(field);h=d.get(hfield)
    if isinstance(path,str) and path.startswith('/') and isinstance(h,str) and len(h)==64:external(path,h,d.get(nfield),str(p),'LITERAL_BACKING')
   if isinstance(d.get('path'),str) and d['path'].startswith('/') and isinstance(d.get('sha256'),str) and any(tag in str(d.get('encoding','')).upper() for tag in ['GZIP','EXACT_PREIMAGE']):external(d['path'],d['sha256'],d.get('bytes'),str(p),'LITERAL_BACKING')
   # Frozen lineage source declarations are content references, never replacement physical custody.
   for field,hfield,nfield in [('source','sourceSHA256','sourceBytes'),('source','sha256','bytes')]:
    path=d.get(field);h=d.get(hfield)
    if isinstance(path,str) and path.startswith('/') and isinstance(h,str) and len(h)==64:external(path,h,d.get(nfield),str(p),'HISTORICAL_DECLARED_SOURCE_CONTENT')
   # Explicit frozen contract/reference outside six sources.
   if p.name in ('prepared122bindings.json','external-backing-refs.json'):
    path=d.get('path');h=d.get('sha256')
    if isinstance(path,str) and path.startswith('/') and isinstance(h,str):external(path,h,d.get('bytes'),str(p),'LITERAL_BACKING')
 # ROOT proofs are authenticators, not acceptance. Include exact current proof bytes.
 for p in [B/'task04-native-c6-root-frozen-current-schema-inspection.json',B/'task04-native-c6-capture-performance-source-aid-root-inspection.json',B/'task04-c5-fresh-review-content-backing/pack-receipt.json',B/'task04-c5-fresh-review-content-backing-root-inspection.json']:
  h,s,e=read(p,estimate=True);external(str(p),h,s.st_size,'ROOT_AUTHENTICATOR_ONLY','LITERAL_BACKING')
 ledger.close();dump(T/'objects-with-external-06.json',objects)
 report={'utc':now(),'status':'EXTERNAL_LITERAL_REFERENCE_CLOSURE_MEASURED','references':len(seen),'unresolved':unresolved,'newExternalRawBytes':newbytes,'externalEstimatedGzipBytes':estimate,'totalObjects':len(objects),'deltaObjects':sum(v['backing']=='delta' for v in objects.values()),'deltaRawBytes':sum(v['bytes'] for v in objects.values() if v['backing']=='delta'),'estimatedGzipBytes':sum(v['estimate'] for v in objects.values()),'allHistoricalMutableOriginalRereadsAvoided':True};dump(Q/'external-closure-measurement-06.json',report);print(json.dumps({k:v for k,v in report.items() if k!='unresolved'}),flush=True);print('unresolved='+str(len(unresolved)),flush=True)
if __name__=='__main__':main()
