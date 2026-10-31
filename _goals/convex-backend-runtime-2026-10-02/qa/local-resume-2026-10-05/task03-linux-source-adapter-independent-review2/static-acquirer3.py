"""Finite independent staged source discovery; no candidate code execution."""
import hashlib,json,os,stat,time,traceback
from pathlib import Path
J=Path(__file__).parent
L=J.parent/'task03-u4-linux-prospective-source-qualification-repair2'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(s):return {k:str(getattr(s,'st_'+k)) for k in FIELDS}
def read(fd):
    chunks=[];offset=0
    while True:
        b=os.pread(fd,65536,offset)
        if not b:break
        offset+=len(b)
        if offset>16777216:raise ValueError('FILE_CAP')
        chunks.append(b)
    return b''.join(chunks)
held=[];bodies={};events=[];final=[];closes=[];primary=None;summary={}
def open_group(rows):
    new=[]
    for row in rows:
        path=row['path'];pin=row.get('PRE9') or nine(os.lstat(path))
        if nine(os.lstat(path))!=pin:raise ValueError(('PRE_NINE_CHANGED',path))
        if pin['uid']!='501' or pin['gid']!='20' or pin['nlink']!='1' or not stat.S_ISREG(int(pin['mode'])):raise ValueError('OWNER_OR_KIND')
        age=(time.time_ns()-max(int(pin['mtime_ns']),int(pin['ctime_ns'])))/1e9
        if age<240:raise ValueError(('CURRENT_MATURITY',path,age))
        if len(held)>=4096 or sum(x['bytes'] for x in held)+row['bytes']+23000000+2097152>67108864:raise ValueError('NONRESETTING_SOURCE_CAP')
        x=dict(row,PRE9=pin,fd=None,ageSeconds=age);held.append(x);new.append(x)
        x['fd']=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
        x['OPEN9']=nine(os.fstat(x['fd']))
        if x['OPEN9']!=pin:raise ValueError('OPEN_NINE')
        events.append({'event':'OPEN','path':path})
    for x in new:
        b=read(x['fd']);events.append({'event':'BODY','path':x['path']})
        if len(b)!=x['bytes'] or hashlib.sha256(b).hexdigest()!=x['sha256']:raise ValueError(('EOF_SIZE_HASH',x['path']))
        x['POST9']=nine(os.fstat(x['fd']))
        if x['POST9']!=x['PRE9'] or nine(os.lstat(x['path']))!=x['PRE9']:raise ValueError('POST_NINE')
        bodies[x['path']]=b
def find_rows(value):
    found=[]
    if isinstance(value,dict):
        if 'path' in value and 'sha256' in value and ('bytes' in value or 'size' in value):
            pins=[v for v in value.values() if isinstance(v,dict) and set(v)==set(FIELDS)]
            if len(pins)==1:found.append({'path':value['path'],'bytes':value.get('bytes',value.get('size')),'sha256':value['sha256'],'PRE9':pins[0],'declarationKeys':list(value)})
        if not found:
            for v in value.values():found.extend(find_rows(v))
    elif isinstance(value,list):
        for v in value:found.extend(find_rows(v))
    return found
try:
    own_stop=J/'static-acquirer-writers-stopped3.json'
    stop=json.loads(own_stop.read_bytes())
    own=[{'path':str(J/'static-acquirer3.py'),'bytes':stop['bytes'],'sha256':stop['sha256']}]
    open_group(own)
    pubs=[{'path':str(L/'finite-publication-pins1.json'),'bytes':26778,'sha256':'323750bdf2c2892089f7f7ae75e9e4c7a1df3ecc7892dae7e97206728d554d27'},
          {'path':str(L/'final-writers-stopped1.json'),'bytes':678,'sha256':'8f33d74b1bdff085dbe1b4ae65a987e711f3adf7f69638d163010b89af05a690'}]
    open_group(pubs)
    pin_doc=json.loads(bodies[pubs[0]['path']]);stop_doc=json.loads(bodies[pubs[1]['path']])
    summary['publisherDocuments']={'pins':pin_doc,'stop':stop_doc}
    rows=find_rows(pin_doc)
    if len(rows)!=44 or len({x['path'] for x in rows})!=44 or sum(x['bytes'] for x in rows)!=1953410:raise ValueError(('FINITE_PACKET_DECLARATION',len(rows),sum(x['bytes'] for x in rows)))
    open_group(rows)
    summary['packetRows']=rows
    summary['jsonKeys']={p:list(json.loads(b)) if isinstance(json.loads(b),(list,dict)) else type(json.loads(b)).__name__ for p,b in bodies.items() if p.endswith('.json')}
    summary['texts']={p:b.decode() for p,b in bodies.items() if p.endswith(('.py','.md'))}
    summary['manifest']=json.loads(bodies[str(L/'closed-adapter-source-manifest.json')])
    summary['plans']={p:json.loads(b) for p,b in bodies.items() if 'plan' in Path(p).name and p.endswith('.json')}
    summary['rawResults']={p:{k:v for k,v in json.loads(b).items() if k not in ('sourceRows','sourceCloses','result','bodies','inputs','details','rows')} for p,b in bodies.items() if 'replay' in Path(p).name and p.endswith('.json')}
except BaseException as e:
    primary={'type':type(e).__name__,'error':str(e),'traceback':traceback.format_exc()}
finally:
    for x in held:
        if x['fd'] is None:continue
        error=None
        try:
            b=read(x['fd']);fn=nine(os.fstat(x['fd']))
            if len(b)!=x['bytes'] or hashlib.sha256(b).hexdigest()!=x['sha256'] or fn!=x['PRE9'] or nine(os.lstat(x['path']))!=x['PRE9']:raise ValueError('FINAL_SOURCE_CHECK')
        except BaseException as e:error=str(e);fn=None
        final.append({k:v for k,v in x.items() if k!='fd'}|{'FINAL9':fn,'finalError':error,'fullEOF':error is None})
    for x in held:
        fd=x['fd'];x['fd']=None
        if fd is None:continue
        try:os.close(fd);closes.append({'path':x['path'],'attempts':1,'success':True})
        except BaseException as e:closes.append({'path':x['path'],'attempts':1,'success':False,'error':str(e)})
record={'scope':'INDEPENDENT_REVIEW2_STAGED_STATIC_DISCOVERY_ONLY','primary':primary,'summary':summary,'events':events,'sourceRows':final,'sourceCloses':closes,'currentBytes':sum(x['bytes'] for x in held),'priorReservationBytes':23000000,'stagedHeadersBeforeLaterMembers':True,'allFDsBeforeFirstHeader':False,'candidateExecution':False,'sourceEligibility':False}
(J/'static-acquisition3.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'primary':primary,'held':len(held),'bytes':record['currentBytes'],'closes':len(closes),'closeErrors':[x for x in closes if not x['success']],'jsonKeys':summary.get('jsonKeys'),'manifest':summary.get('manifest'),'plans':summary.get('plans'),'texts':summary.get('texts'),'rawResults':summary.get('rawResults')},indent=2))
