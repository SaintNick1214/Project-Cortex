import os, sys, json, stat, time, hashlib, traceback

R = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion'
P = R + '/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
J = P + '/task03-f2-inactive-lineage-independent-review1'
F = P + '/task03-attempt6-current-binding-repair2'
fields = ('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
def nine(s): return [str(getattr(s, k)) for k in fields]
def path(p): return p if p.startswith('/') else R + '/' + p
rows = PRELOADED
by = {x['path']:x for x in rows}
events = []
failure = None
close_errors = []
def emit(o): print(json.dumps(o, sort_keys=True), flush=True)
def acquire(specs, stage):
    global failure
    fresh = []
    for spec in specs:
        if isinstance(spec,str): spec={'path':spec}
        p=path(spec['path'])
        if p in by:
            x=by[p]
            if spec.get('sha256'): assert x['sha256']==spec['sha256'], ('reused-hash',p)
            if spec.get('bytes') is not None: assert x['bytes']==spec['bytes'], ('reused-size',p)
            continue
        assert len(rows)<4096, 'source-FD-count'
        pre=os.lstat(p)
        assert stat.S_ISREG(pre.st_mode) and pre.st_nlink==1, ('regular-single-link',p)
        assert time.time_ns()-max(pre.st_mtime_ns,pre.st_ctime_ns)>=60_000_000_000, ('immature',p)
        assert pre.st_size<=16*1024*1024 and sum(x['bytes'] for x in rows)+pre.st_size<=64*1024*1024,'source-byte-ledger'
        fd=os.open(p,os.O_RDONLY | getattr(os,'O_NOFOLLOW',0))
        x={'path':p,'fd':fd,'PRE9':nine(pre),'bytes':pre.st_size,'stage':stage,'openedUnixNs':time.time_ns(),'closeAttempted':False}
        rows.append(x); by[p]=x; fresh.append((x,spec))
        assert nine(os.fstat(fd))==x['PRE9']==nine(os.lstat(p)), ('open-nine',p)
        if spec.get('PRE9') is not None: assert x['PRE9']==[str(v) for v in spec['PRE9']],('original-nine',p)
    events.append({'stage':stage,'allFDsBeforeStageContent':True,'newFiles':len(fresh),'unionFiles':len(rows),'unionBytes':sum(x['bytes'] for x in rows)})
    for x,spec in fresh:
        pieces=[]
        while True:
            z=os.read(x['fd'],1048576)
            if not z: break
            pieces.append(z)
        x['body']=b''.join(pieces); x['fullEOF']=True
        x['sha256']=hashlib.sha256(x['body']).hexdigest()
        assert len(x['body'])==x['bytes'], ('EOF-size',x['path'])
        if spec.get('sha256'): assert x['sha256']==spec['sha256'], ('original-hash',x['path'])
        if spec.get('bytes') is not None: assert x['bytes']==spec['bytes'], ('original-size',x['path'])
        assert nine(os.fstat(x['fd']))==x['PRE9']==nine(os.lstat(x['path'])), ('post-read-nine',x['path'])
def doc(p): return json.loads(by[path(p)]['body'])
def brief(v):
    if isinstance(v,dict): return {k:(len(z) if isinstance(z,list) else list(z) if isinstance(z,dict) else z) for k,z in v.items()}
    return {'type':type(v).__name__,'count':len(v)}
def final_nine():
    faults=[]
    for x in rows:
        try:
            x['FINAL9']=nine(os.fstat(x['fd'])); x['PATHFINAL9']=nine(os.lstat(x['path']))
            if x['PRE9']!=x['FINAL9'] or x['PRE9']!=x['PATHFINAL9']: faults.append({'path':x['path'],'reason':'nine-drift','PRE9':x['PRE9'],'FINAL9':x['FINAL9'],'PATHFINAL9':x['PATHFINAL9']})
        except BaseException as e: faults.append({'path':x['path'],'reason':repr(e)})
    assert not faults, faults
try:
    acquire([{'path':F+'/inactive-source-histories-proposal2.json','bytes':86994,'sha256':'5069e9019dbc96dc7aee7834cde985841acf69854f4fa35ed3bde0d330eb412e'},P+'/root-task03-u3-reject-and-source-nonuse-proposal-mature-readback1.json'],'declared-document-bootstrap')
    proposal=doc(F+'/inactive-source-histories-proposal2.json')
    emit({'proposal':brief(proposal),'rootReceipt':doc(P+'/root-task03-u3-reject-and-source-nonuse-proposal-mature-readback1.json')})
    mf=[F+'/new-bounded-private-native-reader3/shared-source-epoch3/source-inputs-plan.json', F+'/root-source-stack-controls1/source-inputs-plan.json',P+'/task03-attempt6-actual-public-custody-readiness-repair3/closed-source-manifest.json']
    acquire(proposal['consumers'] + mf,'finite-listed-consumers-and-three-manifests')
    emit({'ready':True,'files':len(rows),'bytes':sum(x['bytes'] for x in rows),'manifestKeys':{p:brief(doc(p)) for p in mf}})
    for line in sys.stdin:
        req=json.loads(line); op=req['op']; events.append({'request':req,'atUnixNs':time.time_ns()})
        if op=='show':
            out={}
            for p in req['paths']:
                p=path(p); txt=by[p]['body'].decode()
                if req.get('lines'):
                    a,b=req['lines']; txt='\n'.join('%d: %s'%(i+1,z) for i,z in enumerate(txt.splitlines()) if a<=i+1<=b)
                out[p]=txt
            emit(out)
        elif op=='summary': emit({p:brief(doc(p)) for p in req['paths']})
        elif op=='add': acquire(req['specs'],'adaptive-dependency-batch'); emit({'files':len(rows),'bytes':sum(x['bytes'] for x in rows)})
        elif op=='search':
            import re
            rg=re.compile(req['pattern']); out={}
            for p in req.get('paths',list(by)):
                p=path(p)
                try: txt=by[p]['body'].decode()
                except UnicodeDecodeError: continue
                found=['%d: %s'%(i+1,z) for i,z in enumerate(txt.splitlines()) if rg.search(z)]
                if found: out[p]=found
            emit(out)
        elif op=='analyze':
            namespace={'rows':rows,'by':by,'proposal':proposal,'doc':doc,'path':path,'json':json,'os':os,'emit':emit,'mf':mf}
            exec(req['code'],namespace)
        elif op=='close':
            final_nine(); emit({'closing':True,'finalNinePass':True}); break
        else: raise ValueError(op)
        final_nine()
except BaseException as e:
    failure={'error':repr(e),'traceback':traceback.format_exc()}
    emit({'failure':failure})
finally:
    final_fault=None
    try: final_nine()
    except BaseException as e: final_fault=repr(e)
    for x in rows:
        assert not x['closeAttempted']
        x['closeAttempted']=True
        try: os.close(x['fd']); x['closeResult']='closed'
        except BaseException as e: x['closeResult']=repr(e); close_errors.append({'path':x['path'],'error':repr(e)})
    result={'scope':'BOUNDED_STATIC_NONUSE_PROPOSAL_ONLY','effects':0,'sourceEligibility':False,'failure':failure,'finalFailure':final_fault,'closeErrors':close_errors,'files':len(rows),'bytes':sum(x['bytes'] for x in rows),'sourceLedgerCaps':{'files':4096,'bytes':67108864,'perFile':16777216},'events':events,'inputs':[{k:v for k,v in x.items() if k not in ('fd','body')} for x in rows],'setupNonqualifyingRead':'Initial rg emitted proposal content before this distinct qualifying interval; that output is not custody evidence.'}
    out=J+'/held-static-inspection-receipt1.json'
    with open(out,'x') as f: json.dump(result,f,sort_keys=True,separators=(',',':')); f.write('\n')
    emit({'receipt':out,'files':len(rows),'closeAttempts':sum(x['closeAttempted'] for x in rows),'failure':failure,'finalFailure':final_fault,'closeErrors':close_errors})
