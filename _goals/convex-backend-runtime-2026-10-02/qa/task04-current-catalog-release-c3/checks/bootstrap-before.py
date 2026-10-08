import pathlib,json,hashlib,os,datetime,shutil,difflib,re,sys
r=pathlib.Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa';old=q/'task04-current-catalog-composition-c2';b=q/'task04-current-catalog-release-c3';w=r/'work/resume/task04-current-catalog-release-c3';start=datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,indent=2)+'\n')
pins=json.loads((old/'source-pre.json').read_text());assert len(pins['sources'])==136
for row in pins['sources']:assert sha(r/row['path'])==row['sha256'] and (r/row['path']).read_bytes()==(old/'preimages'/row['path']).read_bytes()
dump(b/'protected-pre.json',pins)
lineage=[]
for folder in [old,q/'task04-catalog-c2-fresh-review']:
 m=folder/'qa-manifest.json';d=json.loads(m.read_text());actual=[]
 def walk(p):
  for f in p.iterdir():
   if f==m:continue
   if f.is_symlink() or f.is_file():actual.append(str(f.relative_to(folder)))
   elif f.is_dir():walk(f)
 walk(folder);assert set(actual)=={row['path'] for row in d['rows']}
 for row in d['rows']:
  p=folder/row['path'];raw=os.readlink(p).encode() if p.is_symlink() else p.read_bytes();assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']
 t=b/'lineage'/folder.name;t.mkdir(parents=True);shutil.copyfile(m,t/'qa-manifest.json');shutil.copyfile(folder/'report.md',t/'report.md');lineage.append({'folder':str(folder),'rows':len(d['rows']),'reportSHA256':sha(folder/'report.md'),'manifestSHA256':sha(m),'allRowsVerified':True,'links':'literal only'})
shutil.copyfile(q/'task04-catalog-c2-coordinator-acceptance.json',b/'lineage/coordinator-acceptance.json')
# Exact unified patch application to held original bytes, in memory only.
patch=(old/'proposed-four-file-minimal.patch').read_text();lines=patch.splitlines(keepends=True);outputs={};i=0
while i<len(lines):
 assert lines[i].startswith('--- a/');name=lines[i][6:].strip();i+=1;assert lines[i]=='+++ b/'+name+'\n';i+=1;original=(r/name).read_text().splitlines(keepends=True);result=[];cursor=0
 while i<len(lines) and not lines[i].startswith('--- a/'):
  h=re.fullmatch(r'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@.*\n',lines[i]);assert h;target=int(h[1])-1;result.extend(original[cursor:target]);cursor=target;i+=1
  while i<len(lines) and not lines[i].startswith(('@@ ','--- a/')):
   line=lines[i];i+=1
   if line[0] in ' -':assert original[cursor]==line[1:];cursor+=1
   if line[0] in ' +':result.append(line[1:])
 result.extend(original[cursor:]);outputs[name]=''.join(result)
assert list(outputs)==json.loads((old/'original-tests.json').read_text())
# ONLY approved immutable QA runner and owned work routing substitutions.
changes=[];newpatch=[]
for name,text in outputs.items():
 text=text.replace('_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-composition-c2/current-compose.mjs','_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-release-c3/current-compose.mjs').replace('work/resume/task04-current-catalog-composition-c2/test-scratch','work/resume/task04-current-catalog-release-c3/test-scratch')
 p=b/'postimages'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text);before=(r/name).read_text();newpatch.extend(difflib.unified_diff(before.splitlines(True),text.splitlines(True),fromfile='a/'+name,tofile='b/'+name));changes.append({'path':name,'beforeSHA256':sha(r/name),'afterSHA256':sha(p),'derivation':'exact reviewed C2 unified patch applied in-memory; ONLY new runner/work route substitutions'})
(b/'proposed-four-file-exact.patch').write_text(''.join(newpatch));(b/'lineage/C2-original-held.patch').write_text(patch)
shutil.copytree(old/'preimages',b/'preimages-before');shutil.copytree(old/'preimages',b/'preimages')
post=json.loads(json.dumps(pins))
for row in post['sources']:
 if row['path'] in outputs:
  p=b/'postimages'/row['path'];shutil.copyfile(p,b/'preimages'/row['path']);row['sha256']=sha(p)
