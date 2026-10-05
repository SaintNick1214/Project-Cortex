from measure import *
aids=[(B/'task04-c7-exact-identity-source-aid','b5d12b3410abc8c0c267db5b12652b6871db7dadddfbfa77fb781342655d85e9'),(R/'work/resume/task04-c7-exact-identity-source-aid','ceaee4219712f8e8d7c6f6e592099d264d546ccaefce037bcb251bf4f34d3e0a')]
objects=json.loads((T/'objects-resolved.json').read_text());prior=json.loads((T/'union-catalog.json').read_text())['objects'];checks=json.loads((T/'source-checks.json').read_text());report=json.loads((Q/'final-closure-measurement.json').read_text());newrows=[]
for root,pinh in aids:
 packet=json.loads(pin(root/'selfseal.json',pinh));assert packet['format']=='PLAIN_EXACT_FILE_CONTENT_MANIFEST_NOT_DIRECTORY_HISTORICAL_SEAL' and packet['root']==str(root);known={r['relativePath']:r for r in packet['rows']};membership={str(p.relative_to(root)) for p in paths(root)}
 assert {str(p.relative_to(root)) for p in paths(root) if p.is_file() and p.name!='selfseal.json'}==set(known)
 nr=nb=0;before=now()
 for p in sorted(paths(root),key=str):
  rel=str(p.relative_to(root));s=p.lstat();row={'path':rel,'identity':ident(s)}
  if stat.S_ISREG(s.st_mode):
   h,s,e=read(p,estimate=True);row.update(kind='file',sha256=h,bytes=s.st_size);nr+=1;nb+=s.st_size
   if p.name!='selfseal.json':assert known[rel]['sha256']==h and known[rel]['bytes']==s.st_size and {k:str(v) for k,v in ident(s).items()}==known[rel]['identity']
   if h not in objects:
    if h in prior:assert prior[h]['bytes']==s.st_size
    objects[h]={'path':str(p),'bytes':s.st_size,'backing':prior[h]['backing'] if h in prior else 'delta','estimate':0 if h in prior else e}
  elif stat.S_ISDIR(s.st_mode):row.update(kind='directory',members=sorted(os.listdir(p)))
  elif stat.S_ISLNK(s.st_mode):row.update(kind='symlink',target=os.readlink(p))
  else:raise AssertionError(str(p))
  newrows.append({'root':str(root),'sourceClass':'SOURCE_AID_PLAIN_CONTENT_MANIFEST_LATE_PROSPECTIVE_ONLY','row':row})
 assert membership=={str(p.relative_to(root)) for p in paths(root)}
 checks.append({'root':str(root),'sourceClass':'SOURCE_AID_PLAIN_CONTENT_MANIFEST_LATE_PROSPECTIVE_ONLY','manifestSHA256':pinh,'utcPRE':before,'utcPOST':now(),'rows':len(membership),'files':nr,'regularBytes':nb,'literalLinks':0,'runtime':'NOT_RUN','noNativeCaptureClaim':True})
with (T/'source-rows.jsonl').open('a') as out:
 for x in newrows:out.write(json.dumps(x,separators=(',',':'))+'\n')
seen={(json.loads(l)['literalPath'],json.loads(l)['expectedSHA256'],json.loads(l)['classification']) for l in (T/'external-references-final.jsonl').open()};added=0
with (T/'external-references-final.jsonl').open('a') as out:
 for x in newrows:
  r=x['row'];p=Path(x['root'])/r['path']
  if r['kind']!='file' or p.suffix not in ('.json','.jsonl'):continue
  for d in scalarobjects(p):
   for field,hfield,nfield in [('path','sha256','bytes'),('source','sourceSHA256','sourceBytes'),('sourcePath','sha256','bytes'),('beforeByteBacking','encodedSHA256','encodedBytes')]:
    path=d.get(field);h=d.get(hfield);n=d.get(nfield);kind='SOURCE_AID_DECLARED_CONTENT_REF'
    if not isinstance(path,str) or not path.startswith('/') or not isinstance(h,str) or len(h)!=64 or (path,h,kind) in seen:continue
    seen.add((path,h,kind));added+=1;v=objects.get(h,prior.get(h));ref={'literalPath':path,'expectedSHA256':h,'declaredBytes':n,'context':str(p),'classification':kind}
    if v:
     assert n is None or v['bytes']==n;ref.update(bytes=v['bytes'],backing=v['backing'],resolution='AUTHENTICATED_EXACT_CONTENT_ONLY_NOT_NATIVE_CAPTURE')
     if h not in objects:objects[h]={'path':None,'bytes':v['bytes'],'backing':v['backing'],'estimate':0}
    else:ref['resolution']='FINITE_UNRESOLVED_HISTORICAL_CONTENT';report['unresolved'].append(ref)
    out.write(json.dumps(ref,separators=(',',':'))+'\n')
dump(T/'source-checks-aid.json',checks);dump(T/'objects-aid-resolved.json',objects)
report.update(sourceRoots=8,sourceRows=report['sourceRows']+len(newrows),sourceRegularBytes=sum(r['regularBytes'] for r in checks),references=report['references']+added,uniqueObjects=len(objects),reusedObjects=sum(v['backing']!='delta' for v in objects.values()),deltaObjects=sum(v['backing']=='delta' for v in objects.values()),deltaRawBytes=sum(v['bytes'] for v in objects.values() if v['backing']=='delta'),estimatedEncodedDeltaBytes=sum(v['estimate'] for v in objects.values()),unresolvedHistoricalRows=len(report['unresolved']),unresolvedUniqueHashes=len({r['expectedSHA256'] for r in report['unresolved']}),sourceAidRuntime='NOT_RUN')
dump(Q/'final-eight-root-measurement.json',report);print(json.dumps({k:v for k,v in report.items() if k!='unresolved'}),flush=True)
