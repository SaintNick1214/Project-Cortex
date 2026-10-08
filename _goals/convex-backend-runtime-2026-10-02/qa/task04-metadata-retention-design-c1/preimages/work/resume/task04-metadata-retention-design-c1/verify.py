from pathlib import Path
import hashlib,json
r=Path('/workspace/Project-Cortex'); q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-design-c1'
p=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-convex-ai-budget-public-source-c3'; review=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-ai-budget-public-c3-fresh-review/report.md'
assert hashlib.sha256((p/'qa-manifest.json').read_bytes()).hexdigest()=='47e6cd5b0594c4e14839a9bfd343c9e427a7321953cf3626b26c8cc0ac1fb636'
assert hashlib.sha256(review.read_bytes()).hexdigest()=='f113623b7ac61dad661f1f39bca02435848608dbdb37de6aeddf221cc33ed4f3'
m=json.loads((p/'qa-manifest.json').read_text()); assert len(m['files'])==9
assert {str(x.relative_to(p)) for x in p.rglob('*') if x.is_file()}=={x['path'] for x in m['files']}|{'qa-manifest.json'}
for row in m['files']:
 b=(p/row['path']).read_bytes(); assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
files={}
for pre in q.glob('*-pre.json'):
 post=q/(pre.name[:-9]+'-post.json')
 if post.exists():
  a=json.loads(pre.read_text())['files']; assert a==json.loads(post.read_text())['files']; files.update(a)
locators={'node_modules/@convex-dev/ai-sdk-provider/src/index.ts':'51-94 cost mapping and factory wiring','node_modules/@ai-sdk/openai-compatible/src/chat/openai-compatible-chat-language-model.ts':'395-425 generate raw/mapped linkage;566-578 raw-first/process;701-724 finish metadata','node_modules/@ai-sdk/provider/src/language-model/v4/language-model-v4-generate-result.ts':'32 providerMetadata','node_modules/@ai-sdk/provider/src/language-model/v4/language-model-v4-stream-part.ts':'finish providerMetadata','node_modules/@ai-sdk/provider/src/shared/v4/shared-v4-provider-metadata.ts':'Record<string,JSONObject>','_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c2/fixture/convex/observer.ts':'17-19 omission;28 raw cost/categories nomination'}
mapping=[dict(path=name,locator=locator,**files[name]) for name,locator in locators.items()]
(q/'source-map.json').write_text(json.dumps({'sourceInterpretationAcceptedOnly':True,'metadataDesignAccepted':False,'pins':mapping},indent=2)+'\n')
ranges={'node_modules/@convex-dev/ai-sdk-provider/src/index.ts':[(51,94)],'node_modules/@ai-sdk/openai-compatible/src/chat/openai-compatible-chat-language-model.ts':[(395,425),(566,578),(701,725)],'_goals/convex-backend-runtime-2026-10-02/qa/task04-convex-ai-budget-public-source-c3/client-index.ts':[(237,255),(862,883),(898,925)]}
out=[]
for name,rr in ranges.items():
 lines=(r/name).read_text().splitlines();out.append('SOURCE '+name)
 for a,b in rr:out.extend(f'{i}: {lines[i-1]}' for i in range(a,b+1))
(q/'source-excerpts.txt').write_text('\n'.join(out)+'\n')
result={'status':'PASS','subjectRows':9,'subjectManifestSha256':'47e6cd5b0594c4e14839a9bfd343c9e427a7321953cf3626b26c8cc0ac1fb636','freshReviewSha256':'f113623b7ac61dad661f1f39bca02435848608dbdb37de6aeddf221cc33ed4f3','sourcePinCount':len(files),'designGate':'PENDING','actualMoney':'EMPTY'}
(q/'verification.json').write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps(result))
