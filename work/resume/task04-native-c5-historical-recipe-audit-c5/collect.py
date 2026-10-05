import pathlib,json,gzip,hashlib,re,datetime,stat
R=pathlib.Path('/workspace/Project-Cortex');A=R/'work/resume/task04-model-drift-native-preparation-c5/output-route-audit';O=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-historical-recipe-audit-c5';H=lambda b:hashlib.sha256(b).hexdigest()
rs=json.loads((A/'audit-byte-preimages.json').read_text())['files'];sources=[]
for r in rs:
 if not re.search(r'native-(extension|regression|extra)-preparation-c5/scripts/(guard|offline-runtime-freeze)\.mjs$',r['path']) and not r['path'].endswith('/freeze-after-scratch.mjs'):continue
 b=gzip.decompress((A/r['encodedPath']).read_bytes());assert H(b)==r['sha256'] and len(b)==r['bytes'];s=b.decode();lines=[]
 for i,l in enumerate(s.splitlines(),1):
  if 'scripts--guard.mjs.text' in l or 'preservation' in l.lower() or 'Historical' in l or 'parentC7' in l or 'nlink' in l and i<40 or 'completePaths' in l or 'assertCompleteManifest' in l or 'strictHistoricalRows' in l or 10<=i<=12 and r['path'].endswith('/guard.mjs'):
   lines.append({'line':i,'lineSHA256':H(l.encode()),'exactLine':l})
 sources.append({'path':r['path'],'bytes':r['bytes'],'sha256':r['sha256'],'encodedPath':r['encodedPath'],'lines':lines})
full={};profiles=[];manifestPins=[]
for kind in ['extension','regression','extra']:
 root=R/'_goals/convex-backend-runtime-2026-10-02/qa'/('task04-model-drift-native-'+kind+'-preparation-c5');p=root/'historical-preservation.json';b=p.read_bytes();pres=json.loads(b);members={};packets=[];negative=[];rowsTotal=0
 manifestPins.append({'path':str(p.relative_to(R)),'bytes':len(b),'sha256':H(b),'binding':'CURRENT_EXACT_PUBLIC_MANIFEST_BYTES_PACKET_PINS_CHECKED_NOT_RETROACTIVE_CUSTODY'})
 for packet in pres['packets']:
  base=R/packet['path'];p=base/packet['manifest'];b=p.read_bytes();assert H(b)==packet['manifestSHA256'];m=json.loads(b);assert len(m['files'])==packet['rows'];rows=m['files'];rowsTotal+=len(rows);add=[]
  manifestPins.append({'path':str(p.relative_to(R)),'bytes':len(b),'sha256':H(b),'binding':'ORIGINAL_HISTORICAL_PACKET_MANIFEST_SHA'});members[str(p)]={'path':str(p),'bytes':len(b),'sha256':H(b)}
  if 'fullClosure' in packet:
   f=packet['fullClosure'];p=root/f['path'];b=p.read_bytes();assert H(b)==f['sha256'] and len(b)==f['bytes'];complete=json.loads(b)['files'];assert len(complete)==f['rows']==83;prior={r['path']:r for r in rows};add=[r['path'] for r in complete if r['path'] not in prior];assert len(add)==3;rows=complete
   manifestPins.append({'path':str(p.relative_to(R)),'bytes':len(b),'sha256':H(b),'binding':'ORIGINAL_SOURCE_BOUND_FULL83_SUPPLEMENT'})
  packets.append({'packet':packet,'supplementAdditionalPaths':add,'rowKeys':sorted({k for row in rows for k in row})})
  for row in rows:
   name=str(base/row['path']);value={'path':name,'bytes':row['bytes'],'sha256':row['sha256']};assert name not in members or members[name]==value;members[name]=value
   st=(base/row['path']).lstat()
   if stat.S_ISREG(st.st_mode) and st.st_nlink!=1:negative.append({'path':str((base/row['path']).relative_to(R)),'nlink':st.st_nlink,'classification':'OBSERVED_NOT_DECLARED_NEGATIVE'})
 for name,row in members.items():assert name not in full or full[name]==row;full[name]=row
 selected=sorted(members.values(),key=lambda r:r['path']);profiles.append({'profile':kind,'packetCount':len(pres['packets']),'manifestRowCountBeforeDedup':rowsTotal,'dataManifestUnionRows':len(selected),'exactSubsetCanonicalJSONSHA256':H(json.dumps(selected,separators=(',',':')).encode()),'packets':packets,'observedNonSingleLinks':negative})
old=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c8/evidence/full-preservation01-failure/scripts--guard.mjs.text';b=old.read_bytes();oldPin={'path':str(old.relative_to(R)),'bytes':len(b),'sha256':H(b),'sourceBinding':'offline-runtime-freeze3 archived line9'}
selected=sorted(full.values(),key=lambda r:r['path'])
data={'scope':'SOURCE_RECIPE_AID_NOT_CAPTURE_OF_ALL_HISTORICAL_BYTES_NOT_READINESS','observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceArchiveManifestSHA256':H((A/'audit-manifest.json').read_bytes()),'sources':sources,'originalHistoricalManifestPins':manifestPins,'profiles':profiles,'combinedExactHistoricalSubset':{'rows':len(selected),'canonicalJSONSHA256':H(json.dumps(selected,separators=(',',':')).encode())},'standaloneOldGuardText':oldPin,'notExecuted':'ALL original122 held; source read only; no private actual file contents'}
(O/'sourcepins-and-subsets.json').write_text(json.dumps(data,indent=2)+'\n');print(json.dumps({'profiles':[{k:p[k]for k in ['profile','packetCount','manifestRowCountBeforeDedup','dataManifestUnionRows']}for p in profiles],'combined':data['combinedExactHistoricalSubset'],'oldGuard':oldPin}))
