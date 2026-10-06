"""Distinct current own-receipt observation; preserves failed assessment, creates first pin only."""
from pathlib import Path
import datetime, importlib.util, json, os, sys, time
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
J=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt5-repair3-current-source-review'
s=importlib.util.spec_from_file_location('current_seal_reader',J/'verify-receipts.py');v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
failed=J/'writer-finalization-assessment.json';current=J/'writer-finalization-current-assessment.json';manifest=J/'final-evidence-manifest.json'
failed_bytes,failed_row=v.read(failed);assert json.loads(failed_bytes)['status']=='FAIL'
assert not current.exists() and not manifest.exists()
# No source receipt or failed pin is changed. Allow all closed receipt writers
# to settle before taking a new, explicitly distinct current observation.
time.sleep(5)
names=sorted(p for p in J.iterdir() if p.is_file());assert all(p.parent==J for p in names)
def observations(paths):
    result=[]
    for phase in range(3):
        result.append({'phase':phase,'observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':[v.read(p)[1] for p in paths]})
        if phase<2:time.sleep(5)
    return result
def same(obs):return obs[0]['files']==obs[1]['files']==obs[2]['files']
obs=observations(names)
value={'scope':'DISTINCT_POST_FAILURE_CURRENT_OWN_RECEIPT_OBSERVATION_BEFORE_FIRST_PIN_NOT_REPAIR',
       'status':'PASS' if same(obs) else 'FAIL','observations':obs,'failedAssessment':failed_row,
       'failedAssessmentStill':'FAIL_UNKNOWN_CTIME_FINAL_SOURCE_ASSESSMENT_PHASE0_TO1',
       'priorMissingOrFailedPinsRefreshed':False,'initialPinAlreadyExisted':False,'allOriginalAssertionsKept':True,'actualEffects':0}
with current.open('x') as f:json.dump(value,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
if not same(obs):print(json.dumps({'status':'FAIL','currentAssessment':str(current),'manifestCreated':False}));raise SystemExit(1)
names.append(current);names.sort()
# The current observation receipt itself is a writer. Close it, then assess
# the exact complete set including that receipt before creating any first pin.
time.sleep(5)
complete=observations(names)
if not same(complete):
    with (J/'writer-finalization-current-complete-failure.json').open('x') as f:
        json.dump({'status':'FAIL','scope':'COMPLETE_CURRENT_OWN_WRITER_SET_BEFORE_INITIAL_PIN','observations':complete,'autoRefresh':False},f,indent=2);f.write('\n')
    print(json.dumps({'status':'FAIL','manifestCreated':False,'completeCurrentAssessment':'FAIL'}));raise SystemExit(1)
assert sorted(p for p in J.iterdir() if p.is_file())==names
assert v.read(failed)[0]==failed_bytes
rows=complete[2]['files']
data={'scope':'FRESH_JUDGE_FINITE_REVIEW_EVIDENCE_ONLY_NOT_OPERATIONAL_ATTESTATION','pathBase':str(R),'files':rows,'regularFiles':len(rows),
      'selfExcluded':True,'initialPinCreationAttempts':1,'initialFailedWriterAssessment':'FAIL_PRESERVED_NOT_REPAIRED',
      'distinctCurrentWriterAssessment':'PASS_BEFORE_FIRST_PIN','completeCurrentWriterObservations':complete,
      'sourceEligibilityOnly':True,'historicalFailedEvidenceSealRepaired':False,'actualPublicCustodyAccepted':False,
      'privateOperationsReleased':False,'Task03Accepted':False,'goalAccepted':False,'actualEffects':0}
with manifest.open('x') as f:json.dump(data,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
# The manifest is self-excluded. After its writer is closed, observe the final
# path and descriptor to full EOF; do not refresh any member pin after writing.
time.sleep(5)
body,row=v.read(manifest);assert json.loads(body)==data
again={x['path']:v.read(R/x['path'])[1] for x in rows};assert v.compare(v.exact(rows),again)==[]
source=json.loads((J/'identity-final.json').read_bytes());expected=v.exact(source['sourceFiles'])
now={p:v.read(R/p)[1] for p in expected};assert v.compare(expected,now)==[]
assert v.read(failed)[0]==failed_bytes
assert v.read(manifest)[1]==row
print(json.dumps({'status':'PASS_CURRENT_FINITE_SEAL_ONLY','ownManifest':row,'regularFiles':len(rows),
                  'manifestReadBackFullEOFAll9':True,'allMembersFinalFullEOFAll9':True,'current2083AfterReportVerdictAndOwnSeal':'PASS_ALL9_FULL_EOF_FINAL_PATH',
                  'initialFailedWriterAssessment':'FAIL_PRESERVED','allWritersStoppedOnReturn':True,'initialPinCreationAttempts':1,'failedPinsRefreshed':False,'actualEffects':0}))
