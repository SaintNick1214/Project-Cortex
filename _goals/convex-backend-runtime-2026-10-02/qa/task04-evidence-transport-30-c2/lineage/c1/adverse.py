import importlib.util,io,tarfile,gzip,hashlib,json,datetime,sys,os
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex');OUT=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30';W=ROOT/'work/resume/task04-evidence-transport-30/adverse';W.mkdir()
spec=importlib.util.spec_from_file_location('helper',OUT/'materialize.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
result={'argv':sys.argv,'utcPre':now(),'expectedRejections':[],'unexpectedFailures':[]}
def rejects(name,fn):
 pre=now()
 try:fn()
 except (ValueError,OSError,tarfile.TarError) as e:result['expectedRejections'].append({'name':name,'utcPre':pre,'utcPost':now(),'type':type(e).__name__,'message':str(e)})
 else:raise AssertionError('unexpected acceptance: '+name)
def archive_test(name,names,body=b'ok',expected_body=b'ok',kind=tarfile.REGTYPE):
 d=W/name;d.mkdir();raw=io.BytesIO()
 with tarfile.open(fileobj=raw,mode='w') as t:
  for n in names:
   m=tarfile.TarInfo(n);m.type=kind;m.size=len(body) if kind==tarfile.REGTYPE else 0;t.addfile(m,io.BytesIO(body) if m.size else None)
 b=gzip.compress(raw.getvalue(),mtime=0);(d/'part').write_bytes(b);digest=hashlib.sha256(expected_body).hexdigest();mapping={'chunks':[{'path':'part','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}],'contents':{digest:len(expected_body)}}
 rejects(name,lambda:list(h.entries(d,mapping)))
try:
 for p in ('../outside','/absolute','a/../b','a//b','a\\b','a/./b'):
  rejects('unsafe:'+p,lambda p=p:h.safe(p))
 target=W/'original';target.mkdir();(target/'present').write_bytes(b'ok');row=['present',hashlib.sha256(b'ok').hexdigest(),2]
 assert h.existing(target,row)
 rejects('exclusive-create-existing-same-content',lambda:h.create(target,'present',b'ok'));assert (target/'present').read_bytes()==b'ok'
 rejects('existing-content-mismatch',lambda:h.existing(target,['present','0'*64,2]));assert (target/'present').read_bytes()==b'ok'
 outside=W/'outside';outside.mkdir();(target/'link').symlink_to(outside,target_is_directory=True)
 rejects('symlink-ancestor',lambda:h.create(target,'link/escape',b'ok'));assert not (outside/'escape').exists()
 (target/'filelink').symlink_to(target/'present');rejects('symlink-file',lambda:h.existing(target,['filelink',row[1],2]))
 digest=hashlib.sha256(b'ok').hexdigest()
 archive_test('unknown-entry',['unknown']);archive_test('duplicate-entry',[digest,digest]);archive_test('hash-mismatch',[digest],body=b'NO');archive_test('symlink-entry',[digest],kind=tarfile.SYMTYPE);archive_test('missing-entry',[])
 result['exitCode']=0
except BaseException as e:result['unexpectedFailures'].append(repr(e));result['exitCode']=1
result['utcPost']=now();(OUT/'adverse-receipt.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));sys.exit(result['exitCode'])
