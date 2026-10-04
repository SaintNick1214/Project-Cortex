import json,gzip,re,hashlib,pathlib,datetime,posixpath
R=pathlib.Path('/workspace/Project-Cortex')
A=R/'work/resume/task04-model-drift-native-preparation-c5/output-route-audit'
O=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-finite-recipe-audit-c3'
sha=lambda b:hashlib.sha256(b).hexdigest()
put=lambda n,d:(O/n).write_text(json.dumps(d,indent=2)+'\n')
contract=json.loads((A/'proposed-closed-command-contract.json').read_bytes())
rows=json.loads((A/'audit-byte-preimages.json').read_bytes())['files']
sources={};pins={};bad=[]
for r in rows:
 b=gzip.decompress((A/r['encodedPath']).read_bytes())
 if sha(b)!=r['sha256'] or len(b)!=r['bytes']:bad.append(r['path'])
 sources[r['path']]=b.decode(errors='replace');pins[r['path']]={k:r[k] for k in ['path','sha256','bytes','encodedPath']}
assert not bad
ops=r'writeFileSync|appendFileSync|openSync|writeSync|writevSync|fsyncSync|fdatasyncSync|closeSync|ftruncateSync|fchmodSync|fchownSync|mkdirSync|mkdtempSync|renameSync|linkSync|symlinkSync|unlinkSync|rmdirSync|rmSync|cpSync|copyFileSync|truncateSync|chmodSync|chownSync|utimesSync|createWriteStream|writeFile|appendFile|truncate|datasync|fsync|copyFile|mkdtemp|symlink|rename|unlink|writev|ftruncate|fchmod|fchown|write|open|close'
routepat=re.compile(r'\b('+ops+r')\s*\(')
interest=re.compile(r'\b(spawnSync|spawn|execFileSync|execFile|execSync|exec|fork|SourceTextModule|SyntheticModule|build|import)\s*\(')
sourceIndex={}
for p,s in sources.items():
 if not p.endswith(('.mjs','.js','.cjs','.ts')):continue
 evidence=[]
 for i,l in enumerate(s.splitlines(),1):
  apis=sorted(set(routepat.findall(l)));other=sorted(set(interest.findall(l)))
  if apis or other or ('assert.' in l) or re.search(r'limits|rpcMs|nativeClientRpc|qualifierMs|deadlineMs',l):
   evidence.append({'line':i,'writerCandidates':apis,'otherCandidates':other,'exactLine':l,'lineSHA256':sha(l.encode()),'status':'SOURCE_EVIDENCE_NOT_EXECUTION_TRACE'})
 sourceIndex[p]={'pin':pins[p],'sites':evidence}
put('source-evidence.json',{'scope':'Exact archived source lines; candidate sites distinguish call contexts in per-ID inventory. No source evaluated.','sources':sourceIndex})
base='work/resume/task04-model-drift-native-preparation-c5/'
qbase='_goals/convex-backend-runtime-2026-10-02/qa/'
entries=[]
for c in contract['commands']:
 p=c['proposedArgv'][2].removeprefix(str(R)+'/');profile=c.get('profile');seen={};queue=[(p,[])]
 while queue:
  current,chain=queue.pop(0)
  if current in seen or current not in sources:continue
  seen[current]=chain+[current];s=sources[current]
  specs=set(re.findall(r'''(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]''',s))
  for spec in specs:
   if spec.startswith('.'):
    dst=posixpath.normpath(posixpath.join(posixpath.dirname(current),spec))
    if dst in sources:queue.append((dst,seen[current]))
  # Original VM loaders read exact public script names. This edge is a SOURCE
  # recipe reference, not evidence every exported function is called.
  if profile:
   scriptroot=qbase+'task04-model-drift-native-'+profile+'-preparation-c5/scripts/'
   for name in set(re.findall(r"[\w-]+\.mjs",s)):
    for dst in [scriptroot+name,base+name]:
     if dst in sources and dst!=current:queue.append((dst,seen[current]))
 routeRows=[]
 for src,chain in seen.items():
  idx=sourceIndex.get(src,{});sites=idx.get('sites',[])
  routeRows.append({'source':pins[src],'shortestReferenceChain':chain,'writerCandidates':sorted({api for x in sites for api in x['writerCandidates']}),'processCandidates':[{'line':x['line'],'lineSHA256':x['lineSHA256']} for x in sites if set(x['otherCandidates'])&{'spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'}],'nestedVM':any(set(x['otherCandidates'])&{'SourceTextModule','SyntheticModule'} for x in sites),'compilerBuild':any('build' in x['otherCandidates'] for x in sites),'dynamicImport':any('import' in x['otherCandidates'] for x in sites)})
 notes=['Original assertions and exceptions remain byte-pinned. Candidate/reference graph is conservative and does not promote uncalled exports to effects.']
 if c['id'].startswith('router-import-controls-'):notes+=['Calls only observedHttpRouter inside VM; build/import are exact DUMMY overrides; real tsc/cp/stage-link exports are uncalled. Healthy builds1/imports1; source/compiler/pin late drift builds1/imports0; effects0 in all four arms.']
 if c['id'].startswith('offline-runtime-freeze-'):notes+=['ProcessOwner.spawn DUMMY branch uses injected spawn object; no real OS process in this test recipe.']
 entries.append({'id':c['id'],'status':'HELD_NOT_EXECUTED','exactArgv':c['proposedArgv'],'argvCanonicalJSONSHA256':sha(json.dumps(c['proposedArgv'],separators=(',',':')).encode()),'entry':pins[p],'registryEntrySHA256MatchesArchive':c['entrySha256']==pins[p]['sha256'],'outputFamily':c['writeFamily'],'profile':profile,'sourceReferenceClosure':routeRows,'notes':notes})
put('per-id-inventory.json',{'scope':'Implementation aid, not independent gate verdict, confinement proof, composition PASS or execution authorization. ALL122 HELD.','commandCount':len(entries),'commands':entries})
put('source-validation.json',{'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceModules':len(rows),'allArchiveDecodedBytesMatch':not bad,'auditManifestSHA256':sha((A/'audit-manifest.json').read_bytes()),'reportSHA256':sha((A/'report.md').read_bytes()),'commandContractSHA256':sha((A/'proposed-closed-command-contract.json').read_bytes()),'commands':len(entries),'allEntryPinsMatch':all(e['registryEntrySHA256MatchesArchive'] for e in entries),'execution':'NONE; Python archive read and inventory authoring only','C3AcceptanceReads':'NONE'})
print(json.dumps({'modules':len(rows),'commands':len(entries),'entryPinsMatch':all(e['registryEntrySHA256MatchesArchive'] for e in entries),'output':str(O)}))
