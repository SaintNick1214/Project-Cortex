import datetime,hashlib,json,pathlib
R=pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
Q=P/'task04-confirmed-unknown-cost-v2-20261008';J=P/'task04-backend-gateway-independent-review1'
reads={};checks=[]
def data(path):
 p=pathlib.Path(path);b=p.read_bytes();reads[str(p)]={'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()};return b
def load(path):return json.loads(data(path))
def check(name,value):checks.append({'name':name,'status':'PASS' if value else 'FAIL'});return value
handoff=load(Q/'final-installed-handoff.json')
for row in handoff['principals']:
 data(row['path']);check('exact final principal '+pathlib.Path(row['path']).name,reads[row['path']]['bytes']==row['bytes'] and reads[row['path']]['sha256']==row['sha256'])
source=load(Q/'final-current-candidate-digests.json')
for row in source['files']:
 data(row['absolutePath']);check('current source/test '+row['path'],reads[row['absolutePath']]['bytes']==row['bytes'] and reads[row['absolutePath']]['sha256']==row['sha256'])
check('final candidate digest agrees',handoff['candidateDigest']==source['candidateDigest']=='f5f2d3589e47ffa7147c294978286e4705146f0466d1de26f19fbdac90379e43')
manifest=load(Q/'installed-manifest-candidate.json');ts=data(R/'convex-dev/runtimeGatewayQualifications.ts').decode();literal=json.loads(ts[ts.index('{\n'):ts.rindex('} as const')+1]);check('compiled literal equals installed candidate manifest',literal==manifest)
record=load(Q/'installed-qualification-candidate-record.json');check('acceptanceHash truthfully binds observed candidate record',manifest['acceptanceHash']==reads[str(Q/'installed-qualification-candidate-record.json')]['sha256'] and record['independentFinalVerdict']=='PENDING' and not record['invoiceCostKnown'])
for row in record['evidence']:
 data(Q/row['path']);pin=reads[str(Q/row['path'])];check('record evidence '+row['path'],pin['bytes']==row['bytes'] and pin['sha256']==row['sha256'])
provider=data(R/record['provider']['path']);check('provider transformation source exact',hashlib.sha256(provider).hexdigest()==record['provider']['sha256'])
installed=load(Q/'installed-path-assertions.json')
for row in installed['deployedSourceMatches']:
 pin=reads[str(R/row['path'])];check('reported deployed production source '+row['path'],row['privateDeployedCopyMatches'] and pin['bytes']==row['bytes'] and pin['sha256']==row['sha256'])
remember=load(Q/'installed-remember.json');recall=load(Q/'installed-recall.json');rememberReplay=load(Q/'installed-remember-replay.json');recallReplay=load(Q/'installed-recall-replay.json')
check('four installed authenticated RPC outcomes',all(x['actualJwt'] and x['error'] is None and x['target']=='groovy-bird-988' for x in [remember,recall,rememberReplay,recallReplay]))
check('installed remember persists and stable replay returns created false',remember['result']['created'] is True and rememberReplay['result']['created'] is False and remember['result']['receiptId']==rememberReplay['result']['receiptId'] and remember['result']['facts']==rememberReplay['result']['facts'])
check('installed recall returns facts and managed-vector context',bool(recall['result']['context']) and {x['source'] for x in recall['result']['items']}=={'facts','vector'} and recall['result']['profileId']=='cortex-text-small-1536-v1')
check('recall replay preserves result identity despite clock-based ranking',[(x['id'],x['source'],x['content']) for x in recall['result']['items']]==[(x['id'],x['source'],x['content']) for x in recallReplay['result']['items']])
memory=load(Q/'installed-memory-after.stdout');memoryReplay=load(Q/'installed-memory-after-replay.stdout');ledger=load(Q/'installed-ledger-after.stdout');ledgerReplay=load(Q/'installed-ledger-after-replay.stdout')
check('all installed source/fact/chunk/vector/receipt rows are singular',all(len(memory[k])==1 for k in ['sources','facts','chunks','vectors','receipts']))
check('installed persisted memory and ledger replay unchanged',memory==memoryReplay and ledger==ledgerReplay)
check('installed finite default vector contract',memory['vectors'][0]['dimensions']==1536 and memory['vectors'][0]['finite'] is True and memory['vectors'][0]['sourceId']==memory['sources'][0]['id'])
operations={x['operationKey']:x for x in ledger['operations']};extract=operations['memory.extract'];embedding=operations['embedding.memory'];check('embedding exact extraction child/common run',embedding['parentOperationId']==extract['_id'] and embedding['snapshot']['parentOperationId']==extract['_id'] and embedding['snapshot']['runBudgetId']==extract['snapshot']['runBudgetId'])
check('three completed retained unknown-cost paid attempts release only slots',len(ledger['attempts'])==3 and all(x['state']=='uncertain' and x['reservationUnits']==100000 and x['slotReleased'] is True and x['resultWithheld'] is False and bool(x['privateResultBytes']) for x in ledger['attempts']))
tenants=[x for x in ledger['accounts'] if x['kind']=='tenant'];check('full tenant liability 300000 and no reserved/active slots',len(tenants)==1 and tenants[0]['uncertainUnits']==300000 and all(x['reservedUnits']==0 and x['activeConcurrency']==0 and x['settledUnits']==0 for x in ledger['accounts']))
retire=load(Q/'retirement.json');delete=load(Q/'retirement-delete.json');check('owned disposable retirement delete200/readback404',retire['retired'] and retire['projectId']==delete['projectId']==3171182 and delete['deletionHttpStatus']==200 and retire['readbackHttpStatus']==404 and retire['productionMutations']==0)
affected=load(Q/'affected-installed3.json');check('closed affected author raw 389 passed zero fail/skip',affected['success'] and affected['numPassedTests']==389 and affected['numFailedTests']==affected['numPendingTests']==0)
own=load(J/'independent-installed-registry-results1.json');command=load(J/'independent-installed-registry-command1.json');check('independent current registry 3 pass and reaped',own['success'] and own['numPassedTests']==3 and own['numFailedTests']==own['numPendingTests']==0 and command['exitCode']==0 and not command['timedOut'] and command['childReaped'] and command['before']==command['after'])
check('closed authorship handoff no remaining writers',handoff['remainingOwnedProcessWriters']==[] and handoff['serviceTargetRetired'])
report={'scope':'ORDINARY_INDEPENDENT_PRODUCT_SOURCE_AND_INSTALLED_RECEIPT_CHECK_NOT_SOURCE_CERTIFICATION','candidateDigest':source['candidateDigest'],'checks':checks,'pass':sum(x['status']=='PASS' for x in checks),'fail':sum(x['status']=='FAIL' for x in checks),'readReferences':list(reads.values()),'ordinaryQaReads':True,'serviceEffects':False,'reviewerCandidateEdits':False,'historicalFailuresUnchanged':True,'reviewerSetupCorrection':'Initial metadata read guessed model-policy-registry.test.ts and failed FileNotFound. Correct exact final row is gateway-qualification-registry.test.ts; no candidate finding or first-run coverage asserted. A later rg used absent src/domain/services.ts; no candidate finding asserted.','closedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(J/'independent-installed-final-check1.json').write_text(json.dumps(report,indent=2)+'\n');print({k:report[k] for k in ['pass','fail','candidateDigest','closedAt']});assert report['fail']==0
