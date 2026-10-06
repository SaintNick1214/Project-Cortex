"""Reviewer-only strict-input helper controls; no producer pipeline or subjects."""
import hashlib
import json
import math
from pathlib import Path
import sys

S=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-c8-current-canonical-input-producers/source')
before=(S/'strict_io.py').read_bytes()
sys.path.insert(0,str(S))
from strict_io import Hold, strict_json

controls=[]
for name,raw,expected in [('duplicate-key',b'{"x":1,"x":2}','DUPLICATE_JSON_KEY'),('trailing-record',b'{} false','STRICT_JSON_PARSE'),('partial-record',b'{"x":','STRICT_JSON_PARSE'),('nonfinite-NaN',b'NaN','NONFINITE_JSON'),('nonfinite-Infinity',b'Infinity','NONFINITE_JSON'),('nonfinite-positive-exponent',b'1e309','NONFINITE_JSON'),('nonfinite-negative-exponent',b'-1e309','NONFINITE_JSON')]:
    try:
        value=strict_json(raw)
        controls.append({'name':name,'status':'FAIL','expected':expected,'accepted':repr(value),'nonfinite':isinstance(value,float)and not math.isfinite(value)})
    except Hold as error:controls.append({'name':name,'status':'PASS'if str(error)==expected else'FAIL','expected':expected,'denied':str(error)})
for name,raw,expected in [('finite-fraction',b'0.125',0.125),('safe-exponent-integer',b'1e3',1000.0)]:
    try:
        value=strict_json(raw)
        controls.append({'name':name,'status':'PASS'if value==expected else'FAIL','value':value,'expected':expected})
    except Hold as error:controls.append({'name':name,'status':'FAIL','denied':str(error)})
raw=(S/'strict_io.py').read_bytes()
controls.append({'name':'reviewed-helper-content-unchanged','status':'PASS'if before==raw else'FAIL'})
label=sys.argv[1]if len(sys.argv)==2 else'initial'
assert label in ('initial','repaired-r3')
target=Path(__file__).resolve().parent/('python-json-review-results-'+label+'.json')
result={'scope':'REVIEWER_HELPER_BOUNDARY_ONLY_NO_PRODUCER_PIPELINE','helper':str(S/'strict_io.py'),'helperBytes':len(raw),'helperSHA256':hashlib.sha256(raw).hexdigest(),'controls':controls,'ROOT':'ABSENT','original122':'HELD','nativeQualification':False}
with target.open('x')as stream:stream.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'scope':result['scope'],'passed':sum(row['status']=='PASS'for row in controls),'failed':sum(row['status']=='FAIL'for row in controls),'result':str(target)}))
raise SystemExit(1 if any(row['status']=='FAIL'for row in controls)else 0)
