import pathlib,os,stat,json,hashlib,gzip,datetime,subprocess,time,signal
R=pathlib.Path('/workspace/Project-Cortex'); W=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c4';T=pathlib.Path('/tmp/cortex-native-c5-closed-launcher-c4');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-closed-launcher-c4';O=pathlib.Path('/tmp/cortex-native-c5-independent-review-c4-fresh-20261004b');H=lambda b:hashlib.sha256(b).hexdigest()
def put(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
def literal(root):
 rows=[]
 def walk(d):
  for p in sorted(d.iterdir()):
   s=p.lstat(); r={'path':str(p.relative_to(root)),**{k:getattr(s,'st_'+k) for k in ['mode','uid','dev','ino','nlink']}}
   if stat.S_ISLNK(s.st_mode):r.update(type='symlink',target=os.readlink(p))
   elif stat.S_ISDIR(s.st_mode):r['type']='directory'
   elif stat.S_ISREG(s.st_mode):b=p.read_bytes();r.update(type='file',bytes=len(b),sha256=H(b))
   else:raise Exception('special')
   rows.append(r)
   if r['type']=='directory':walk(p)
 walk(root);return rows

def snapshot(label):
 subjects=[]
 for root,expected in [(Q,'cc2af2eb7935d217a1e9eeb674603814921ab01b477673a5f2300bdcc07b8a6a'),(W,'dbe875a439e0d464e8377db33cd26832f3cc77ef944032bb2267defbaa572a7d'),(T,'f47f9ae7675e44ad4c4cccd272bc85e550e12ba6ea542f235839285fd1b1203e')]:
  seal=root/'literal-self-seal.json';assert H(seal.read_bytes())==expected
  rows=literal(root);original=json.loads(seal.read_bytes())['rows'];current=[r for r in rows if r['path']!='literal-self-seal.json'];assert current==original,(root,'seal mismatch')
  subjects.append({'root':str(root),'sealSHA256':expected,'rows':rows,'verified':True})
 put(O/(label+'-subjects.json'),subjects)
 paths=set()
 for p in W.iterdir():
  if p.is_file() and p.suffix in ['.mjs','.cjs','.json','.py']:paths.add(str(p))
 for p in T.iterdir():
  if p.is_file() and p.suffix=='.json':paths.add(str(p))
 graph=json.loads((T/'package-graph.json').read_bytes())['files'];paths.update(r['path'] for r in graph)
 m=json.loads((W/'mirror-source-transform-map.json').read_bytes())['inputs'];paths.update(r['source'] for r in m);paths.update(r['destination'] for r in m)
 refs=json.loads((W/'prepared-source-inputs.json').read_bytes())['files'];paths.update(r['path'] for r in refs)
 paths.add(subprocess.check_output(['which','node'],text=True).strip());paths.update(str(R/p) for p in ['node_modules/esbuild/lib/main.js','node_modules/esbuild/package.json','node_modules/@esbuild/linux-x64/bin/esbuild'])
 rows=[];a=O/'outer-prebytes';a.mkdir(exist_ok=True)
 for p in sorted(paths):
  p=pathlib.Path(p);s=p.lstat();assert p.resolve()==p and stat.S_ISREG(s.st_mode) and s.st_nlink==1
  b=p.read_bytes();h=H(b);dest=a/(h+'.gz')
  if not dest.exists():dest.write_bytes(gzip.compress(b,mtime=0))
  encoded=dest.read_bytes();assert gzip.decompress(encoded)==b
  rows.append({'path':str(p),'bytes':len(b),'sha256':h,'beforeByteBacking':str(dest),'encodedSHA256':H(encoded),'identity':{k:getattr(s,'st_'+k) for k in ['mode','uid','dev','ino','nlink']}})
 put(O/(label+'-sources.json'),rows)
 if label=='POST':assert rows==json.loads((O/'PRE-sources.json').read_bytes());assert subjects==json.loads((O/'PRE-subjects.json').read_bytes())
 print(label,len(rows),[len(x['rows']) for x in subjects],flush=True)

if __name__=='__main__':snapshot(__import__('sys').argv[1])