dump(b/'source-runtime.json',post);shutil.copyfile(old/'source-pre.json',b/'source-before.json');newdigest=sha(b/'source-runtime.json');assert sum(a['sha256']!=z['sha256'] for a,z in zip(pins['sources'],post['sources']))==4
for name in ['current-compose.mjs','private-compose.mjs','containment.mjs','native-probe.mts','offline-guard.mjs','adverse.mjs','containment-controls.mjs','socket-proof.mjs','jest.config.mjs','setup.mjs','package.json','tsconfig.json','eslint.config.mjs','approved-additions.json','original-tests.json','original-four-failures.json']:
 text=(old/name).read_text().replace('task04-current-catalog-composition-c2','task04-current-catalog-release-c3')
 if name=='current-compose.mjs':text=text.replace("'source-pre.json'","'source-runtime.json'").replace('81f5aa3db369433a701b64aea0a613cdb3a0fa01e43211f9b214abeb2d881a50',newdigest)
 if name=='private-compose.mjs':text=text.replace("path.join(base,'diagnostics')","path.join(workRoot,'diagnostics')")
 if name=='adverse.mjs':text=text.replace("'source-pre.json'","'source-runtime.json'")
 if name=='containment-controls.mjs':
  text=text.replace("import {compose,composeForControls} from './current-compose.mjs';", "import {composeForControls as checkedCompose} from './current-compose.mjs';\nconst fixture='/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-release-c3/staged-post-root';\nconst compose=destination=>checkedCompose(destination,{sourceRoot:fixture});\nconst composeForControls=(destination,controls)=>checkedCompose(destination,{sourceRoot:fixture,...controls});")
  text=text.replace("'source-pre.json'","'source-runtime.json'").replace("path.join(base,'diagnostics')","path.join(work,'diagnostics')")
 (b/name).write_text(text)
for d in [w/'diagnostics',w/'test-scratch']:d.mkdir()
shutil.copytree(b/'preimages',b/'staged-post-root');os.symlink(str(r/'node_modules'),b/'node_modules',target_is_directory=True)
(b/'fixture-entry.mjs').write_text("import {composeForControls} from './current-compose.mjs';\nconst sourceRoot='/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-release-c3/staged-post-root';\nconsole.log(JSON.stringify(composeForControls(process.argv[2],{sourceRoot})));\n")
# Isolated copies: same reviewed postimage assertions, absolute existing imports and fixed fixture CLI only.
for name in outputs:
 text=(b/'postimages'/name).read_text().replace('_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-release-c3/current-compose.mjs','_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-release-c3/fixture-entry.mjs')
 def route(m):return m[1]+str(((r/name).parent/m[2]).resolve())+m[3]
 text=re.sub(r'((?:from\s+|import\s*)[\'\"])(\.[^\'\"]+)([\'\"])',route,text);p=b/'copies'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
# Capture semantic/plumbing diff; all other C2 mechanism bytes unchanged.
diffs=[]
for name in ['current-compose.mjs','private-compose.mjs','containment.mjs','native-probe.mts','offline-guard.mjs']:
 diffs.extend(difflib.unified_diff((old/name).read_text().splitlines(True),(b/name).read_text().splitlines(True),fromfile='C2/'+name,tofile='C3/'+name))
(b/'source-binding.diff').write_text(''.join(diffs));dump(b/'source-transition.json',{'originalRows':136,'unchangedRows':132,'changedOnly':changes,'runtimeMode':'POST_ONLY_NO_WHITELIST','runtimeManifestSHA256':newdigest,'sourceBeforeSHA256':sha(b/'source-before.json'),'exactPatchSHA256':sha(b/'proposed-four-file-exact.patch'),'ROOTprecondition':'ALL136 exact PRE plus exact approved patch bytes; apply ONLY four approved postimages; then ALL136 exact POST before any runtime check','actualRootApplied':False});dump(b/'lineage.json',{'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'closures':lineage,'history':'C1 failures and complete old evidence remain bound through C2 full closure; no copied observation relabeled C3 pass'})
for row in pins['sources']:assert sha(r/row['path'])==row['sha256']
dump(b/'bootstrap-receipt.json',{'argv':sys.argv,'cwd':str(pathlib.Path.cwd()),'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':0,'protected':136,'allOriginalRootExact':True,'preExecutionScriptSHA256':sha(w/'bootstrap.py')});print(json.dumps({'runtimeManifestSHA256':newdigest,'changes':changes,'rootUnchanged':True}))
