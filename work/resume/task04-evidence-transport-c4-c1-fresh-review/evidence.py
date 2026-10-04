import gzip,json,os,runpy,stat,sys
from pathlib import Path
e=runpy.run_path(str(Path(__file__).parent/'review.py'));R=e['R'];C=e['C'];Q=e['Q'];W=e['W'];read=e['read'];sha=e['sha'];save=e['save']
def sealcheck(root,name,pin):
 b,s=read(root/name);assert sha(b)==pin;m=json.loads(b);assert m['excludeOnlySelf']==name
 paths={str(p.relative_to(root)) for p in root.rglob('*') if not p.is_dir() and p!=root/name};expected={r['path'] for r in m['files']};assert paths==expected
 for r in m['files']:
  b,s=read(root/r['path']);assert len(b)==r['bytes'] and sha(b)==r['sha256'] and s.st_nlink==1
  if 'mode' in r:assert stat.S_IMODE(s.st_mode)==r['mode']
 return {'root':str(root),'rows':len(expected),'sha256':pin,'exactSelfOnly':True}
seals=[sealcheck(C,'qa-manifest.json','c8612ba3a6e8507485c7d47f364059397be23e56456f8b8d8f8c804a6fadeb5c'),sealcheck(R/'work/resume/task04-evidence-transport-c4-c1','work-manifest.json','362a6aced0e6540f07c767aeccacc01f9a3803c930abccdecca4faee34417593')]
h,idx,m,rows=e['load']();by={r['path']:r for r in rows};summary=json.loads(read(C/'summary.json')[0]);manifests=[]
for info in summary['originalManifests']:
 raw,s=read(R/info['root']/info['manifest']);assert sha(raw)==info['sha256'];mf=json.loads(raw)
 assert len(mf['files'])==info['rows']
 for r in mf['files']:
  mapped=by[info['root']+'/'+r['path']];assert mapped['sha256']==r['sha256']
  if 'bytes' in r:assert mapped['bytes']==r['bytes']
  assert mapped['kind']==r.get('kind','file')
  if 'target' in r:assert bytes.fromhex(mapped['targetHex'])==os.fsencode(r['target'])
  if 'mode' in r:assert mapped['mode']==r['mode']
 manifests.append({'root':info['root'],'allOriginalRowsMappedExactly':info['rows'],'rawBytes':len(raw),'sha256':sha(raw)})
assert max(r['bytes'] for r in rows if r['kind']=='file')==h.OBJECT_LIMIT
assert sum(m['contents'].values())+72*len(m['contents'])==h.STREAM_LIMIT
assert sum(m['contents'].values())==1215614313 and len(m['contents'])==18995
parts=[]
for cat in ['mapParts','archiveParts']:
 concat=bytearray()
 for p in idx[cat]:
  b,s=read(C/p['path']);assert len(b)==p['bytes']<=5242880 and sha(b)==p['sha256'];concat.extend(b)
 parts.append({'category':cat,'count':len(idx[cat]),'encodedBytes':len(concat),'sha256':sha(concat)})
receipts=[]
for p in sorted(C.glob('*.command.json')):
 b,s=read(p);r=json.loads(b);assert 'utcPRE' in r and 'utcPOST' in r and r['utcPRE']<=r['utcPOST'] and 'argv' in r and 'exit' in r
 # Every saved raw channel is actually read. Historical post rows bind that command's exact bytes.
 streams={}
 for channel in ['stdout','stderr']:
  path=p.with_name(p.name.replace('.command.json','.'+channel));raw,st=read(path);streams[channel]={'bytes':len(raw),'sha256':sha(raw)}
  candidates=[row for row in r.get('post',[]) if row['path']==str(path.relative_to(R))]
  if candidates:assert candidates[0]['bytes']==len(raw) and candidates[0]['sha256']==sha(raw)
 receipts.append({'command':p.name,'utcPRE':r['utcPRE'],'utcPOST':r['utcPOST'],'argv':r['argv'],'exit':r['exit'],'rawStreams':streams})
# Read entire structured source brackets, failed controls, and reference reports without hiding raw histories.
structured={}
for p in sorted(C.glob('*.json')):
 if p.name not in ['qa-manifest.json','index.json'] and not p.name.endswith('.command.json'):
  b,s=read(p);v=json.loads(b);structured[p.name]={'bytes':len(b),'sha256':sha(b),'topLevelKeys':list(v) if isinstance(v,dict) else None}
references=[]
for p in sorted((C/'reference-reports').glob('*')):
 b,s=read(p);references.append({'path':str(p),'bytes':len(b),'sha256':sha(b),'fullUTF8Read':bool(b.decode('utf-8'))})
save(Q/'evidence-review.json',{'candidateSeals':seals,'allEightManifestMappings':manifests,'boundedParts':parts,'derivedObjectCeiling':h.OBJECT_LIMIT,'derivedStreamCeiling':h.STREAM_LIMIT,'mapExactDecodedCeiling':h.MAP_LIMIT,'allGenuineReceipts':receipts,'structuredEvidenceFullyRead':structured,'fullReferenceReportsRead':references,'historicalNonzeroExits':[r['command'] for r in receipts if r['exit']],'incidentContinuity':False,'ownCachedPycRead':False})
print(json.dumps({'sealsVerified':seals,'receiptsFullyRead':len(receipts),'historicalFailures':sum(bool(r['exit']) for r in receipts),'manifestsMappedExactly':8,'boundedParts':parts}))
