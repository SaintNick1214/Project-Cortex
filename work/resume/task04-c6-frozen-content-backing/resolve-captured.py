from pack import *
def main():
 closure=json.loads((Q/'external-closure-measurement-06.json').read_bytes());objects=json.loads((T/'objects-with-external-06.json').read_bytes());missing={r['expectedSHA256'] for r in closure['unresolved']};graph=SOURCES[2][0]/'package-graph.json';graphh,_,raw=read(graph,True);packet=json.loads(raw);assert graphh==next(json.loads(l)['row']['sha256'] for l in (T/'source-rows.jsonl').open() if json.loads(l)['root']==str(SOURCES[2][0]) and json.loads(l)['row']['path']=='package-graph.json');captured=[];outdir=T/'decoded-authentic-captured-preimages';outdir.mkdir(mode=0o700)
 for r in packet['files']:
  h=r.get('sha256')
  if h not in missing:continue
  p=Path(r['beforeByteBacking']);eh=r['encodedSHA256'];assert eh in objects;actual,s,_=read(p);assert actual==eh and s.st_size==objects[eh]['bytes'];f,s=held(p);a=hashlib.sha256();n=0;out=outdir/h
  with f,out.open('xb') as o,gzip.GzipFile(fileobj=f,mode='rb') as z:
   for b in iter(lambda:z.read(1048576),b''):assert o.write(b)==len(b);a.update(b);n+=len(b)
   assert ident(s)==ident(os.fstat(f.fileno()))==ident(p.lstat())
  assert a.hexdigest()==h and n==r['bytes'];dh,ds,e=read(out,estimate=True);assert dh==h;objects[h]={'path':str(out),'bytes':n,'backing':'delta','estimate':e};captured.append({'rawSHA256':h,'rawBytes':n,'capturedGzipLiteralPath':str(p),'encodedSHA256':eh,'encodedBytes':s.st_size,'freshEncodedIdentity':ident(s),'authenticatedDeclarationSource':str(graph),'authenticatedDeclarationSHA256':graphh,'fullGzipEOFCRCDecodedRawSHA256Verified':True,'scope':'EXACT_CONTENT_BINDING_ONLY_NOT_EARLIER_CUSTODY'});missing.remove(h)
 dump(T/'captured-preimage-resolutions.json',captured);dump(T/'objects-final.json',objects)
 with (T/'external-references-final.jsonl').open('x') as o:
  for line in (T/'external-references-06.jsonl').open():
   x=json.loads(line)
   if x.get('resolution')=='UNRESOLVED_LITERAL_EXTERNAL_CONTENT' and x['expectedSHA256'] not in missing:x.update(resolution='AUTHENTICATED_CAPTURED_GZIP_DECODED_EXACT_CONTENT_ONLY',bytes=objects[x['expectedSHA256']]['bytes'],backing='delta')
   o.write(json.dumps(x,separators=(',',':'))+'\n')
 report={**closure,'unresolved':[r for r in closure['unresolved'] if r['expectedSHA256'] in missing],'capturedPreimagesResolved':len(captured),'allLiteralBackingReferencesResolved':True,'historicalSourceProvenanceGaps':len(missing),'totalObjects':len(objects),'deltaObjects':sum(v['backing']=='delta' for v in objects.values()),'deltaRawBytes':sum(v['bytes'] for v in objects.values() if v['backing']=='delta'),'estimatedGzipBytes':sum(v['estimate'] for v in objects.values())};dump(Q/'final-closure-measurement.json',report);print(json.dumps({k:v for k,v in report.items() if k!='unresolved'}))
if __name__=='__main__':main()
