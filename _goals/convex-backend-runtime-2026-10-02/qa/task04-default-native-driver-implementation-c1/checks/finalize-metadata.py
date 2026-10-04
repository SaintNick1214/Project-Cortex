import pathlib,json,hashlib,datetime
base=pathlib.Path(__file__).resolve().parent.parent
root=base.parents[3]
utc=datetime.datetime.now(datetime.timezone.utc).isoformat()
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def put(name,obj):(base/name).write_text(json.dumps(obj,indent=2)+'\n')
parts=[json.loads(line) for line in (base/'checks/final-suite-04/stdout').read_text().splitlines()]
outcomes=[dict(scope=p['scope'],**r) for p in parts if p['scope']!='OFFLINE_SUPPORTED_ADAPTER_FAKE_FETCH_ONLY' for r in p['outcomes']]
assert len(outcomes)==40 and all(r['status']=='PASS' for r in outcomes)
adapter=next(p for p in parts if p['scope']=='OFFLINE_SUPPORTED_ADAPTER_FAKE_FETCH_ONLY')
assert adapter['total']==14 and adapter['realNetwork']==adapter['serviceTokens']==adapter['paidCalls']==0
old=json.loads((base/'test-discovery.json').read_text());old.update(groups=40,executed=40,outcomes=outcomes,coherentSource='checks/final-suite-04',adapterCases=14);put('test-discovery.json',old)
checks=[]
for p in sorted((base/'checks').glob('*/run.json')):
 r=json.loads(p.read_text());r={'name':p.parent.name,**r,'stdoutSHA256':h(p.parent/'stdout'),'stderrSHA256':h(p.parent/'stderr')};checks.append(r)
old=json.loads((base/'check-history.json').read_text());old['checks']=checks
old['newExplorationMissingPathProbes'].append('Resume read of absent checks/final-types-02/result.json and final-lint-02/result.json; correct files are run.json; raw terminal result exists in conversation, exact startUTC NOT_CAPTURED')
put('check-history.json',old)
# Every recorded fixture prehash resolves to exact preserved bytes; no hash inversion or guessed preimage.
lookup={}
for p in sorted(base.rglob('*')):
 if p.is_file():lookup.setdefault(h(p),str(p.relative_to(base)))
rows=[]
for p in sorted((base/'checks').glob('*/source-pre.json')):
 for source,sha in json.loads(p.read_text()).items():
  found=lookup.get(sha);assert found, (p.parent.name,source,sha)
  rows.append({'check':p.parent.name,'source':source,'sha256':sha,'exactBytePreimage':found,'status':'EXACT_BYTES_RETAINED'})
put('preimage-index.json',{'utc':utc,'claim':'Exact matching SHA256 only; no invented bytes/timestamps','rows':rows,'missing':0})
sources=[]
for r in json.loads((base/'source-pre.json').read_text())['sources']:
 p=root/r['path'];s=h(p);assert s==r['sha256'];sources.append(dict(r,postSHA256=s,unchanged=True))
assert len(sources)==56
put('source-post.json',{'utc':utc,'sources':sources})
p=base/'coverage.json';text=p.read_text().replace('final-suite-02','final-suite-04').replace('final-types-02','final-types-03').replace('final-lint-02','final-lint-03').replace('controls9','controls10').replace('runner6','runner7').replace('observer7','observer8');p.write_text(text)
coverage=json.loads(p.read_text());coverage['mappings'][1]['executedChecks']+='; safe individually qualified USD sum overflow downgrades only new money to UNKNOWN/fullK while retaining observed decimal/STOP and independent lifetime'
coverage['mappings'][3]['executedChecks']+='; text segment ID/start/end and early response metadata conflicts in both orderings'
coverage['mappings'][5]['executedChecks']+='; actual registered synthetic runner E11write/E14runAction vs E12E13 no-write'
put('coverage.json',coverage)
p=base/'report.md';text=p.read_text().replace('37 distinct groups','40 distinct groups').replace('checks/final-suite-02','checks/final-suite-04').replace('final-types-02','final-types-03').replace('final-lint-02','final-lint-03').replace('All998 recorded source-preimage rows',f'All{len(rows)} recorded source-preimage rows')
text=text.replace('Independently supported synthetic full charge is never clipped above K or voluntary$10.','Independently supported synthetic full charge is never clipped above K or voluntary$10. An individually safe full cost whose sum cannot be represented exactly as a safe microUSD integer remains honest UNKNOWN for the new money dimension, with observed full decimal/categories retained, fullK liability, STOP and independently trusted lifetime release; no clamp, wrap or reset.')
text=text.replace('Raw actual model is retained verbatim;','Native text start/delta/end segment IDs and early mapped response metadata are ordered and correlated against later raw evidence. Raw actual model is retained verbatim;')
text=text.replace('Raw prior failures stay immutable.','Raw prior failures stay immutable. The complete earlier2407-file provisional freeze (report294f4621a268a894d4db10327803959fe9728ac6031915f712b77cc59b1e7c1b/manifest63fc1f4321dc9f72ad887febdcd698c79b42eca3a58e2777662cb8b9948aee97) is retained byte-exact under failures/pre-overflow-freeze; overflow-repair.json records the self-review finding and repair before this final handoff.')
p.write_text(text)
state=json.loads((base/'resume-snapshot.json').read_text());state.update(utc=utc,offline='40 groups +14 adapter correspondences +unchanged23/6/4/5 regression PASS; final installedtypes/stricttypedlint PASS',reportSHA256=h(p),finalSuite='checks/final-suite-04',protectedSources=56,sourcePreimages=len(rows),sourcePreimagesMissing=0)
put('resume-snapshot.json',state)
(root/'work/resume/task04-default-native-driver-implementation-c1/state.json').write_text(json.dumps(state,indent=2)+'\n')
for p in base.rglob('*'):
 if p.is_file() and (p.name=='requests.ts' or p.name in ['stdout','stderr']):p.chmod(0o600)
print(json.dumps({'utc':utc,'groups':40,'adapter':14,'checks':len(checks),'exactPreimages':len(rows),'protected':56,'native':'NOT_RUN','paid':'NOT_RUN'}))
