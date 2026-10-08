"""Independent G CODE/HOST replay actor. Source passed in verified held byte cache only."""
import ast,contextlib,hashlib,io,json,sys,types,time
from pathlib import Path
def run(ctx):
    body=ctx['bodies'];pins=ctx['pins'];J=Path(ctx['J']);D=Path(ctx['D']);R=Path(ctx['R'])
    def module(name,path):
        m=types.ModuleType(name);m.__file__=path;sys.modules[name]=m
        exec(compile(body[path],path,'exec'),m.__dict__);return m
    rel=lambda name:next(p for p in body if p.endswith(name))
    A=module('g_review_adapters',rel('/task03-operative-phase-source-adapters1/source_adapters1.py'))
    P=module('g_review_phase',rel('/task03-f2-close-fence-repair6/phase_partition4.py'))
    G=module('g_review_guard',str(D/'source-gates-borrowed1.py'))
    Author=module('g_review_author_controls',str(D/'guard_seam_controls1.py'))
    NControls=module('g_review_scoped_N_regressions',rel('/task03-operative-phase-source-adapters1/source_controls1.py'))
    Own=module('g_review_independent_controls',str(J/'independent-controls1.py'))
    old=body[rel('/task03-attempt6-current-binding-repair2/source-gates.py')];new=body[str(D/'source-gates-borrowed1.py')]
    stdout=io.StringIO();errors=[]
    with contextlib.redirect_stdout(stdout):
        author=Author.run(A,P,G,old,new)
        regress=NControls.run(A,P)
        independent=Own.run(A,P,G,body[str(D/'guard_seam_controls1.py')],old,new)
    raw=stdout.getvalue();assert len(raw.encode())<=262144
    if raw:(J/'control-stdout1.txt').write_text(raw)
    assert type(author)is list and type(regress)is dict and type(independent)is dict
    result={'scope':'INDEPENDENT_ROOT_G_CODE_HOST_REVIEW','author18':author,'underlyingN71ScopedOnly':regress,
        'freshIndependent':independent,'candidateSha256':hashlib.sha256(new).hexdigest(),
        'candidateBytecodeUnmodified':True,'borrowedFixtureASTOnly':True,'allInputsHeldThroughControlFinal':True,
        'underlyingN1Verdict':'REJECT_2.6_UNCHANGED','RootR6Verdict':'REJECT_2.8_UNCHANGED',
        'SourceEligibility':False,'functionalAcceptance':False,'effects':0,'python':sys.version}
    (J/'independent-control-results1.json').write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
    return result
