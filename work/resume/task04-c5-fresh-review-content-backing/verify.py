from pathlib import Path
import json,gzip,hashlib,datetime,os,stat
from pack import Q,W,O,R,read,ident,checkid,verifytar,H
p=Q/'pack-receipt.json';receipt=json.loads(p.read_bytes());raw=(O/'index.json').read_bytes();enc=(O/'index.transport.json.gz').read_bytes();pins=receipt['index'];assert len(raw)==pins['decodedBytes'] and H(raw)==pins['decodedSHA256'];assert len(enc)==pins['transportBytes'] and H(enc)==pins['transportSHA256'] and gzip.decompress(enc)==raw
idx=json.loads(raw);objects={r['sha256']:r['bytes'] for r in idx['objects'] if r['backing']=='delta'}
ver=verifytar([{**r,'sourcePath':str(O/r['name'])} for r in idx['archive']['parts']],objects,(idx['archive']['sha256'],idx['archive']['bytes']))
assert all(r['bytes']<=5*1024*1024 for r in idx['archive']['parts'])
for r in idx['references']:
 p=Path(r['provenancePath']);row=r if r.get('sealFile') else r['originalRow'];s=p.lstat();checkid(s,row['identity']);kind=row.get('kind','file')
 if kind in ('file','regular'):
  h,s,_=read(p);assert h==row['sha256'] and s.st_size==row['bytes']
 elif kind=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members']
 elif kind=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target']
 else:raise AssertionError(kind)
for r in idx['independentlyVerifiedReferences']:
 row=r['originalReference'];h,s,b=read(row['path'],'decodedSHA256' in row);assert h==row['sha256'] and s.st_size==row['bytes'];checkid(s,row.get('identity',{}))
 if 'decodedSHA256' in row:
  dec=gzip.decompress(b);assert len(dec)==row['decodedBytes'] and H(dec)==row['decodedSHA256']
for s in idx['sourceSeals']:assert read(s['sealPath'])[0]==s['sealSHA256']
u=receipt['unionCatalog'];uraw=(O/'union-catalog.json').read_bytes();ue=(O/'union-catalog.transport.json.gz').read_bytes();assert len(uraw)==u['decodedBytes'] and H(uraw)==u['decodedSHA256'];assert len(ue)==u['transportBytes'] and H(ue)==u['transportSHA256'] and gzip.decompress(ue)==uraw
union=json.loads(uraw)['objects'];assert len(union)==29591
for r in idx['objects']:
 if r['backing']!='delta':assert union[r['sha256']]=={'bytes':r['bytes'],'backing':r['backing']}
for p in O.iterdir():assert stat.S_ISREG(p.lstat().st_mode) and p.lstat().st_nlink==1
report={'status':'READ_BACK_CONTENT_VERIFIED_ONLY','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'indexSHA256':H(raw),'sourceReferencesRechecked':len(idx['references']),'externalReferencesRechecked':len(idx['independentlyVerifiedReferences']),'exactSourceSealHashesUnchanged':True,'unionObjects':len(union),'deltaVerification':ver,'noPhysicalRestorationCustodyOrRuntimeAcceptance':True}
(Q/'read-back-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
