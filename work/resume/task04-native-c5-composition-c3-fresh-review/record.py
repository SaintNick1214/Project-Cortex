import os, pathlib, json, hashlib, gzip, datetime, subprocess, signal, stat, shutil
R=pathlib.Path('/workspace/Project-Cortex'); O=pathlib.Path('/tmp/cortex-native-c5-independent-review-c3-fresh-20261004a'); Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-composition-c3-fresh-review'
H=lambda b:hashlib.sha256(b).hexdigest()
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
roots=[R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-closed-launcher-c3',R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c3',pathlib.Path('/tmp/cortex-native-c5-closed-launcher-c3')]
def rows(root):
 out=[]
 def walk(p):
  for c in sorted(p.iterdir()):
   s=c.lstat(); row=dict(path=str(c.relative_to(root)),mode=s.st_mode,uid=s.st_uid,dev=s.st_dev,ino=s.st_ino,nlink=s.st_nlink)
   if stat.S_ISLNK(s.st_mode):b=os.readlink(c).encode();row.update(type='symlink',bytes=len(b),sha256=H(b),literalTarget=os.readlink(c))
   elif stat.S_ISREG(s.st_mode):b=c.read_bytes();row.update(type='file',bytes=len(b),sha256=H(b))
   elif stat.S_ISDIR(s.st_mode):row.update(type='directory');out.append(row);walk(c);continue
   else:raise RuntimeError('unhandled literal type')
   out.append(row)
 walk(root);return sorted(out,key=lambda x:x['path'])
pre={str(r):rows(r) for r in roots}; (O/'frozen-PRE.json').write_text(json.dumps(pre,indent=2))
external=json.loads((roots[0]/'external-backing.json').read_text()); refs=external['references']+external['preparedInputReferences']['files']
references=[]
for r in refs:
 b=pathlib.Path(r['path']).read_bytes();references.append(dict(path=r['path'],bytes=len(b),sha256=H(b),recordedEqual=len(b)==r['bytes'] and H(b)==r['sha256']))
(O/'external-PRE.json').write_text(json.dumps(references,indent=2))
node=shutil.which('node'); env={'PATH':str(pathlib.Path(node).parent)+':/usr/bin:/bin','TMPDIR':str(O/'child-tmp')};(O/'child-tmp').mkdir(exist_ok=True)
runs=[]
for mode in ['positive','close-primary','restore-failure']:
 argv=[node,'--experimental-vm-modules',str(O/'control.mjs'),mode]; entry=(O/'control.mjs').read_bytes();(O/(mode+'-entry.prebytes.gz')).write_bytes(gzip.compress(entry,mtime=0)); start=utc()
 with (O/(mode+'.stdout')).open('wb') as out,(O/(mode+'.stderr')).open('wb') as err:
  child=subprocess.Popen(argv,cwd=R,env=env,stdout=out,stderr=err,start_new_session=True)
  try:code=child.wait(timeout=120); status='RECORDED_EXIT'
  except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);code=child.wait();status='TIMEOUT_120S_FAIL_INCOMPLETE'
 runs.append(dict(argv=argv,cwd=str(R),env=env,utcStart=start,utcEnd=utc(),pid=child.pid,exitCode=code,status=status,raw=[dict(path=str(O/(mode+'.'+s)),bytes=(O/(mode+'.'+s)).stat().st_size,sha256=H((O/(mode+'.'+s)).read_bytes()),complete=status=='RECORDED_EXIT')for s in ['stdout','stderr']]))
 (Q/'execution-receipts.json').write_text(json.dumps(runs,indent=2))
post={str(r):rows(r) for r in roots};(O/'frozen-POST.json').write_text(json.dumps(post,indent=2))
refpost=[]
for r in references:
 b=pathlib.Path(r['path']).read_bytes();refpost.append(dict(path=r['path'],bytes=len(b),sha256=H(b),PREEqual=len(b)==r['bytes'] and H(b)==r['sha256']))
(O/'external-POST.json').write_text(json.dumps(refpost,indent=2))
(Q/'integrity-receipt.json').write_text(json.dumps(dict(frozenWholeRootsEqual=pre==post,frozenRoots=[dict(root=str(r),rows=len(pre[str(r)]),sealSHA256=H((r/'literal-self-seal.json').read_bytes()))for r in roots],externalReferences=len(references),externalPREExpectedEqual=all(r['recordedEqual']for r in references),externalPOSTEqual=all(r['PREEqual']for r in refpost),UTC=utc()),indent=2))
print(json.dumps({'runs':[(r['argv'][-1],r['exitCode'],r['status'])for r in runs],'frozenWholeRootsEqual':pre==post,'externalPOSTEqual':all(r['PREEqual']for r in refpost)}))
