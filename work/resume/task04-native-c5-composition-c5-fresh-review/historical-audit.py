import importlib.util,pathlib,json,gzip,stat,time
s=importlib.util.spec_from_file_location('review',pathlib.Path(__file__).with_name('review.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
plan=m.load(m.T/'historical-freeze-after-scratch.json');expected={r['path']:r for r in plan['rows']};p=m.T/'prepared-freeze-after-scratch-00d45c0b-66de-42a4-8931-af9cc2c317c5/consumed-version-ledger.jsonl';seen={};backing={};errors=[];nlinks=[];start=m.utc()
for line in open(p):
 e=json.loads(line)
 if e['path'] not in expected:continue
 r=expected[e['path']];assert e['bytes']==r['bytes'] and e['sha256']==r['sha256'];assert e['declaredHistoricalMatchesActual'] is True;seen[e['path']]=e
 b=e['beforeByteBacking'];bp=b['path']
 if bp not in backing:
  rr,encoded=m.held(bp);assert rr['sha256']==b['sha256'] and rr['bytes']==b['bytes'];decoded=encoded if b['encoding']=='RAW_EXACT_PREIMAGE' else gzip.decompress(encoded);assert len(decoded)==e['bytes'] and m.H(decoded)==e['sha256'];backing[bp]=rr
 current=m.held(e['path'])[0];assert current['sha256']==e['sha256'] and current['bytes']==e['bytes'];ss=pathlib.Path(e['path']).lstat();assert pathlib.Path(e['path']).resolve()==pathlib.Path(e['path'])
 if ss.st_nlink!=1:nlinks.append({'path':e['path'],'nlink':ss.st_nlink,'kind':r.get('kind')})
assert set(seen)==set(expected)
result={'utcStart':start,'utcEnd':m.utc(),'rows':len(seen),'decodedHistoricalBytes':sum(e['bytes'] for e in seen.values()),'ledger':m.held(p)[0],'backingUniqueCount':len(backing),'backingUnique':list(backing.values()),'nlinkNotOne':nlinks,'allDeclarationCurrentBytesAndBackingEqual':True,'historicalOriginalCustody':'BROKEN_FOREVER','wholeRouteExecution':'NOT_EXECUTED','historicalCapturedIdentitiesNotReplacedByCurrent':True}
m.save('historical-current-and-captured-backing-audit',result);print(json.dumps({k:v for k,v in result.items() if k not in ['backingUnique','nlinkNotOne']}));print('nlinkNotOne',len(nlinks))
