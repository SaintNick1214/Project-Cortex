import pathlib,json,gzip,re,hashlib,datetime
R=pathlib.Path('/workspace/Project-Cortex');A=R/'work/resume/task04-model-drift-native-preparation-c5/output-route-audit';O=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-deadline-source-audit-c4'
h=lambda b:hashlib.sha256(b).hexdigest()
names={'guard.mjs','qualify-owned.mjs','driver.mjs','current-inputs.mjs','parent-inputs.mjs','qualifier-diagnostics.mjs','process-owner.mjs','process-terminal.mjs','cleanup.mjs','window-evidence.mjs'}
out=[]
for r in json.loads((A/'audit-byte-preimages.json').read_text())['files']:
 if not re.search(r'native-(extension|regression|extra)-preparation-c5/scripts/',r['path']) or pathlib.Path(r['path']).name not in names:continue
 b=gzip.decompress((A/r['encodedPath']).read_bytes());assert len(b)==r['bytes'] and h(b)==r['sha256'];s=b.decode();lines=[]
 for i,l in enumerate(s.splitlines(),1):
  if re.search(r'qualifierMs|driverMs|1440000|1200000|deadline|concurrency|cleanup|startedAt|active--|records.size|spawned|setTimeout|SIGTERM|SIGKILL',l,re.I):lines.append({'line':i,'exactSourceLine':l,'lineSHA256':h(l.encode())})
 out.append({'path':r['path'],'bytes':r['bytes'],'sourceSHA256':r['sha256'],'encodedPath':r['encodedPath'],'sourceLines':lines})
(O/'source-evidence.json').write_text(json.dumps({'status':'READ_ONLY_IMPLEMENTATION_AID_NOT_GATE_VERDICT','archiveManifestSHA256':h((A/'audit-manifest.json').read_bytes()),'sources':out},indent=2)+'\n')
(O/'sourcepins.json').write_text(json.dumps({'status':'ORIGINAL_SOURCE_PINS_ONLY_NO_C4_SUBJECT_SEAL','sources':[{k:r[k] for k in ['path','bytes','sourceSHA256','encodedPath']} for r in out],'allDecodedPinsMatch':True,'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n')
print('captured',len(out),'original pinned source modules')
