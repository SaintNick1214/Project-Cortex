import os,json,gzip,re,hashlib,pathlib,datetime,stat
R=pathlib.Path('/workspace/Project-Cortex')
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-generated-producer-source-audit'
W=R/'work/resume/task04-native-c5-generated-producer-source-audit'
T=pathlib.Path('/dev/shm/cortex-native-c5-generated-producer-source-audit')
A=R/'work/resume/task04-model-drift-native-preparation-c5/output-route-audit'
C=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c5'
H=lambda b:hashlib.sha256(b).hexdigest()
def put(root,name,obj):
 (root/name).write_text(json.dumps(obj,indent=2)+'\n')
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  before=os.fstat(fd);b=b''
  while True:
   chunk=os.read(fd,1048576)
   if not chunk:break
   b+=chunk
  after=os.fstat(fd);literal=os.lstat(p)
  ident=lambda s:{k:getattr(s,k) for k in ['st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns']}
  assert ident(before)==ident(after)==ident(literal)
  assert stat.S_ISREG(before.st_mode)
  return b,ident(before)
 finally:os.close(fd)
invpath=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-finite-recipe-audit-c3/per-id-inventory.json'
inv=json.loads(invpath.read_bytes())['commands']
pins={r['source']['path']:r['source'] for c in inv for r in c['sourceReferenceClosure']}
sources={};observations=[];errors=[];evidence={}
pattern=re.compile(r'SourceTextModule|SyntheticModule|runInContext|\.namespace\.|sourceOverride|vmParentSource|historicalSources|historicalLocatorHashes|\bbuild\(|writeFileSync|writeFile\(|import\(|spawn\(|cpSync|\.replace\(')
for p,pin in sorted(pins.items()):
 encoded,encodedIdent=held(A/pin['encodedPath']);b=gzip.decompress(encoded)
 assert len(b)==pin['bytes'] and H(b)==pin['sha256']
 backing=T/(pin['sha256']+'.gz')
 if not backing.exists():backing.write_bytes(encoded)
 current,identity=held(R/p)
 observations.append({'path':p,'archivePin':pin,'currentSHA256':H(current),'currentBytes':len(current),'currentIdentity':identity,'currentMatchesArchive':current==b,'encodedOriginalIdentity':encodedIdent,'ownBacking':str(backing),'ownBackingSHA256':H(encoded)})
 s=b.decode();sources[p]=s
 evidence[p]={'pin':pin,'referenceIDs':[c['id'] for c in inv if any(x['source']['path']==p for x in c['sourceReferenceClosure'])], 'directEntryIDs':[c['id'] for c in inv if c['entry']['path']==p], 'sites':[{'line':n,'exactLine':l,'lineSHA256':H(l.encode())} for n,l in enumerate(s.splitlines(),1) if pattern.search(l)]}
put(T,'original-source-observations.json',observations)
put(T,'source-lines.json',evidence)
routes=[]
for c in inv:
 p=c['entry']['path'];s=sources[p]
 routes.append({'id':c['id'],'exactArgv':c['exactArgv'],'entryPin':c['entry'],'sourceReferenceClosure':c['sourceReferenceClosure'],'directVMConstructorExpressions':re.findall(r'new\s+(?:vm\.)?SourceTextModule\(([^\n]{0,240})',s),'directNamespaceMemberCandidates':sorted(set(re.findall(r'\.namespace\.([A-Za-z0-9_]+)',s))),'parentTwoFieldActualBody':'vmParentSource' in s,'classification':'SOURCE_INSPECTED; direct expressions and reference edges are not a general invocation/reachability proof'})
