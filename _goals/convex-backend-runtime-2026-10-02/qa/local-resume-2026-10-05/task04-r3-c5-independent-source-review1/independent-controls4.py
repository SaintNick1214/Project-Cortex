"""Own harness syntax correction only; original controls2 failure conserved."""
from pathlib import Path
J=Path(__file__).resolve().parent
def main():
    raw=held_source(str(J/'independent-controls2.py'))
    assert raw.count(b'__cause__or ')==1
    corrected=raw.replace(b'__cause__or ',b'__cause__ or ')
    ns={'__file__':str(J/'independent-controls2.py'),'__name__':'independent_syntax_correction',
        'held_source':held_source,'cohort_pins':cohort_pins,'source_ledger':source_ledger}
    exec(compile(corrected,str(J/'independent-controls2.py')+'.explicit-own-syntax-correction','exec'),ns)
    return ns['main']()
