"""Independent R4/C6 finite held-source reader. No candidate is imported or executed by this program."""
import os,sys,time,json,hashlib,stat,traceback,ast
from pathlib import Path
CONFIG=json.loads("{\"J\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1\",\"priorAdmissions\":329,\"priorBytes\":7352555,\"oldRows\":[{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/AGENTS.md\",\"sha256\":\"4fbaf846434518261f72e3b1911e2146b508b736e7c46b76261fa8c6fd67724e\",\"bytes\":4486,\"PRE9\":{\"ctime_ns\":\"1791256027008400598\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"90614824\",\"mode\":\"33188\",\"mtime_ns\":\"1791256001820824707\",\"nlink\":\"1\",\"size\":\"4486\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/.agents/CODEX-RUNTIME.md\",\"sha256\":\"8d60140b54b93fa29f388d9608c0b17d9993e1a48f7ec0788e993690ac456895\",\"bytes\":5824,\"PRE9\":{\"ctime_ns\":\"1791256019462616177\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"90614758\",\"mode\":\"33188\",\"mtime_ns\":\"1791256001817028388\",\"nlink\":\"1\",\"size\":\"5824\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/.agents/PROJECT-PROFILE.md\",\"sha256\":\"04ac20437bc36af9202ad748da57a07bfb824cdb92834fd365edfa5a00207a12\",\"bytes\":14706,\"PRE9\":{\"ctime_ns\":\"1791256028092052753\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"90614759\",\"mode\":\"33188\",\"mtime_ns\":\"1791256001817139722\",\"nlink\":\"1\",\"size\":\"14706\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/.agents/roles/pessimistic-judge.md\",\"sha256\":\"71e0e99d0709275056fbd15125eeffa71f6ed87d9a9114ea325e3c6efcf29f9a\",\"bytes\":6919,\"PRE9\":{\"ctime_ns\":\"1791256034616750681\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"90614762\",\"mode\":\"33188\",\"mtime_ns\":\"1791256001817338140\",\"nlink\":\"1\",\"size\":\"6919\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/.agents/skills/judge-task/SKILL.md\",\"sha256\":\"2522d7f180dec8492a698007a14b8e1259b4b237cbedba71144a8ad86469497d\",\"bytes\":7742,\"PRE9\":{\"ctime_ns\":\"1791256028093830516\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"90614784\",\"mode\":\"33188\",\"mtime_ns\":\"1791256001818424690\",\"nlink\":\"1\",\"size\":\"7742\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md\",\"sha256\":\"44777e644f835c759af09dfa8acefc7f37d29fac5152c8d34fd7b497e9858d74\",\"bytes\":2759,\"PRE9\":{\"ctime_ns\":\"1791275788476032303\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"90807212\",\"mode\":\"33188\",\"mtime_ns\":\"1791256023394463916\",\"nlink\":\"1\",\"size\":\"2759\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/resume-dependency-refinement-c2/plan.md\",\"sha256\":\"6bc18263062c10da0d347f0d81113d3f771f48c028c818caf4d250faf968dab6\",\"bytes\":13554,\"PRE9\":{\"ctime_ns\":\"1791256454354517967\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"90615394\",\"mode\":\"33188\",\"mtime_ns\":\"1791256001888821284\",\"nlink\":\"1\",\"size\":\"13554\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/root-task04-r3-c5-final-reject-mature-readback1.json\",\"sha256\":\"ace6fbd3b11d3a1563be9e6884f6a0b92bae6326ef948ae4785cad77186f71e4\",\"bytes\":3514,\"PRE9\":{\"ctime_ns\":\"1791399353712710672\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"92814721\",\"mode\":\"33188\",\"mtime_ns\":\"1791399261654771527\",\"nlink\":\"1\",\"size\":\"3514\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-full-partial-review/report.md\",\"sha256\":\"6ffca48ea7c45ee11bff3c4bb5adf8c23b65b3a5abb2832bdc3e5f2817968732\",\"bytes\":12794,\"PRE9\":{\"ctime_ns\":\"1791257244166789891\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"90637018\",\"mode\":\"33188\",\"mtime_ns\":\"1791256006695588829\",\"nlink\":\"1\",\"size\":\"12794\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-recorder-v6-review/review.md\",\"sha256\":\"acc32cfa16780b8fb92b4af3cd25b86b30702e29f58c27253373f5ba0131def7\",\"bytes\":8313,\"PRE9\":{\"ctime_ns\":\"1791260938752712415\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"90637090\",\"mode\":\"33188\",\"mtime_ns\":\"1791256006793610624\",\"nlink\":\"1\",\"size\":\"8313\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/context-reader1.py\",\"sha256\":\"2c2b615803c0e02b5fa52b6c62fc83a2f794f459914aff7cb880ee33d3db93ae\",\"bytes\":8967,\"PRE9\":{\"ctime_ns\":\"1791402550251432152\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"92924989\",\"mode\":\"33152\",\"mtime_ns\":\"1791402516611771415\",\"nlink\":\"1\",\"size\":\"8967\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/context-writers-stopped.json\",\"sha256\":\"72df5bb66b403d5c78a45b6ad2134827acfd20e431356aece3661af103bbedbd\",\"bytes\":475,\"PRE9\":{\"ctime_ns\":\"1791402550253587587\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"92924990\",\"mode\":\"33152\",\"mtime_ns\":\"1791402516611933455\",\"nlink\":\"1\",\"size\":\"475\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/context-held-closure1.json\",\"sha256\":\"b48b041d76ddb2f8a018e45eaa1218ebedaa5a856b59af3b2a2dd2d702b1cb2a\",\"bytes\":109778,\"PRE9\":{\"ctime_ns\":\"1791402647192489740\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"92925994\",\"mode\":\"33152\",\"mtime_ns\":\"1791402635447075729\",\"nlink\":\"1\",\"size\":\"109778\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r3-c5-independent-source-review1/report2.md\",\"sha256\":\"3b070cd406cfcc0e9e1e919295d5973614b841fd983fad627d0e1a1455e59098\",\"bytes\":9960,\"PRE9\":{\"ctime_ns\":\"1791399352469106535\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"92813829\",\"mode\":\"33152\",\"mtime_ns\":\"1791399155213939236\",\"nlink\":\"1\",\"size\":\"9960\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r3-c5-independent-source-review1/verdict2.json\",\"sha256\":\"c82075a5e6ff99ca4537e2c1651a88bf4d803f88b119c1c368bb9aa44ec0f3e4\",\"bytes\":18550,\"PRE9\":{\"ctime_ns\":\"1791399351878936786\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"92813828\",\"mode\":\"33152\",\"mtime_ns\":\"1791399155213779571\",\"nlink\":\"1\",\"size\":\"18550\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r3-c5-independent-source-review1/review-reference-manifest2.json\",\"sha256\":\"1001abf91eaa9409a0d2ece80fc917b26b8cdcc8feab60f41c3bec13fb2a79d2\",\"bytes\":14749,\"PRE9\":{\"ctime_ns\":\"1791399352542202420\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"92813830\",\"mode\":\"33152\",\"mtime_ns\":\"1791399155214219107\",\"nlink\":\"1\",\"size\":\"14749\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r3-c5-independent-source-review1/final-reject-subset-FDclosure4.json\",\"sha256\":\"d93fdc2d78bcc83c9fb0631706dea9f4348dc74b7ed7bed5ce832408584b5a84\",\"bytes\":32107,\"PRE9\":{\"ctime_ns\":\"1791399352726561233\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"92813831\",\"mode\":\"33152\",\"mtime_ns\":\"1791399155215318426\",\"nlink\":\"1\",\"size\":\"32107\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r3-c5-independent-source-review1/final-review-writer-stop4.json\",\"sha256\":\"bf07652fa2a6d8124b9b66adfdce2d5fa0eb80f222cb50a3a681e4d5f20edc8f\",\"bytes\":4105,\"PRE9\":{\"ctime_ns\":\"1791399352325922520\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"92813832\",\"mode\":\"33152\",\"mtime_ns\":\"1791399155215448674\",\"nlink\":\"1\",\"size\":\"4105\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/independent-oracle-kernel1.py\",\"sha256\":\"2f58a028e7ea3598474589d747043fefdfc59de037be4109564f9112a3ff4539\",\"bytes\":5927,\"PRE9\":{\"ctime_ns\":\"1791403013206009714\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"92931220\",\"mode\":\"33152\",\"mtime_ns\":\"1791403005498414448\",\"nlink\":\"1\",\"size\":\"5927\",\"uid\":\"501\"}},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/oracle-kernel-writers-stopped.json\",\"sha256\":\"682a9899999133fdc7823ecaa78502b3c4d9cd76dd80cd72d60b14cd1922fcc4\",\"bytes\":1679,\"PRE9\":{\"ctime_ns\":\"1791403013203707407\",\"dev\":\"16777234\",\"gid\":\"20\",\"ino\":\"92931221\",\"mode\":\"33152\",\"mtime_ns\":\"1791403005498569113\",\"nlink\":\"1\",\"size\":\"1679\",\"uid\":\"501\"}}],\"seven\":[{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair4/source-epoch3/closed-source-reference-manifest.json\",\"sha256\":\"13b40faf3aebbea6cef43d510c940b327d7750436ea39bdb7140e3adb488b8a3\",\"bytes\":413751},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair4/source-epoch3/final-writer-stop.json\",\"sha256\":\"ffae4a20235b036755ccea54089abf59060c4759b1c0e0e44aeaa41257ef670d\",\"bytes\":1140},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair4/source-epoch3/preparation-report.json\",\"sha256\":\"52812fa3deae0749f869b1c365c6f4159a242d3f360f3251881efc7608637c42\",\"bytes\":8858},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair4/source-epoch3/preparation-report.md\",\"sha256\":\"d38aaf9a22527b44f9d44d54a0c9471dbe796bc103c6ca020844b9fd8d516fe2\",\"bytes\":3380},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair4/source-epoch3/evidence/qualified-source-control-results.json\",\"sha256\":\"1e634a63242115afc7c9a34883b922cb932a5f64b154e2d2edf7bf7416155af9\",\"bytes\":69574},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair4/source-epoch3/evidence/qualified-source-input-FDclosure.json\",\"sha256\":\"4d9172490d388f6f06d9e1fb4093eafa0383bf91243943595047bc3e533216c0\",\"bytes\":381838},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair4/source-epoch3/evidence/qualified-entry-loader-receipt.json\",\"sha256\":\"963ef0dfa272cce7c3cc0ae2bf3e4dcea6b8a320e09575460bcf8fa1f60c67c5\",\"bytes\":2288}],\"headers\":[\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/root-task04-r4-epoch3-final-locators-mature-readback1.json\",\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/root-task04-r4-epoch3-report-raw-mature-readback1.json\"],\"oldHeaderReceipt\":{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/qualified-root-header-receipt2.json\",\"sha256\":\"1b60f0093d569c7b2d4fc811e85411bd780b6ecbedc11333763275c84744ba95\",\"bytes\":2482},\"oldSetupClosure\":{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/source-holder2-final-closure.json\",\"sha256\":\"eae9afc5b34e1dc4f7bf7b2ed3feca171c308da3c72d81e985240ec403822f31\",\"bytes\":6680},\"additionalSetupClosure\":{\"bytes\":4328,\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/source-holder5-final-closure.json\",\"sha256\":\"5c83b562a30789bc4501fd438bf8569b4eb2ba18adcb28936de38abbe3719038\"},\"pathBindingValidation\":{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/path-binding-validation6.json\"},\"latestSetupClosure\":{\"bytes\":449595,\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/source-holder6-final-closure.json\",\"sha256\":\"9fb167b95a50e3ba1c247895165de410b8fcc3a9e60a1289fb856e805025b57f\"}}")
J=Path(CONFIG['J']); F=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
def nine(s):return {k:str(getattr(s,'st_'+k)) for k in F}
def sha(b):return hashlib.sha256(b).hexdigest()
def err(e):return {'type':type(e).__name__,'message':str(e),'trace':traceback.format_exc()}
def encode(o):return (json.dumps(o,sort_keys=True,separators=(',',':'))+'\n').encode()
def write_new(name,body):
 p=J/name;b=body if isinstance(body,bytes) else encode(body)
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 primary=None;ce=None
 try:
  v=memoryview(b)
  while v:
   n=os.write(fd,v);assert n>0;v=v[n:]
  os.fsync(fd)
 except BaseException as e:primary=e
 finally:
  try:os.close(fd)
  except BaseException as e:ce=e
 if primary is not None or ce is not None:
  raise BaseExceptionGroup('publisher primary/close',[e for e in (primary,ce) if e is not None])
 return {'path':str(p),'sha256':sha(b),'bytes':len(b)}
