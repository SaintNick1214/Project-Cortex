import json,gzip,hashlib,datetime,os,stat
from pathlib import Path
R=Path('/workspace/Project-Cortex');T=Path('/dev/shm/cortex-native-c6-closed-launcher-c6')
H=lambda b:hashlib.sha256(b).hexdigest()
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd); assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
  with os.fdopen(os.dup(fd),'rb') as f:b=f.read()
  z=os.fstat(fd);v=os.lstat(p);keys=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
  assert all(getattr(a,'st_'+k)==getattr(z,'st_'+k)==getattr(v,'st_'+k) for k in keys)
  return b,{k:getattr(a,'st_'+k) for k in keys}
 finally:os.close(fd)
def old(r):
 enc,_=held(r['beforeByteBacking']);assert len(enc)==r['encodedBytes'] and H(enc)==r['encodedSHA256']
 b=gzip.decompress(enc);assert len(b)==r['bytes'] and H(b)==r['sha256'];return b
p=T/'runs/24a610653f8247cfa3f44c9371f59f2f/receipt.json';raw,ident=held(p);d=json.loads(raw)
assert d['commands'][0]['exitCode']==0 and d.get('primaryFailure') is None and d['original8LiteralRowsAndIdentitiesEqual'] and not d['sourceByteHashesEqual']
pre={r['path']:r for r in d['commands'][0]['sourcePRE']};post={r['path']:r for r in d['sourcePOST']};assert set(pre)==set(post)
delta=[k for k in pre if (pre[k]['bytes'],pre[k]['sha256'])!=(post[k]['bytes'],post[k]['sha256'])]
mapPath=str(R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6/mirror-source-transform-map.json')
expected={mapPath};profiles=[]
for kind,counts,changed in [('extension',(116,98,18),17),('regression',(113,97,16),16),('extra',(118,100,18),17)]:
 root=T/'mirror/_goals/convex-backend-runtime-2026-10-02/qa'/('task04-model-drift-native-'+kind+'-preparation-c5')
 names=[str(root/'runner-dependency-inventory.json'),str(root/'dependency-tiers.json')];expected.update(names)
 pairs=[]
 for name in names:
  before=json.loads(old(pre[name]));b,i=held(name);assert len(b)==post[name]['bytes'] and H(b)==post[name]['sha256']
  assert all(i[k]==v for k,v in post[name]['identity'].items())
  pairs.append((before,json.loads(b)))
 a,b=pairs[0];c,e=pairs[1]
 assert len(a['inputs'])==len(b['inputs'])==counts[0]
 assert [x['path'] for x in a['inputs']]==[x['path'] for x in b['inputs']]
 n=0
 for x,y in zip(a['inputs'],b['inputs']):
  assert {k:v for k,v in x.items() if k not in ('bytes','sha256')}=={k:v for k,v in y.items() if k not in ('bytes','sha256')}
  n+=int((x['bytes'],x['sha256'])!=(y['bytes'],y['sha256']))
 assert n==changed
 for domain,count in [('rpc',counts[1]),('boundaryOnly',counts[2])]:
  assert len(c[domain]['runner'])==len(e[domain]['runner'])==count
  assert [x['path'] for x in c[domain]['runner']]==[x['path'] for x in e[domain]['runner']]
  assert c[domain]['tools']==e[domain]['tools']
  for x,y in zip(c[domain]['runner'],e[domain]['runner']):
   assert {k:v for k,v in x.items() if k not in ('bytes','sha256')}=={k:v for k,v in y.items() if k not in ('bytes','sha256')}
 assert sorted(b['inputs'],key=lambda x:x['path'])==sorted(e['rpc']['runner']+e['boundaryOnly']['runner'],key=lambda x:x['path'])
 profiles.append({'kind':kind,'inputRows':counts[0],'rpcRows':counts[1],'boundaryRows':counts[2],'changedHashSizeRows':n,'toolRowsUnchanged':True,'inventoryTierExact':True})
assert set(delta)==expected
captures=[]
for name in ('original8PRE','original8POST'):
 r=d[name];enc,_=held(r['path']);assert len(enc)==r['bytes'] and H(enc)==r['sha256'];body=gzip.decompress(enc);assert H(body)==r['decodedSha256'];captures.append(json.loads(body))
assert captures[0]['files']==captures[1]['files'] and len(captures[0]['files'])==148325
out={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_OWN_SETUP_DELTA_INSPECTION_ONLY','batch':'24a610653f8247cfa3f44c9371f59f2f','receiptSHA256':H(raw),'receiptIdentity':ident,'sourceRowMembershipEqual':len(pre),'changedPaths':delta,'profiles':profiles,'originalFixtureLiteralRowsEqual':148325,'sourceEqual':False,'limits':'Setup generated exactly six metadata files and map changes. Actual held lineage-before-write deficiency remains; source/body/current readiness and independent judgment are not awarded. Current POST metadata identities inspected, not all changed mutable code.','original122':'HELD'}
dest=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c6-root-metadata-setup-delta-inspection.json';assert not dest.exists();dest.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'status':out['status'],'deltaPaths':len(delta),'profiles':profiles}))
