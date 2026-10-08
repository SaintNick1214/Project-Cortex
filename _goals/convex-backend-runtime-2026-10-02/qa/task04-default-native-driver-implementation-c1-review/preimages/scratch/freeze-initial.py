import pathlib,json,hashlib,datetime,shutil,sys
r=pathlib.Path('/workspace/Project-Cortex');w=r/'work/resume/task04-default-native-driver-implementation-c1-review';q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c1-review';s=q.with_name('task04-default-native-driver-implementation-c1');o=q/'checks/final-freeze';o.mkdir(parents=True,exist_ok=True)
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def files(base,exclude=None):return sorted([p for p in base.rglob('*') if p.is_file() and p!=exclude],key=lambda p:str(p.relative_to(base)))
def snapshot(base,exclude=None):return [{'path':str(p.relative_to(base)),'bytes':p.stat().st_size,'sha256':h(p)} for p in files(base,exclude)]
def put(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
start=utc();pre=snapshot(w);pins=json.loads((q/'source-pre.json').read_text())['sources'];put(o/'source-pre.json',{'utc':start,'scratch':pre,'protected':[{'path':p['path'],'sha256':h(r/p['path'])} for p in pins]})
try:
 assert all(h(r/p['path'])==p['sha256'] for p in pins)
 manifest=json.loads((s/'qa-manifest.json').read_text());assert snapshot(s,s/'qa-manifest.json')==manifest['rows'];assert h(s/'qa-manifest.json')=='08b29e170eb855a7184c20eb8ff91ea44a900a27bde2e1452018987d8c11da51';assert h(s/'report.md')=='c3d72b786268a4b89266f69d9dcdad78bcf24dbbb5b27effafb73f1a28c7887d'
 put(q/'subject-post.json',{'utc':utc(),'unchanged':True,'rows':5076,'manifestSHA256':h(s/'qa-manifest.json'),'reportSHA256':h(s/'report.md')})
 post={'utc':utc(),'sources':[{'path':p['path'],'bytes':(r/p['path']).stat().st_size,'sha256':h(r/p['path'])} for p in pins]};put(q/'source-post.json',post);assert post['sources']==json.loads((q/'source-pre.json').read_text())['sources']
 # Resolve every recorded reviewer source-pre hash to exact retained bytes, including failed versions.
 byhash={}
 for base in [w,q/'preimages/fixture',q/'preimages/protected']:
  for p in files(base):byhash.setdefault(h(p),[]).append(str(p.relative_to(r)))
 index=[]
 for check in sorted((q/'checks').iterdir()):
  p=check/'source-pre.json'
  if not p.exists() or check.name=='final-freeze':continue
  raw=json.loads(p.read_text())
  for name,digest in raw.items():
   assert digest in byhash,(check.name,name,digest)
   index.append({'check':check.name,'source':name,'sha256':digest,'exactBytePreimage':byhash[digest][0]})
 put(q/'reviewer-source-preimage-index.json',{'rows':index,'count':len(index),'missing':[],'claim':'Exact original recorded SHA equality, no reconstructed timestamps.'})
 # Source graph read inventory states limits rather than claiming every source branch execution.
 put(q/'graph-audit.json',{'readSourceFiles':[str(p.relative_to(s)) for p in files(s/'fixture/convex')],'registeredBoundaries':['guard:provision/reserveCheckpoint/enterPeer/stop/capture/attach/control/inspect','managed:provisionOwned/writeE11/preflight/hydrate/searchE14/queryAuthorization/readOwned/getFence','lifecycle:stageAndTrigger/inspectTrigger/recoverOwnedEvidence/deleteOwned/revokeOwned/purgeOwnedPrivate','runner:run disabled before reserve and OFFICIAL_DRIVER source/runtime-body dummy port'],'executedProducerGroups':40,'adapterCorrespondences':14,'v1RegressionGroups':[23,6,4,5],'independentObservedBlockers':['retained receipt/attempt linkage','unhandled owned persistence rejection','unclosed empty segment/postfinish usage terminal','ROOT fresh stage capability','original shorter stage wait','integer-index canonical object order'],'sourceOrDiagnosticLimits':['closed money extraction positive missing; arbitrary DUMMY raw categories not accepted source schema','reader runtime body ports are not real SDK factory/native service','ancillary dispatch_pending state not an extra normative blocker','initial zero-stage assertion not used to deny all legitimate pending late effects'],'noWholeBranchCoverageClaim':True,'native':'NOT_RUN','actualProofs':'EMPTY'})
 # W manifest includes all nested files and excludes only its own exact root self.
 wm=w/'manifest.json';put(wm,{'version':1,'classification':'FROZEN_INDEPENDENT_OFFLINE_REVIEW_SCRATCH','excludesOnly':'manifest.json','rows':snapshot(w,wm)})
 shutil.copytree(w,q/'preimages/scratch')
 after=snapshot(w,w/'manifest.json');assert after==pre
 put(o/'source-post.json',{'utc':utc(),'scratch':snapshot(w),'protected':post['sources']})
 summary={'verdict':'REJECT','average':2.4,'subjectRows':5076,'protectedPins':56,'sourcePreimages':1208,'provisionalRows':2407,'reviewerSourcePreimageRows':len(index),'reportSHA256':h(q/'report.md'),'scratchManifestSHA256':h(wm),'scratchRows':len(json.loads(wm.read_text())['rows'])}
 put(o/'run.json',{'argv':[sys.executable,str(w/'freeze.py')],'cwd':str(r),'startUTC':start,'endUTC':utc(),'exit':0});(o/'stdout').write_text(json.dumps(summary)+'\n');(o/'stderr').write_bytes(b'')
 put(q/'verification.json',{**summary,'subjectManifestSHA256':h(s/'qa-manifest.json'),'subjectReportSHA256':h(s/'report.md'),'sourcePrePostEqual':True,'subjectUnchanged':True,'completeRecursiveQAExcludesOnlyOwnSelf':True,'native':'NOT_RUN','paid':'NOT_RUN','wholeTask04':'INCOMPLETE','all17':'INCOMPLETE','UI':'NOT_RUN'})
 qm=q/'qa-manifest.json';put(qm,{'version':1,'utc':utc(),'classification':'REJECT_OFFLINE_IMPLEMENTATION_ONLY','excludesOnly':'qa-manifest.json','rows':snapshot(q,qm)})
 assert snapshot(q,qm)==json.loads(qm.read_text())['rows'];assert snapshot(w,wm)==json.loads(wm.read_text())['rows'];assert h(q/'report.md')==summary['reportSHA256']
 print(json.dumps({**summary,'qaManifestSHA256':h(qm),'qaRows':len(json.loads(qm.read_text())['rows']),'freeze':'COMPLETE_NO_FURTHER_MUTATIONS'}))
except BaseException as e:
 (o/'stderr').write_text(repr(e)+'\n');put(o/'run.json',{'argv':[sys.executable,str(w/'freeze.py')],'cwd':str(r),'startUTC':start,'endUTC':utc(),'exit':1});raise
