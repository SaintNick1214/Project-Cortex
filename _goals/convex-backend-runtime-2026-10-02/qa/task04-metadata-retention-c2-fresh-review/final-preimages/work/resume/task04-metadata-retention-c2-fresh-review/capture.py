import pathlib,hashlib,json,datetime,subprocess,sys
r=pathlib.Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-c2-fresh-review'
tag=sys.argv[1];files=json.loads(sys.argv[2]);argv=sys.argv[3:]
def snap(phase):
 out={}
 for f in files:
  p=r/f;b=p.read_bytes();out[f]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
  if phase=='pre':
   d=q/'preimages'/f;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(b)
 (q/(tag+'-'+phase+'.json')).write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':out},indent=2)+'\n')
snap('pre');start=datetime.datetime.now(datetime.timezone.utc).isoformat();x=subprocess.run(argv,cwd=r,capture_output=True);(q/(tag+'.stdout')).write_bytes(x.stdout);(q/(tag+'.stderr')).write_bytes(x.stderr);(q/(tag+'-receipt.json')).write_text(json.dumps({'argv':argv,'cwd':str(r),'startUtc':start,'endUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':x.returncode},indent=2)+'\n');snap('post');print(x.stdout.decode());print(x.stderr.decode(),file=sys.stderr);sys.exit(x.returncode)