put(Q,'per-id-source-routes.json',routes)
parents=[]
recipes=json.loads((C/'parent-source-recipes.json').read_bytes())['recipes']
for recipe in recipes:
 p=str(pathlib.Path(recipe['source']).relative_to(R));s=sources[p]
 generated=s
 for field,val in [('historicalSources',recipe['sources']),('historicalLocatorHashes',recipe['locatorHashes'])]:
  pat=r'export const '+field+r'=Object.freeze\(\{[\s\S]*?\}\);'
  assert len(re.findall(pat,generated))==1
  generated=re.sub(pat,lambda _: 'export const '+field+'=Object.freeze('+json.dumps(val,separators=(',',':'))+');',generated,count=1)
 b=generated.encode();assert len(b)==recipe['generatedBytes'] and H(b)==recipe['generatedSHA256']
 (T/('recomputed-parent-'+recipe['profile']+'.mjs.text')).write_bytes(b)
 ids=[c['id'] for c in inv if c['profile']==recipe['profile'] and 'vmParentSource' in sources[c['entry']['path']]]
 entries=[]
 for c in inv:
  if c['id'] not in ids:continue
  ep=c['entry']['path'];lines=sources[ep].splitlines()
  entries.append({'id':c['id'],'entryPin':c['entry'],'exactLines':[{'line':n,'exactLine':l,'lineSHA256':H(l.encode())} for n,l in enumerate(lines,1) if 4<=n<=30 or '.namespace.' in l]})
 parents.append({'profile':recipe['profile'],'sourcePin':pins[p],'recipe':recipe,'originalActualIDs':ids,'entries':entries,'pythonTextRecomputationMatchesRecipe':True,'execution':'NO_SOURCE_EVALUATION; reproduction only of two literal text substitutions; actual producer DUMMY corpus fields separately source inspected at entry lines7-13'})
put(Q,'parent-producer-chains.json',parents)
adapterEvidence={}
for p in sorted(C.iterdir()):
 if p.suffix not in ['.mjs','.cjs'] and p.name not in ['parent-source-recipes.json','original122-route-bindings.json']:continue
 b,identity=held(p);s=b.decode();back=T/(H(b)+'.adapter.txt');back.write_bytes(b)
 adapterEvidence[str(p.relative_to(R))]={'sha256':H(b),'bytes':len(b),'identity':identity,'backing':str(back),'generatedParentReferences':[{'line':n,'exactLine':l} for n,l in enumerate(s.splitlines(),1) if 'generated-parent' in l or 'validateGeneratedParent' in l or 'generateParent' in l],'boundaryEvidence':[{'line':n,'exactLine':l} for n,l in enumerate(s.splitlines(),1) if re.search(r'producerPaths|SourceTextModule|registerProduced|eligible=|function capture|bootstrap.json|dispatchInputs|beforeServiceBinding|dynamic=|generated=',l)]}
put(Q,'frozen-adapter-source-evidence.json',adapterEvidence)
post=[]
for row in observations:
 b,i=held(R/row['path']);post.append({'path':row['path'],'bytesAndIdentityUnchanged':H(b)==row['currentSHA256'] and i==row['currentIdentity']})
put(Q,'coverage.json',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commands':len(inv),'sourceUnion':len(pins),'currentArchiveMatches':sum(r['currentMatchesArchive'] for r in observations),'originalPREPOSTUnchanged':all(r['bytesAndIdentityUnchanged'] for r in post),'directVMEntryIDs':sum(bool(r['directVMConstructorExpressions']) for r in routes),'twoFieldParentIDs':[r['id'] for r in routes if r['parentTwoFieldActualBody']],'scope':'READONLY_SOURCE_AID_NOT_VERDICT; no original code/import/controls/processes/native/private/Git/network/subagents','post':post,'limits':['The inherited source-reference closure is conservative and may omit dynamic references; lexical VM/member candidates are not exhaustive semantic call graphs.','No generated route executed; no output inode/held backing/runtime confinement/timing or readiness established.','Loaded/compiled exports and DUMMY hooks are explicitly not promoted to invoked effects.']})
put(Q,'exploratory-errors.json',{'retained':[{'operation':'initial broad source search','result':'tool output truncated; no conclusions based on absent tail; later owned complete line index retains relevant exact source lines'},{'operation':'exploratory Python regex','result':'SyntaxWarning invalid escape sequence \\.; script exited0; later audit uses raw regex strings'},{'operation':'required-context first rg','result':'command yielded session95477; polled to completion; no source execution'},{'operation':'focused original source display','result':'tool output truncated; exact lines preserved in source-lines.json and parent-producer-chains.json'}],'auditErrors':errors})
print(json.dumps({'commands':len(inv),'sources':len(pins),'currentMatches':sum(r['currentMatchesArchive'] for r in observations),'parentIDs':[r['id'] for r in routes if r['parentTwoFieldActualBody']]}))
