from pathlib import Path
import json,hashlib,os,stat,datetime
R=Path.cwd();q=R/'_goals/convex-backend-runtime-2026-10-02/qa';closures=[]
for rel,pin in [('_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-closed-launcher-c2-fresh-review/qa-manifest.json','6a869eb95a6e1d8c28afd11e4f8a780d4b7b4d5b1cd9dfa03c6a24350e6f583d'),('work/resume/task04-native-c5-closed-launcher-c2-fresh-review/work-manifest.json','61e04b2b0c2c44c2b3b161b1192cc1b028a7703251a6385b8c41d7341c2336de'),('/tmp/cortex-native-c5-closed-launcher-c2-fresh-review/tmp-manifest.json','44d7a4aacc881c1811543c54366177c16d8d0c3240524b47cec97729444dc5cd')]:
 p=R/rel;assert hashlib.sha256(p.read_bytes()).hexdigest()==pin;d=json.loads(p.read_text());expected={r['path']:r for r in d['files']};actual={}
 def walk(root):
  for x in os.scandir(root):
   f=Path(x.path);st=f.lstat()
   if stat.S_ISDIR(st.st_mode):walk(f)
   elif f!=p:actual[str(f.relative_to(p.parent))]=f
 walk(p.parent);assert set(actual)==set(expected);negative=[]
 for n,f in actual.items():
  st=f.lstat();assert st.st_uid==os.getuid()
  if st.st_nlink!=1:
   assert rel.startswith('work/resume/') and n.startswith('extra-fixture/extra-') and f.name in ['hard-a','hard-b'] and st.st_nlink==2
   mate=f.with_name('hard-b' if f.name=='hard-a' else 'hard-a');assert str(mate.relative_to(p.parent)) in expected;ms=mate.lstat();assert (ms.st_dev,ms.st_ino)==(st.st_dev,st.st_ino);negative.append(n)
  if stat.S_ISLNK(st.st_mode):b=os.fsencode(os.readlink(f))
  else:
   assert stat.S_ISREG(st.st_mode);fd=os.open(f,os.O_RDONLY|os.O_NOFOLLOW)
   with os.fdopen(fd,'rb') as h:
    before=os.fstat(h.fileno());assert (before.st_dev,before.st_ino)==(st.st_dev,st.st_ino);b=h.read();after=os.fstat(h.fileno());assert (before.st_size,before.st_mtime_ns,before.st_ctime_ns)==(after.st_size,after.st_mtime_ns,after.st_ctime_ns)
  assert len(b)==expected[n]['bytes'] and hashlib.sha256(b).hexdigest()==expected[n]['sha256'],n
 closures.append({'path':rel,'sha256':pin,'rows':len(expected),'literalLinks':sum(f.is_symlink() for f in actual.values()),'exactSelfOnly':True,'negativeHardlinkFixturePaths':negative,'ordinaryFilesNlink1ExceptExactNegativePairs':True,'modeFields':'Not declared by candidate seal; no historical mode assertion made.'})
report=q/'task04-native-c5-closed-launcher-c2-fresh-review/report.md';assert hashlib.sha256(report.read_bytes()).hexdigest()=='1eb173b2736e9b66c0238a31ac155fb30867a1bd6de617ad30e2c1854c1367e3'
(q/'task04-native-c5-closed-launcher-c2-component-coordinator-acceptance.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fullReportRead':True,'reportSHA256':'1eb173b2736e9b66c0238a31ac155fb30867a1bd6de617ad30e2c1854c1367e3','closures':closures,'verdict':'PASS_COMPONENT_ONLY','average':4.4,'controls':81,'original122':'HELD','qualificationsReleased':False,'internalCompilerArgvRaw':'NOT_CAPTURED','historicalCustody':'BROKEN','rootInitialVerifierFailures':'Missing-root/mode schema assumptions, then nlink1-only assumption rejected four exact owned negative fixture paths; original failures remain tool history, no child/source edit.'},indent=2)+'\n');print({'accepted':'COMPONENT_ONLY4.4','closures':[(r['rows'],r['literalLinks']) for r in closures]})
