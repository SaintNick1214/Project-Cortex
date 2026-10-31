import os, sys, json, hashlib, stat, time
from pathlib import Path

OWN = Path(__file__).resolve().parent
P = OWN.parent
N = P / 'task04-current-producer-native-public-repair1'
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
HELD = {}
ROWS = {}
ERRORS = []

def identity(s):
    return {k: str(getattr(s, 'st_' + k)) for k in FIELDS}

def save(name, data):
    path = OWN / name
    with path.open('x') as f:
        json.dump(data, f, sort_keys=True, indent=2)
        f.write('\n')

def content(fd):
    os.lseek(fd,0,0)
    h=hashlib.sha256(); parts=[]; count=0
    while True:
        b=os.read(fd,65536)
        if not b: break
        parts.append(b); h.update(b); count+=len(b)
    return b''.join(parts),h.hexdigest(),count

def pinread(rel, digest, size):
    path=N/rel
    pre=identity(os.lstat(path)); fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    op=identity(os.fstat(fd)); b,h,n=content(fd); post=identity(os.fstat(fd)); final=identity(os.lstat(path))
    if not stat.S_ISREG(os.fstat(fd).st_mode) or op['nlink']!='1' or not pre==op==post==final or h!=digest or n!=size:
        raise RuntimeError('closed-metadata-pin-failure:'+rel)
    HELD[str(path)]=fd
    ROWS[str(path)]={'path':str(path),'PRE':pre,'OPEN':op,'POST':post,'pathFINAL':final,'bytes':n,'sha256':h,'EOF':True,'kind':'literal-closed-metadata-pin'}
    return json.loads(b)

def capture():
    handoff=pinread('closed-handoff.json','7fb1ec006b4c5a517e0ff263f6fd85a9235066d76d2cd332ab9876e19707ce66',4922)
    metadata={}
    for row in handoff['exactPins']:
        rel=row['path']
        if rel=='source/source-manifest.json': continue
        metadata[rel]=pinread(rel,row['sha256'],row['bytes']) if rel.endswith('.json') else None
    base=metadata['evidence/source-baseline1.json']
    ext=metadata['evidence/external-current1.json']
    packet=metadata['packet-manifest1.json']
    closed=metadata['final-current-closure.json']
    cohorts=[('prospective-source-113',base['files']),('old-external-336',ext['files']),('closed-packet-286',packet['files']),('prior-review-metadata',ext['priorRejectedReviewMetadata']),('root-books',closed['rootBooks'])]
    expected={}; kinds={}
    for kind,files in cohorts:
        for row in files:
            path=row['path']; e={'nine':row['PRE'],'sha256':row['sha256'],'bytes':row['bytes']}
            if path in expected and expected[path]!=e: raise RuntimeError('conflicting-literal-pins:'+path)
            expected[path]=e; kinds.setdefault(path,[]).append(kind)
    # ALL source and other prospective cohort metadata are opened/fenced before any qualifying source contents.
    initial={}; aliases={}
    for path,e in expected.items():
        pre=identity(os.lstat(path))
        fd=HELD.get(path)
        if fd is None: fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW); HELD[path]=fd
        s=os.fstat(fd); op=identity(s)
        initial[path]={'PRE':pre,'OPEN':op}
        if not stat.S_ISREG(s.st_mode) or s.st_nlink!=1: ERRORS.append({'path':path,'stage':'PRE','error':'not-regular-noalias'})
        if pre!=e['nine'] or op!=e['nine']: ERRORS.append({'path':path,'stage':'PRE','error':'literal-nine-mismatch','expected':e['nine'],'actual':initial[path]})
        alias=(s.st_dev,s.st_ino)
        if alias in aliases and aliases[alias]!=path: ERRORS.append({'path':path,'stage':'PRE','error':'inode-alias','other':aliases[alias]})
        aliases[alias]=path
    save('evidence/first-metadata-before-source-contents1.json',{'scope':'FINITE_LITERAL_CURRENT_REGULAR_FILES_ONLY','sourceCount':113,'externalCount':336,'metadata':initial,'errors':ERRORS.copy(),'sourceContentsReadForQualification':False})
    for index,(path,e) in enumerate(expected.items()):
        fd=HELD[path]; b,h,n=content(fd); post=identity(os.fstat(fd)); final=identity(os.lstat(path))
        row={'path':path,**initial[path],'POST':post,'pathFINAL':final,'bytes':n,'sha256':h,'EOF':True,'kind':kinds[path]}
        if post!=e['nine'] or final!=e['nine'] or h!=e['sha256'] or n!=e['bytes']: ERRORS.append({'path':path,'stage':'FIRST_EOF','error':'literal-pin-mismatch','expected':e,'actual':row})
        row['backing']='raw/'+str(index).zfill(4)
        with (OWN/row['backing']).open('xb') as f: f.write(b)
        ROWS[path]=row
    for e in handoff['exactPins']:
        path=str(N/e['path']); row=ROWS.get(path)
        if row is None or row['sha256']!=e['sha256'] or row['bytes']!=e['bytes']:
            ERRORS.append({'path':path,'stage':'CLOSED_EXACT_MAP','error':'missing-or-byte-pin-mismatch','expected':e})
    setup=str(OWN/'hold-review.py')
    pre=identity(os.lstat(setup)); fd=os.open(setup,os.O_RDONLY|os.O_NOFOLLOW); HELD[setup]=fd
    b,h,n=content(fd); op=identity(os.fstat(fd)); final=identity(os.lstat(setup))
    if pre!=op or op!=final: ERRORS.append({'path':setup,'stage':'OWN_SETUP_PRE','error':'nine-mismatch'})
    ROWS[setup]={'path':setup,'PRE':pre,'OPEN':op,'POST':op,'pathFINAL':final,'bytes':n,'sha256':h,'EOF':True,'kind':'mature-own-setup-first-observation'}
    save('evidence/first-prospective-held-source-external1.json',{'scope':'CURRENT_NON_ENABLING_REGULAR_FILES_ONLY','heldCount':len(HELD),'sourceCount':113,'externalCount':336,'files':list(ROWS.values()),'errors':ERRORS.copy(),'historicalCustodyRepaired':False,'nativeExecuted':False,'enclosingMacSealAttempted':False})
    print(json.dumps({'capture':'PASS' if not ERRORS else 'FAIL','heldCount':len(HELD),'errors':ERRORS,'sourceCount':113,'externalCount':336}),flush=True)

