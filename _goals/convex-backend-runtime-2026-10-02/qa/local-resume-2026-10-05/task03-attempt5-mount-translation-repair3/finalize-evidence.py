"""Finite implementer evidence snapshot; no prospective source baseline retry."""
import datetime,hashlib,importlib.util,json,os,sys
from pathlib import Path
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=Path(__file__).absolute().parent;P=QA.parent;Q=P.parent/'task03-local-native-attempt5-2026-10-06';PUB=Q/'coordinate-source/repair3';B=P/'task03-attempt5-private-source-repair3'
spec=importlib.util.spec_from_file_location('final_scoped_evidence_all9',QA/'source-binding.py');S=importlib.util.module_from_spec(spec);spec.loader.exec_module(S)
def put(path,raw):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  offset=0
  while offset<len(raw):
   count=os.write(fd,raw[offset:]);assert count>0;offset+=count
  os.fsync(fd)
 finally:os.close(fd)
def js(path,value):put(path,(json.dumps(value,indent=2)+'\n').encode())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
post=json.loads((QA/'raw/post-finalization-failure-observation.json').read_bytes());mf=post['sourceManifestCurrentOnly'];source=R/mf['path']
fd=os.open(source,os.O_RDONLY|os.O_NOFOLLOW)
try:
 assert S.identity(os.fstat(fd))==mf['identityDecimal'];body=bytearray()
 while True:
  raw=os.read(fd,65536)
  if not raw:break
  body.extend(raw);assert len(body)<=mf['bytes']
 assert len(body)==mf['bytes'] and hashlib.sha256(body).hexdigest()==mf['sha256'] and S.identity(os.fstat(fd))==S.identity(source.lstat())==mf['identityDecimal']
finally:os.close(fd)
put(QA/'raw/current-source-manifest-complete-body.json',bytes(body))
js(QA/'command-receipts.json',{'scope':'SOURCE_REPAIR_COMMAND_INDEX_ONLY','records':[{'command':'python3 -B run-source-checks.py','status':'PASS_PREIMAGE_SOURCE_ONLY','receipt':'raw/source-checks/commands.json'},{'command':'python3 -B mount-diagnostic.py','status':'PASS_ONE_ACTUAL_PUBLIC_READONLY_DIAGNOSTIC_ONLY','receipt':'raw/mount-diagnostic/outcome.json'},{'command':'python3 -B run-qualified-absence-source-checks.py','status':'PASS_FINAL_PRIVATE_SOURCE_ONLY','receipt':'raw/source-checks-qualified-absence/commands.json'},{'command':'source evidence writer','status':'FAIL_PRESERVED_THEN_CORRECTED_WRITER_CASE_ONLY','receipt':'raw/absence-evidence-writer-failure-1.json'},{'command':'python3 -B finalize-source.py','status':'FAIL_NEW15_FILE_WRITER_OBSERVATION_NO_BASELINE_CREATED','receipt':'raw/finalization-source-failure.json'},{'command':'post-failure source observation','status':'OBSERVED_CURRENT14_ZERO_DELTAS_NOT_RESEAL','receipt':'raw/post-finalization-failure-observation.json'}],'privateReads':0,'privateStats':0,'APICalls':0,'officialCLI':False,'nativeFoundationAccepted':False,'sourceAccepted':False})
source_rows=[S.read(R,R/pin['path'],pin) for pin in [*post['beforeManifest14CurrentComparison']['files'],mf]]
S.final(R,source_rows)
js(QA/'raw/final-current-operative-observation.json',{'scope':'CURRENT15_OPERATIVE_RECHECK_AFTER_REPORT_NOT_BASELINE_OR_REPAIR_OF_FAILED_OBSERVATION','status':'OBSERVED_CURRENT_MATCH','files':source_rows,'bindings':15,'allNineDuringReadAndFinalPath':'PASS_ALL9','fullEOFHashSize':'PASS','deltas':[],'failed15WriterObservationStill':'FAILED','originalFailedPhaseRowsNotRetained':True,'causeOfOriginalFailedObservation':'UNKNOWN','prospective2086BaselineCreated':False,'sourceApproved':False})
# Exact finite implementation/receipt cohort; no fixture subtree scan or authority.
parents=[QA,QA/'raw',QA/'preimages',QA/'raw/source-checks',QA/'raw/source-checks-qualified-absence',QA/'raw/mount-diagnostic',QA/'raw/selected-source-mocks',QA/'raw/selected-source-mocks-qualified-absence']
paths=[]
for parent in parents:
 for path in parent.iterdir():
  if path.is_file():paths.append(path)
paths += [B/'README.md']
paths=sorted(set(paths),key=str)
assert len(paths)<400
rows=[S.read(R,path) for path in paths];S.final(R,rows)
manifest=QA/'final-evidence-manifest.json'
js(manifest,{'scope':'FINITE_IMPLEMENTER_CURRENT_EVIDENCE_OBSERVATION_ONLY_NOT_RUNTIME_AUTHORITY','pathBase':str(R),'files':rows,'regularFiles':len(rows),'selfExcluded':True,'excludedFixtureSubtrees':['fixtures/selected-source-mocks','fixtures/selected-source-mocks-qualified-absence'],'mockFilesystemIdentitiesAreRuntimeAuthority':False,'prospectiveSourceBaselineCreated':False,'failedSourceFinalizationStill':'FAILED','sourceApproved':False,'Task03Accepted':False})
# A final post-manifest path check never refreshes any recorded observation.
S.final(R,rows);S.final(R,source_rows)
manifest_row=S.read(R,manifest);S.final(R,[manifest_row])
js(QA/'producer-finalization-state.json',{'scope':'IMPLEMENTER_WRITER_STOP_HANDOFF_ONLY','status':'PARTIAL_PROSPECTIVE_BASELINE_FAILED','sourceWritersStopped':True,'allProducerWritersStopWhenThisProcessReturns':True,'ownEvidenceRegularFiles':len(rows),'ownEvidenceManifest':manifest_row,'finalCurrent15SourceObservation':'raw/final-current-operative-observation.json','reportSha256':sha(QA/'report.md'),'sourcePacketSha256':sha(QA/'current-operative-source-packet.json'),'publicSourceManifestSha256':mf['sha256'],'noCurrent2086BaselineCreated':True,'failedWriterObservationPreserved':True,'oldFailedPinsRefreshed':False,'sourceApproved':False,'parentNextGate':'Distinct prospective CURRENT observation after this writer exits, then independent original-criteria/source judgment; no failed observation relabel','privateReads':0,'privateStats':0,'APICalls':0,'extraDiagnostic':False,'public1912Acquisition':False,'privateCoordinatorExecuted':False})
print(json.dumps({'status':'PARTIAL','allProducerWritersStoppedAfterReturn':True,'evidenceFiles':len(rows),'evidenceManifestSha256':manifest_row['sha256'],'sourcePacketSha256':sha(QA/'current-operative-source-packet.json'),'reportSha256':sha(QA/'report.md'),'sourceManifestSha256':mf['sha256'],'noProspectiveBaselineCreated':True}))
