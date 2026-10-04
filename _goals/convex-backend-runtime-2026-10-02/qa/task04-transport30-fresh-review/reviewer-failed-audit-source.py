import datetime,gzip,hashlib,io,json,os,stat,subprocess,sys,tarfile,traceback
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex')
W=ROOT/'work/resume/task04-transport30-fresh-review'
OUT=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-transport30-fresh-review'
PACK=OUT.parent/'task04-evidence-transport-30'
SRC=OUT.parent/'task04-catalog-release-c4-fresh-review'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
OUT.mkdir(exist_ok=False)
record={'argv':sys.argv,'utcPre':now(),'checks':[],'failures':[],'qualificationAcceptance':False}
def check(name,fn):
    r={'name':name,'utcPre':now()};record['checks'].append(r)
    try:r['result']=fn();r['exitCode']=0
    except BaseException:r['exitCode']=1;r['failure']=traceback.format_exc();record['failures'].append(r['failure']);raise
    finally:r['utcPost']=now();(OUT/'audit-receipt.json').write_text(json.dumps(record,indent=2)+'\n')
def run(name,argv):
    r={'name':name,'argv':argv,'utcPre':now()}
    p=subprocess.run(argv,cwd=ROOT,capture_output=True)
    (OUT/(name+'.stdout')).write_bytes(p.stdout);(OUT/(name+'.stderr')).write_bytes(p.stderr)
    r.update(utcPost=now(),exitCode=p.returncode,stdout=p.stdout.decode(),stderr=p.stderr.decode());record['checks'].append(r)
    assert p.returncode==0,r
    return json.loads(p.stdout)
def file_set(base):
    paths=set()
    for root,dirs,files in os.walk(base,followlinks=False):
        for n in dirs+files:assert not (Path(root)/n).is_symlink()
        for n in files:
            p=Path(root)/n;assert stat.S_ISREG(p.stat().st_mode);paths.add(p.relative_to(base).as_posix())
    return paths
def verify_closure(base,m):
    rows=m['rows'];assert m['excludesOnly']=='qa-manifest.json'
    assert len(rows)==len({r['path'] for r in rows})
    assert file_set(base)=={r['path'] for r in rows}|{'qa-manifest.json'}
    for r in rows:
        b=(base/r['path']).read_bytes();assert r['kind']=='file' and len(b)==r['bytes'] and sha(b)==r['sha256'],r['path']
    return len(rows)
def packet():
    raw=(PACK/'qa-manifest.json').read_bytes()
    assert sha(raw)=='8e0571129a46c31c031a751a6f97d532d54a16e4c9c0de86b72e9a169094f4d8'
    assert sha((PACK/'report.md').read_bytes())=='215a7457f0e769bf61b36adf45bcc86a8bd1b9361fd10a74c3d4043cee8688aa'
    return {'rows':verify_closure(PACK,json.loads(raw)),'manifestSha256':sha(raw)}
check('packet-closure-before',packet)
raw=(SRC/'qa-manifest.json').read_bytes();assert sha(raw)=='0b3f7f43fdfbd1b2e71cb420b7a24d1255773b3ca6973df0775dc4d1c0c5179d'
source_manifest=json.loads(raw)
m=json.loads(gzip.decompress((PACK/'transport-map.json.gz').read_bytes()))
ns={'__name__':'review_helper','__file__':str(PACK/'materialize.py')}
exec(compile((PACK/'materialize.py').read_text(),str(PACK/'materialize.py'),'exec'),ns)
def mapcheck():
    expected=sorted([[r['path'],r['sha256'],r['bytes']] for r in source_manifest['rows']]+[['qa-manifest.json',sha(raw),len(raw)]])
    assert m['files']==expected and len(expected)==63544
    assert len(m['contents'])==436 and len(m['chunks'])==2
    assert set(r[1] for r in expected)==set(m['contents'])
    assert all(m['contents'][r[1]]==r[2] for r in expected)
    assert all('\\' not in r[0] and '\0' not in r[0] and not r[0].startswith('/') and all(c not in ('','.','..') for c in r[0].split('/')) for r in expected)
    stream=b''.join((PACK/c['path']).read_bytes() for c in m['chunks'])
    for c in m['chunks']:
        b=(PACK/c['path']).read_bytes();assert len(b)==c['bytes']<=5242880 and sha(b)==c['sha256']
    assert len(stream)==m['archiveBytes'] and sha(stream)==m['archiveSha256']
    bodies={}
    with tarfile.open(fileobj=io.BytesIO(stream),mode='r:gz') as t:
        for member in t:
            assert member.name not in bodies and member.name in m['contents']
            assert member.type==tarfile.REGTYPE and member.size==m['contents'][member.name] and not member.pax_headers
            b=t.extractfile(member).read();assert sha(b)==member.name and len(b)==member.size;bodies[member.name]=b
    assert set(bodies)==set(m['contents'])
    assert bodies[sha(raw)]==raw
    rebuilt=io.BytesIO()
    with gzip.GzipFile(fileobj=rebuilt,mode='wb',filename='',mtime=0,compresslevel=9) as gz,tarfile.open(fileobj=gz,mode='w|',format=tarfile.USTAR_FORMAT) as t:
        for h,b in sorted(bodies.items()):
            member=tarfile.TarInfo(h);member.size=len(b);member.mode=0o644;member.uid=member.gid=member.mtime=0;member.uname=member.gname='';t.addfile(member,io.BytesIO(b))
    assert rebuilt.getvalue()==stream
    assert gzip.compress(json.dumps(m,separators=(',',':'),ensure_ascii=True).encode(),compresslevel=9,mtime=0)==(PACK/'transport-map.json.gz').read_bytes()
    return {'files':len(expected),'totalOriginalBytes':sum(r[2] for r in expected),'uniqueContents':len(bodies),'maxContentBytes':max(map(len,bodies.values())),'archiveBytes':len(stream),'exactRecompression':True,'mapExactRecompression':True,'unsafeSealedPaths':0}
