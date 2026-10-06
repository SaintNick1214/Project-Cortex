"""One bounded writer-finalization observation and one initial prospective pin set."""
import datetime,hashlib,importlib.util,json,os,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');G=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=G/'task03-local-native-attempt5-2026-10-06';P=G/'local-resume-2026-10-05';PUBLIC=Q/'coordinate-source/repair3';B=P/'task03-attempt5-private-source-repair3';QA=Path(__file__).absolute().parent
spec=importlib.util.spec_from_file_location('current_full_eof_all9_binding',QA/'source-binding.py');S=importlib.util.module_from_spec(spec);spec.loader.exec_module(S)
def put(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  raw=(json.dumps(value,indent=2)+'\n').encode();offset=0
  while offset<len(raw):
   count=os.write(fd,raw[offset:]);assert count>0;offset+=count
  os.fsync(fd)
 finally:os.close(fd)
 directory=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:os.fsync(directory)
 finally:os.close(directory)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
oldfile=P/'task03-attempt5-public-repair2-prospective3/current-source-baseline.json';assert digest(oldfile)=='07efed2f6f9381a4bb884d7bd8c65edbba5513b6754a9aaa3a3987f68976601e';old=json.loads(oldfile.read_bytes());oldmap={r['path']:r for r in old['files']};assert len(oldmap)==2098
privateold=P/'task03-attempt5-private-repair2-operative-current-observation/current-operative-baseline.json';assert digest(privateold)=='fb2d3d81e04d4de99c4b93ee211e151e6092882da6f8e92d80cd33f9cfb0b0aa';privatepins=json.loads(privateold.read_bytes())['files']
prior={**oldmap,**{r['path']:r for r in privatepins}}
freeze=Q/'candidate-freeze-attempt5.json';f=json.loads(freeze.read_bytes());assert digest(freeze)=='053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570' and len(f['files'])==1905
names=[row['path'] for row in f['files']]+['candidate-freeze-attempt5.json','independent-preparation-review.json']+['managed-fixture/fixture/convex/_generated/'+name for name in ('api.d.ts','api.js','dataModel.d.ts','server.d.ts','server.js')]
assert len(names)==len(set(names))==1912
copy_paths={str((Q/name).relative_to(R)) for name in names};assert copy_paths<=set(oldmap)
management_review=P/'task03-attempt5-management-review.json'
product_paths={path for path in oldmap if not path.startswith(str(Q.relative_to(R))+'/') and path!=str(management_review.relative_to(R))};assert len(product_paths)==161
assert len(set(oldmap)-copy_paths-product_paths-{str(management_review.relative_to(R))})==24
source_paths=[PUBLIC/name for name in ('task03-attempt5-public-coordinate.py','task03-attempt5-coordinate-common.py','task03-attempt5-linux-public-transfer.py','public-recipe-binding.json','README.md')]+[freeze,Q/'independent-preparation-review.json',management_review]
spec=importlib.util.spec_from_file_location('private_current_operative_source',B/'task03-attempt5-private-coordinate.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
private_paths=[Path(m.__file__),*m.dependencies()];assert len(private_paths)==13 and len(set(private_paths))==13
missing=P/'task03-attempt5-linux-public-custody-review.json';private_present=[p for p in private_paths if p!=missing];assert len(private_present)==12
manifest=PUBLIC/'source-receipt-manifest.json'
pre_manifest=sorted(set(source_paths+private_present)-{manifest},key=str);assert len(pre_manifest)==14
observations=[]
try:
 for phase in range(3):
  rows=[S.read(R,p,prior.get(str(p.relative_to(R)))) for p in pre_manifest];S.final(R,rows)
  observations.append({'phase':phase,'observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':rows})
  if phase:assert rows==observations[0]['files'], 'source writers not finalized; no pins created'
  if phase<2:time.sleep(0.5)
 put(QA/'raw/writer-finalization-before-manifest.json',{'scope':'BOUNDED_THREE_OBSERVATIONS_NO_AUTO_RESEAL','status':'PASS','sourceWritersStopped':True,'initialPinsNotYetCreated':True,'observations':observations})
 stable={r['path']:r for r in observations[-1]['files']}
 manifest_rows=[stable[str(p.relative_to(R))] for p in source_paths]
 put(manifest,{'scope':'DISTINCT_CURRENT_OPERATIVE_REPAIR3_PUBLIC_SOURCE_MANIFEST_ONLY_NOT_ACCEPTANCE','pathBase':str(R),'files':manifest_rows,'regularFiles':8,'preparationFreezeSha256':m.FREEZE,'publicCopyFiles':1912,'selfExcluded':True,'sourceApproved':False,'actualPublicCandidateTransport':False,'historical23SourceReference':str((Q/'coordinate-source/repair2/source-receipt-manifest.json').relative_to(R)),'historical23SourceNotRuntimeAuthority':True,'manifestDefinition':'Five exact new recipe code/helper/common/binding/readme members plus unchanged freeze/preparation-review/management-review qualification dependencies; no mock filesystem cohort.'})
 operative=sorted(set(source_paths+private_present),key=str);assert len(operative)==15
 obs2=[]
 for phase in range(3):
  rows=[S.read(R,p,stable.get(str(p.relative_to(R)),prior.get(str(p.relative_to(R))))) for p in operative];S.final(R,rows)
  obs2.append({'phase':phase,'observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':rows})
  if phase:assert rows==obs2[0]['files'], 'manifest writer not finalized; no initial baseline created'
  if phase<2:time.sleep(0.5)
 put(QA/'raw/writer-finalization-before-baseline.json',{'scope':'BOUNDED_THREE_OBSERVATIONS_NO_AUTO_RESEAL','status':'PASS','sourceWritersStopped':True,'initialPinsNotYetCreated':True,'observations':obs2})
 operative_pin={r['path']:r for r in obs2[-1]['files']}
 operative_public={str(p.relative_to(R)) for p in source_paths}|{str(manifest.relative_to(R))};assert len(operative_public)==9
 operative_private={str(p.relative_to(R)) for p in private_present};assert len(operative_private)==12
 paths=sorted(copy_paths|product_paths|set(operative_pin));assert len(paths)==2086
 rows=[]
 for relative in paths:
  row=S.read(R,R/relative,operative_pin.get(relative,prior.get(relative)));assert relative in operative_pin or relative in prior
  row['cohorts']=[name for name,members in [('public-copy1912',copy_paths),('product-source161',product_paths),('public-operative9',operative_public),('private-operative12',operative_private)] if relative in members]
  rows.append(row)
 S.final(R,rows)
 counts={name:sum(name in row['cohorts'] for row in rows) for name in ('public-copy1912','product-source161','public-operative9','private-operative12')};assert counts=={'public-copy1912':1912,'product-source161':161,'public-operative9':9,'private-operative12':12}
 put(QA/'current-source-baseline.json',{'scope':'REPAIR3_DISTINCT_CURRENT_SOURCE_BASELINE_ONLY','state':'HELD_FOR_FRESH_INDEPENDENT_REVIEW','pathBase':str(R),'observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':rows,'regularBindings':len(rows),'cohortCounts':counts,'privateFutureDependencyCount':12,'privatePresentDependencyCount':11,'futureTwelfthDependency':{'path':str(missing.relative_to(R)),'state':'ABSENT_ACTUAL_PUBLIC_CUSTODY_REQUIRED','sha256':None},'publicSourceManifestSha256':digest(manifest),'preparationFreezeSha256':m.FREEZE,'allCurrentIdentitiesThroughFinalRecheck':'PASS_ALL9','priorCurrentPublicBaselineSha256':digest(oldfile),'priorCurrentPrivateOperativeBaselineSha256':digest(privateold),'priorCurrentPinsComparedWithoutRefresh':True,'historicalFailedPinsRefreshed':False,'historicalCustodyRestored':False,'allFailedB2BroadSeals':'FAILED_EXCLUDED_FROM_RUNTIME_AUTHORITY','dummyHistoricalFilesystemAuthorityAccepted':False,'sourceApproved':False,'actualPublic1912Acquisition':False,'actualPrivateExecuted':False,'Task03Accepted':False,'goalAccepted':False,'GitStagingDuringReview':'PROHIBITED','privateReads':0,'privateStats':0,'APICalls':0})
 private_rows=[row for row in rows if 'private-operative12' in row['cohorts']]
 put(B/'current-operative-baseline.json',{'scope':'REPAIR3_PRIVATE_CURRENT_OPERATIVE_SOURCE_ONLY','pathBase':str(R),'files':private_rows,'bindings':12,'completeFutureDependencies':12,'presentDependencies':11,'twelfthDependency':{'path':str(missing.relative_to(R)),'state':'ABSENT_ACTUAL_PUBLIC_CUSTODY_REQUIRED','sha256':None},'sourceApproved':False,'privateProvisioningReleased':False,'all9ThroughReadAndFinalPath':'PASS_ALL9','broaderFailedB2Seals':'FAILED_EXCLUDED_FROM_RUNTIME_AUTHORITY','privateReads':0,'privateStats':0,'APICalls':0})
 put(QA/'current-operative-source-packet.json',{'scope':'FINITE_OPERATIVE_SOURCE_PACKET_DEFINITION_NOT_ACCEPTANCE','baseline':str((QA/'current-source-baseline.json').relative_to(R)),'baselineSha256':digest(QA/'current-source-baseline.json'),'baselineSchema':'files array of exact repository-relative paths, sha256, bytes, nine decimal identity fields, fullEOF/allNineThroughRead and disjoint-or-overlapping cohort memberships; current source/FD/path/final-path equality required','sourceManifest':str(manifest.relative_to(R)),'sourceManifestSha256':digest(manifest),'sourceManifestSchema':'pathBase repository root; files array of exact repository-relative operative public code/common/helper/binding/readme plus three qualification dependencies; selfExcluded true; eight rows; all9/hash/fullEOF','publicOperativePaths':sorted(operative_public),'publicCopyMembership':'Exact unchanged freeze1905 + freeze + preparation-review + five generated files =1912','productSourcePaths':sorted(product_paths),'privateOperativeBaseline':str((B/'current-operative-baseline.json').relative_to(R)),'privateOperativeBaselineSha256':digest(B/'current-operative-baseline.json'),'privateOperativePaths':sorted(operative_private),'privateFutureDependency':{'path':str(missing.relative_to(R)),'state':'ABSENT_HELD','sha256':None},'historicalSource23CopiedOrRegenerated':False,'originalDummyCohortsRegenerated':False,'runtimeAuthorityForMockFilesystemIdentity':False,'sourceApproved':False,'publicCustodyAccepted':False,'privateProvisioningReleased':False})
 put(QA/'raw/initial-source-all9.json',{'scope':'INITIAL_CURRENT2086_SOURCE_AND_OPERATIVE_BINDINGS_ONLY','status':'PASS','regularBindings':len(rows),'cohortCounts':counts,'fullEOFHashSize':'PASS','allNineDuringReadAndFinalPath':'PASS_ALL9','priorSuccessfulCurrentPinsUnchanged':True,'deltas':[],'baselineSha256':digest(QA/'current-source-baseline.json'),'sourceApproved':False})
 print(json.dumps({'status':'PASS','bindings':len(rows),'counts':counts,'baselineSha256':digest(QA/'current-source-baseline.json'),'publicSourceManifestSha256':digest(manifest),'privateBaselineSha256':digest(B/'current-operative-baseline.json'),'sourceApproved':False}))
except BaseException as e:
 put(QA/'raw/finalization-source-failure.json',{'scope':'ONE_INITIAL_SOURCE_FINALIZATION_ATTEMPT_ONLY','status':'FAIL','failureClass':type(e).__name__,'evidence':str(e),'allPriorPinsPreserved':True,'autoReseal':False,'sourceApproved':False});raise
