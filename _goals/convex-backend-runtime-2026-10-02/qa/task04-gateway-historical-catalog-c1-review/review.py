import pathlib,json,hashlib,shutil,subprocess,datetime,os,difflib
R=pathlib.Path('/workspace/Project-Cortex'); G=R/'_goals/convex-backend-runtime-2026-10-02'; P=G/'qa/task04-gateway-historical-catalog-preparation-c1'; Q=G/'qa/task04-gateway-historical-catalog-c1-review'; W=R/'work/resume/task04-gateway-historical-catalog-c1-review'; C=W/'owned-packet'; S=W/'execution'; S.mkdir(exist_ok=True)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(name,obj): (Q/name).write_text(json.dumps(obj,indent=2)+'\n')
def fingerprint(paths): return {str(p):sha(p) for p in sorted(set(paths))}
rows=json.loads((P/'manifest.json').read_text())['files']; actual={str(p.relative_to(P)) for p in P.rglob('*') if p.is_file() and p.name!='manifest.json'}
assert sha(P/'report.md')=='2b2a2988e27330d5f86d062fdd2f16cb1167f2baeb23e1a5dab9d6f90ab1a822'
assert sha(P/'manifest.json')=='11364f3492a5956c032267ae64339743cae5ab6e8dccf98b539a0b71adb5cd76'
assert actual=={x['path'] for x in rows}
assert all((P/x['path']).stat().st_size==x['bytes'] and sha(P/x['path'])==x['sha256'] for x in rows)
save('producer-integrity.json',{'verifiedRows':len(rows),'actualFiles':len(actual)+1,'missing':[],'extra':[],'mismatch':[],'reportSHA256':sha(P/'report.md'),'manifestSHA256':sha(P/'manifest.json')})
F=json.loads((P/'freeze.json').read_text()); bound=[P/x['path'] for x in rows]+[P/'manifest.json']+[pathlib.Path(x['path']) for x in F['official']]+[R/x['original'] for x in F['local']]+[R/'convex-dev/runtimeGateway.ts',R/'jest.config.mjs',R/'package.json',R/'package-lock.json']
before=fingerprint(bound); save('input-preimages.json',before)
node=shutil.which('node'); assert node
env={'PATH':str(R/'work/resume/toolchain-bin')+':'+str(pathlib.Path(node).parent)+':/usr/local/bin:/usr/bin:/bin','TMPDIR':str(S),'NO_COLOR':'1'}
def run(name,args,expected=0):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat(); pre=fingerprint(bound)
 p=subprocess.run(args,cwd=R,env=env,capture_output=True,text=True,timeout=180)
 (Q/(name+'.stdout')).write_text(p.stdout); (Q/(name+'.stderr')).write_text(p.stderr)
 post=fingerprint(bound); assert pre==post
 save(name+'.receipt.json',{'argv':args,'cwd':str(R),'startedUTC':start,'endedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'environment':env,'exitCode':p.returncode,'expectedExitCode':expected,'preHashes':pre,'postHashes':post,'stable':True})
 assert p.returncode==expected,(name,p.stderr[-3000:]); return p
run('node-version',[node,'--version']); run('npm-version',[str(R/'work/resume/toolchain-bin/npm'),'--version'])
run('original-immutable-guard',[node,'--input-type=module','-e',"import {verify} from '"+str(P/'guard.mjs')+"'; console.log(JSON.stringify(verify()));"])
C.mkdir(exist_ok=True)
for name in ['catalog','official-preimages']:
 shutil.copytree(P/name,C/name)
names=['freeze.json','jest.historical.json','expected-config.json','current-guard-template.json','guard.mjs','resolver.cjs','run-historical.mjs','tamper-controls.mjs']
(Q/'runner-preimages').mkdir(exist_ok=True)
for name in names: shutil.copyfile(P/name,Q/'runner-preimages'/name)
adapt={}
for name in names:
 old=(P/name).read_text(); new=old.replace(str(P),str(C)).replace(str(R/'work/resume/task04-gateway-historical-catalog-preparation-c1'),str(S)); (C/name).write_text(new)
 adapt[name]={'originalSHA256':sha(P/name),'pathRelocationOnlyBeforePinRebind':new.replace(str(C),str(P)).replace(str(S),str(R/'work/resume/task04-gateway-historical-catalog-preparation-c1'))==old}
freezeOld=sha(P/'freeze.json'); freezeNew=sha(C/'freeze.json')
text=(C/'resolver.cjs').read_text().replace(freezeOld,freezeNew); (C/'resolver.cjs').write_text(text)
resolverOld=sha(P/'resolver.cjs'); resolverNew=sha(C/'resolver.cjs')
text=(C/'guard.mjs').read_text().replace(freezeOld,freezeNew).replace(resolverOld,resolverNew); (C/'guard.mjs').write_text(text)
assert json.loads((C/'freeze.json').read_text())['local']==F['local']; assert json.loads((C/'freeze.json').read_text())['official']==F['official']
for row in F['local']: assert sha(C/row['catalog'])==row['sha256']
for row in F['official']: assert sha(C/row['snapshot'])==row['sha256'] and sha(pathlib.Path(row['path']))==row['sha256']
save('adaptations.json',{'paths':{str(P):str(C),str(R/'work/resume/task04-gateway-historical-catalog-preparation-c1'):str(S)},'files':adapt,'pinRebind':{'originalFreeze':freezeOld,'relocatedFreeze':freezeNew,'originalResolver':resolverOld,'relocatedResolver':resolverNew},'allLocalAndOfficialEntriesUnchanged':True,'sourceAndAssertionBytesUnchanged':True})
(Q/'adaptations.diff').write_text(''.join(''.join(difflib.unified_diff((P/n).read_text().splitlines(True),(C/n).read_text().splitlines(True),fromfile='producer/'+n,tofile='owned/'+n)) for n in names))
run('fresh-discovery',[node,str(C/'run-historical.mjs'),'--list']); run('fresh-historical78',[node,str(C/'run-historical.mjs'),'--run']); run('fresh-denied-controls15',[node,str(C/'tamper-controls.mjs')])
extra=[]
def deny(name,mutate,restore):
 marker=S/'child-started.json'; marker.unlink(missing_ok=True)
 try:
  mutate(); p=run(name,[node,str(C/'run-historical.mjs'),'--list'],1); assert not marker.exists() and 'PREIMPORT_GUARD_PASS' not in p.stdout; extra.append({'name':name,'exitCode':1,'childStarted':False})
 finally: restore()
f=C/'freeze.json'; b=f.read_bytes(); deny('freeze-tamper',lambda:f.write_bytes(b+b'\n'),lambda:f.write_bytes(b))
f=C/F['official'][0]['snapshot']; b=f.read_bytes(); deny('official-missing',lambda:f.unlink(),lambda:f.write_bytes(b))
f=C/'official-preimages/extra.js'; deny('official-extra',lambda:f.write_text('throw Error("unexpected")'),lambda:f.unlink())
f=C/'catalog/symlink.ts'; deny('catalog-symlink',lambda:f.symlink_to(C/'catalog/src/domain/profile.ts'),lambda:f.unlink())
save('additional-denied-controls.json',extra)
for name in ['historical-results.json','discovery.json','import-verification.json','tamper-results.json']: shutil.copyfile(C/name,Q/name)
shutil.copyfile(S/'imports.ndjson',Q/'imports.ndjson')
run('post-immutable-guard',[node,'--input-type=module','-e',"import {verify} from '"+str(P/'guard.mjs')+"'; console.log(JSON.stringify(verify()));"])
after=fingerprint(bound); assert before==after; save('input-postimages.json',after); save('preservation.json',{'allBoundFilesUnchanged':True,'files':len(before),'producerRows':len(rows),'localFiles':len(F['local']),'officialFiles':len(F['official']),'ownControls':19,'currentTestsExecuted':0})
print('Independent historical78 PASS; producer stable; nineteen denied controls; exact discovery/import boundary PASS')
