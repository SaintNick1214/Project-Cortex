from pack import *
from parser import scalarobjects
BASE=Path('/dev/shm/cortex-root-c6-frozen-content-backing');BASEQ=B/'task04-c6-frozen-content-backing';BASEW=R/'work/resume/task04-c6-frozen-content-backing'
SOURCES=[(B/'task04-native-c6-full-composition-restored-review','3aacd1e6e7468ed8964418bc5a68021bdd4a24e710733348e4fa8aa4b96028dc'),(R/'work/resume/task04-native-c6-full-composition-restored-review','0a40c200c335394f025bcbe0ff84e67cc40cbadab0b4cce07d707111562337f4'),(Path('/dev/shm/cortex-native-c6-restored-review'),'6f96403c8f1f505709b63fc5bef9d804fa9fb7b7914adcd8073b35e553ba2d51'),(B/'task04-native-c6-full-composition-fresh-review',None),(R/'work/resume/task04-native-c6-full-composition-fresh-review',None),(Path('/tmp/cortex-native-c6-independent-review-a4bf5535-2d53-44fe-a92c-42bace827faa'),None)]
def baseline():
 rootproof=B/'task04-c6-frozen-content-backing-root-inspection.json';proof=json.loads(read(rootproof,True)[2]);print('ROOT proof fields '+str(list(proof)),flush=True)
 # ROOT conclusion read explicitly, never inherited from producer.
 assert proof.get('gzipEOFCRCAndExactTarMembershipVerified') is True and proof['deltaObjectsStreamed']==1463 and proof['status']=='ROOT_AUTHENTICATED_C6_CONTENT_BACKING_READBACK_NOT_ACCEPTANCE',proof
 receipt=json.loads(read(BASEQ/'pack-receipt.json',True)[2]);assert receipt['deltaObjects']==1463
 assert read(BASE/'index.json')[0]=='3cc2357a9eb2adff1aaa1c9bf2db167fc532a9e028b80b89f26f77cc5c9c2d32'
 assert read(BASE/'index.transport.json.gz')[0]=='144b84f4951865450b4a76a80fb2d76801c40eabfec6e4173898fc0b957a1e07'
 assert read(BASE/'union-catalog.json')[0]=='1cee18abd6591e12c4e32ab598e34e7880e129300876994226986c06b1b647da'
 prior=json.loads(read(BASE/'union-catalog.json',True)[2])['objects'];assert len(prior)==29880
 for d in scalarobjects(BASE/'index.json'):
  if set(('sha256','bytes','backing'))<=set(d) and len(d)==3:
   if d['backing']=='delta':assert d['sha256'] not in prior;prior[d['sha256']]={'bytes':d['bytes'],'backing':'task04-c6-frozen-content-backing'}
   else:assert prior[d['sha256']]=={'bytes':d['bytes'],'backing':d['backing']}
 assert len(prior)==31343
 refs=[]
 for root,h in [(BASEQ,'91f914037261c04dd2afd40eedd67b105f5e29369caf2038bd143097bdd1bd9b'),(BASEW,'e4b2e205afbcab32dea7a5e27e2b571a9d1f2fef1b4ccd134b1ed3787cf98439'),(BASE,'f0d242206e83f256df942149bd9539b64687e507522527da2503bc2c7fb16f4a')]:
  packet=json.loads(pin(root/'selfseal.json',h));assert packet['root']==str(root) and packet['excludedSelfOnly']==['selfseal.json']
  # All baseline seal rows freshly read, no hash memo; prior archives anchored additionally by ROOT stream verification.
  assert {str(p.relative_to(root)) for p in paths(root) if p!=root/'selfseal.json'}=={r['path'] for r in packet['rows']}
  for row in packet['rows']:checkrow(root/row['path'],row)
  refs.append({'path':str(root/'selfseal.json'),'sha256':h})
 dump(T/'union-catalog.json',{'format':'AUTHENTICATED_PRIOR29880_PLUS_C6_DELTA1463_V1','objects':prior})
 dump(T/'baseline-proof.json',{'rootInspection':{'path':str(rootproof),'sha256':read(rootproof)[0],'proof':proof},'seals':refs,'receipt':receipt,'priorLocatorPath':str(BASE/'authenticated-prior-locators.json'),'priorLocatorSHA256':read(BASE/'authenticated-prior-locators.json')[0],'indexPath':str(BASE/'index.json'),'indexSHA256':receipt['index']['decodedSHA256'],'archive':receipt['archive'],'unionObjects':31343})
 return prior

