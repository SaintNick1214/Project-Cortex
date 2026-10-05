import os,json,hashlib,pathlib,datetime
R=pathlib.Path('/workspace/Project-Cortex')
B=R/'work/resume/task04-c7-exact-identity-repair'; D=B/'selector-coordinate-static-proposal'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
checked={};drift=[]
def pin(p, current=True):
 path=p['path'];fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  pre=os.fstat(fd);h=hashlib.sha256();n=0;parts=[]
  while True:
   v=os.read(fd,1048576)
   if not v:break
   h.update(v);n+=len(v);parts.append(v)
  assert ident(pre)==ident(os.fstat(fd))==ident(os.lstat(path)),path
  assert n==p['bytes'] and h.hexdigest()==p['sha256'],path
  assert ident(pre)==p['identity'],path
  checked[path]={'bytes':n,'sha256':h.hexdigest(),'identity':ident(pre)}
  return b''.join(parts)
 finally:os.close(fd)
def backing(p):
 q=p['beforeByteBacking'];raw=pin(q);assert len(raw)==p['bytes'] and hashlib.sha256(raw).hexdigest()==p['sha256'];return raw
report=json.loads((D/'report.json').read_text());application=json.loads((D/'application.json').read_text())
before=json.loads(backing(report['before']));after=json.loads(pin(application['after']));proposed=json.loads(pin(report['proposed']))
assert after==proposed
assert set(before)==set(after) and set(before['perId'])==set(after['perId'])
proof={(p['id'],p['index']):p for p in report['proof']};seen=0;changed=0
for name,old in before['perId'].items():
 new=after['perId'][name];assert {k:v for k,v in old.items() if k!='calls'}=={k:v for k,v in new.items() if k!='calls'}
 assert len(old['calls'])==len(new['calls'])
 for i,(x,y) in enumerate(zip(old['calls'],new['calls'])):
  seen+=1;p=proof[(name,i)]
  assert {k:v for k,v in x.items() if k not in ('line','columnStart','columnEnd')}=={k:v for k,v in y.items() if k not in ('line','columnStart','columnEnd')}
  for key in ('line','columnStart','columnEnd'):assert x[key]==p['before'][key] and y[key]==p['after'][key]
  changed+=x!=y
  raw=pin({'path':y['producer'],'bytes':int(y['producerIdentity']['fields']['size']),'sha256':y['producerSHA256'],'identity':y['producerIdentity']})
  line=raw.decode().splitlines()[y['line']-1];units=line.encode('utf-16-le');span=units[2*y['columnStart']:2*y['columnEnd']].decode('utf-16-le')
  assert ('new '+y['kind'] in span if y['kind']=='SourceTextModule' else y['kind'] in span),(name,i)
assert seen==246 and changed==10 and len(proof)==246
for p in report['sourcePins']:backing(p)
for k in ('preparedAfter',):pin(application[k])
disposition=json.loads((B/'canonical-501-semantic-disposition-partial.json').read_text())
assert disposition['sites']==501 and len(disposition['rows'])==501
assert {x['originalSiteID'] for x in disposition['rows']}=={f'ORIGINAL-{i:03}' for i in range(1,502)}
for row in disposition['rows']:
 original=pin(row['originalCapturedFile']).decode().splitlines();assert original[row['original']['line']-1]==row['original']['source']
 backing(row['currentCapturedFile'])
result={'scope':'ROOT_STATIC_COORDINATES_AND_DISPOSITION_BYTES_ONLY_NOT_AST_OR_RUNTIME_QUALIFICATION','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'selectors':seen,'changedCoordinates':changed,'coordinateConvention':'UTF16_CODE_UNITS','originalSiteIDs':501,'heldFiles':len(checked),'checks':checked,'runtime':'UNEXECUTED_HELD','currentCandidateSemanticAcceptance':'NOT_CLAIMED'}
(R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-coordinate-disposition-root-inspection.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='checks'}))
