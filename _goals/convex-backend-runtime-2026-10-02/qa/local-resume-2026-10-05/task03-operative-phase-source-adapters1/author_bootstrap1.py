"""Exact finite native author entry; SOURCE/mock only, never Root authority."""
import hashlib,json,os,stat,sys,time,types
from pathlib import Path
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(s):return {k:str(getattr(s,'st_'+k)) for k in FIELDS}
request_raw=sys.stdin.buffer.read(32770)
if len(request_raw)>32769:raise RuntimeError('original_stdin_cap')
request=json.loads(request_raw);owned=[];raws={};errors=[];attempts=[]
try:
    if set(request)!= {'headers','output'} or len(request['headers'])!=3:raise RuntimeError('exact_three_headers')
    for row in request['headers']:
        path=row['path'];s=os.lstat(path)
        if (nine(s)!=row['PRE9'] or not stat.S_ISREG(s.st_mode) or s.st_nlink!=1
                or time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns)<240000000000):
            raise RuntimeError('header_original9_or240_maturity_denial')
        fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
        try:owned.append((path,fd,row))
        except BaseException as primary:
            try:os.close(fd);error=None
            except BaseException as close:error=repr(close)
            attempts.append({'path':path,'attempt':1,'error':error,'registrationFallback':True})
            if error:errors.append(error)
            raise primary
        if nine(os.fstat(fd))!=row['PRE9']:raise RuntimeError('header_OPEN9_denial')
    for path,fd,row in owned:
        raw=b'';offset=0
        while True:
            part=os.pread(fd,65536,offset)
            if not part:break
            offset+=len(part);raw+=part
            if offset>row['bytes'] or offset>16777216:raise RuntimeError('header_size_cap')
        if (len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']
                or nine(os.fstat(fd))!=row['PRE9'] or nine(os.lstat(path))!=row['PRE9']):
            raise RuntimeError('header_EOF_hash_original9_denial')
        raws[row['role']]=raw
    module=types.ModuleType('operative_source_author_held_actor');sys.modules[module.__name__]=module
    exec(compile(raws['actor'],'held_control_actor1.py','exec',dont_inherit=True),module.__dict__)
    result=module.run(owned,raws['plan'],raws['stop'],request['output'])
    print(json.dumps({'scope':'AUTHOR_SOURCE_MOCK_ONLY','PASS':result['PASS'],'FAIL':result['FAIL'],
                      'heldCount':result['bootstrapAndWholeInputFDCount'],'minimumCaptureAgeNs':result['minimumCaptureAgeNs'],
                      'sourceMemberBytes':result['sourceMemberBytes'],'sourceEligibility':False,'effects':0}))
except BaseException as error:
    errors.append(repr(error))
    raise
finally:
    detached=tuple(owned);owned.clear()
    for path,fd,row in detached:
        try:os.close(fd);error=None
        except BaseException as failure:error=repr(failure);errors.append(error)
        attempts.append({'path':path,'attempt':1,'error':error})
    if errors:
        Path(request['output'],'author-bootstrap-failure1.json').write_text(json.dumps(
            {'scope':'AUTHOR_BOOTSTRAP_FAILED_NO_PIN_REFRESH','errors':errors,'closeAttempts':attempts,
             'sourceEligibility':False,'effects':0},indent=2)+'\n')