check('exact-map-archive-determinism',mapcheck)
check('frozen-source-closure-before',lambda:verify_closure(SRC,source_manifest))
replica=W/'replica'
for name,args in [('clean-materialize',['--materialize']),('idempotence',['--materialize']),('read-only',[])]:
    result=run(name,[sys.executable,str(PACK/'materialize.py'),'--target',str(replica),*args])
    assert result['filesVerified']==63544 and result['created']==(63544 if name=='clean-materialize' else 0) and result['qualificationAcceptance'] is False
check('independent-restored-original-closure',lambda:verify_closure(replica,source_manifest))
assert (replica/'qa-manifest.json').read_bytes()==raw
def adverse():
    A=W/'negative';A.mkdir();results=[]
    def reject(name,fn,exc=(ValueError,OSError,tarfile.TarError)):
        r={'name':name,'utcPre':now()};results.append(r)
        try:fn()
        except exc as e:r.update(rejected=True,type=type(e).__name__,message=str(e))
        else:r.update(rejected=False)
        r['utcPost']=now();return r['rejected']
    for path in ('/a','../a','a/../b','a//b','a/./b','a\\\\b'):
        assert reject('unsafe-'+repr(path),lambda path=path:ns['safe'](path))
    # Actual defect assessment: these accepted strings never occur in the pinned map.
    assert ns['safe']('a\\b')=='a\\b';results.append({'name':'single-backslash-validation-gap','accepted':True,'sealedMapAffected':False})
    assert ns['safe']('a\0b')=='a\0b';results.append({'name':'nul-validation-gap','accepted':True,'sealedMapAffected':False})
    target=A/'target';target.mkdir();foreign=target/'foreign';foreign.write_bytes(b'foreign')
    assert reject('exclusive-no-overwrite',lambda:ns['create'](target,'foreign',b'new'))
    assert foreign.read_bytes()==b'foreign'
    assert reject('existing-hash-mismatch',lambda:ns['existing'](target,['foreign','0'*64,7]))
    assert reject('unknown-target-path',lambda:ns['verify_set'](target,[]));assert foreign.read_bytes()==b'foreign'
    outside=A/'outside';outside.mkdir();(target/'link').symlink_to(outside,target_is_directory=True)
    assert reject('symlink-ancestor-write',lambda:ns['create'](target,'link/escape',b'x'))
    assert not (outside/'escape').exists()
    (A/'ancestor').symlink_to(outside,target_is_directory=True)
    assert reject('symlink-target-ancestor',lambda:ns['directory'](A/'ancestor'/'child',True))
    assert not (outside/'child').exists()
    (target/'leaf').symlink_to(foreign)
    assert reject('symlink-file-read',lambda:ns['read_at'](target,'leaf'))
    def malformed(name,names,kind=tarfile.REGTYPE,body=b'x',expected=b'x'):
        d=A/name;d.mkdir();buf=io.BytesIO();h=sha(expected)
        with tarfile.open(fileobj=buf,mode='w') as t:
            for n in names:
                member=tarfile.TarInfo(n);member.type=kind;member.size=len(body) if kind==tarfile.REGTYPE else 0;t.addfile(member,io.BytesIO(body) if member.size else None)
        b=gzip.compress(buf.getvalue(),mtime=0);(d/'part').write_bytes(b)
        mapping={'chunks':[{'path':'part','bytes':len(b),'sha256':sha(b)}],'contents':{h:len(expected)}}
        assert reject(name,lambda:list(ns['entries'](d,mapping)))
    h=sha(b'x')
    malformed('unknown-archive',['../escape']);malformed('duplicate-archive',[h,h]);malformed('link-member',[h],kind=tarfile.SYMTYPE);malformed('hardlink-member',[h],kind=tarfile.LNKTYPE);malformed('missing-member',[]);malformed('content-hash',[h],body=b'z')
    # Failure ownership: inject write failure into a newly owned fixture file only.
    original_write=ns['os'].write
    def failwrite(fd,b):raise OSError('review injected write failure')
    try:
        ns['os'].write=failwrite
        assert reject('write-failure',lambda:ns['create'](target,'owned-partial',b'abc'))
    finally:ns['os'].write=original_write
    assert (target/'owned-partial').read_bytes()==b'' and foreign.read_bytes()==b'foreign'
    results.append({'name':'failure-ownership-observation','ownedPartialFileBytes':0,'foreignFileUnchanged':True,'automaticRollback':False})
    (OUT/'negative-controls.json').write_text(json.dumps(results,indent=2)+'\n')
    return {'expectedRejections':sum(r.get('rejected',False) for r in results),'validationGaps':2,'sealedMapAffected':False,'foreignPreserved':True,'partialOwnedFileRetained':True}
check('independent-negative-controls',adverse)
check('frozen-source-closure-after',lambda:verify_closure(SRC,source_manifest))
check('packet-closure-after',packet)
record['utcPost']=now();record['exitCode']=0
(OUT/'audit-receipt.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
