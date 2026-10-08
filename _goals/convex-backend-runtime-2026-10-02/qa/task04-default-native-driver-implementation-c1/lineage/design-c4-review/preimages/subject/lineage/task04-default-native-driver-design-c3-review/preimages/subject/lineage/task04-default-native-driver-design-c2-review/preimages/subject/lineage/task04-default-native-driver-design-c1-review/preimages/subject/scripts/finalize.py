from pathlib import Path
import json,hashlib,datetime
root=Path('/workspace/Project-Cortex');q=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-design-c1';now=datetime.datetime.now(datetime.timezone.utc).isoformat()
p=q/'proposal.md';s=p.read_text();s=s.replace('ActualModel is verbatim observed, never prefixed/inferred from requested model.','ActualModel is verbatim raw-provider observed, never prefixed/inferred from requested model. A mapped modelId/model instance ID may represent the requested identity; only a source-proven raw-derived mapping can corroborate raw serving evidence. This installed compatible Chat adapter uses getResponseMetadata(responseBody) for generation while request/provider call metadata also contains this.modelId; neither requested-ID occurrences nor assumed Gateway rewriting certify serving truth. Existing actualGateway exact snapshot checks remain unchanged. Whether hosted Gateway rewrites raw model to the selected ID is NOT_OBSERVED. Explicit documented expected alias/snapshot premises remain conditional, never raw-ID normalization or alias substitution to manufacture success.');p.write_text(s)
h=json.loads((q/'failures/history.json').read_text());h['failures'].append({'operation':'guessed compatible adapter path omitted chat subdirectory','result':'read diagnostic only; rg --files discovered official src/chat path; exact UTC not captured'});(q/'failures/history.json').write_text(json.dumps(h,indent=2)+'\n');p=q/'raw/exploration-failures.txt';p.write_text(p.read_text()+'rg: node_modules/@ai-sdk/openai-compatible/src/openai-compatible-chat-language-model.ts: IO error: No such file or directory (os error 2)\n')
m=json.loads((q/'source-matrix.json').read_text())
for path in ['node_modules/@ai-sdk/openai-compatible/src/chat/openai-compatible-chat-language-model.ts','node_modules/@ai-sdk/openai-compatible/src/chat/get-response-metadata.ts']:
 b=(root/path).read_bytes();m['sources'].append({'path':path,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'scope':'current-official-source-read-only'})
(q/'source-matrix.json').write_text(json.dumps(m,indent=2)+'\n')
checks=[]
for r in m['sources']:
 b=(root/r['path']).read_bytes();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'];checks.append(r['path'])
ids=json.loads((q/'initial14-identities.json').read_text())['cases'];assert len(ids)==14;assert len({c['normalizedNativeRequestHash'] for c in ids})==13
expected=['C01','C02','C03','C04','C05','C06','C07','C08','E11','E12','E13','E14','C09','C10'];assert json.loads((root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-model-qualification-preparation/manifest.json').read_text())['executionOrder']==expected
assert sum(c['candidateReservationKMicroUSD'] for c in ids)==314310
receipt={'utc':now,'classification':'DOCUMENTATION_IDENTITY_INTEGRITY_ONLY','checks':['current source matrix all hashes match','fourteen expected identities','13 unique native hashes','exact ordinal execution order','conditional K total314310'],'sourceCount':len(checks),'result':'PASS','applicationTests':'NOT_RUN','native':'NOT_RUN','paid':'NOT_RUN','freshIndependentReview':'NOT_RUN'}
(q/'verification.json').write_text(json.dumps(receipt,indent=2)+'\n');(q/'raw/integrity.stdout').write_text(json.dumps(receipt)+'\n');(q/'raw/integrity.stderr').write_text('')
(q/'command-receipts.json').write_text(json.dumps({'utc':now,'commands':[{'argv':['python','work/resume/task04-default-native-driver-design-c1/build-packet.py'],'cwd':str(root),'exit':0,'observedSuccessfulUTC':'2026-10-04T09:54:12.092486+00:00'},{'argv':['python','work/resume/task04-default-native-driver-design-c1/finalize.py'],'cwd':str(root),'utc':now,'exit':0,'stdout':'raw/integrity.stdout','stderr':'raw/integrity.stderr'}],'earlierExploration':'exact start/end UTC unavailable; failures preserved rather than fabricated'},indent=2)+'\n')
rows=[]
for p in sorted(q.rglob('*')):
 if p.is_file() and p!=q/'qa-manifest.json':
  b=p.read_bytes();rows.append({'path':str(p.relative_to(q)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
(q/'qa-manifest.json').write_text(json.dumps({'classification':'DESIGN_ONLY','utc':now,'excludes':['qa-manifest.json'],'files':rows},indent=2)+'\n')
print(json.dumps({'utc':now,'rows':len(rows),'manifestSha256':hashlib.sha256((q/'qa-manifest.json').read_bytes()).hexdigest(),'integrity':'PASS_DOCUMENTATION_ONLY'}))
