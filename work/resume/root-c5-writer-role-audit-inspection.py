from pathlib import Path
import os, stat, json, hashlib, gzip, datetime
R=Path('/workspace/Project-Cortex')
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa'
T=Path('/tmp/cortex-native-c5-closed-launcher-c5')
H=lambda b:hashlib.sha256(b).hexdigest()
def read(p):
 p=Path(p); s=p.lstat(); assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd); chunks=[]
  while True:
   b=os.read(fd,1048576)
   if not b:break
   chunks.append(b)
  z=os.fstat(fd)
 finally:os.close(fd)
 ident=lambda x:(x.st_dev,x.st_ino,x.st_size,x.st_mtime_ns,x.st_ctime_ns)
 assert ident(s)==ident(a)==ident(z)==ident(p.lstat())
 return b''.join(chunks),s
seals=[]
for root in [Q/'task04-native-c5-writer-role-audit',R/'work/resume/task04-native-c5-writer-role-audit',Path('/tmp/cortex-native-c5-writer-role-audit')]:
 raw,_=read(root/'seal.json'); seal=json.loads(raw)
 assert seal['root']==str(root)
 members={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and p.name!='seal.json'}
 assert members=={r['path'] for r in seal['rows']}
 for r in seal['rows']:
  b,s=read(root/r['path']);assert len(b)==r['bytes'] and H(b)==r['sha256']
  for k in ['mode','uid','dev','ino','nlink']:assert getattr(s,'st_'+k)==r[k]
 seals.append({'root':str(root),'sha256':H(raw),'members':len(members)})
evidence,_=read(Q/'task04-native-c5-writer-role-audit/source-evidence.json');d=json.loads(evidence)
pins=[];contents={};archived=Q/'task04-native-c5-writer-role-audit-observed-source-bytes';archived.mkdir(exist_ok=True)
for r in d['sourcePins']:
 b,_=read(r['path']);origin=r['path'];current=H(b)==r['sha256'] and len(b)==r['bytes']
 if not current:
  found=False
  for directory in ['prebytes','consumed-prebytes']:
   p=T/directory/(r['sha256']+'.gz')
   if not p.exists():continue
   encoded,_=read(p);decoded=gzip.decompress(encoded)
   if H(decoded)==r['sha256'] and len(decoded)==r['bytes']:
    b=decoded;origin=str(p);found=True
    target=archived/(r['sha256']+'.text')
    if target.exists():assert target.read_bytes()==b
    else:target.write_bytes(b)
    break
  assert found, 'Missing authentic observed bytes: '+r['path']
 assert H(b)==r['sha256'] and len(b)==r['bytes'];contents[r['path']]=b
 pins.append({**r,'verifiedFrom':origin,'currentBytesEqual':current,'custody':'CONTENT_ONLY_NO_OLD_INODE_OR_TIME_CLAIM'})
for r in d['writerCandidatesConservativeNotReachability']+d['exactWriterAndVerifySourceLines']:
 line=contents[r['source']].decode().splitlines()[r['line']-1]
 assert H(line.encode())==r['lineSHA256']
 if 'exactSourceLine' in r:assert line==r['exactSourceLine']
mapping=json.loads(contents[str(R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c5/mirror-source-transform-map.json')])
mapped={r['destination']:r for r in mapping['inputs']}
assert len(d['exactHostMetadataOutputs'])==24 and d['commandCount']==122 and d['uniqueEntries']==60
for r in d['exactHostMetadataOutputs']:
 row=mapped.get(r['exactMirrorOutput']);assert (row is not None)==r['mappedInput']
 assert (row['destinationSHA256'] if row else None)==r['initialMappedSHA256']
 assert not r['immutableSourceClosureMember']
receipt={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'ROOT_READ_ONLY_SOURCE_AID_INSPECTION_NOT_C5_READINESS','observationUTC':d['utc'],'seals':seals,'sourcePins':pins,'lineHashesVerified':len(d['writerCandidatesConservativeNotReachability'])+len(d['exactWriterAndVerifySourceLines']),'exactHostMetadataOutputsVerified':24,'unclassifiedMappedHostOutputCount':0,'limitations':['Conservative direct-entry writer scan is not transitive semantic completeness.','Mutable source snapshots are checked against authentic archived observed bytes when current bytes differ.','No candidate/original module executed; no C5 or original-122 acceptance awarded.','Generic eligible-writer-root capture is not exact per-command producer lineage.']}
(Q/'task04-native-c5-writer-role-audit-root-inspection.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'seals':len(seals),'pins':len(pins),'archivedObservedPins':sum(not r['currentBytesEqual'] for r in pins),'lines':receipt['lineHashesVerified'],'hostOutputs':24}))
