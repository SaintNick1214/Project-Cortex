from archive import *
def main():
 receipt=json.loads((Q/'pack-receipt.json').read_bytes());checked={}
 for k,name in [('index','index'),('unionCatalog','union-catalog')]:
  pins=receipt[k];p=T/(name+'.json');z=T/(name+'.transport.json.gz');a,s,_=read(p);b,ss,_=read(z);assert a==pins['decodedSHA256'] and s.st_size==pins['decodedBytes'];assert b==pins['transportSHA256'] and ss.st_size==pins['transportBytes']
  with p.open('rb') as f,z.open('rb') as e,gzip.GzipFile(fileobj=e,mode='rb') as gz:
   for x in iter(lambda:f.read(1048576),b''):assert gz.read(len(x))==x
   assert gz.read(1)==b''
  checked[k]={'decodedSHA256':a,'transportSHA256':b,'exactLosslessGzipEOFCRC':True}
 objects=json.loads((T/'objects-final.json').read_bytes());delta={h:v for h,v in objects.items() if v['backing']=='delta'};v=verifytar(receipt['archive'],delta);src=sourcescheck();prior,deps=authenticate();assert len(prior)==29880
 for h,obj in objects.items():
  if obj['backing']!='delta':assert prior[h]=={'bytes':obj['bytes'],'backing':obj['backing']}
 report={'status':'SEPARATE_PROCESS_SELF_READBACK_ONLY_ROOT_INDEPENDENT_READBACK_REQUIRED','utc':now(),'checks':checked,'delta':v,'sourceChecks':src,'reusableUnionObjects':len(prior),'reusedSHA256SizeAndAuthenticatedLocator':len(objects)-len(delta),'priorOrderedArchivePartAndWholeArchiveHashesFreshVerified':True,'allLiteralBackingReferencesResolved':True,'historicalSourceProvenanceGapRows':receipt['historicalSourceProvenanceGapRows'],'historicalSourceProvenanceGapUniqueHashes':receipt['historicalSourceProvenanceGaps'],'C6fullCriterion':'UNRESOLVED120','actualApproval':'ABSENT','original122SourceParentNativePrivatePaid':'HELD','physicalRestorationOrRuntimeAcceptance':False};dump(Q/'read-back-verification.json',report);print(json.dumps(report))
if __name__=='__main__':main()
