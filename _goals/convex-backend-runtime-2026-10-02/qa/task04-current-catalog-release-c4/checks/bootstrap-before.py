from pathlib import Path
import json,hashlib,os,datetime,shutil,difflib,sys,re
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa';old=q/'task04-current-catalog-release-c3';b=q/'task04-current-catalog-release-c4';w=r/'work/resume/task04-current-catalog-release-c4';start=datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,indent=2)+'\n')
pre=json.loads((old/'source-before.json').read_text());assert len(pre['sources'])==136
for row in pre['sources']:assert sha(r/row['path'])==row['sha256']==sha(old/'preimages-before'/row['path'])
dump(b/'protected-pre.json',pre)
lineage=[]
for folder,mname in [(old,'qa-manifest.json'),(r/'work/resume/task04-current-catalog-release-c3','scratch-manifest.json'),(q/'task04-current-catalog-composition-c2','qa-manifest.json'),(q/'task04-catalog-c2-fresh-review','qa-manifest.json')]:
 m=folder/mname;data=json.loads(m.read_text());seen=[]
 def walk(p):
  for f in p.iterdir():
   if f==m:continue
   if f.is_symlink() or f.is_file():seen.append(str(f.relative_to(folder)))
   elif f.is_dir():walk(f)
 walk(folder);assert set(seen)=={row['path'] for row in data['rows']}
 for row in data['rows']:
  p=folder/row['path'];raw=os.readlink(p).encode() if p.is_symlink() else p.read_bytes();assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']
 t=b/'lineage'/('C3-scratch' if mname.startswith('scratch') else folder.name);t.mkdir(parents=True);shutil.copyfile(m,t/mname)
 if (folder/'report.md').exists():shutil.copyfile(folder/'report.md',t/'report.md')
 lineage.append({'folder':str(folder),'rows':len(data['rows']),'manifestSHA256':sha(m),'allRowsVerified':True,'links':'literal never traversed'})
shutil.copyfile(old/'source-before.json',b/'source-before.json');shutil.copytree(old/'preimages-before',b/'preimages-before');shutil.copytree(old/'preimages-before',b/'preimages')
changes=[];patch=[];post=json.loads(json.dumps(pre))
for name in json.loads((old/'original-tests.json').read_text()):
 before=(r/name).read_text();text=(old/'postimages'/name).read_text().replace('task04-current-catalog-release-c3/current-compose.mjs','task04-current-catalog-release-c4/current-compose.mjs').replace('work/resume/task04-current-catalog-release-c3/test-scratch','work/resume/task04-current-catalog-release-c4/test-scratch');p=b/'postimages'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text);shutil.copyfile(p,b/'preimages'/name);patch.extend(difflib.unified_diff(before.splitlines(True),text.splitlines(True),fromfile='a/'+name,tofile='b/'+name));changes.append({'path':name,'beforeSHA256':sha(r/name),'afterSHA256':sha(p),'beforeBytes':(r/name).stat().st_size,'afterBytes':p.stat().st_size,'derivation':'exact C3 postimage (exact C2 held patch derivation) with ONLY C4 runner/work routing'})
 for row in post['sources']:
  if row['path']==name:row['sha256']=sha(p);row['bytes']=p.stat().st_size