def canonical_sources(rows):
 # Original fields are compared before any current member is opened.
 by={};physical={}
 for r in rows:
  key=(r['path'],r.get('sha256'),r.get('bytes'),r.get('PRE9'))
  if r['path'] in by:
   old=by[r['path']]
   assert key==(old['path'],old.get('sha256'),old.get('bytes'),old.get('PRE9')),'CONFLICTING_DECLARED_SOURCE_DUPLICATE'
   continue
  if r.get('PRE9')is not None:
   identity=(r['PRE9']['dev'],r['PRE9']['ino'])
   assert identity not in physical,'DECLARED_SOURCE_PATH_ALIAS'
   physical[identity]=r['path']
  by[r['path']]=r
 return list(by.values())
class Holder:
 def __init__(self):
  self.owned=[];self.by={};self.cache={};self.rows={};self.events=[];self.errors=[]
  self.count=CONFIG['priorAdmissions'];self.total=CONFIG['priorBytes']
  self.previous={r['path']:r for r in CONFIG['oldRows']}
 def open_all(self,rows):
  added=[]
  for r in rows:
   path=r['path']
   if path in self.by:
    p=self.by[path];assert not r.get('PRE9') or r['PRE9']==p['PRE9']
    assert not r.get('sha256') or r['sha256']==self.rows.get(path,p['expected']).get('sha256'),'DUPLICATE_DECLARED_HASH_CHANGED'
    assert r.get('bytes') is None or r['bytes']==int(p['PRE9']['size']),'DUPLICATE_DECLARED_SIZE_CHANGED'
    continue
   fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
   try:
    p={'path':path,'fd':fd,'expected':r,'closeAttempted':False}
    self.owned.append(p)
   except BaseException as primary:
    try:os.close(fd)
    except BaseException as close:raise BaseExceptionGroup('reader immediate registration/close',[primary,close])
    raise
   # Registration precedes stat/maturity/parser and accounting operations.
   s=os.fstat(fd);p['PRE9']=nine(s);p['capturedUnixNs']=str(time.time_ns())
   before=self.previous.get(path)
   if not(before and before['PRE9']==p['PRE9'] and before['bytes']==s.st_size):
    self.count+=1;self.total+=s.st_size
   assert self.count+2<=4096 and self.total+147456<=67108864,'CUMULATIVE_SOURCE_PLUS_RESERVED_FUTURE_CONTROL_BUDGET'
   assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20 and 0<=s.st_size<=16777216
   assert time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns)>=(240000000000 if path.startswith(str(J)+'/') else 60000000000),'SOURCE_MATURITY'
   assert p['PRE9']==nine(os.stat(path,follow_symlinks=False)),'PATH_NINE_CHANGED'
   if r.get('PRE9') is not None:assert p['PRE9']==r['PRE9'],'ORIGINAL_NINE_CHANGED:'+path
   assert not any(q is not p and q.get('PRE9',{}).get('dev')==p['PRE9']['dev'] and q.get('PRE9',{}).get('ino')==p['PRE9']['ino'] for q in self.owned),'SOURCE_PHYSICAL_ALIAS'
   self.by[path]=p;added.append(p)
  self.events.append({'phase':'ALL_FDS_BEFORE_BODIES','added':len(added),'held':len(self.owned),'chargedAdmissions':self.count,'chargedBytes':self.total})
  return added
 def raw(self,p):
  chunks=[];n=0
  while True:
   b=os.read(p['fd'],min(131072,16777217-n))
   if not b:break
   n+=len(b);assert n<=16777216;chunks.append(b)
  return b''.join(chunks)
 def read_all(self,added):
  for p in added:
   b=self.raw(p);r=p['expected'];assert len(b)==int(p['PRE9']['size'])
   assert p['PRE9']==nine(os.fstat(p['fd']))==nine(os.stat(p['path'],follow_symlinks=False)),'READ_NINE_CHANGED:'+p['path']
   if r.get('sha256'):assert (sha(b),len(b))==(r['sha256'],r['bytes']),'SOURCE_HASH_CHANGED:'+p['path']
   self.cache[p['path']]=b
   self.rows[p['path']]={'path':p['path'],'PRE9':p['PRE9'],'sha256':sha(b),'bytes':len(b),'fullEOF':True,'capturedUnixNs':p['capturedUnixNs']}
 def snapshot(self):
  return {'scope':'R4_C6_INDEPENDENT_HELD_HEADER_PROOF','rows':list(self.rows.values()),'events':self.events,'heldFDs':len(self.owned),'chargedAdmissions':self.count,'chargedBytes':self.total,'oneCumulativeLedger':True,'maxAdmissions':4096,'maxBytes':67108864,'perFileBytes':16777216,'publisherSelfExcluded':True,'sourceEligibility':False}
 def verify_all(self):
  out=[]
  for p in self.owned:
   q={'path':p['path'],'exact':False}
   try:
    os.lseek(p['fd'],0,0);b=self.raw(p);row=self.rows[p['path']]
    q.update(fullEOF=True,sha256=sha(b),bytes=len(b),FD9=nine(os.fstat(p['fd'])),path9=nine(os.stat(p['path'],follow_symlinks=False)))
    q['exact']=p['PRE9']==q['FD9']==q['path9'] and (sha(b),len(b))==(row['sha256'],row['bytes'])
   except BaseException as e:q['error']=err(e)
   out.append(q)
  return out
 def close_all(self):
  out=[]
  for p in self.owned:
   assert not p['closeAttempted'],'UNKNOWN_FD_CLOSE_RETRY';p['closeAttempted']=True
   q={'path':p['path'],'attempt':1,'error':None}
   try:os.close(p['fd'])
   except BaseException as e:q['error']=err(e)
   out.append(q)
  return out
