from pathlib import Path
import os,stat,json,gzip,hashlib,datetime,collections
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa'
H=lambda b:hashlib.sha256(b).hexdigest()
def ident(s):return {k:getattr(s,'st_'+k) for k in ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')}
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
  with os.fdopen(os.dup(fd),'rb') as f:b=f.read()
  assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(p));return b,ident(a)
 finally:os.close(fd)
reportRaw,reportIdentity=held(Q/'task04-native-c6-closed-launcher-c6/whole07-timing-analysis.json');d=json.loads(reportRaw);pins={};checks=[]
for p in d['pins']:
 raw,i=held(p['path']);assert i==p['identity'] and len(raw)==p['bytes'] and H(raw)==p['sha256']
 enc,ei=held(p['backing']);assert len(enc)==p['encodedBytes'] and H(enc)==p['encodedSHA256'];decoded=gzip.decompress(enc);assert decoded==raw
 pins[p['path']]=raw;checks.append(dict(path=p['path'],sha256=H(raw),freshIdentity=i,backingSHA256=H(enc),backingFreshIdentity=ei))
phasePin=next(p for p in pins if p.endswith('/child-phases.jsonl'));fencePin=next(p for p in pins if p.endswith('/source-fence-phases.jsonl'));ledgerPin=next(p for p in pins if p.endswith('/consumed-version-ledger.jsonl'))
def chain(raw):
 previous='0'*64;rows=[]
 for line in raw.splitlines(keepends=True):
  row=json.loads(line);assert row['previousSHA256']==previous and row['ordinal']==len(rows)+1;previous=H(line);rows.append(row)
 return rows
phases=chain(pins[phasePin]);assert phases==d['phaseRows'];fences=chain(pins[fencePin]);install=phases[-1]['utc'];assert phases[-1]['stage']=='INSTALL_COMPLETE'
starts={r['fence']:r for r in fences if r['stage']=='ALIAS_START'};ends={r['fence']:r for r in fences if r['stage']=='CLOSURE_END'}
iso=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
measured=[]
for f,a in starts.items():
 if a['utc']<install:continue
 z=ends[f];delta=iso(z['utc'])-iso(a['utc']);ms=delta.days*86400000+delta.seconds*1000+delta.microseconds//1000
 declared=next(r for r in d['allPostInstallSourceFences'] if r['fence']==f)
 assert declared['startUTC']==a['utc'] and declared['endUTC']==z['utc'] and declared['milliseconds']==ms and declared['rows']==a['rows']
 measured.append(ms)
assert len(measured)==20 and sum(measured)==15858
events=[json.loads(line) for line in pins[ledgerPin].splitlines()];body=[e for e in events if e['utcBeforeConsumption']>=install]
ref=d['bodyConsumption']['allEventsBacking'];encoded,ei=held(ref['path']);assert len(encoded)==ref['encodedBytes'] and H(encoded)==ref['encodedSHA256'];decoded=gzip.decompress(encoded);assert len(decoded)==ref['decodedBytes'] and H(decoded)==ref['decodedSHA256'];assert [json.loads(line) for line in decoded.splitlines()]==body
history=[e for e in body if e['classification']=='READONLY_SOURCE_BOUND_HISTORICAL_CURRENT_VERSION'];assert len(body)==2601 and len(history)==2583
assert sum(e['bytes'] for e in body)==57696224 and sum(e['bytes'] for e in history)==54007675
objects={}
for e in body:
 ref=e['beforeByteBacking'];key=ref['path'];binding=(ref['bytes'],ref['sha256'],e['bytes'],e['sha256'],ref['encoding'])
 if key in objects:assert objects[key]==binding;continue
 enc,_=held(key);assert len(enc)==ref['bytes'] and H(enc)==ref['sha256']
 assert ref['encoding'] in ('GZIP_EXACT_PREIMAGE','RAW_EXACT_PREIMAGE')
 raw=gzip.decompress(enc) if ref['encoding']=='GZIP_EXACT_PREIMAGE' else enc
 assert len(raw)==e['bytes'] and H(raw)==e['sha256'];objects[key]=binding
contracts=[]
for row in d['profilesRemainingSourceContract']:
 needle={'extension':'extension','regression':'regression','extra':'extra'}[row['kind']]
 path=next(p for p in pins if p.endswith('/historical-preservation.json') and ('native-'+needle+'-preparation') in p)
 historical=json.loads(pins[path]);assert len(historical['packets'])==row['packets'] and sum(p['rows'] for p in historical['packets'])==row['declaredManifestRowsPerPreservationCall']
 contracts.append(dict(profile=row['kind'],declaredHistoricalRowsPerCall=row['declaredManifestRowsPerPreservationCall'],bodyCallsPerProfile=2,specialNewUniqueRows=3,specialAdditionalReadOperationsPerCall=83))
out=dict(utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='ROOT_FULL_WHOLE07_PHASE_LEDGER_AND_SOURCE_COUNTS_VERIFIED',reportSHA256=H(reportRaw),reportFreshIdentity=reportIdentity,pins=checks,bodyEvents=len(body),historicalEvents=len(history),bodyBytes=57696224,historicalBytes=54007675,uniqueBodyPreimageObjectsVerified=len(objects),postInstallFullFences=20,postInstallFenceMilliseconds=15858,sourceContracts=contracts,baselineRequiredHistoricalRowOperations=2*sum(r['declaredHistoricalRowsPerCall'] for r in contracts),specialAdditionalReadOperations=6*83,limits='Measured timeout, not an infeasibility theorem. Special closure has3newunique rows but source rereads complete83afterprevious80. Source sequence/code independently read; no whole completion, source-tier/cap/assertion waiver, current qualification or original122 execution.')
with (Q/'task04-native-c6-root-whole07-phase-ledger-inspection.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(dict(status=out['status'],bodyEvents=len(body),historicalEvents=len(history),requiredHistoricalRowOperations=out['baselineRequiredHistoricalRowOperations']+out['specialAdditionalReadOperations'])))
