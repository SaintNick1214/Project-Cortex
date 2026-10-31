from pathlib import Path
import json,hashlib,shutil
q=Path(__file__).resolve().parent;r=q.parents[3];b=q.parent/'task03-foundation-live-preparation-c11';old=q.parent/'task03-foundation-live-fixture-c11'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
(q/'scripts').mkdir(exist_ok=True);(q/'cases').mkdir(exist_ok=True);(q/'historical-preimages/scripts').mkdir(parents=True,exist_ok=True)
names=['qualify','native-engine','argument-candidates','auth-boundaries','closure-fixtures','lifecycle','batch-bindings','policy-fixture','driver','deploy','cleanup','wire-diagnostics','reactive-transport','process-owner','process-terminal','guard']
rows=[]
for name in names:
 p=b/'scripts'/f'{name}.mjs';d=q/'scripts'/p.name;h=q/'historical-preimages/scripts'/p.name
 shutil.copyfile(p,d);shutil.copyfile(p,h);rows.append({'historicalSource':str(p.relative_to(r)),'sha256':sha(p),'preimage':str(h.relative_to(q)),'prospectiveCopy':str(d.relative_to(q))})
for name in ['mf-registry-artifacts.mjs','metadata-worker-domain.mjs','metadata-worker-domain.json']:
 p=b/'cases'/name;d=q/'cases'/name;shutil.copyfile(p,d);rows.append({'historicalSource':str(p.relative_to(r)),'sha256':sha(p),'prospectiveCopy':str(d.relative_to(q))})
shutil.copyfile(q/'c11-lifecycle-coverage.json',q/'lifecycle-coverage.json')
m=q/'managed-fixture/fixture';(m/'convex').mkdir(parents=True,exist_ok=True)
manifest=json.loads((q/'fixture-copy-manifest.json').read_text());copies=[]
for row in manifest['files']:
 src=r/row['source'];relative=row['source'].replace('convex-dev/','convex/',1) if row['source'].startswith('convex-dev/') else row['source'];dst=m/relative;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
 copies.append({'source':row['source'],'copy':str(dst.relative_to(q)),'sha256':sha(src),'bytes':src.stat().st_size,'officialCodegenMutable': '/_generated/' in relative})
for name in ['qualificationOwned.ts','auth.config.ts']:
 src=old/'fixture/convex'/name;dst=m/'convex'/name;shutil.copyfile(src,dst)
 hd=q/'historical-preimages'/name;shutil.copyfile(src,hd);rows.append({'historicalSource':str(src.relative_to(r)),'sha256':sha(src),'preimage':str(hd.relative_to(q)),'prospectiveCopy':str(dst.relative_to(q)),'delta':'FRESH_PUBLIC_KEY_ONLY' if name=='auth.config.ts' else 'EXACT_BYTE_CONSERVED'})
(m/'convex.json').write_text(json.dumps({'functions':'convex/'},indent=2)+'\n');shutil.copyfile(q/'fixture/package.json',m/'package.json')
(q/'managed-fixture-copy-manifest.json').write_text(json.dumps({'state':'PROSPECTIVE_NATIVE_NOT_DEPLOYED','files':copies,'newFixtureHelpers':['qualificationDelta:allocateDeletedAttemptId','qualificationDelta:policySnapshot'],'conservedHelpers':10,'freshAuthDelta':'fresh-identity-public.json','productSourceAlterations':0},indent=2)+'\n')
(q/'historical-script-provenance.json').write_text(json.dumps({'historicalCustody':'References and exact preimages remain historical C11 evidence; these prospective copies do not relabel historical execution custody.','files':rows},indent=2)+'\n')
request=json.loads((q/'project-request.json').read_text());request.update({'projectName':request['projectSlug'],'teamId':325340,'teamSlug':'nicholasgeil','teamName':'Cortex Memory','privateEnvironmentFile':'/Users/SaintNick/.codex/tmp/cortex-runtime-task03-private-20261005/deploy.env','privateTargetReceipt':'/Users/SaintNick/.codex/tmp/cortex-runtime-task03-private-20261005/target.json','requiredNodeVersion':'24.15.0','requiredNpmVersion':'12.2.0','requiredRuntimePlatform':'linux','retirementRequired':True,'targetFields':['operation','requestSha256','purpose','projectName','projectSlug','teamId','projectId','deploymentName','deploymentUrl','kind','deploymentType','createdAt','active','retired','deleted','isolationVerified','productionDeployment','sharedCiTarget','privateEnvironmentFile','freshManagedProject']})
(q/'project-request.json').write_text(json.dumps(request,indent=2)+'\n')
print(json.dumps({'managedSourceCopies':len(copies),'historicalOperationalSources':len(rows),'externalRequests':0,'deployments':0}))
