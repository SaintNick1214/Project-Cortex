from pathlib import Path
import json,hashlib,shutil,difflib,datetime
root=Path('/workspace/Project-Cortex');base=root/'_goals/convex-backend-runtime-2026-10-02/qa';qa=base/'task04-model-drift-charge-only-implementation-c1';work=root/'work/resume/task04-model-drift-charge-only-implementation-c1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,v):(qa/n).write_text(json.dumps(v,indent=2)+'\n')
# Verify complete originals and copy immutable rejection/design inputs including nested manifests.
packets=['task04-model-drift-charge-only-repair-preparation-c1','task04-model-drift-charge-only-c1-design-review','task04-model-drift-charge-only-repair-preparation-c2','task04-model-drift-charge-only-c2-design-review','task04-gateway-terminal-composition-c1-review']
checks=[]
for name in packets:
 p=base/name;m=p/'manifest.json';rows=json.loads(m.read_text())['files'];assert {str(f.relative_to(p)) for f in p.rglob('*') if f.is_file() and f!=m}=={r['path'] for r in rows}
 for r in rows:assert sha(p/r['path'])==r['sha256'] and (p/r['path']).stat().st_size==r['bytes']
 dst=qa/'inherited'/name;shutil.copytree(p,dst,dirs_exist_ok=True);checks.append(dict(packet=name,rows=len(rows),manifestSHA256=sha(m),complete=True))
for name in ['task04-model-drift-charge-only-c2-coordinator-design-acceptance.json','task04-terminal-capture-native-c4-coordinator-acceptance.json','task04-gateway-check-routing-c1-coordinator-acceptance.json']:
 shutil.copyfile(base/name,qa/'inherited'/name)
save('inherited-integrity.json',checks)
pre=json.loads((qa/'source-pre.json').read_text())['files'];post=[]
for row in pre:
 p=root/row['path'];d=dict(path=row['path'],bytes=p.stat().st_size,sha256=sha(p),changed=sha(p)!=row['sha256']);post.append(d)
allowed=['convex-dev/runtimeModelPolicy.ts'];assert [r['path'] for r in post if r['changed']]==allowed
save('source-post.json',dict(utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),files=post,newTest=dict(path='tests/unit/runtime/model-policy-model-drift.test.ts',bytes=(root/'tests/unit/runtime/model-policy-model-drift.test.ts').stat().st_size,sha256=sha(root/'tests/unit/runtime/model-policy-model-drift.test.ts'))))
p=root/allowed[0];(qa/'policy-changes.diff').write_text(''.join(difflib.unified_diff((qa/'preimages'/allowed[0]).read_text().splitlines(True),p.read_text().splitlines(True),fromfile='accepted7394preimage',tofile=allowed[0])))
for path in [allowed[0],'tests/unit/runtime/model-policy-model-drift.test.ts']:
 dst=qa/'final-source'/path;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes((root/path).read_bytes())
# Historical full read-only input closure; official preimages are shared with this packet's identical current closure.
h=base/'task04-gateway-terminal-composition-implementation-c1/historical';f=json.loads((h/'freeze.json').read_text());rows=[]
for r in f['local']:
 p=h/r['catalog'];assert sha(p)==r['sha256'];dst=qa/'historical-input-preimages'/r['catalog'];dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(p.read_bytes());rows.append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p),preimage=str(dst.relative_to(qa))))
for r in f['official']:
 p=Path(r['path']);assert sha(p)==r['sha256'];dst=qa/'execution-source-preimages'/p.relative_to(root)
 if not dst.exists():dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(p.read_bytes())
 assert sha(dst)==r['sha256'];rows.append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p),preimage=str(dst.relative_to(qa))))
save('historical-source-closure.json',dict(scope='HISTORICAL_ONLY old frozen Gateway; no current mapping',files=rows))
results={}
for label,file in [('native','native-results.json'),('current','current-results.json'),('historical','historical/historical-results.json')]:
 r=json.loads((qa/file).read_text());assert r['numFailedTests']==r['numPendingTests']==r['numTodoTests']==r['numRuntimeErrorTestSuites']==0
 results[label]={k:r[k] for k in ['numTotalTests','numPassedTests','numFailedTests','numPendingTests','numTodoTests','numTotalTestSuites','numRuntimeErrorTestSuites']};results[label]['suites']=[dict(path=t['name'],outcomes=len(t['assertionResults']),failed=sum(a['status']!='passed' for a in t['assertionResults'])) for t in r['testResults']]
assert results['native']['numPassedTests']==190 and sorted(s['outcomes'] for s in results['native']['suites'])==[57,133];assert results['current']['numPassedTests']==160;assert results['historical']['numPassedTests']==78
save('results-summary.json',results);save('skips.json',dict(skipped=[],pending=[],todo=[],runtimeErrors=[],unexecuted=['Actual Convex native/OCC/rollback/publication/isolation/retirement extensions on changed source','Provider actual complete USD/account categories/whole invocation including drift','Paid/default qualification','Task07/global root revocation owner wiring'],scope='Offline registered handlers/fake DB and synthetic money only'))
imports=[json.loads(s) for s in (qa/'current-imports.ndjson').read_text().splitlines()];assert all(x['verified'] and '/catalog/' not in x['resolved'] for x in imports)
for suffix in ['convex-dev/runtimeGateway.ts','convex-dev/runtimeModelPolicy.ts','tests/unit/runtime/model-policy-admission.test.ts','tests/unit/runtime/model-policy-model-drift.test.ts']:assert any(x['resolved']==str(root/suffix) for x in imports),suffix
save('current-import-verification.json',dict(scope='CURRENT_ACTUAL_SOURCE offline',count=len(imports),files=sorted({x['resolved'] for x in imports}),allVerified=True,noHistoricalMapping=True))
for p in work.glob('*.py'):shutil.copyfile(p,qa/p.name)
print('verified final counts original133/new57/current160/historical78; source/schema/original tests frozen')
