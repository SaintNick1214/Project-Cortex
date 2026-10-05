from pathlib import Path
import os,stat,json,hashlib,gzip,datetime
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c4';T=Path('/tmp/cortex-native-c5-closed-launcher-c4');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-closed-launcher-c4';RUN=T/'runs/f359639c0b0c442e98f4326a3f93f718';H=lambda b:hashlib.sha256(b).hexdigest();utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def put(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
def row(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and p.resolve()==p
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1;h=hashlib.sha256();n=0
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b);n+=len(b)
  identity=lambda z:tuple(getattr(z,'st_'+k)for k in ['dev','ino','mode','uid','nlink','size','mtime_ns','ctime_ns']);assert identity(s)==identity(a)==identity(os.fstat(fd))==identity(p.lstat())
 finally:os.close(fd)
 return {'path':str(p),'bytes':n,'sha256':h.hexdigest(),'identity':{k:getattr(s,'st_'+k)for k in ['dev','ino','mode','uid','nlink','size','mtime_ns','ctime_ns']}}
receipt=json.loads((RUN/'receipt.json').read_bytes());assert len(receipt['commands'])==6 and all(c['exitCode']==0 for c in receipt['commands']);assert receipt['sourceByteHashesEqual'] and receipt['original8LiteralRowsAndIdentitiesEqual'] and not receipt.get('primaryFailure') and not receipt.get('secondaryFailure')
policy=row(W/'route-policy.mjs');assert policy['sha256']=='72eedf1f80bcca600319e690605d29675389fbb6dda371246293f63ee242ec03'
map_=json.loads((W/'mirror-source-transform-map.json').read_bytes());audit=json.loads((R/'work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json').read_bytes());by={x['source']:x for x in map_['inputs']};commands=[]
for c in audit['commands']:
 source=next(x for x in c['proposedArgv'] if x in by);s=by[source];assert c['entrySha256']==s['sha256'];assert row(Path(source))['sha256']==s['sha256'];assert row(Path(s['destination']))['sha256']==s['destinationSHA256'];commands.append({'id':c['id'],'originalArgv':c['proposedArgv'],'originalEntry':source,'originalEntrySHA256':s['sha256'],'preparedEntry':s['destination'],'preparedEntrySHA256':s['destinationSHA256'],'writeFamily':c['writeFamily'],'currentAdmission':'HELD_FIXED_ROOT_APPROVAL_ABSENT','futureInterface':'root-launcher.mjs exact audited ID only, fixed independent-approved offline-only gate required','nativePrivatePaid':'HELD'})
assert len(commands)==122 and len(set(c['id']for c in commands))==122
put(Q/'prepared-122.json',{'commands':commands,'actualOriginalEntriesExecuted':0,'bindingsReviewedByOWNControl':'all122-prepared-exact-original-preimages-finite-argv-owned-writer-graphs','routeSource':row(W/'command-registry.mjs'),'finiteRecipeAudit':row(R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-finite-recipe-audit-c3/seal.json')})
profiles=['extension','regression','extra'];qa=[str(T/'mirror/_goals/convex-backend-runtime-2026-10-02/qa'/('task04-model-drift-native-'+k+'-preparation-c5'))for k in profiles];mutable=[p+'/'+n for p in qa for n in ['runner-dependency-inventory.json','dependency-tiers.json','runtime-freeze.json','qa-manifest.json']];generated=[p+'/evidence/final-freeze-verification.json'for p in qa];excluded=set(mutable+generated)
put(Q/'source-classification.json',{'immutableExecutableAndPackage':{'acceptedPolicy':policy,'mirrorAndOriginalRecipe':row(W/'mirror-source-transform-map.json'),'mirrorSourceCount':len(map_['inputs']),'rows':[{'original':x['source'],'originalSHA256':x['sha256'],'path':x['destination'],'bytes':x['destinationBytes'],'sha256':x['destinationSHA256']}for x in map_['inputs']if x['destination']not in excluded],'packageGraph':row(T/'package-graph.json'),'fullConsumedBeforeEachChildService':'Actual full sourcePRE before-byte maps, no cache/stat-only or package exemption'},'declaredGeneratedMetadata':{'mutableMetadata':mutable,'finalFreezeVerification':generated,'transformMapAndBootstrap':'Generated exact pinned inputs at consumption; never silently classified executable equality','generatedEntriesAndStdin':'Each actual generated entry/config and virtual stdin archived before the inner child/service'},'historicalOnly':{'originalReadMap':row(T/'original-read-map.json'),'sourceTiers':'Original FULL/RPC unchanged; historical read ports are not executable imports'},'allOriginalAssertionsCapsErrors':'Original hash-bound recipe sources; mechanical path transforms only; no waiver'})
runs=[]
for p in sorted((T/'runs').glob('*/receipt.json')):
 x=json.loads(p.read_bytes());runs.append({'receipt':row(p),'commands':[{'argv':c['argv'],'exitCode':c.get('exitCode'),'status':c.get('status'),'stdout':row(p.parent/(Path(c['argv'][-1]).name+'.stdout'))if(p.parent/(Path(c['argv'][-1]).name+'.stdout')).exists()else None,'stderr':row(p.parent/(Path(c['argv'][-1]).name+'.stderr'))if(p.parent/(Path(c['argv'][-1]).name+'.stderr')).exists()else None}for c in x.get('commands',[])],'sourceByteHashesEqual':x.get('sourceByteHashesEqual'),'original8LiteralRowsAndIdentitiesEqual':x.get('original8LiteralRowsAndIdentitiesEqual'),'primaryFailure':x.get('primaryFailure'),'secondaryFailure':x.get('secondaryFailure')})
put(Q/'execution-evidence.json',{'currentBatch':row(RUN/'receipt.json'),'runs':runs,'oldFailures':'C3 frozen failures/REJECT retained read-only; C4 f10f5 and b2e0a6d failures retained. No older false source outcome relabelled.','historicalCustody':'BROKEN_FOREVER six old incidents; new full8 prospective PRE/POST equality only','original8PRE':receipt['original8PRE'],'original8POST':receipt['original8POST'],'actualOriginalEntriesExecuted':0,'qualificationStatuses':'SOURCE_PARENT_NATIVE_PRIVATE_PAID_TIMING_HELD','currentRootApproval':'ABSENT','untestedDefensiveBranch':'Raw FD opening/synchronous spawn setup cleanup is source-inspected; lifecycle install/close/restore fault combinations were actually executed'})
services=[]
for p in sorted(T.rglob('service-receipt.json')):
 x=json.loads(p.read_bytes());services.append({'receipt':row(p),'actualSpawnCount':x.get('actualSpawnCount'),'events':x['events'],'rawComplete':x['rawComplete'],'rawLimit':x['rawLimit'],'encodedLimit':x['encodedLimit'],'admittedGraphBytes':x['admittedGraphBytes'],'streams':x['streams'],'primary':x['primary'],'secondary':x['secondary']})
serviceIndex=T/'compiler-evidence-full.json';put(serviceIndex,{'services':services,'allocation':'finite32*sourcegraph + 8192*rowcount +options/16384; not upper theorem for original output; overflow incomplete','originalDiagnosticCap':256000,'originalCompilerDeadline':'20s cap with absolute parent min; no supplied deadline reset'})
put(Q/'compiler-evidence.json',{'fullIndex':row(serviceIndex),'serviceCount':len(services),'actualOriginalEntriesExecuted':0,'scope':'OWN_SOURCE_BOUND_COMPILER_PORT_CONTROLS_NOT_ORIGINAL_QUALIFICATION','rawCompletenessSeparateWholeEvidence':True,'serialFamilies':'runner-closure/dependency-tiers each3 real write:false services plus exhausted parent zero-dispatch/strict20s absolute control','perServiceActualArgvRawAndSourceMaps':'See fullIndex and sibling compiler control receipts'})
refs=[]
for p in [R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-closed-launcher-c3/literal-self-seal.json',R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c3/literal-self-seal.json',Path('/tmp/cortex-native-c5-closed-launcher-c3/literal-self-seal.json'),R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-composition-c3-fresh-review/report.md',R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-finite-recipe-audit-c3/seal.json',R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-deadline-source-audit-c4/report.md']:
 refs.append(row(p))
externalArchives=[]
for x in json.loads((T/'package-graph.json').read_bytes())['files']:
 if x.get('beforeByteBacking'):externalArchives.append({'path':x['beforeByteBacking'],'encodedSHA256':x['encodedSHA256'],'decodedSHA256':x['sha256'],'decodedBytes':x['bytes'],'readonly':'C3 frozen source archive, reused exact reference; full current source reread before each service'})
external=T/'external-backing-full.json';put(external,{'references':refs,'borrowedPackageArchives':externalArchives,'originalHistoryReference':row(T/'original-read-map.json'),'authenticIndexSHA256':'a82fb82ad92d4a9753a9c7fe612ba880f82f4893a7a6d3e211dc8ec9a4fad869','transportParts':32,'history':'148325literalrows/30symlinks/3110990905regularbytes; C4 captures same authentic reference','hardlinks':'No operative guard/source hardlinks'})
put(Q/'external-backing.json',{'fullReferences':row(external),'externalSubjectReferences':refs,'currentPreparedInputs':row(W/'prepared-source-inputs.json')})
put(Q/'current-code-and-input-pins.json',{'utc':utc(),'code':[row(p)for p in sorted(W.iterdir())if p.is_file()and p.suffix in ['.mjs','.cjs','.py']],'preparedInputs':json.loads((W/'prepared-source-inputs.json').read_bytes()),'originalEntryAndTransformedRecipe':'prepared-122/source-classification/maps above','rootApprovalAbsent':not (R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-closed-launcher-c4-root-approval').exists()})
with (Q/'report.md').open('a')as f:f.write('\nActual final batch f359639c0b0c442e98f4326a3f93f718 completed all6 exit0; lifecycle5, fixed gate5 and runtime11 assertions PASS; both serial families executed three real services and supplied-absolute/exhausted-parent controls; OWN independent seam executed PASS. Recorder sourceByteHashesEqual=true and original8LiteralRowsAndIdentitiesEqual=true, primary/secondary null. These observations do not substitute independent acceptance. The earlier control batch f10f5 retained the actual20s compiler-deadline failure and postread TypeError; b2e0a6d retained both serial observation-denial assertion failures. See exact receipts/raw in execution-evidence.\n')
def seal(root):
 target=root/'literal-self-seal.json';rows=[]
 def visit(d):
  for p in sorted(d.iterdir()):
   if p==target:continue
   s=p.lstat();r={'path':str(p.relative_to(root)),'mode':s.st_mode,'uid':s.st_uid,'dev':s.st_dev,'ino':s.st_ino,'nlink':s.st_nlink}
   if stat.S_ISLNK(s.st_mode):r.update(type='symlink',target=os.readlink(p))
   elif stat.S_ISDIR(s.st_mode):r['type']='directory'
   elif stat.S_ISREG(s.st_mode):x=row(p);r.update(type='file',bytes=x['bytes'],sha256=x['sha256'])
   else:raise Exception('OWN_SPECIAL_FILE:'+str(p))
   rows.append(r)
   if r['type']=='directory':visit(p)
 visit(root);put(target,{'utc':utc(),'root':str(root),'selfOnlyExclusion':str(target),'literalNoFollow':True,'rows':rows,'rowsSHA256':H(json.dumps(rows,separators=(',',':')).encode())});return row(target)
a=seal(W);b=seal(T);put(Q/'owned-seal-references.json',{'work':a,'temporary':b,'status':'FROZEN_REVIEW_PENDING_ALL_ORIGINAL122_HELD','noInFlightSourceEdit':True});c=seal(Q);print(json.dumps({'workSeal':a,'tmpSeal':b,'qaSeal':c,'original122':'HELD','status':'FROZEN_FULL_FINITE_PREPARATION_CANDIDATE_REVIEW_PENDING'}))
