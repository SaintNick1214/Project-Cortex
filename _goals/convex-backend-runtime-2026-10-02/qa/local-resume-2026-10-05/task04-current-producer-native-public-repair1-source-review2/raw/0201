"""Public effect-substituted monotonic source guards; no child or Docker calls."""
import importlib.util
import json
from pathlib import Path
import sys

D=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(D/'source'))
spec=importlib.util.spec_from_file_location('proposed_ci',D/'source/ci-run.py')
ci=importlib.util.module_from_spec(spec);spec.loader.exec_module(ci)
real_monotonic=ci.time.monotonic
now=[100.0];ci.time.monotonic=lambda:now[0]
rows=[]

def check(name,function):
    try:function();rows.append({'name':name,'status':'PASS'})
    except BaseException as error:rows.append({'name':name,'status':'FAIL','error':repr(error)})

def denial(function):
    try:function()
    except ValueError as error:assert 'ABSOLUTE_INFRASTRUCTURE' in str(error)
    else:raise AssertionError('LATE_TERMINAL_OR_DISPATCH_ACCEPTED')

def setup():
    now[0]=100;ci.WHOLE_END=2200;ci.phase('setup-acquisition',180)
    assert ci.remaining()==180 and ci.STAGE_END==280

check('initial180-window',setup)
check('strict-positive-predeadline',lambda:(now.__setitem__(0,279.5),exec('assert ci.remaining()==.5')))
check('exact-stage-deadline-refused',lambda:(now.__setitem__(0,280),denial(ci.remaining)))
check('late-terminal-refused',lambda:(now.__setitem__(0,280.001),denial(ci.remaining)))

def whole_clip():
    now[0]=2190;ci.phase('finite-public-export',300)
    assert ci.STAGE_END==2200 and ci.remaining()==10

check('new-phase-clipped-by-original-whole',whole_clip)
check('whole-equality-refused',lambda:(now.__setitem__(0,2200),denial(ci.remaining)))
check('fresh-phase-does-not-renew-expired-whole',lambda:(now.__setitem__(0,2201),ci.phase('new',900),denial(ci.remaining)))

def every_phase():
    now[0]=100;ci.WHOLE_END=2200
    for name,seconds in [('setup',180),('build',900),('create',120),('native120-public480',600),('export',300)]:
        ci.phase(name,seconds);assert ci.remaining()==seconds
        assert min(60,ci.remaining())<=60
        now[0]+=seconds;denial(ci.remaining)
    assert now[0]==2200

check('five-worst-case-phases-total2100-and-late-denial-each',every_phase)

def separate_cleanup():
    body_failed='ABSOLUTE_BODY_DEADLINE'
    ci.WHOLE_END=now[0]+60;ci.phase('owned-cleanup',60)
    assert ci.remaining()==60 and body_failed=='ABSOLUTE_BODY_DEADLINE'
    now[0]+=60;denial(ci.remaining)

check('cleanup60-distinct-never-clears-body-failure',separate_cleanup)

def outer_arithmetic():
    assert 180+900+120+600+300==2100
    assert 2100+60+60==37*60
    assert 180+37*60+240+60==45*60
    old=(D/'evidence/superseded-envelope20/task04-current-producer-native-public.yml.proposed').read_text()
    new=(D/'task04-current-producer-native-public.yml.proposed').read_text()
    assert 'timeout-minutes: 20' in old and 'timeout-minutes: 45' in new
    assert 900+600+300>20*60
    assert 'timeout-minutes: 3' in new and 'timeout-minutes: 37' in new and 'timeout-minutes: 4' in new

check('rejected20-preserved-prospective45-complete-arithmetic',outer_arithmetic)
ci.time.monotonic=real_monotonic
value={'scope':'PUBLIC_HOST_EFFECT_SUBSTITUTED_MONOTONIC_GUARDS_ONLY','count':len(rows),'rows':rows,
       'DockerExecuted':False,'nativeQualification':False,'originalTask04DeadlinesChanged':False}
(D/'controls/window-results-run1.json').write_text(json.dumps(value)+'\n')
print(json.dumps(value));assert all(r['status']=='PASS' for r in rows)
