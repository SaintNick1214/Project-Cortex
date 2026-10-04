exec(open('/workspace/Project-Cortex/work/resume/task04-native-c5-composition-c4-fresh-review/collect.py').read().split("if __name__")[0])
fresh=[]
for r in json.loads((O/'PRE-sources.json').read_bytes()):
 pth=pathlib.Path(r['path']);bb=pth.read_bytes();ss=pth.lstat();assert H(bb)==r['sha256'] and len(bb)==r['bytes'];assert all(getattr(ss,'st_'+k)==v for k,v in r['identity'].items());assert gzip.decompress(pathlib.Path(r['beforeByteBacking']).read_bytes())==bb;fresh.append(r)
put(O/'fresh-outer-sourcePRE.json',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':fresh,'allActualBytesRereadBeforeNode':True})
entry=O/'control.mjs';b=entry.read_bytes();d=O/'outer-prebytes'/(H(b)+'.gz');d.write_bytes(gzip.compress(b,mtime=0));assert gzip.decompress(d.read_bytes())==b
node=subprocess.check_output(['which','node'],text=True).strip();argv=[node,'--experimental-vm-modules',str(entry)];env={'PATH':str(pathlib.Path(node).parent)+':/usr/bin:/bin','TMPDIR':str(O)};receipt={'argv':argv,'cwd':str(R),'environment':env,'utcStart':datetime.datetime.now(datetime.timezone.utc).isoformat(),'outerPrerequisites':'PRE-sources.json; exact bytes archived before this Node','entryPRE':{'path':str(entry),'sha256':H(b),'bytes':len(b),'backing':str(d)},'deadlineSeconds':120}
put(O/'outer-before.json',receipt)
with (O/'stdout.raw').open('wb') as out,(O/'stderr.raw').open('wb') as err:
 p=subprocess.Popen(argv,cwd=R,env=env,stdout=out,stderr=err,start_new_session=True);receipt['pid']=p.pid;receipt['pgid']=os.getpgid(p.pid)
 try:receipt['exitCode']=p.wait(timeout=120);receipt['timeout']=False
 except subprocess.TimeoutExpired:
  receipt['timeout']=True;os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=2)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
  receipt['exitCode']=p.returncode
 observations=[]
 for i in range(2):
  members=[]
  for proc in pathlib.Path('/proc').iterdir():
   if proc.name.isdigit():
    try:
     z=(proc/'stat').read_text().split(') ',1)[1].split()
     if int(z[2])==receipt['pgid']:members.append({'pid':int(proc.name),'state':z[0]})
    except (FileNotFoundError,ProcessLookupError):pass
  observations.append({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'members':members});time.sleep(.1)
 receipt['quiescence']={'observations':observations,'complete':all(not x['members'] for x in observations)}
receipt['utcEnd']=datetime.datetime.now(datetime.timezone.utc).isoformat();receipt['entryEqual']=entry.read_bytes()==b;receipt['raw']=[{'path':str(O/n),'bytes':(O/n).stat().st_size,'sha256':H((O/n).read_bytes())} for n in ['stdout.raw','stderr.raw']];put(O/'outer-receipt.json',receipt);print(json.dumps(receipt));print((O/'stdout.raw').read_text());print((O/'stderr.raw').read_text())
