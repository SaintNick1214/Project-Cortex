import os,stat,json,hashlib,datetime
from pathlib import Path
R=Path('/workspace/Project-Cortex'); Q=R/'_goals/convex-backend-runtime-2026-10-02/qa'
def verify(p,pin):
 b=p.read_bytes(); assert hashlib.sha256(b).hexdigest()==pin,(p,'seal'); d=json.loads(b); root=Path(d['root']); root=root if root.is_absolute() else R/root
 rows=d['files']; expected={r['path']:r for r in rows}; actual={}
 def walk(x):
  for ent in os.scandir(x):
   f=Path(ent.path); s=f.lstat()
   if stat.S_ISDIR(s.st_mode): walk(f)
   elif f!=p: actual[str(f.relative_to(root))]=f
 walk(root); assert set(actual)==set(expected),(p,'set')
 for name,f in actual.items():
  r=expected[name]; s=f.lstat(); assert stat.S_IMODE(s.st_mode)==r['mode'],(name,'mode'); assert s.st_nlink==r.get('nlink',1),(name,'nlink')
  if stat.S_ISLNK(s.st_mode): raw=os.fsencode(os.readlink(f)); assert r['kind'] in ['symlink','link','literal-symlink'],name
  else:
   assert stat.S_ISREG(s.st_mode),(name,'type')
   fd=os.open(f,os.O_RDONLY|os.O_NOFOLLOW)
   with os.fdopen(fd,'rb') as h:
    z=os.fstat(h.fileno()); assert (z.st_dev,z.st_ino)==(s.st_dev,s.st_ino); raw=h.read(); z2=os.fstat(h.fileno()); assert (z2.st_size,z2.st_mtime_ns,z2.st_ctime_ns)==(z.st_size,z.st_mtime_ns,z.st_ctime_ns)
  assert len(raw)==r['bytes'] and hashlib.sha256(raw).hexdigest()==r['sha256'],(name,'bytes')
 return {'path':str(p.relative_to(R)) if p.is_relative_to(R) else str(p),'sha256':pin,'rows':len(rows),'literalLinks':sum(f.is_symlink() for f in actual.values()),'verified':True}
def seal(rel,name,pin): return verify(R/rel/name,pin)
a=[seal('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1-fresh-review','qa-manifest.json','0a15543bcf258ca4814ac433d3e97eb9311d8239a284bad22b66ce4b2f6e9280'),seal('work/resume/task04-evidence-transport-c4-c1-fresh-review','work-manifest.json','3866141fbd003ebf63b84cbe6b56227de73c6f220ce51adacf6619fd24a6a282')]
b=[seal('_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-closed-launcher-c1-fresh-review','qa-manifest.json','cc681937dd3ecba297567080e9416040203e41a91985e1b32f825ab5f667109e'),seal('work/resume/task04-native-c5-closed-launcher-c1-fresh-review','work-manifest.json','f8869f7e9039b7075ed8cd5869f5bbef537e3dfd20ca156d96ce9a9c5d63202d'),verify(Path('/tmp/cortex-native-c5-closed-launcher-c1-fresh-review/tmp-manifest.json'),'fd940c6d0c274954ca0a77160d60d188fad7044151647116573df958388cfc3e')]
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
for name,rows,verdict,score,scope in [('task04-evidence-transport-c4-c1-coordinator-acceptance.json',a,'PASS_TRANSPORT_ONLY',4.8,'Lossless transport only; no native qualification, source acceptance, or historical custody restoration.'),('task04-native-c5-closed-launcher-c1-coordinator-rejection.json',b,'REJECT',2.6,'25 unchanged PASS; 9 extra PASS/3 FAIL. Repair descriptor-close ownership, exhaustive cleanup, inert compiler options. All122 HELD.')]:
 d={'utc':now,'verdict':verdict,'independentAverage':score,'fullReportRead':True,'closures':rows,'scope':scope}; (Q/name).write_text(json.dumps(d,indent=2)+'\n'); print(name,verdict,[(x['rows'],x['literalLinks']) for x in rows])