assert sum(x!=y for x,y in zip(pre['sources'],post['sources']))==4
dump(b/'source-runtime.json',post);runtime=sha(b/'source-runtime.json');(b/'proposed-four-file-exact.patch').write_text(''.join(patch));shutil.copyfile(old/'proposed-four-file-exact.patch',b/'lineage/C3-held-exact.patch')
transition={'originalRows':136,'unchangedRows':132,'changedOnly':changes,'runtimeMode':'POST_ONLY_NO_WHITELIST','runtimeManifestSHA256':runtime,'sourceBeforeSHA256':sha(b/'source-before.json'),'exactPatchSHA256':sha(b/'proposed-four-file-exact.patch'),'ROOTprecondition':'ALL136 exact PRE+approved patch/postimages; ONLY4 exact postimages then ALL136 POST','actualRootApplied':False,'C3MetadataRepair':'four runtime row bytes now exact POST lengths; C3 original metadata/history immutable'};dump(b/'source-transition.json',transition);transitionhash=sha(b/'source-transition.json')
files=['current-compose.mjs','private-compose.mjs','containment.mjs','native-probe.mts','offline-guard.mjs','adverse.mjs','containment-controls.mjs','socket-proof.mjs','jest.config.mjs','setup.mjs','package.json','tsconfig.json','eslint.config.mjs','approved-additions.json','original-tests.json','original-four-failures.json','fixture-entry.mjs','release-preconditions.mjs','release-controls.mjs','precondition-controls.mjs']
for name in files:
 text=(old/name).read_text().replace('task04-current-catalog-release-c3','task04-current-catalog-release-c4')
 if name=='current-compose.mjs':text=text.replace('410dd9bc4624ebe4e63590a829342874dfa8c47749048ce15b81875a75dc47be',runtime).replace("const root='/workspace/Project-Cortex';","import {repositoryRoot as root} from './repository-location.mjs';")
 if name=='release-preconditions.mjs':text=text.replace("const root='/workspace/Project-Cortex';","import {repositoryRoot as root} from './repository-location.mjs';");text=re.sub(r"(readExact\(path.join\(base,'source-transition.json'\),')[a-f0-9]{64}('\))",lambda m:m[1]+transitionhash+m[2],text)
 if name=='fixture-entry.mjs':text="import path from 'node:path';\nimport {fileURLToPath} from 'node:url';\n"+text;text=text.replace("const sourceRoot='/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-release-c4/staged-post-root';","const sourceRoot=path.join(path.dirname(fileURLToPath(import.meta.url)),'staged-post-root');")
 if name=='release-controls.mjs':text=text.replace("const work='/workspace/Project-Cortex/work/resume/task04-current-catalog-release-c4';","import {repositoryRoot} from './repository-location.mjs';\nconst work=path.join(repositoryRoot,'work/resume/task04-current-catalog-release-c4');")
 if name=='containment-controls.mjs':text=text.replace("const fixture='/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-release-c4/staged-post-root';","const fixture=path.join(path.dirname(fileURLToPath(import.meta.url)),'staged-post-root');").replace("const root='/workspace/Project-Cortex';","const root=repositoryRoot;");text="import {repositoryRoot} from './repository-location.mjs';\n"+text
 if name=='jest.config.mjs':text="import config from '../../../../jest.config.mjs';\nimport path from 'node:path';\nimport {fileURLToPath} from 'node:url';\nimport {repositoryRoot} from './repository-location.mjs';\nconst base=path.dirname(fileURLToPath(import.meta.url));\nexport default {...config,rootDir:repositoryRoot,roots:[base+'/copies'],setupFiles:[base+'/setup.mjs'],setupFilesAfterEnv:[],reporters:['default'],cacheDirectory:base+'/cache',testPathIgnorePatterns:['/node_modules/']};\n"
 (b/name).write_text(text)
(b/'repository-location.mjs').write_text("""import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectAncestors} from './containment.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
assert.equal(path.basename(base),'task04-current-catalog-release-c4','FIXED_PACKET_ANCESTRY');
assert.equal(path.basename(path.dirname(base)),'qa','FIXED_QA_ANCESTRY');
assert.equal(path.basename(path.resolve(base,'../..')),'convex-backend-runtime-2026-10-02','FIXED_GOAL_ANCESTRY');
assert.equal(path.basename(path.resolve(base,'../../..')),'_goals','FIXED_GOALS_ANCESTRY');
inspectAncestors(base);
export const repositoryRoot=path.resolve(base,'../../../..');
inspectAncestors(repositoryRoot);
""")
for d in [w/'diagnostics',w/'test-scratch']:d.mkdir()
shutil.copytree(b/'preimages',b/'staged-post-root');os.symlink(str(r/'node_modules'),b/'node_modules',target_is_directory=True)
for name in json.loads((b/'original-tests.json').read_text()):
 text=(b/'postimages'/name).read_text().replace('task04-current-catalog-release-c4/current-compose.mjs','task04-current-catalog-release-c4/fixture-entry.mjs')
 def route(m):return m[1]+str(((r/name).parent/m[2]).resolve())+m[3]
 text=re.sub(r'((?:from\s+|import\s*)[\'\"])(\.[^\'\"]+)([\'\"])',route,text);p=b/'copies'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
diff=[]
for name in ['current-compose.mjs','private-compose.mjs','containment.mjs','native-probe.mts','offline-guard.mjs','fixture-entry.mjs','release-preconditions.mjs','repository-location.mjs']:
 before=(old/name).read_text() if (old/name).exists() else '';diff.extend(difflib.unified_diff(before.splitlines(True),(b/name).read_text().splitlines(True),fromfile='C3/'+name,tofile='C4/'+name))
(b/'source-binding.diff').write_text(''.join(diff));s=(old/'checks/run.py').read_text();s=s.replace("'precondition-controls.mjs'","'precondition-controls.mjs','repository-location.mjs','portability-controls.mjs'");(b/'checks/run.py').write_text(s)
dump(b/'lineage.json',{'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'closures':lineage,'rootFoundC3Blocker':'hardcoded root breaks actual root routing in other checkout; C3 never installed/judged as deployable','oldClaims':'all complete failures/history remain external immutable originals; no observed outcomes relabeled new'});dump(b/'bootstrap-receipt.json',{'argv':sys.argv,'cwd':str(Path.cwd()),'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':0,'protectedPRE':136,'scriptBeforeSHA256':sha(b/'checks/bootstrap-before.py'),'runtimeManifestSHA256':runtime})
for row in pre['sources']:assert sha(r/row['path'])==row['sha256']
print(json.dumps({'runtimeManifest':runtime,'changes':changes,'rootOriginal136':True}))
