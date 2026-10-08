import copy,hashlib,importlib.util,json,os,stat,struct,zlib
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');T=Path('/tmp/cortex-evidence-transport-c4-c1/adversarial');T.mkdir(exist_ok=False)
spec=importlib.util.spec_from_file_location('helper',Q/'materialize.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
results=[]
def reject(name,fn):
 try:fn()
 except (ValueError,OSError,UnicodeError,KeyError) as e:results.append({'control':name,'expected':'reject','observed':'reject','reason':str(e)});return
 raise AssertionError(name+' accepted')
def ok(name,fn):fn();results.append({'control':name,'expected':'pass','observed':'pass'})
root=h.ROOTS[0];base=T/'small';base.mkdir();path=root+'/fixture';data=b'proof';row={'path':path,'kind':'file','mode':0o600,'bytes':len(data),'sha256':h.sha(data)}
ok('exact-exclusive-create',lambda:h.create(base,row,data));ok('exact-read-and-unique-nlink-mode',lambda:h.present(base,row));reject('exclusive-collision-no-overwrite',lambda:h.create(base,row,data));assert (base/path).read_bytes()==data
wrong={**row,'sha256':h.sha(b'other')};reject('existing-wrong-hash',lambda:h.present(base,wrong));wrong={**row,'mode':0o644};reject('existing-wrong-mode',lambda:h.present(base,wrong));wrong={**row,'bytes':4};reject('pre-fstat-size',lambda:h.present(base,wrong))
for pathvalue in ['../escape','/absolute','a\\b','a\0b',root+'/../escape','other/file']:
 reject('unsafe-path-'+repr(pathvalue),lambda p=pathvalue:h.create(base,{**row,'path':p},data))
# Actual byte literals, including an absolute broken private-looking target, never follow.
literal=b'/ABSENT-NEGATIVE-FIXTURE/no-read';link={**row,'path':root+'/terminal-link','kind':'literal-symlink','bytes':len(literal),'sha256':h.sha(literal),'targetHex':literal.hex(),'mode':0o777}
ok('literal-absolute-broken-link-create',lambda:h.create(base,link));ok('literal-absolute-broken-link-verify',lambda:h.present(base,link));assert os.readlink(os.fsencode(base/link['path']))==literal
reject('terminal-link-as-ancestor',lambda:h.create(base,{**row,'path':link['path']+'/child'},data));reject('regular-versus-link-collision',lambda:h.present(base,{**row,'path':link['path']}));reject('link-literal-mismatch',lambda:h.present(base,{**link,'targetHex':b'wrong'.hex()}))
# A symlink in every absolute target-base ancestor is denied.
foreign=T/'foreign';foreign.mkdir();alias=T/'ancestor-alias';alias.symlink_to(foreign,target_is_directory=True)
reject('absolute-ancestral-symlink',lambda:h.create(alias,row,data));assert not list(foreign.iterdir())
# Existing hardlinks are rejected, source transport never hardlinks.
os.link(base/path,base/(root+'/hardlink'))
reject('nlink2-idempotence-denied',lambda:h.present(base,row))
# Fault the positive bounded write loop. Positive partial writes must complete; zero/oversize/error fail.
write=h.os.write
for name,fault in [('zero-write',lambda fd,b:0),('invalid-negative-write',lambda fd,b:-1),('invalid-oversize-write',lambda fd,b:len(b)+1),('write-error',lambda fd,b:(_ for _ in ()).throw(OSError('INJECTED')) )]:
 r={**row,'path':root+'/'+name};h.os.write=fault
 try:reject(name,lambda r=r:h.create(base,r,data))
 finally:h.os.write=write
 assert (base/r['path']).exists();assert (base/r['path']).stat().st_size==0
r={**row,'path':root+'/positive-partial-write'};h.os.write=lambda fd,b:write(fd,b[:1])
try:ok('positive-partial-write-completes',lambda:h.create(base,r,data))
finally:h.os.write=write
# Read faults occur after exact fstat, bounded requests never exceed remaining plus sentinel.
read=h.os.read
for name,fault in [('short-read',lambda fd,n:b''),('oversize-read',lambda fd,n:b'x'*(n+1))]:
 h.os.read=fault
 try:reject(name,lambda:h.exactread(base,r['path'],5,r['sha256']))
 finally:h.os.read=read
calls=0
def grow(fd,n):
 global calls
 calls+=1
 if calls==2:return b'X'
 return read(fd,n)
h.os.read=grow
try:reject('growth-after-fstat',lambda:h.exactread(base,r['path'],5,r['sha256']))
finally:h.os.read=read
# Encoded streams: bombs, truncation, trailing gzip members/bytes, missing data all deny.
def enc(b):return zlib.compress(b,wbits=31)
ok('decoded-exact-boundary',lambda:(lambda d:(d.read(5),d.finish()))(h.Decode([enc(data)],5)))
reject('decoded-max-plus-one',lambda:(lambda d:d.read(5))(h.Decode([enc(data+b'x')],5)))
reject('decoded-bomb',lambda:(lambda d:d.read(1))(h.Decode([enc(b'A'*1000000)],5)))
reject('gzip-trailing-bytes',lambda:(lambda d:(d.read(5),d.finish()))(h.Decode([enc(data)+b'TRAIL'],5)))
reject('gzip-concatenated-member',lambda:(lambda d:(d.read(5),d.finish()))(h.Decode([enc(data)+enc(b'')],5)))
reject('truncated-gzip',lambda:(lambda d:(d.read(5),d.finish()))(h.Decode([enc(data)[:-4]],5)))
reject('missing-decoded-byte',lambda:(lambda d:d.read(6))(h.Decode([enc(data)],6)))
reject('extra-encoded-part',lambda:(lambda d:(d.read(5),d.finish()))(h.Decode([enc(data),b'x'],5)))
reject('unbounded-decoded-read',lambda:h.Decode([enc(data)],5).read(-1))
# Frozen index verifies before mapping or target writes.
packet=T/'corrupt-packet';packet.mkdir();(packet/'index.json').write_bytes(b'X'*h.INDEX_LIMIT)
reject('corrupt-index-before-target',lambda:h.load(packet));assert not (T/'must-not-create').exists()
idx,m,rows,byhash=h.load(Q)
for name,mut in [('duplicate-path',lambda v:v['files'].append(v['files'][0])),('path-escape',lambda v:v['files'][0].update(path='../escape')),('unknown-kind',lambda v:v['files'][0].update(kind='fifo')),('over-object-cap',lambda v:v['files'][0].update(bytes=h.OBJECT_LIMIT+1)),('wrong-content-hash',lambda v:v['files'][0].update(sha256='0'*64))]:
 v=copy.deepcopy(m);mut(v);reject(name,lambda v=v:h.validate_map(v))
# Production object parser exercised with fixture-derived exact trusted ceilings.
origparts=h.Parts;origcap=h.STREAM_LIMIT
key=h.sha(data);body=key.encode()+struct.pack('>Q',5)+data;fixture={'contents':{key:5}}
def runbody(raw,cap,contents=fixture):
 h.STREAM_LIMIT=cap;h.Parts=lambda base,parts:[enc(raw)]
 try:list(h.objects(Q,{'archiveParts':[]},contents))
 finally:h.Parts=origparts;h.STREAM_LIMIT=origcap
ok('raw-object-exact-boundary',lambda:runbody(body,len(body)))
reject('raw-unknown-member',lambda:runbody(b'0'*64+body[64:],len(body)))
reject('raw-member-size',lambda:runbody(key.encode()+struct.pack('>Q',6)+data,len(body)))
reject('raw-object-hash-corruption',lambda:runbody(body[:-1]+b'X',len(body)))
reject('raw-trailing-member',lambda:runbody(body+body,len(body)))
other=h.sha(b'other');dupecontents={'contents':{key:5,other:5}}
reject('raw-duplicate-member',lambda:runbody(body+body,2*len(body),dupecontents))
reject('raw-missing-member',lambda:runbody(body,2*len(body),dupecontents))
(Q/'adversarial-results.json').write_text(json.dumps({'controls':results,'total':len(results),'status':'PASS','fixtures':'OWN/tmp retained; partial writes deliberately retained; injected bounded unit faults not native execution'},indent=2)+'\n')
print(json.dumps({'adversarialControls':len(results),'status':'PASS'}))
