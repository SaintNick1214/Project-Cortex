"""Independent R7 held-code actor; never executes author acquisition tools."""
import ast,contextlib,hashlib,io,json,sys,types
from pathlib import Path
def run(ctx):
    body=ctx['bodies'];J=Path(ctx['J']);D=Path(ctx['D']);P=Path(ctx['P'])
    def pick(suffix):return next(k for k in body if k.endswith(suffix))
    def module(name,path):
        m=types.ModuleType(name);m.__file__=path;sys.modules[name]=m
        exec(compile(body[path],path,'exec'),m.__dict__);return m
    M=module('independent_R7_actual_phase',str(D/'phase_partition5.py'))
    Reg=module('independent_R7_author_regressions',str(D/'registration_controls1.py'))
    Own=module('independent_R7_new_oracles',str(J/'independent-controls1.py'))
    old4=body[pick('/task03-f2-close-fence-repair6/phase_partition4.py')]
    old2=body[pick('/task03-f2-phase-partition-repair4/phase_partition2.py')]
    oldcontrols=body[pick('/task03-f2-phase-partition-repair4/partition_controls2.py')]
    fixture=J/'fixture-original165';fixture.mkdir(mode=0o700,exist_ok=False)
    data={'original_phase2':old2,'original_controls2':oldcontrols,'partition_controls2.py':oldcontrols}
    mods={'phase_candidate':M};summaries=[];output=io.StringIO()
    with contextlib.redirect_stdout(output):
        for name,key in [('independent_cases1.py','summary'),('independent_additional_cases1.py','result'),('independent_close_fence_cases1.py','result')]:
            path=pick('/task03-phase-partition-independent-review3/'+name)
            ns={'mods':mods,'data':data,'D':fixture,'A':D,'ORIGINAL':P/'task03-f2-phase-partition-repair4','json':json,'Path':Path}
            exec(compile(body[path],path,'exec'),ns);summaries.append(ns[key])
        author=Reg.run(M)
        own=Own.run(M,old4,body[str(D/'phase_partition5.py')],body[str(D/'registration_controls1.py')])
    stdout=output.getvalue();assert len(stdout.encode())<=262144
    (J/'independent-control-stdout1.txt').write_text(stdout)
    initial=summaries[0];original=initial['original97'];prior_count=original['discovered']+initial['discovered']-1+sum(x['discovered']for x in summaries[1:])
    prior_fail=original['failed']+initial['failed']+sum(x['failed']for x in summaries[1:])
    assert prior_count==165 and author['passed']+author['failed']==48
    result={'scope':'INDEPENDENT_R7_CODE_HOST_ONLY','original165':{'discovered':prior_count,'passed':prior_count-prior_fail,'failed':prior_fail,
        'raw36HasOriginal97WrapperCountedOnce':True,'blocks':summaries},
        'author48ScopedRegression':author,'freshIndependent':own,
        'discovered':165+48+own['discovered'],'executed':165+48+own['executed'],
        'passed':165-prior_fail+author['passed']+own['passed'],'failed':prior_fail+author['failed']+own['failed'],'skipped':0,
        'candidateSHA256':hashlib.sha256(body[str(D/'phase_partition5.py')]).hexdigest(),'candidateCodeBytesUnmodified':True,
        'fixtureAndOutputOnlyHarnessBinding':str(fixture),'SourceEligibility':False,'functionalAcceptance':False,'effects':0,'python':sys.version}
    (J/'independent-control-results1.json').write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
    return result
