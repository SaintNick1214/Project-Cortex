from pathlib import Path
import json,hashlib,subprocess,datetime
root=Path('/workspace/Project-Cortex/work/backend-runtime/task03b2a-checkout');out=Path('/workspace/Project-Cortex/work/backend-runtime/task03b2a-judge-cycle2');qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task03b2a'
hashof=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
checks=[]
def test(name,ok,details=None):
 checks.append({'name':name,'pass':bool(ok),'details':details});assert ok,(name,details)
freeze=json.loads((qa/'freeze.json').read_text())
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();test('reviewed frozen HEAD',head==freeze['reviewedHead'],head)
for record in freeze['sourceHashes']+freeze['checkHashes']:test('freeze '+record['file'],hashof(root/record['file'])==record['sha256'])
for file,key in [('check-receipts.json','receiptsSha256'),('contracts.md','contractsSha256'),('report.md','reportSha256'),('history/cycle1-final/preservation.json','archivePreservationSha256')]:test('freeze '+file,hashof(qa/file)==freeze[key])
test('two freeze files identical',(qa/'freeze.json').read_bytes()==(qa/'cycle2/freeze.json').read_bytes())
for record in json.loads((qa/'cycle2/check-hashes.json').read_text()):test('cycle2 checks '+record['file'],hashof(root/record['file'])==record['sha256'])
archive=qa/'history/cycle1-final';preservation=json.loads((archive/'preservation.json').read_text());test('archive69',len(preservation['records'])==69)
for record in preservation['records']:
 rel=record.get('path',record.get('file'))+('.text' if record['kind']=='source' else '');test('archive '+record['kind']+'/'+rel,hashof(archive/record['kind']/rel)==record['sha256'])
for record in json.loads((qa/'baseline-unchanged.json').read_text()):
 p=root/record['file'];base=subprocess.check_output(['git','show','HEAD:'+record['file']],cwd=root);test('03A unchanged '+record['file'],p.read_bytes()==base and hashof(p)==record['sha256'])
old=(archive/'source/tests/unit/runtimeMetadataAuth/handlers.test.ts.text').read_text();new=(root/'tests/unit/runtimeMetadataAuth/handlers.test.ts').read_text();test('original handler assertions byte-prefix unchanged',new.startswith(old))
for name in ['schema.ts','users.ts']:test('unchanged from cycle1 '+name,(root/'convex-dev'/name).read_bytes()==(archive/'source/convex-dev'/(name+'.text')).read_bytes())
snapshot=json.loads((out/'initial-snapshot.json').read_text());diff=[p for p,h in snapshot.items() if not (root/p).is_file() or hashof(root/p)!=h];test('all245 snapshotted candidate auth source and QA unchanged',not diff,{'entries':len(snapshot),'differences':diff})
original=json.loads((root/'_goals/convex-backend-runtime-2026-10-02/qa/task03a/public-path-inventory.json').read_text());actual=json.loads((out/'catalog/public-path-inventory.json').read_text());native=json.loads((out/'framework-registration.json').read_text())
paths=sorted(r['path'] for r in original['endpoints'] if r['path'].split(':')[0] in ['immutable','mutable','users','sessions']);test('AST exact41 paths',paths==sorted(r['path'] for r in actual['endpoints']),len(paths));test('native exact41 paths',paths==sorted(r['path'] for r in native));test('AST0 unresolved',not actual['completeness']['unresolved']);test('native36public5internal',sum(r['visibility']=='public' for r in native)==36 and sum(r['visibility']=='internal' for r in native)==5)
results=json.loads((out/'jest-readonly-results.json').read_text());test('readonly exact189 zero skipped two suites',results['numPassedTests']==189 and results['numFailedTests']==0 and results['numPendingTests']==0 and results['numPassedTestSuites']==2)
for name,count in [('boundary-probes.json',118),('extra-probes.json',33)]:probe=json.loads((out/name).read_text());test(name+' all independent outcomes',len(probe)==count and all(r['pass'] for r in probe),count)
known=json.loads((out/'known-probes.log').read_text());test('known private leak absent',not known[0]['leakedPriorValue'] and known[0]['store']['accepted']);test('known bulk duplicate preeffects',all(not r['accepted'] and r['attemptedWrites']==0 for r in known[1:5]));test('known expiry and version deny',all(not r['accepted'] and r['writes']==0 for r in known[5:9]));test('known source collision',known[9]['pass']);additional=json.loads((out/'known-additional.log').read_text());test('all known8additional deny',len(additional)==8 and all(not r['accepted'] for r in additional))
test('original numeric null now explicit INVALID_INPUT','INVALID_INPUT' in (out/'known-numeric.log').read_text())
test('root five diagnostic log identical cycle1',(out/'full-root-types.log').read_bytes()==(archive/'qa/checks/full-root-types.log').read_bytes());test('baseline0 diagnostics',not json.loads((out/'baseline-diagnostics.json').read_text())['diagnostics'])
summary={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':head,'sourceHashes':freeze['sourceHashes'],'checks':checks,'assertions':len(checks),'allPass':all(c['pass'] for c in checks),'candidateUnchanged':True,'candidateSnapshotCount':len(snapshot),'archiveRecords':69,'rootTypeErrors':5,'actualES2021Errors':2,'retainedTests':189,'independentBoundaryProbes':151}
(out/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k not in ['checks','sourceHashes']},indent=2))
