import pathlib,json,hashlib,datetime,os
b=pathlib.Path(__file__).resolve().parent.parent;root=b.parents[3];utc=datetime.datetime.now(datetime.timezone.utc).isoformat()
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def put(name,v):(b/name).write_text(json.dumps(v,indent=2)+'\n')
pins=json.loads((b/'source-pre.json').read_text())['sources'];post=[]
for r in pins:
 p=root/r['path'];assert h(p)==r['sha256'];assert h(b/'preimages'/r['path'])==r['sha256'];post.append(dict(r,postSHA256=h(p),unchanged=True))
put('source-post.json',{'utc':utc,'sources':post,'allUnchanged':True})
tests=json.loads((b/'final-four-04.json').read_text());assert tests['numPassedTests']==tests['numTotalTests']==454 and tests['numFailedTests']==tests['numPendingTests']==0 and tests['numPassedTestSuites']==4
adverse=json.loads((b/'checks/final-adverse-03/stdout').read_text());assert adverse['groups']==30 and all(r['status']=='PASS' for r in adverse['outcomes'])
discovered=json.loads((b/'checks/final-discovery/stdout').read_text());assert len(discovered)==4 and set(discovered)=={r['name'] for r in tests['testResults']}
put('discovery.json',{'discovered':discovered,'suites':4,'executed':454,'passed':454,'failed':0,'pending':0,'skipped':0,'adverse':30,'scope':'ISOLATED_OFFLINE_COPIES_ONLY','actualRootUnitRerun':'NOT_RUN'})
checks=[]
for p in sorted((b/'checks').glob('*/receipt.json')):
 r=json.loads(p.read_text());checks.append(dict(name=p.parent.name,**r,stdoutSHA256=h(p.parent/'stdout'),stderrSHA256=h(p.parent/'stderr')))
put('check-history.json',{'checks':checks,'startupGaps':['composition-01','final-types','final-lint'],'readOnlyDiscoveryGap':'exploration-gap.json','gap':'No exact startup startUTC captured for orchestration failures before compiler/composition invocation; never fabricated; raw/preimages retained as available','native':'NOT_RUN','paid':'NOT_RUN'})
# Current dependency closures are exact against each FINAL before-execution snapshot.
closures={'final-four-04':['current-compose.mjs','native-probe.mts','offline-guard.mjs','jest.config.mjs','setup.mjs','approved-additions.json','source-pre.json','copies','proposed-four-file-minimal.patch','checks/make-copies.py','checks/run.py'],'final-composition-03':['current-compose.mjs','native-probe.mts','offline-guard.mjs','approved-additions.json','source-pre.json'],'final-adverse-03':['current-compose.mjs','adverse.mjs','offline-guard.mjs','approved-additions.json','source-pre.json'],'final-types-03':['native-probe.mts','tsconfig.json'],'final-lint-04':['current-compose.mjs','adverse.mjs','offline-guard.mjs','setup.mjs','jest.config.mjs','eslint.config.mjs']}
owned=[]
for name,paths in closures.items():
 for rel in paths:
  current=b/rel;before=b/'checks'/name/'preimage'/rel
  paths2=list(current.rglob('*')) if current.is_dir() else [current]
  for p in paths2:
   if p.is_file():
    relative=p.relative_to(b);q=b/'checks'/name/'preimage'/relative;assert q.is_file() and h(q)==h(p),(name,str(relative));owned.append({'check':name,'path':str(relative),'beforeSHA256':h(q),'postSHA256':h(p),'unchanged':True})
put('owned-source-post.json',{'utc':utc,'phase':'verified AFTER completed final executions; before byte-preimages physically copied BEFORE invocation','dependencyClosures':closures,'rows':owned})
composition=json.loads((b/'final-witness-03/composition.json').read_text());inventory=json.loads((b/'final-witness-03/public-path-inventory.json').read_text());baseline=inventory['baselineCompleteness']['counts'];current=inventory['completeness']['counts'];assert baseline['registered']==259 and current['registered']==275 and baseline['modules']==37 and current['modules']==38
assert current['public']==200 and current['internal']==75 and baseline['internal']==59
assert next(r['sha256'] for r in inventory['completeness']['sourceHashes'] if r['file']=='convex-dev/schema.ts')=='b95bdd8b643b9d8d7f3d6ed2770181cff15e116110af3b3648bb4492e58495c2'
new=inventory['endpoints'][259:];assert len(new)==16 and all(r['visibility']=='internal' and r['disposition']=='retain-internal' for r in new)
put('composition-map.json',{'baselineProjection':composition['exactCurrentRepair'],'approvedAdditive':composition['currentComposition'],'baselineInventoryCounts':baseline,'currentInventoryCounts':current,'priorEndpointsExact':inventory['endpoints'][:259],'new16Internal':new,'selected25':{'paths':[r for r in inventory['endpoints'] if r['path'].split(':')[0] in ['governance','admin','graphSync']],'public':7,'internal':18},'approvedNativeBytesSHA256':h(b/'approved-additions.json'),'nativeService':'NOT_RUN'})
rows=[]
for r in tests['testResults']:
 original=next(t for t in json.loads((b/'original-tests.json').read_text()) if r['name'].endswith(t));rows.append({'original':original,'originalSHA256':h(root/original),'copySHA256':h(pathlib.Path(r['name'])),'cases':len(r['assertionResults']),'passed':sum(a['status']=='passed' for a in r['assertionResults']),'sameCaseNames':True,'status':'PASS'})
original=json.loads((b/'original-four-failures.json').read_text())
for r in tests['testResults']:
 old=next(o for o in original if r['name'].endswith(o['name'].split('/workspace/Project-Cortex/')[1]));assert [a['fullName'] for a in r['assertionResults']]==[a['fullName'] for a in old['assertionResults']]
put('test-map.json',{'rows':rows,'strictCompose':'unchanged accepted script executes literal26/173/22 and original4+5 negative controls in exact baseline replica','oldInventory':'unchanged frozen task03b2d inventory executes37-module259-endpoint baseline; additive16 separate','allOriginal17NativeValidators':'all original asset native installed exportArgs loops remain unchanged;454 original cases execute','patch':'proposed-four-file-minimal.patch','routingStatus':'SOURCE_SERIALIZED_HOLD_PENDING_FRESH_REVIEW_ROOT_RELEASE'})
state={'utc':utc,'status':'ISOLATED_CURRENT_COMPOSITION_COMPLETE_REVIEW_PENDING_SOURCE_SERIALIZED_HOLD','subject':str(b),'tests':'4suites454PASS0skip +30adversePASS','sources':len(pins),'catalog':'26/173 exact07df +5approved=31/184;259prior+16INTERNAL=275;25selected7public18internal;22/17 preserved','native':'NOT_RUN','paid':'NOT_RUN','actualRootTestsRouted':False,'gates':'fresh independent review and explicit ROOT source-serialized release before any real4file splice; seven asset failures Task11 remain; native/live/goal gates incomplete'}
put('resume.json',state);(root/'work/resume/task04-current-catalog-composition-c1/state.json').write_text(json.dumps(state,indent=2)+'\n')
print(json.dumps({'utc':utc,'sources':len(pins),'tests':454,'adverse':30,'checks':len(checks),'ownedPostRows':len(owned),'counts':current,'native':'NOT_RUN'}))