def sourcecheck():
 members={str(r):set() for r,_ in SOURCES};counts=0
 for line in (T/'source-rows.jsonl').open():
  x=json.loads(line);checkrow(Path(x['root'])/x['row']['path'],x['row']);members[x['root']].add(x['row']['path']);counts+=1
 for root,h in SOURCES:
  assert {str(p.relative_to(root)) for p in paths(root)}==members[str(root)]
  if h:assert read(root/'seal.json')[0]==h
 return {'utc':now(),'sourceRows':counts,'fullHeldFDHashNineIdentityLiteralMembership':True,'allSixSourcesIncludingSourceOwnSeal':True,'latePlainRootsHaveNoHistoricalCustodyClaim':True}

def main():
 prior=baseline();objects={};checks=[];nrows=0;ledger=(T/'source-rows.jsonl').open('x')
 def register(p,h,n,e):
  if h in objects:assert objects[h]['bytes']==n;return
  if h in prior:assert prior[h]['bytes']==n
  objects[h]={'path':str(p) if p else None,'bytes':n,'backing':prior[h]['backing'] if h in prior else 'delta','estimate':0 if h in prior else e}
 for root,pinh in SOURCES:
  before=now();known=None
  if pinh:
   packet=json.loads(pin(root/'seal.json',pinh));assert packet['root']==str(root) and packet['exclusion']=='ONLY_OWN_ROOT_seal.json';known={r['path']:r for r in packet['rows']}
  membership={str(p.relative_to(root)) for p in paths(root)}
  if known:assert membership-{'seal.json'}==set(known)
  nr=nb=links=0
  for p in sorted(paths(root),key=lambda p:str(p.relative_to(root))):
   rel=str(p.relative_to(root));s=p.lstat();row={'path':rel,'identity':ident(s)}
   if known and rel!='seal.json':assert row['identity']==known[rel]['identity']
   if stat.S_ISREG(s.st_mode):
    h,s,e=read(p,estimate=True);row.update(kind='file',bytes=s.st_size,sha256=h);register(p,h,s.st_size,e);nr+=1;nb+=s.st_size
    if known and rel!='seal.json':assert h==known[rel]['sha256'] and s.st_size==known[rel]['bytes']
   elif stat.S_ISDIR(s.st_mode):row.update(kind='directory',members=sorted(os.listdir(p)))
   elif stat.S_ISLNK(s.st_mode):row.update(kind='symlink',target=os.readlink(p));links+=1
   else:raise AssertionError(str(p))
   if known and rel!='seal.json':checkrow(p,known[rel],False)
   ledger.write(json.dumps({'root':str(root),'sourceClass':'FROZEN_ACTUAL_SEAL' if pinh else 'PLAIN_LATE_PROSPECTIVE_ONLY','row':row},separators=(',',':'))+'\n');nrows+=1
  assert membership=={str(p.relative_to(root)) for p in paths(root)}
  checks.append({'root':str(root),'sourceClass':'FROZEN_ACTUAL_SEAL' if pinh else 'PLAIN_LATE_PROSPECTIVE_ONLY','sealSHA256':pinh,'utcPRE':before,'utcPOST':now(),'rows':len(membership),'files':nr,'regularBytes':nb,'literalLinks':links});print(json.dumps(checks[-1]),flush=True)
 ledger.close();dump(T/'source-checks.json',checks)
 dump(T/'objects-initial.json',objects)
 refs=(T/'external-references.jsonl').open('x');seen=set();unresolved=[]
 def external(path,h,n,context,kind):
  if (path,h,kind) in seen:return
  seen.add((path,h,kind));row={'literalPath':path,'expectedSHA256':h,'declaredBytes':n,'context':context,'classification':kind}
  if h in objects or h in prior:
   v=objects.get(h,prior.get(h));assert n is None or v['bytes']==n,(path,n,v['bytes']);row.update(bytes=v['bytes'],backing=v['backing'],resolution='EXACT_AUTHENTICATED_CONTENT_ONLY_NO_HISTORICAL_PHYSICAL_CUSTODY')
   if h not in objects:register(None,h,v['bytes'],0)
  elif kind=='LITERAL_BACKING' and Path(path).exists() and not Path(path).is_symlink():
   a,s,e=read(path,estimate=True);assert a==h,(path,a,h);assert n is None or n==s.st_size;register(path,h,s.st_size,e);row.update(bytes=s.st_size,currentIdentity=ident(s),freshFullStreamVerified=True,resolution='LATE_LITERAL_BACKING_BYTES')
  else:row['resolution']='FINITE_UNRESOLVED_HISTORICAL_CONTENT';unresolved.append(row)
  refs.write(json.dumps(row,separators=(',',':'))+'\n')
 for line in (T/'source-rows.jsonl').open():
  x=json.loads(line);r=x['row'];p=Path(x['root'])/r['path']
  if r['kind']!='file' or p.suffix not in ('.json','.jsonl'):continue
  for d in scalarobjects(p):
   for field,hfield,nfield in [('beforeByteBacking','encodedSHA256','encodedBytes'),('backing','backingSHA256','backingBytes'),('encodedPath','encodedSHA256','encodedBytes'),('sourcePath','sha256','bytes'),('index','indexSHA256','indexBytes'),('summary','summarySHA256','summaryBytes'),('archivePath','archiveSHA256','archiveBytes'),('gzipPath','encodedSHA256','encodedBytes'),('source','sourceSHA256','sourceBytes'),('source','sha256','bytes'),('path','sha256','bytes')]:
    path=d.get(field);h=d.get(hfield)
    if isinstance(path,str) and path.startswith('/') and isinstance(h,str) and len(h)==64:
     literal=field not in ('source','path') or path.endswith(('.gz','.part','.json.gz')) or '/prebytes/' in path or 'backing' in path
     external(path,h,d.get(nfield),str(p),'LITERAL_BACKING' if literal else 'HISTORICAL_SOURCE_PROOF_REF')
   for field,hfield,nfield in [('decodedPath','decodedSHA256','decodedBytes')]:
    if isinstance(d.get(field),str) and isinstance(d.get(hfield),str):external(d[field],d[hfield],d.get(nfield),str(p),'HISTORICAL_DECODED_REF')
 refs.close();dump(T/'objects-final.json',objects)
 report={'utc':now(),'status':'MEASURED_BEFORE_ARCHIVE_ALLOCATION','baselineObjects':31343,'sourceRows':nrows,'sourceRegularBytes':sum(v['regularBytes'] for v in checks),'uniqueObjects':len(objects),'reusedObjects':sum(v['backing']!='delta' for v in objects.values()),'deltaObjects':sum(v['backing']=='delta' for v in objects.values()),'deltaRawBytes':sum(v['bytes'] for v in objects.values() if v['backing']=='delta'),'estimatedEncodedDeltaBytes':sum(v['estimate'] for v in objects.values()),'references':len(seen),'unresolvedHistoricalRows':len(unresolved),'unresolved':unresolved,'encodedHardLimit':268435456,'memoryCurrent':int(Path('/sys/fs/cgroup/memory.current').read_text()),'memoryMax':17179869184}
 dump(Q/'measurement.json',report);print(json.dumps({k:v for k,v in report.items() if k!='unresolved'}),flush=True);dump(Q/'source-before-archive.json',sourcecheck())
if __name__=='__main__':main()

SOURCES += [(B/'task04-c7-exact-identity-source-aid',None),(R/'work/resume/task04-c7-exact-identity-source-aid',None)]
