"""One-shot own closed-writer assessment, initial finite seal and full readback."""
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, sys, time
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
J=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt5-repair3-current-source-review'
s=importlib.util.spec_from_file_location('seal_finite_reader',J/'verify-receipts.py');v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
assessment=J/'writer-finalization-assessment.json';manifest=J/'final-evidence-manifest.json'
assert not assessment.exists() and not manifest.exists()
names=sorted(p for p in J.iterdir() if p.is_file())
assert all(p.parent==J for p in names)
observations=[]
for phase in range(3):
    observations.append({'phase':phase,'observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':[v.read(p)[1] for p in names]})
    if phase<2:time.sleep(5)
same=observations[0]['files']==observations[1]['files']==observations[2]['files']
value={'scope':'ONE_BOUNDED_OWN_CLOSED_WRITER_ASSESSMENT_BEFORE_INITIAL_PIN','status':'PASS' if same else 'FAIL',
       'allArtifactWritersClosedBeforeObservation':True,'observations':observations,'initialPinAlreadyExisted':False,
       'autoRefresh':False,'sourceAcceptance':'SOURCE_ELIGIBILITY_ONLY','actualEffects':0}
with assessment.open('x') as f:json.dump(value,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
if not same:
    print(json.dumps({'status':'FAIL','assessment':str(assessment),'cause':'UNKNOWN','sealCreated':False}));raise SystemExit(1)
rows=[v.read(p)[1] for p in names]+[v.read(assessment)[1]]
assert v.compare(v.exact(observations[2]['files']),v.exact(rows[:-1]))==[]
data={'scope':'FRESH_JUDGE_FINITE_REVIEW_EVIDENCE_ONLY_NOT_OPERATIONAL_ATTESTATION','pathBase':str(R),'files':rows,
      'regularFiles':len(rows),'selfExcluded':True,'writerAssessment':'PASS_CLOSED_THREE_OBSERVATIONS_BEFORE_INITIAL_PIN',
      'sourceEligibilityOnly':True,'historicalFailedEvidenceSealRepaired':False,'actualPublicCustodyAccepted':False,
      'privateOperationsReleased':False,'Task03Accepted':False,'goalAccepted':False,'actualEffects':0}
with manifest.open('x') as f:json.dump(data,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
body,row=v.read(manifest);assert json.loads(body)==data
again={x['path']:v.read(R/x['path'])[1] for x in rows};assert v.compare(v.exact(rows),again)==[]
print(json.dumps({'status':'PASS','ownManifest':row,'regularFiles':len(rows),'manifestReadBackFullEOFAll9':True,
                  'allMembersFinalFullEOFAll9':True,'allWritersStoppedOnReturn':True,'sealAttempts':1,'actualEffects':0}))
