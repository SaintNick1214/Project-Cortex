from measure import *
def main():
 objects=json.loads((T/'objects-final.json').read_text());report=json.loads((Q/'measurement.json').read_text());missing={r['expectedSHA256'] for r in report['unresolved']};captured=[]
 for line in (T/'source-rows.jsonl').open():
  x=json.loads(line);r=x['row'];p=Path(x['root'])/r['path']
  if r['kind']!='file' or p.suffix not in ('.json','.jsonl'):continue
  for d in scalarobjects(p):
   proposals=[]
   if isinstance(d.get('beforeByteBacking'),str):proposals.append((d.get('sha256'),d.get('bytes'),d['beforeByteBacking'],d.get('encodedSHA256'),d.get('encodedBytes')))
   if isinstance(d.get('path'),str) and d.get('decodedSHA256'):proposals.append((d['decodedSHA256'],d.get('decodedBytes'),d['path'],d.get('sha256'),d.get('bytes')))
   for h,n,path,eh,en in proposals:
    if h not in missing:continue
    assert eh in objects,(path,eh)
    src=objects[eh]['path']
    # Source objects always have exact current path; reused external paths read only when explicitly declared gzip backing.
    if src is None:src=path
    a,s,e=read(src,estimate=True);assert a==eh and (en is None or en==s.st_size)
    f,s=held(src);ah=hashlib.sha256();size=encodedEstimate=0;est=zlib.compressobj(3,wbits=31)
    with f,gzip.GzipFile(fileobj=f,mode='rb') as z:
     for b in iter(lambda:z.read(65536),b''):ah.update(b);size+=len(b);encodedEstimate+=len(est.compress(b))
     encodedEstimate+=len(est.flush());assert ident(s)==ident(os.fstat(f.fileno()))==ident(Path(src).lstat())
    assert ah.hexdigest()==h and (n is None or size==n),(src,h,ah.hexdigest(),n,size)
    objects[h]={'path':None,'bytes':size,'backing':'delta','estimate':encodedEstimate,'decodedGzipSource':src,'encodedSHA256':eh,'encodedBytes':s.st_size,'encodedIdentity':ident(s)}
    captured.append({'rawSHA256':h,'rawBytes':size,'capturedGzipLiteralPath':path,'currentReadSource':src,'encodedSHA256':eh,'encodedBytes':s.st_size,'currentIdentity':ident(s),'declarationSource':str(p),'declarationSourceSHA256':r['sha256'],'fullGzipEOFCRCDecodedRawSHA256Verified':True,'scope':'EXACT_CONTENT_ONLY_NOT_HISTORICAL_CUSTODY'});missing.remove(h)
 dump(T/'objects-resolved.json',objects);dump(T/'captured-preimage-resolutions.json',captured)
 with (T/'external-references-final.jsonl').open('x') as out:
  for l in (T/'external-references.jsonl').open():
   x=json.loads(l)
   if x['expectedSHA256'] not in missing and x['resolution']=='FINITE_UNRESOLVED_HISTORICAL_CONTENT':x.update(resolution='DECLARED_CAPTURED_GZIP_FULLY_DECODED_CONTENT_ONLY',bytes=objects[x['expectedSHA256']]['bytes'],backing='delta')
   out.write(json.dumps(x,separators=(',',':'))+'\n')
 report.update(unresolved=[r for r in report['unresolved'] if r['expectedSHA256'] in missing],unresolvedHistoricalRows=sum(r['expectedSHA256'] in missing for r in report['unresolved']),unresolvedUniqueHashes=len(missing),capturedPreimagesResolved=len(captured),uniqueObjects=len(objects),reusedObjects=sum(v['backing']!='delta' for v in objects.values()),deltaObjects=sum(v['backing']=='delta' for v in objects.values()),deltaRawBytes=sum(v['bytes'] for v in objects.values() if v['backing']=='delta'),estimatedEncodedDeltaBytes=sum(v['estimate'] for v in objects.values()),allLiteralBackingReferencesResolved=True)
 dump(Q/'final-closure-measurement.json',report);print(json.dumps({k:v for k,v in report.items() if k!='unresolved'}),flush=True)
if __name__=='__main__':main()
