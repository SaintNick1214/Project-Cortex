import os,sys,time,json,hashlib,stat,types,traceback
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
A=P/'task03-f2-phase-partition-repair4'; D=P/'task03-phase-partition-independent-review1'
SELF=Path(__file__)
expected={'finite-publication-pins1.json':(13999,'0dfef94c0b7a3ca7e870e0dce8f2892e901041790a97e03c59fcd10db15af74f'),'final-writer-stop1.json':(1007,'5f24c94d3d0c03ac8b01dddd4e4cafd7e6f64257f652d12f7c79a4adc4109a73'),'report1.md':(6203,'304916a2541dc358b9e44931e8ad687877d88e3d5e08a89fa14fbb03dfb78141'),'prospective-partition-recipe4.json':(3036809,'e45836c6413da4b208d71cf9aafaf2b56c8b13a3c03ade56ed4aef96d4ef74a4')}
def tup(s): return [s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_uid,s.st_gid,s.st_size,s.st_mtime_ns,s.st_ctime_ns]
def capture(path):
 l=os.lstat(path); assert stat.S_ISREG(l.st_mode) and l.st_nlink==1
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW); f=os.fstat(fd); q=os.stat(path,follow_symlinks=False)
 assert tup(l)==tup(f)==tup(q)
 age=time.time()-max(f.st_mtime,f.st_ctime);assert age>=240,(str(path),'immature',age)
 return {'path':str(path),'fd':fd,'initial':tup(f),'age_seconds':age,'reads':0,'closes':0}
def body(row):
 assert row['reads']==0
 chunks=[]
 while True:
  b=os.read(row['fd'],65536)
  if not b:break
  chunks.append(b)
 value=b''.join(chunks);row['reads']=1;row['bytes_read']=len(value);row['sha256']=hashlib.sha256(value).hexdigest()
 assert len(value)==row['initial'][6]
 assert tup(os.fstat(row['fd']))==row['initial']==tup(os.stat(row['path'],follow_symlinks=False))
 return value
def finish(rows):
 for x in rows:
  x['final']=tup(os.fstat(x['fd']));assert x['final']==x['initial']==tup(os.stat(x['path'],follow_symlinks=False))
 for x in rows:os.close(x['fd']);x['closes']+=1
 assert all(x['reads']==1 and x['closes']==1 for x in rows)
rows=[];data={};mods={}
try:
 # Bootstrap own code and the stopped authority headers are separate ordinary debt.
 boot=[capture(SELF),capture(D/'writer-stop-review2.json')]
 rows+=boot
 for row in boot:body(row)
 header=[capture(A/'finite-publication-pins1.json'),capture(A/'final-writer-stop1.json')]
 rows+=header
 for row in header:
  name=Path(row['path']).name;data[name]=body(row);assert (len(data[name]),row['sha256'])==expected[name]
 pins=json.loads(data['finite-publication-pins1.json']);stop=json.loads(data['final-writer-stop1.json'])
 print(json.dumps({'headers_verified':True,'finite_members':len(pins['members']),'epoch':2}),flush=True)
 # Stop for exact header schema inspection. Commands are finite source/mock requests.
 for line in sys.stdin:
  cmd=json.loads(line)
  if cmd['op']=='acquire':
   names=cmd.get('names',[Path(x['path']).name for x in pins['members']]);assert len(names)==48 and len(set(names))==48
   assert set(names)=={x.name for x in A.iterdir() if x.is_file()}-set(expected.keys()&{'finite-publication-pins1.json','final-writer-stop1.json'})
   members=[capture(A/name) for name in names];rows+=members
   for row in members:
    name=Path(row['path']).name;data[name]=body(row)
    if name in expected:assert (len(data[name]),row['sha256'])==expected[name]
   print(json.dumps({'acquired':len(members),'bytes':sum(x['bytes_read'] for x in members),'all_member_fds_before_member_body':True}),flush=True)
  elif cmd['op']=='show':
   name=cmd['name'];lines=data[name].decode().splitlines();start=cmd.get('start',1);end=cmd.get('end',len(lines))
   print('\n'.join(f'{i+1}: {lines[i]}' for i in range(start-1,min(end,len(lines)))),flush=True)
  elif cmd['op']=='json':
   value=json.loads(data[cmd['name']])
   for key in cmd.get('keys',[]):value=value[key]
   print(json.dumps(value,indent=2,sort_keys=True),flush=True)
  elif cmd['op']=='keys':
   value=json.loads(data[cmd['name']]);print(json.dumps({k:({'type':type(v).__name__,'length':len(v) if isinstance(v,(list,dict,str)) else None}) for k,v in value.items()},sort_keys=True),flush=True)
  elif cmd['op']=='exec':
   name=cmd['name'];module=types.ModuleType(cmd.get('module','review_candidate'));module.__file__=str(A/name);sys.modules[module.__name__]=module
   exec(compile(data[name],str(A/name),'exec'),module.__dict__);mods[module.__name__]=module
   print(json.dumps({'loaded':name,'module':module.__name__}),flush=True)
  elif cmd['op']=='test':
   # Review-owned finite mock source supplied through stdin, never imported from candidate disk.
   ns={'mods':mods,'data':data,'D':D,'A':A,'json':json,'Path':Path,'rows':rows,'capture':capture,'body':body,'mods':mods}
   exec(compile(cmd['source'],'<independent-mock-case>','exec'),ns)
  elif cmd['op']=='finish':
   for rr in rows:
    cs=[];offset=0
    while True:
     chunk=os.pread(rr['fd'],65536,offset)
     if not chunk:break
     offset+=len(chunk);cs.append(chunk)
    rb=b''.join(cs);assert len(rb)==rr['bytes_read'] and hashlib.sha256(rb).hexdigest()==rr['sha256']
    rr['final_full_EOF_hash_size']=True;rr['full_body_read_events']=2
   finish(rows)
   receipt={'state':'STOPPED','stage':'independent ordinary SOURCE/MOCK acquisition; not Source qualification','all_candidate_headers_fd_before_header_body':True,'staged_header_discovery_not_all_fds_before_first_header':True,'all_member_fds_before_member_body':True,'literal9':True,'full_eof':True,'once_close_errors':0,'rows':[{k:v for k,v in x.items() if k!='fd'} for x in rows]}
   (D/'acquisition-raw2.json').write_text(json.dumps(receipt,indent=2,sort_keys=True)+'\n')
   print(json.dumps({'finished':True,'rows':len(rows),'bytes':sum(x['bytes_read'] for x in rows)}),flush=True);break
  else:raise ValueError(cmd['op'])
except BaseException:
 traceback.print_exc()
 for x in rows:
  if not x['closes']:
   try:os.close(x['fd']);x['closes']+=1
   except OSError:pass
 (D/'acquisition-failure2.json').write_text(json.dumps({'state':'DENIED','rows':[{k:v for k,v in x.items() if k!='fd'} for x in rows]},indent=2)+'\n')
 sys.exit(1)
