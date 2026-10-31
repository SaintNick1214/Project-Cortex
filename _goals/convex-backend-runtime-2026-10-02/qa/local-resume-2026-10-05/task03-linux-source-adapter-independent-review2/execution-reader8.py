"""Finite independent staged successor reader. No real fixture effects."""
import os,time,json,hashlib,types,stat,traceback
from pathlib import Path
J=Path(__file__).parent
R=J.parents[4]
L=J.parent/'task03-u4-linux-prospective-source-qualification-repair2'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(s):return {k:str(getattr(s,'st_'+k)) for k in FIELDS}
def eof(fd):
    out=[];offset=0
    while True:
        b=os.pread(fd,65536,offset)
        if not b:break
        offset+=len(b)
        if offset>16777216:raise ValueError('SOURCE_FILE_CAP')
        out.append(b)
    return b''.join(out)
def physical(path):
    p=Path(path);p=p if p.is_absolute() else R/p
    if not p.is_absolute() or '..' in p.parts:raise ValueError('CANONICAL_DECLARATION_PATH')
    return str(p)
held=list(QUALIFIED_PREFIX_HELD)
bodies=dict(QUALIFIED_PREFIX_BODIES)
events=[];record=None;primary=None;discovery={};owner_closed=False
def group(rows,stage):
    new=[]
    for row in rows:
        p=row['path'];s=os.lstat(p);pin=row.get('PRE9') or nine(s)
        if nine(s)!=pin:raise ValueError(('DECLARED_ORIGINAL_NINE_CHANGED',p))
        age=(time.time_ns()-max(int(pin['mtime_ns']),int(pin['ctime_ns'])))/1e9
        if age<240:raise ValueError(('CURRENT_SOURCE_AGE',p,age))
        if pin['uid']!='501' or pin['gid']!='20' or pin['nlink']!='1' or not stat.S_ISREG(int(pin['mode'])):raise ValueError('REGULAR_SINGLELINK_MAC_OWNER')
        if len(held)>=4096 or 23000000+2097152+sum(x['bytes'] for x in held)+row['bytes']>67108864:raise ValueError('NONRESETTING_SOURCE_ADMISSION_CAP')
        x={'path':p,'pin':pin,'bytes':row['bytes'],'sha256':row['sha256'],'kind':row.get('kind',stage),'fd':None,'ageSeconds':age}
        held.append(x);new.append(x);x['fd']=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
        if nine(os.fstat(x['fd']))!=pin:raise ValueError('OPEN_NINE')
        events.append({'event':'OPEN','stage':stage,'path':p})
    for x in new:
        b=eof(x['fd']);events.append({'event':'BODY','stage':stage,'path':x['path']})
        if len(b)!=x['bytes'] or hashlib.sha256(b).hexdigest()!=x['sha256']:raise ValueError(('POST_FULL_EOF_SIZE_HASH',x['path']))
        if nine(os.fstat(x['fd']))!=x['pin'] or nine(os.lstat(x['path']))!=x['pin']:raise ValueError('POST_NINE')
        bodies[x['path']]=b