OUTPUT_BYTES=0
def emit(obj):
 global OUTPUT_BYTES
 raw=encode(obj);OUTPUT_BYTES+=len(raw)
 assert OUTPUT_BYTES<=262144,'REVIEWER_STDOUT_CAP'
 sys.stdout.write(raw.decode());sys.stdout.flush()
def shape(x,depth=0):
 if depth>2:return type(x).__name__
 if isinstance(x,dict):return {k:shape(v,depth+1) for k,v in x.items()}
 if isinstance(x,list):return {'count':len(x),'first':shape(x[0],depth+1) if x else None}
 return type(x).__name__
def main(selfbytes,stopbytes,commandsbytes):
 h=Holder();primary=None;last=[];close=[];done=False;publicationErrors=[]
 try:
  own=[{'path':str(J/'source-holder8.py'),'sha256':sha(selfbytes),'bytes':len(selfbytes)},{'path':str(J/'source-holder8-writers-stopped.json'),'sha256':sha(stopbytes),'bytes':len(stopbytes)}]
  boot=own+[CONFIG['oldHeaderReceipt'],CONFIG['oldSetupClosure'],CONFIG['additionalSetupClosure'],CONFIG['latestSetupClosure'],CONFIG['pathBindingValidation'],{'path':str(J/'complete-review8-requests.jsonl'),'sha256':sha(commandsbytes),'bytes':len(commandsbytes)}]
  h.read_all(h.open_all(boot))
  old=json.loads(h.cache[CONFIG['oldHeaderReceipt']['path']])
  assert old['scope']=='R4_C6_INDEPENDENT_HELD_HEADER_PROOF' and len(old['rows'])==4
  for row in old['rows']:h.previous[row['path']]=row
  h.read_all(h.open_all(old['rows']))
  stdinbytes=sys.stdin.buffer.read(32770)
  assert len(stdinbytes)<=32769 and stdinbytes==commandsbytes==h.cache[str(J/'complete-review8-requests.jsonl')],'FINITE_STDIN_BYTES_CHANGED'
  inputlines=stdinbytes.decode().splitlines()
  header=write_new('qualified-root-header-receipt8.json',h.snapshot())
  emit({'event':'ROOT_HEADERS_HELD_BEFORE_CANDIDATE','receipt':header,'headers':[{'path':p,'object':json.loads(h.cache[p])} for p in CONFIG['headers']],'ledger':{'admissions':h.count,'bytes':h.total}})
  for line in inputlines:
   command=json.loads(line)
   op=command['op']
   if op=='acquire_current':
    rootrows=[r for p in CONFIG['headers'] for r in json.loads(h.cache[p])['files']]
    assert len(rootrows)==7 and len({r['path'] for r in rootrows})==7
    for expected in CONFIG['seven']:
     actual=next(r for r in rootrows if r['path']==expected['path'])
     assert (actual['sha256'],actual['bytes'])==(expected['sha256'],expected['bytes'])
    h.read_all(h.open_all(rootrows))
    receipt=write_new('qualified-candidate-header-receipt8.json',h.snapshot())
    mf=json.loads(h.cache[CONFIG['seven'][0]['path']]);inputs=mf['inputs']
    assert type(inputs)is list and len(inputs)<=4096
    expected_rows=[]
    for r in inputs:
     assert type(r)is dict and type(r['path'])is str and os.path.isabs(r['path'])
     assert type(r['bytes'])is int and 0<=r['bytes']<=16777216 and type(r['sha256'])is str and len(r['sha256'])==64 and all(c in '0123456789abcdef'for c in r['sha256'])
     for key in ('PRE9','OPEN9','POST9','FINAL9'):
      n=r[key];assert type(n)is dict and set(n)==set(F) and all(type(n[k])is str and n[k].isdecimal()and str(int(n[k]))==n[k] for k in F)
     assert r['fullEOF'] is True
     expected_rows.append({'path':r['path'],'sha256':r['sha256'],'bytes':r['bytes'],'PRE9':r['PRE9']})
    assert len({r['path']for r in expected_rows})==len(expected_rows)
    active=json.loads("[\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-repair4/source-successor2/ci-run.py\",\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-repair4/source/native_export.py\",\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair4/programs/consumer.py\",\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair4/source-epoch3/infrastructure/prepare.py\"]")
    assert all(p in {r['path']for r in expected_rows} for p in active)
    allrows=expected_rows+CONFIG['oldRows']+json.loads("[{\"bytes\":6579,\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/prior-root5-source-fence-failure1.json\",\"sha256\":\"aaaa4e1d98ef1abbc3b734c510839b8e963429cf6f038d2f8001b4a44b006a99\"},{\"bytes\":517,\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/prior-root5-failure-writers-stopped.json\",\"sha256\":\"b24e28aa3a0dfc4c1e54a819f904e8b5a47749d128a66624e94404c64f426f31\"},{\"bytes\":601,\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/prior-document-writers-stopped.json\",\"sha256\":\"51c17d45febfc7de1dfae8f4b0248931033d4ad5a7dc1d265727d1145e9d6b6c\"},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/prior-document-prospective-readback1.json\",\"sha256\":\"56f8891c4153e30e2e1bb2fdbdf6262960e56aa0035a1d758e8af50daf5900ef\",\"bytes\":94656},{\"bytes\":4838,\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/independent-oracle-selfchecks1.json\",\"sha256\":\"ea0c487f76692e90d10655efb963068368571a9b80e1014adb9eccf2f4cf911e\"},{\"bytes\":511,\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/independent-oracle-selfchecks-writers-stopped.json\",\"sha256\":\"ab61025f2a36ce449ed4bbe93e41defb58c4e9876be1bb48b9d8d5e35e075ac0\"},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/reader-source-setup-controls1.py\",\"sha256\":\"e8830087123c041bceb4e211796513da65421cc7dc7a86045608bf492c109ec2\",\"bytes\":3279},{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/reader-source-setup-controls1-stop.json\",\"sha256\":\"cb74c6f4c996ea81b691fa477acbdc57aa6b6f79782bd172c4b880135030de21\",\"bytes\":531}]")
    canonical=canonical_sources(allrows)
    added=h.open_all(canonical);h.read_all(added)
    whole=write_new('qualified-whole-source-header-receipt8.json',h.snapshot())
    emit({'event':'WHOLE_CURRENT_SOURCE_HELD','manifestMemberCount':len(inputs),'manifestKeys':list(mf),'firstMember':inputs[0]if inputs else None,'wholeReceipt':whole,'held':len(h.owned),'chargedAdmissions':h.count,'chargedBytes':h.total,'candidateEffects':0,'sourceEligibility':False})
   elif op=='wait_independent_controls':
    controlpath=str(J/'independent-controls5.py');stoppath=str(J/'independent-controls5-stop.json')
    waitdeadline=time.monotonic()+900
    emit({'event':'CURRENT_SOURCE_HELD_WAITING_NAMED_INDEPENDENT_CONTROL_SOURCE','source':controlpath,'stop':stoppath,'remainingSourceCodeBytesReserved':131072,'remainingSourceStopBytesReserved':16384,'sameLedger':True,'waitBudgetSeconds':900,'sourceEligibility':False})
    while True:
     assert time.monotonic()<waitdeadline,'FINITE_INDEPENDENT_CONTROL_WAIT_EXPIRED'
     try:
      a=os.stat(controlpath,follow_symlinks=False);b=os.stat(stoppath,follow_symlinks=False)
     except FileNotFoundError:time.sleep(.25);continue
     if time.time_ns()-max(a.st_mtime_ns,a.st_ctime_ns,b.st_mtime_ns,b.st_ctime_ns)<240000000000:time.sleep(.25);continue
     assert 0<=a.st_size<=131072 and 0<=b.st_size<=16384
     break
    added=h.open_all([{'path':controlpath},{'path':stoppath}]);h.read_all(added)
    stop=json.loads(h.cache[stoppath])
    assert stop['scope']=='R4_C6_INDEPENDENT_CANDIDATE_SOURCE_CONTROL_STOP' and stop['writerState']=='STOPPED' and stop['remainingSourceWrites']==[]
    expected=stop['sourcePin'];assert expected['path']==controlpath and (expected['sha256'],expected['bytes'])==(h.rows[controlpath]['sha256'],h.rows[controlpath]['bytes'])
    namespace={'__name__':'independent_closed_candidate_controls','__file__':controlpath}
    exec(compile(h.cache[controlpath],controlpath,'exec'),namespace)
    result=namespace['main'](h.cache,h.rows,h,{})
    receipt=write_new('independent-candidate-controls8.json',result)
    emit({'event':'CANDIDATE_CONTROLS_COMPLETE','receipt':receipt,'result':result})
   elif op=='open':
    added=h.open_all(command['rows']);h.read_all(added)
    receipt=write_new(command['receipt'],h.snapshot()) if command.get('receipt') else None
    emit({'event':'OPEN_COMPLETE','receipt':receipt,'added':len(added),'held':len(h.owned),'ledger':{'admissions':h.count,'bytes':h.total},'shapes':[{'path':p,'shape':shape(json.loads(h.cache[p]))} for p in command.get('jsonShapes',[])]})
   elif op=='json':
    o=json.loads(h.cache[command['path']]);emit({'event':'JSON','path':command['path'],'object':o})
   elif op=='body':
    b=h.cache[command['path']].decode();lines=b.splitlines();a=command.get('first',1);z=command.get('last',len(lines))
    emit({'event':'BODY','path':command['path'],'body':'\n'.join(str(i+1)+': '+lines[i] for i in range(a-1,min(z,len(lines))))})
   elif op=='run':
    path=command['path'];namespace={'__name__':'independent_closed_control','__file__':path}
    exec(compile(h.cache[path],path,'exec'),namespace)
    result=namespace['main'](h.cache,h.rows,h,command.get('args',{}))
    receipt=write_new(command['receipt'],result)
    emit({'event':'CONTROL_RESULT','receipt':receipt,'result':result})
   elif op=='publish':
    # Only explicit reviewer-authored verdict bytes; never changes candidate.
    emit({'event':'PUBLISHED','receipt':write_new(command['name'],command['body'])})
   elif op=='verify':
    last=h.verify_all();emit({'event':'HELD_VERIFICATION','exact':sum(q['exact'] for q in last),'held':len(last),'failures':[q for q in last if not q['exact']]})
   elif op=='finish':done=True;break
   else:raise AssertionError('UNKNOWN_READER_COMMAND')
 except BaseException as e:primary=err(e)
 finally:
  try:last=h.verify_all()
  except BaseException as e:publicationErrors.append({'phase':'FINAL_VERIFY','error':err(e)})
  # Cleanup occurs even if the final report writer fails.
  try:
   preclose=write_new('held-before-close-verdict-receipt8.json',{**h.snapshot(),'primaryFailure':primary,'final':last,'finalAllExact':len(last)==len(h.owned) and all(q['exact'] for q in last),'publicationErrors':publicationErrors})
  except BaseException as e:publicationErrors.append({'phase':'REPORT_BEFORE_CLOSE','error':err(e)})
  try:close=h.close_all()
  except BaseException as e:publicationErrors.append({'phase':'CLOSE_LOOP_SETUP','error':err(e)})
  result={**h.snapshot(),'primaryFailure':primary,'final':last,'finalAllExact':len(last)==len(h.owned) and all(q['exact'] for q in last),'closeAttempts':close,'closeRetries':0,'publicationErrors':publicationErrors,'explicitFinished':done,'candidateAcceptance':False}
  try:receipt=write_new('source-holder8-final-closure.json',result)
  except BaseException as e:receipt=None;publicationErrors.append({'phase':'FINAL_CLOSE_PUBLICATION','error':err(e)})
  emit({'event':'HOLDER_CLOSED','receipt':receipt,'held':len(h.owned),'chargedAdmissions':h.count,'chargedBytes':h.total,'primaryFailure':primary,'allFinalExact':result['finalAllExact'],'closeCount':len(close),'closeErrors':[q for q in close if q['error']],'publicationErrors':publicationErrors})
 return 0 if primary is None and result['finalAllExact'] and not any(q['error'] for q in close) and not publicationErrors else 1
