"""Finite staged source/mock/current consumer. Never imports operative programs."""
import hashlib,json,os,stat,sys,time
from pathlib import Path
N=Path(__file__).resolve().parents[1];P=N.parent;R=P.parents[3]
NEW=P/'task04-current-producer-native-public-repair3';OLD=P/'task04-current-producer-native-public-repair1'
LEGACY=P/'task04-current-producer-native-public-consumer-repair2';J=P/'task04-current-producer-native-public-consumer-repair2-source-review3'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def bootstrap(paths):
    held=[];raws={};rows=[]
    try:
        for p in paths:
            pre=ident(p.lstat());age=time.time_ns()-max(int(pre['mtime_ns']),int(pre['ctime_ns']))
            assert age>=60000000000 and pre['nlink']=='1'and stat.S_ISREG(int(pre['mode']))and int(pre['size'])<=16777216
            fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);held.append({'path':str(p),'PRE':pre,'OPEN':ident(os.fstat(fd)),'heldFD':fd,'ageNsAtFirstOpen':age});assert held[-1]['OPEN']==pre
        for h in held:
            chunks=[]
            while b:=os.read(h['heldFD'],65536):chunks.append(b)
            raw=b''.join(chunks);assert len(raw)==int(h['PRE']['size'])and ident(os.fstat(h['heldFD']))==h['PRE']and ident(os.lstat(h['path']))==h['PRE']
            raws[h['path']]=raw;rows.append({**h,'POST':h['PRE'],'pathFINAL':h['PRE'],'heldFINAL':h['PRE'],'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'EOF':True})
        return held,raws,rows
    except BaseException:
        for h in held:os.close(h['heldFD'])
        raise
mode=sys.argv[1];initial=[N/'programs/consumer.py',N/'controls/consumer_controls2.py']
if mode!='plan':initial.append(N/'data/inputs-plan2.json')
held,raws,source_rows=bootstrap(initial);C={'__file__':str(N/'programs/consumer.py'),'__name__':'bounded_current_consumer'}
exec(compile(raws[str(N/'programs/consumer.py')],str(N/'programs/consumer.py'),'exec'),C)
for row in source_rows:C['LEDGER'].reserve(row['path'],row['PRE']);C['LEDGER'].opened()
out=C['output'];pending=[];source_closes=[]
try:
    if mode=='plan':
        # Manifest/bootstrap phase opens every finite header before any header content.
        header_paths=sorted(set([p for p in NEW.rglob('*')if p.is_file()]+[p for p in LEGACY.rglob('*')if p.is_file()]+[p for p in J.rglob('*')if p.is_file()]+[p for p in N.rglob('*')if p.is_file()]+[OLD/'evidence/original-conservation-proof1.json',P/'root-task04-native-consumer-repair2-source-review3-mature-readback1.json']))
        pending=C['open_inputs'](header_paths);headers={};header_rows=[]
        for h in pending:
            row,raw=C['read_held'](h,collect=True);headers[h['path']]=raw;header_rows.append(row)
        baseline=C['strict'](headers[str(LEGACY/'evidence/first-current-mature-baseline1.json')]);assert baseline['oldFailedCount']==119 and len(baseline['files'])==1277
        expected={row['path']:{k:row[k]for k in ('path','roles','bytes','sha256','stableLiteral','oldPacketLiteral')}for row in baseline['files']}
        for row in header_rows:
            if row['path']not in expected:expected[row['path']]={'path':row['path'],'roles':['NEW_DISTINCT_MATURE_HEADER_OR_CONTROL_DATA'],'bytes':row['bytes'],'sha256':row['sha256'],'stableLiteral':row['PRE'],'oldPacketLiteral':None}
            else:assert (expected[row['path']]['bytes'],expected[row['path']]['sha256'])==(row['bytes'],row['sha256'])
        proof=C['strict'](headers[str(OLD/'evidence/original-conservation-proof1.json')]);assert proof['originalCount']==100 and len(proof['rows'])==100
        for item in proof['rows']:
            for path in (R/item['originalSource'],OLD/item['newExactConservationBacking']):
                if str(path)not in expected:expected[str(path)]={'path':str(path),'roles':['ORIGINAL100_EXACT_PREIMAGE_OR_BACKING'],'bytes':item['bytes'],'sha256':item['sha256'],'stableLiteral':None,'oldPacketLiteral':None}
                else:assert (expected[str(path)]['bytes'],expected[str(path)]['sha256'])==(item['bytes'],item['sha256'])
        # Same aggregate ledger continues. All graph FDs precede referenced content.
        references=C['open_inputs']([Path(p)for p in sorted(expected)]);observed=[];pending.extend(references)
        try:
            content={}
            for h in references:
                pin=expected[h['path']];row,raw=C['read_held'](h,pin,collect=True)
                if pin.get('stableLiteral')is not None:assert row['PRE']==C['literal_identity'](pin['stableLiteral'])
                observed.append({**row,'roles':pin['roles'],'stableLiteral':pin.get('stableLiteral'),'oldPacketLiteral':pin.get('oldPacketLiteral')});content[h['path']]=raw
            failures=[r for r in observed if r['oldPacketLiteral']is not None and r['PRE']!=r['oldPacketLiteral']]
            assert len(failures)==119 and all([k for k in FIELDS if r['PRE'][k]!=r['oldPacketLiteral'][k]]==['ctime_ns']for r in failures)
            original=[]
            for item in proof['rows']:
                paths=[R/item['originalSource'],OLD/item['newExactConservationBacking']]
                if item['newExactConservationBacking'].startswith('source/'):paths.append(NEW/item['newExactConservationBacking'])
                for path in paths:
                    raw=content[str(path)];assert (len(raw),hashlib.sha256(raw).hexdigest())==(item['bytes'],item['sha256'])
                original.append({'original':str(paths[0]),'backings':[str(p)for p in paths[1:]],'bytes':item['bytes'],'sha256':item['sha256'],'match':True})
            assert sum('STABLE_OPERATIVE113'in r['roles']for r in observed)==113 and sum('STABLE_ORIGINAL336'in r['roles']for r in observed)==336
            for row in observed+header_rows+source_rows:C['final_fence'](row)
        finally:
            for row in observed:C['final_fence'](row)
        for r in source_rows+header_rows:C['final_fence'](r)
        out('data/inputs-plan2.json',{'schema':'FINITE_REPAIR3_REFERENCE_PLAN','files':[expected[p]for p in sorted(expected)],'count':len(expected),'originalStable113':113,'originalStableExternal336':336,'original100':100,'old119':'FAILED_IMMUTABLE','sourceEligibility':False,'runtimeAuthority':False,'publisherOutputsSelfExcludedUpstream':True,'bootstrapPhase':'FINITE_HELD_HEADERS_BEFORE_REFERENCED_GRAPH_CONTENT_NO_LEDGER_RESET'})
        out('evidence/plan2-first-held-reference-readback.json',{'files':observed,'headerPhase':header_rows,'original100':original,'FDCloses':'REQUIRED_SEPARATE_FINAL_COMPANION_NOT_PRECLAIMED','allGraphFDsBeforeReferencedContents':True,'aggregateLedger':{'paths':len(C['LEDGER'].paths),'bytes':C['LEDGER'].total,'peakFDs':C['LEDGER'].peak},'historicalCustodyRepaired':False,'sourceEligibility':False,'runtimeAuthority':False})
        g={'__file__':str(N/'controls/consumer_controls2.py'),'__name__':'executor_source_mock','C':C}
        exec(compile(raws[str(N/'controls/consumer_controls2.py')],str(N/'controls/consumer_controls2.py'),'exec'),g)
        out('controls/consumer-results2.json',g['RESULT']);print(json.dumps({'planCount':len(expected),'controlsPASS':g['RESULT']['PASS'],'controlsFAIL':g['RESULT']['FAIL'],'aggregateBytes':C['LEDGER'].total}))
    elif mode=='baseline':
        plan=C['strict'](raws[str(N/'data/inputs-plan2.json')]);pin=C['capture_plan'](plan,source_rows);print(json.dumps(pin))
    elif mode=='consume':
        p=N/'evidence/first-current-mature-baseline1.json'
        # No content access: immutable output hash/size supplied by the executor's
        # publication byte pin, rather than a new premature reading of that output.
        pin=C['strict'](os.environ['BASELINE_BYTE_PIN']);print(json.dumps(C['consume_baseline'](pin)))
    elif mode=='close':
        plan=C['strict'](raws[str(N/'data/inputs-plan2.json')]);names=sorted(set([Path(r['path'])for r in plan['files']]+[p for p in N.rglob('*')if p.is_file()]))
        pending=C['open_inputs'](names);observed=[];expected={r['path']:r for r in plan['files']}
        for h in pending:
            row,_=C['read_held'](h,expected.get(h['path']));observed.append(row)
            if h['path']in expected and expected[h['path']].get('stableLiteral')is not None:assert row['PRE']==expected[h['path']]['stableLiteral']
        for r in observed+source_rows:C['final_fence'](r)
        out('final-current-closure2.json',{'schema':'REPAIR3_FIRST_MATURE_CURRENT_PACKET_PLUS_FULL_REFERENCE_CLOSURE','files':observed,'count':len(observed),'bytes':sum(r['bytes']for r in observed),'firstOwnOutputMatureCurrentCapture':True,'allGraphFDsBeforeReferencedContents':True,'minimumAgeNs':min(r['ageNsAtFirstOpen']for r in observed),'aggregateLedger':{'paths':len(C['LEDGER'].paths),'bytes':C['LEDGER'].total,'peakFDs':C['LEDGER'].peak},'old119':'FAILED_IMMUTABLE','sourceEligibility':False,'runtimeAuthority':False,'notHistoricalCustody':True,'upstreamPublisherOutputsSelfExcluded':True})
        print(json.dumps({'closedCurrentCount':len(observed),'aggregateBytes':C['LEDGER'].total,'sourceEligibility':False}))
    else:raise ValueError('UNKNOWN_FINITE_STAGE')
    for row in source_rows:C['final_fence'](row)
finally:
    try:
        final_rows=[]
        for entry in pending+held:
            row,_=C['read_held'](entry,collect=False);C['final_fence'](row);final_rows.append(row)
    finally:
        try:pending_closes=C['close_scope'](pending)
        finally:source_closes=C['close_scope'](held)
out('evidence/'+mode+'2-source-final-FDclosure.json',{'sourceFirstMature':source_rows,'allFinalFullEOFRows':final_rows,'sourceFDCloses':source_closes,'otherFDCloses':pending_closes,'allExplicitClosesReturned':True,'aggregateLedger':{'paths':len(C['LEDGER'].paths),'bytes':C['LEDGER'].total,'peakFDs':C['LEDGER'].peak,'activeAfterClose':C['LEDGER'].active},'sourceEligibility':False,'runtimeAuthority':False,'outputSelfExcludedUpstream':True})