try:
    own=[('reviewer-controls2.py',18621,'d0bd1cf5ed95f1a5979d9e43acfa055464460a2e81e5ad4378701590e79cd21b'),
         ('reviewer-owner2.py',5868,'ef5167479e7000efde68a0afb8313a7b77a778a52731115b797b266a23ea1794'),
         ('reviewer-writers-stopped2.json',1032,'c418dcc3d765bb4ef95da11b911ec19394249b69750fdf72e7d01f78d44a0e19')]
    group([{'path':str(J/n),'bytes':s,'sha256':h} for n,s,h in own],'MATURE_OWN_REVIEWER_SOURCE')
    group([{'path':str(L/'finite-publication-pins1.json'),'bytes':26778,'sha256':'323750bdf2c2892089f7f7ae75e9e4c7a1df3ecc7892dae7e97206728d554d27'},
           {'path':str(L/'final-writers-stopped1.json'),'bytes':678,'sha256':'8f33d74b1bdff085dbe1b4ae65a987e711f3adf7f69638d163010b89af05a690'}],'FINAL_TWO_HEADERS')
    pins=json.loads(bodies[str(L/'finite-publication-pins1.json')]);stop=json.loads(bodies[str(L/'final-writers-stopped1.json')])
    if stop['writers']!='STOPPED' or stop['remainingWrites']!=[] or pins['memberCount']!=44 or pins['memberBytes']!=1953410:raise ValueError('FINAL_STOP_OR_DECLARATION')
    if len(pins['members'])!=44 or sum(x['bytes'] for x in pins['members'])!=1953410:raise ValueError('REFERENCE_CENSUS')
    rows=[];reference_rows=[];seen={}
    for index,row in enumerate(pins['members']):
        p=physical(row['path']);x={'path':p,'bytes':row['bytes'],'sha256':row['sha256']}
        if 'PRE9' in row:
            x['PRE9']=row['PRE9'];x['kind']='ORIGINAL_AUTHOR_MEMBER_PIN'
        else:
            if row.get('physicalNine') not in (None,'REQUIRES_LATER_MATURE_EXTERNAL_CAPTURE'):raise ValueError('UNRECOGNIZED_PUBLISHER_CUSTODY_SCOPE')
            x['PRE9']=nine(os.lstat(p));x['kind']='NEW_PROSPECTIVE_DOC_PIN_NOT_HISTORICAL_REPAIR'
        reference_rows.append(dict(x,referenceIndex=index,declaredPath=row['path']))
        if p in seen:
            earlier=seen[p]
            if (x['PRE9'],x['bytes'],x['sha256'])!=(earlier['PRE9'],earlier['bytes'],earlier['sha256']):raise ValueError(('DUPLICATE_REFERENCE_NOT_EXACT_NINE_SIZE_HASH',p))
            continue
        seen[p]=x;rows.append(x)
    group(rows,'ALL_UNIQUE_PACKET_FDS_BEFORE_PACKET_BODIES')
    mf=json.loads(bodies[str(L/'closed-adapter-source-manifest.json')])
    discovery={'referenceRows':reference_rows,'physicalRows':rows,'referenceCount':44,'physicalCount':len(rows),'referenceBytes':1953410,'physicalBytes':sum(x['bytes'] for x in rows),
      'manifest':mf,'publisherStop':stop,'jsonKeys':{p:list(json.loads(b)) for p,b in bodies.items() if p.endswith('.json') and isinstance(json.loads(b),dict)},
      'texts':{p:b.decode() for p,b in bodies.items() if p.endswith(('.py','.md'))},
      'authorResults':{p:json.loads(b) for p,b in bodies.items() if Path(p).name in ('held-author-controls1.json','held-author-controls2.json','held-author-controls3.json','author-result-summary1.json')},
      'prospectiveDocsDoNotRepairHistoricalPins':True,'samePhysicalDedupOnlyExactNineSizeHash':True}
    runtime={x['name']:dict(x,path=physical(x['path'])) for x in mf['runtimeSourceInputs']}
    declared=[]
    for row in mf['inputs']:
        x=dict(row);x['path']=physical(x['path'])
        already=next((z for z in rows if z['path']==x['path']),None)
        if 'PRE9' not in x:
            if already is None or (x['bytes'],x['sha256'])!=(already['bytes'],already['sha256']):raise ValueError(('NO_EXACT_PROSPECTIVE_DOC_BINDING',x['path']))
            x['PRE9']=already['PRE9']
        declared.append(x)
    proof=json.loads(bodies[runtime['proof']['path']])
    for edge in ('receiptSource','planSource'):
        original=proof[edge]
        declared.append({'path':original['path'],'bytes':original['bytes'],'sha256':original['sha256'],'PRE9':original['expectedNine'],'kind':'ORIGINAL113_CURRENT_RELIED_ON_COMPARATOR_BODY'})
    discovery['newCurrentComparatorSourceEdges']={edge:proof[edge] for edge in ('receiptSource','planSource')}
    mod=types.ModuleType('qualified_review2_owner');mod.__file__=str(J/'reviewer-owner2.py')
    exec(compile(bodies[mod.__file__],mod.__file__,'exec',dont_inherit=True),mod.__dict__)
    record=mod.run(held,bodies,declared,runtime,J,23000000);owner_closed=True
except BaseException as e:primary={'type':type(e).__name__,'error':str(e),'traceback':traceback.format_exc()}
finally:
    if not owner_closed:
        finals=[];closes=[]
        for x in held:
            if x['fd'] is None:continue
            error=None;fn=None
            try:
                b=eof(x['fd']);fn=nine(os.fstat(x['fd']))
                if len(b)!=x['bytes'] or hashlib.sha256(b).hexdigest()!=x['sha256'] or fn!=x['pin'] or nine(os.lstat(x['path']))!=x['pin']:raise ValueError('FINAL_EOF_HASH_NINE')
            except BaseException as e:error=str(e)
            finals.append({k:v for k,v in x.items() if k!='fd'}|{'FINAL9':fn,'fullEOF':error is None,'finalError':error})
        for x in held:
            fd=x['fd'];x['fd']=None
            if fd is None:continue
            try:os.close(fd);closes.append({'path':x['path'],'attempts':1,'success':True})
            except BaseException as e:closes.append({'path':x['path'],'attempts':1,'success':False,'error':str(e)})
        record={'primary':primary,'sourceRows':finals,'sourceCloses':closes,'sourceEligibility':False,'candidateExecution':False}
    record['stagedAcquisitionEvents']=events;record['staticDiscovery']=discovery;record['prefixPrimary']=primary
    record['preservedPriorPrefixes']=['static-acquisition3.json','publisher-schema-discovery4.json','independent-run5.json']
    record['allFDsBeforeFirstHeader']=False
    (J/'independent-run8.json').write_text(json.dumps(record,indent=2)+'\n')
    result=record.get('result') or {}
    print(json.dumps({'primary':record.get('primary'),'prefixPrimary':primary,'held':len(held),'onceCloses':len(record.get('sourceCloses',[])),
      'closeErrors':[x for x in record.get('sourceCloses',[]) if not x['success']],'finalErrors':record.get('sourceFinalErrors'),
      'passed':result.get('passed'),'failed':result.get('failed'),'conditions':result.get('conditions'),'details':result.get('details'),
      'referenceCount':discovery.get('referenceCount'),'physicalCount':discovery.get('physicalCount'),'physicalBytes':discovery.get('physicalBytes'),
      'runtimeInputs':discovery.get('manifest',{}).get('runtimeSourceInputs'),'manifestKeys':list(discovery.get('manifest',{})),
      'newCurrentComparatorSourceEdges':discovery.get('newCurrentComparatorSourceEdges'),
      'codeExcerpts':{p:[{'line':i,'text':line} for i,line in enumerate(text.splitlines(),1) if (p.endswith('root_fixture_driver2.py') and 180<=i<=320) or (p.endswith('linux_source_qualifier.py') and 40<=i<=65) or p.endswith('source_entry.py')] for p,text in discovery.get('texts',{}).items() if p.endswith(('root_fixture_driver2.py','linux_source_qualifier.py','source_entry.py'))}},indent=2))
