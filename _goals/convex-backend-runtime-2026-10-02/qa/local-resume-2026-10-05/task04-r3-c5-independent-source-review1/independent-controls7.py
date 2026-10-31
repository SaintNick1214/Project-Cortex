"""Distinct bootstrap oracle correction; all earlier raw observations immutable."""
from pathlib import Path
J=Path(__file__).resolve().parent
def main():
    raw=held_source(str(J/'independent-controls5.py'))
    changes=[
      (b"answer=ns['main']()",b"answer={'priorClosedAdditionalRaw':'independent-controls5.json','notReexecuted':True}"),
      (b"texts=[r['text']for r in hns['chain'](error)]",b"texts=[r['text']for r in hns['chain'](error)]+[r['failure']for r in getattr(error,'closeFailures',[])]"),
      (b"'rescued':rescued,'errorChain':hns['chain'](error),'noCandidateProgramEntry':True",b"'rescued':rescued,'errorChain':hns['chain'](error),'closeFailures':getattr(error,'closeFailures',[]),'noCandidateProgramEntry':True"),
      (b"target=J/'independent-bootstrap-controls1.json'",b"target=J/'independent-bootstrap-controls2.json'")]
    for old,new in changes:
        assert raw.count(old)==1;raw=raw.replace(old,new)
    ns={'__file__':str(J/'independent-controls5.py'),'__name__':'independent_structured_failure_oracle',
        'held_source':held_source,'cohort_pins':cohort_pins,'source_ledger':source_ledger}
    exec(compile(raw,str(J/'independent-controls5.py')+'.explicit-own-structured-close-oracle','exec'),ns)
    return ns['main']()