def close():
    final=[]; closes=[]; errors=ERRORS.copy()
    for path,fd in HELD.items():
        e=ROWS[path]; before=identity(os.fstat(fd)); b,h,n=content(fd); after=identity(os.fstat(fd))
        try: current=identity(os.lstat(path))
        except BaseException as ex: current={'error':repr(ex)}
        row={'path':path,'heldBEFORE':before,'heldFINAL':after,'pathFINAL':current,'bytes':n,'sha256':h,'EOF':True}
        if before!=e['PRE'] or after!=e['PRE'] or current!=e['PRE'] or h!=e['sha256'] or n!=e['bytes']: errors.append({'path':path,'stage':'FINAL','error':'held-or-path-or-byte-pin-mismatch','actual':row,'expected':e})
        final.append(row)
        try: ret=os.close(fd); closes.append({'path':path,'return':ret})
        except BaseException as ex: closes.append({'path':path,'error':repr(ex)}); errors.append({'path':path,'stage':'CLOSE','error':repr(ex)})
    save('evidence/final-held-source-external-FDclosure1.json',{'scope':'FINITE_HELD_CURRENT_REGULAR_FILES_ONLY','status':'PASS' if not errors else 'FAIL','files':final,'FDCloses':closes,'errors':errors,'historicalCustodyRepaired':False,'nativeAuthority':False})
    print(json.dumps({'final':'PASS' if not errors else 'FAIL','count':len(final),'FDCloses':len(closes),'errors':errors}),flush=True)

print(json.dumps({'ready':True,'own':str(OWN),'metadataBeforeSourceContents':True}),flush=True)
for line in sys.stdin:
    try:
        command=json.loads(line)
        if command=='capture': capture()
        elif command=='close': close(); break
        else: print(json.dumps({'error':'invalid-command'}),flush=True)
    except BaseException as ex:
        save('evidence/failed-first-capture1.json',{'error':repr(ex),'heldCount':len(HELD),'errors':ERRORS,'failedPINRefreshed':False})
        print(json.dumps({'FAILED':repr(ex),'heldCount':len(HELD)}),flush=True)
        break
