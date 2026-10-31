"""Independent finite U2 review reader; no Docker/private/service/target dispatch."""
import hashlib,json,math,os,stat,sys,time
from pathlib import Path
J=Path(__file__).resolve().parent;P=J.parent;R=P.parents[3]
ROOT=P/'root-task03-attempt6-highfd-public-repair2-closed-mature-readback1.json'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
HELD=[];DATA={};ROWS={};TOTAL=0;SEEN={};PEAK=0
def ident(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def strict(raw):
    def pairs(items):
        out={}
        for k,v in items:
            if k in out:raise ValueError('DUPLICATE_KEY')
            out[k]=v
        return out
    def floating(token):
        v=float(token)
        if not math.isfinite(v):raise ValueError('NONFINITE_JSON')
        return v
    def constant(token):raise ValueError('NONFINITE_JSON')
    return json.loads(raw,object_pairs_hook=pairs,parse_float=floating,parse_constant=constant)
def send(value):print(json.dumps(value,sort_keys=True),flush=True)
def write(name,value):
    raw=value if isinstance(value,bytes)else(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode();assert len(raw)<=16777216
    path=J/name;path.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(path,os.O_RDWR|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        view=memoryview(raw)
        while view:n=os.write(fd,view);assert n>0;view=view[n:]
        os.fsync(fd);pin=ident(os.fstat(fd));os.lseek(fd,0,0);got=[]
        while b:=os.read(fd,65536):got.append(b)
        assert b''.join(got)==raw and ident(os.fstat(fd))==pin and ident(path.lstat())==pin
    finally:ret=os.close(fd)
    return {'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'closeReturn':ret,'selfExcludedUpstream':True,'writeReadbackNotFutureInputPin':True}
def opens(paths,pins=None):
    global TOTAL,PEAK
    new=[]
    for path in paths:
        path=Path(path);assert path.is_absolute()and path.resolve()==path
        key=str(path)
        if key in ROWS:continue
        before=ident(path.lstat());age=time.time_ns()-max(int(before['mtime_ns']),int(before['ctime_ns']))
        assert age>=60000000000 and before['nlink']=='1'and stat.S_ISREG(int(before['mode']))and int(before['size'])<=16777216
        if pins and key in pins:assert before==pins[key]['PRE9'],'UNCHANGED_ROOT_FIRST_NINE:'+key
        assert len(HELD)<4096 and TOTAL+int(before['size'])<=67108864
        inode=(before['dev'],before['ino']);assert inode not in SEEN or SEEN[inode]==key
        fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);entry={'path':key,'heldFD':fd,'PRE':before,'ageNsAtFirstOpen':age};HELD.append(entry);new.append(entry)
        TOTAL+=int(before['size']);PEAK=max(PEAK,len(HELD));SEEN[inode]=key;entry['OPEN']=ident(os.fstat(fd));assert entry['OPEN']==before
    return new
def read(entry,pin=None):
    fd=entry['heldFD'];os.lseek(fd,0,0);parts=[];size=0;h=hashlib.sha256()
    while b:=os.read(fd,65536):size+=len(b);assert size<=16777216;h.update(b);parts.append(b)
    assert size==int(entry['PRE']['size'])and ident(os.fstat(fd))==entry['PRE']and ident(os.lstat(entry['path']))==entry['PRE']
    row={**entry,'POST':ident(os.fstat(fd)),'heldFINAL':ident(os.fstat(fd)),'pathFINAL':ident(os.lstat(entry['path'])),'bytes':size,'sha256':h.hexdigest(),'EOF':True}
    if pin:assert (size,h.hexdigest())==(pin['bytes'],pin['sha256']),'UNCHANGED_ROOT_CONTENT:'+entry['path']
    raw=b''.join(parts);DATA[entry['path']]=raw;ROWS[entry['path']]=row;return row,raw
def final():
    out=[]
    for entry in HELD:
        prior=ROWS[entry['path']];row,_=read(entry,prior);assert row['PRE']==prior['PRE'];out.append(row)
    return out
def closes():
    done=[];bad=[]
    for entry in HELD:
        fd=entry.pop('heldFD',None)
        if fd is None:continue
        try:done.append({'path':entry['path'],'fd':fd,'closeReturn':os.close(fd)})
        except BaseException as e:bad.append({'path':entry['path'],'fd':fd,'failure':repr(e),'retryForbidden':True})
    if bad:raise RuntimeError('OWNED_CLOSE_FAILURE_STICKY:'+repr(bad))
    return done
try:
    # Finite root header precedes the complete source graph; same ledger continues.
    root=opens([ROOT])[0];row,raw=read(root,{'bytes':47005,'sha256':'0df4f88dc6e5e7de755d2dc6a0969e8626e0eb5178e8301fa60b15d1354ed31f'})
    reference=strict(raw);pins={r['path']:r for r in reference['files']};assert len(pins)==68
    pending=opens(sorted(pins),pins)
    for entry in pending:read(entry,pins[entry['path']])
    write('first-root68-source-readback.json',{'files':[ROWS[p]for p in sorted(ROWS)],'all68FDsBeforeSourceContents':True,'rootFirstPinsUnchanged':True,'rootReceipt':row,'aggregateLedger':{'paths':len(ROWS),'bytes':TOTAL,'peakFDs':PEAK},'sourceOnly':True,'actualNativeAccepted':False,'independentImplementationOwnership':True,'agentReuseDueToThreadLimit':True})
    send({'ready':True,'held':len(HELD),'bytes':TOTAL,'members':sorted(pins)})
    for line in sys.stdin:
        request=strict(line);op=request['op']
        if op=='read':
            for path in request['paths']:
                assert path in DATA;send({'path':path,'bytes':len(DATA[path]),'text':DATA[path].decode()})
        elif op=='add':
            fresh=opens(request['paths']);mapping=request.get('pins',{})
            for entry in fresh:read(entry,mapping.get(entry['path']))
            send({'added':len(fresh),'held':len(HELD),'bytes':TOTAL})
        elif op=='controls':
            path=request['path'];fresh=opens([path])
            for entry in fresh:read(entry)
            g={'__file__':path,'__name__':'independent_u2_source_host_controls','DATA':DATA,'ROWS':ROWS,'REVIEW_DIR':J,'MAX_OWNED_FDS_AVAILABLE':4096-len(HELD),'strict_review':strict}
            exec(compile(DATA[path],path,'exec'),g);result=g['RESULT'];write(request['output'],result);send(result)
        elif op=='publish':
            final_rows=final()
            write('report.md',request['report'].encode());write('verdict.json',request['verdict'])
            final_rows=final();done=closes()
            write('held-through-report-final-FDclosure.json',{'files':final_rows,'FDCloses':done,'allFinalFullEOFHashNine':True,'allExplicitCloseReturnsObserved':True,'aggregateLedger':{'paths':len(ROWS),'bytes':TOTAL,'peakFDs':PEAK},'allOwnOutputsSelfExcludedUpstream':True,'runtimeAuthority':False})
            write('writer-stop.json',{'writersStopped':True,'stopTimeNs':time.time_ns(),'ownOutputsRequireLaterDistinctMatureFirstConsumer':True,'scope':'ALL_INDEPENDENT_U2_REVIEW_SOURCE_CONTROL_REPORT_CLOSURE_OUTPUT_WRITERS','noNativeAuthority':True})
            send({'closed':True,'files':len(final_rows),'bytes':TOTAL});break
        else:raise ValueError('UNKNOWN_FINITE_REVIEW_OP')
except BaseException as primary:
    try:done=closes()
    except BaseException as cleanup:raise cleanup from primary
    write('review-reader-error.json',{'failure':repr(primary),'FDCloses':done,'sourceEligibility':False,'runtimeAuthority':False})
    raise
