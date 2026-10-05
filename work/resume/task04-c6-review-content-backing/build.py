from archive import *
from measure import sourcecheck

def create():
 report=json.loads((Q/'final-eight-root-measurement.json').read_text());assert report['estimatedEncodedDeltaBytes']+12*1024*1024<268435456
 pre=sourcecheck();dump(Q/'source-pre-pack-check.json',pre);objects=json.loads((T/'objects-aid-resolved.json').read_text());delta={h:v for h,v in objects.items() if v['backing']=='delta'};sink=Sink()
 with gzip.GzipFile(fileobj=sink,filename='',mode='wb',mtime=0,compresslevel=3) as gz:
  with tarfile.open(fileobj=gz,mode='w|',format=tarfile.USTAR_FORMAT) as tar:
   for h,v in sorted(delta.items()):
    decoded=v.get('decodedGzipSource');p=Path(decoded or v['path'])
    if decoded:assert read(p)[0]==v['encodedSHA256']
    f,s=held(p)
    with f:
     data=gzip.GzipFile(fileobj=f,mode='rb') if decoded else f
     wrap=HashRead(data);m=tarfile.TarInfo('objects/'+h);m.size=v['bytes'];m.mode=0o600;m.uid=m.gid=m.mtime=0;tar.addfile(m,wrap)
     assert wrap.n==v['bytes'] and wrap.h.hexdigest()==h
     if decoded:assert data.read(1)==b'';data.close();assert ident(s)==v['encodedIdentity']
     assert ident(s)==ident(os.fstat(f.fileno()))==ident(p.lstat())
 sink.end();arc={'bytes':sink.n,'sha256':sink.h.hexdigest(),'parts':sink.parts};dump(T/'archive.json',arc);verify=verifytar(arc,delta);post=sourcecheck();dump(Q/'source-post-pack-check.json',post)
 header={'format':'C6_REJECTION_REVIEW_EIGHT_ROOT_CONTENT_BACKING_V1','scope':'CONTENT_ONLY_NO_CANDIDATE_IMPLEMENTATION_NO_VERDICT_OR_ACCEPTANCE_NO_OLD_CUSTODY','sources':json.loads((T/'source-checks-aid.json').read_text()),'sourcePRE':pre,'sourcePOST':post,'archive':arc,'decodedObjectVerification':verify,'baseline':json.loads((T/'baseline-proof.json').read_text()),'historicalUnresolved':report['unresolved'],'capturedPreimages':json.loads((T/'captured-preimage-resolutions.json').read_text()),'frozenReportSHA256':'d9a4c86b7cb06a98f65918d12346eb788118b22c1cca4565c66f3467a3238061','observedFrozenReportVerdict':'REJECT','observedFrozenReportScore':2.8,'full120':'FAILED_NULL_INCOMPLETE','actualApproval':'ABSENT','original122SourceParentNativePrivatePaid':'HELD','user120To900':'PENDING'}
 with (T/'index.json').open('x') as out:
  out.write(json.dumps(header,separators=(',',':'))[:-1]+',"sourceRows":[')
  for i,l in enumerate((T/'source-rows.jsonl').open()):out.write((',' if i else '')+l.strip())
  out.write('],"externalReferences":[')
  for i,l in enumerate((T/'external-references-final.jsonl').open()):out.write((',' if i else '')+l.strip())
  out.write('],"objects":[')
  for i,(h,v) in enumerate(sorted(objects.items())):out.write((',' if i else '')+json.dumps({'sha256':h,'bytes':v['bytes'],'backing':v['backing']},separators=(',',':')))
  out.write(']}\n')
 idx=transport(T/'index.json');union=transport(T/'union-catalog.json');total=sink.n+idx['transportBytes']+union['transportBytes'];assert total<268435456
 mapping={str((Q/r['name']).relative_to(R)):str(T/r['name']) for r in arc['parts']}
 # Publish compressed transports with explicit decoded SHA/size; raw index remains locally sealed and reviewable.
 for n in ['index','union-catalog']:mapping[str((Q/(n+'.json.gz')).relative_to(R))]=str(T/(n+'.transport.json.gz'))
 dump(W/'virtual-source-mapping.json',mapping)
 receipt={'status':'CONTENT_ONLY_SELF_READBACK_ROOT_INDEPENDENT_INSPECTION_REQUIRED','utc':now(),'sources':8,'sourceRows':report['sourceRows'],'sourceRegularBytes':report['sourceRegularBytes'],'baselineObjects':31343,'objects':len(objects),'reusedObjects':len(objects)-len(delta),'deltaObjects':len(delta),'deltaRawBytes':sum(v['bytes'] for v in delta.values()),'references':report['references'],'capturedPreimagesResolved':report['capturedPreimagesResolved'],'historicalUnresolvedRows':report['unresolvedHistoricalRows'],'historicalUnresolvedUniqueHashes':report['unresolvedUniqueHashes'],'allLiteralBackingReferencesResolved':True,'archive':arc,'index':idx,'unionCatalog':union,'totalNewEncodedBytes':total,'encodedHardLimit':268435456,'verification':verify,'sourcePRE':pre,'sourcePOST':post,'actualApproval':'ABSENT','original122SourceParentNativePrivatePaid':'HELD','full120':'FAILED_NULL_INCOMPLETE','user120To900':'PENDING','semanticReview':'ROOT_SEPARATE_NO_ACCEPTANCE_BY_TRANSPORT','limits':header['scope']}
 dump(Q/'pack-receipt.json',receipt);print(json.dumps({k:v for k,v in receipt.items() if k!='archive'}),flush=True)

def verify():
 receipt=json.loads((Q/'pack-receipt.json').read_text());objects=json.loads((T/'objects-aid-resolved.json').read_text());delta={h:v for h,v in objects.items() if v['backing']=='delta'}
 checks={}
 for k,n in [('index','index'),('unionCatalog','union-catalog')]:
  pins=receipt[k];p=T/(n+'.json');z=T/(n+'.transport.json.gz');h,s,_=read(p);eh,es,_=read(z);assert h==pins['decodedSHA256'] and s.st_size==pins['decodedBytes'] and eh==pins['transportSHA256'] and es.st_size==pins['transportBytes']
  with p.open('rb') as f,gzip.open(z,'rb') as gz:
   for b in iter(lambda:f.read(65536),b''):assert gz.read(len(b))==b
   assert gz.read(1)==b''
  checks[k]={'decodedSHA256':h,'transportSHA256':eh,'losslessGzipEOFCRCVerified':True}
 report={'utc':now(),'status':'SEPARATE_PROCESS_SELF_READBACK_ONLY_ROOT_REQUIRED','archive':verifytar(receipt['archive'],delta),'indexTransports':checks,'sourcePOST':sourcecheck(),'acceptance':False};dump(Q/'read-back-verification.json',report);print(json.dumps(report),flush=True)
if __name__=='__main__':
 import sys
 (verify if sys.argv[1:] == ['verify'] else create)()
