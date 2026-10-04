import pathlib,json,hashlib
r=pathlib.Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-design-c2';w=r/'work/resume/task04-metadata-retention-design-c2'
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for root,name,want,n in [(q,'qa-seal.json','55e6095e3d1fc96d2f29621e56248291b992ee92d2819ab53ce8526daeda6761',101),(w,'scratch-seal.json','356faab562a02d096c477c91069d030b1e9bcd396dabbe76f3cce17ed1ca4b29',6)]:
 p=root/name;assert h(p)==want;x=json.loads(p.read_text());assert x['fileCount']==len(x['files'])==n;assert x['excludedExactSelf']==name;assert x['root']==str(root);listed=set()
 for row in x['files']:
  rel=row['path'];assert rel not in listed;listed.add(rel);f=root/rel;assert f.is_file() and not f.is_symlink();assert f.stat().st_size==row['bytes'] and h(f)==row['sha256'],str(f)
 actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and p!=root/name};assert actual==listed,(actual-listed,listed-actual);print('recursive closure',str(root),n,want)
for f,want in [('proposal.md','155af8a352dc1d19da2910200cba97496ce1115b53c4f3af2b2dc981c32e7f09'),('report.md','b959e232da42a449ef00dae731cf58390067866495a28030e5314d39dcef9cc1')]:assert h(q/f)==want
p=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-c1-fresh-review/report.md';assert h(p)=='ae0da221338d40c55165230e2e80e65734f7b0a0d64b0798da80f318233fead5'
checked=set()
for pre in q.glob('*-pre.json'):
 post=q/(pre.name[:-9]+'-post.json')
 if not post.exists():continue
 a=json.loads(pre.read_text())['files'];b=json.loads(post.read_text())['files'];assert a==b
 for f,pin in a.items():
  p=r/f;assert h(p)==pin['sha256'] and p.stat().st_size==pin['bytes'],f
  images=[q/'preimages'/f,q/'final-preimages'/f];assert any(v.exists() and v.read_bytes()==p.read_bytes() for v in images),f;checked.add(f)
print('bracketed source paths verified',len(checked))
c1=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-design-c1'
for pre in c1.glob('*-pre.json'):
 for f,pin in json.loads(pre.read_text()).get('files',{}).items():
  if '/node_modules/' in f or f.startswith('node_modules/') or f.endswith('/observer.ts') or f.endswith('/proofs.ts') or f.endswith('/canonical.ts'):
   p=r/f;assert p.stat().st_size==pin['bytes'] and h(p)==pin['sha256'];img=c1/'preimages'/f;assert img.exists() and img.read_bytes()==p.read_bytes();print('current original source pin',f,h(p))
for v in ['resource-controls','resource-controls-v2','resource-controls-v3','resource-controls-v4']:
 x=json.loads((q/(v+'-receipt.json')).read_text());print('control provenance',v,x['argv'],x['exit']);print((q/(v+'.stdout')).read_text());print((q/(v+'.stderr')).read_text())
