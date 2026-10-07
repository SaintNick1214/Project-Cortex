"""Explicit nine-field schema adapter for immutable REJECT publisher2; no candidate edit."""
import hashlib
from pathlib import Path
J=Path(__file__).resolve().parent
OLD=J/'final-reject-publisher2.py'
OLD_SHA='efa3ed95e35d0109fd6dc14518bb89323d5168bfe850f46367fd9abc72b77fbc'
OLD_BYTES=14783
BEFORE="        r=by[path];assert pins[path]['PRE9']==r['PRE9']and(len(raws[path]),sha(raws[path]))==(r['bytes'],r['sha256'])"
AFTER="""        r=by[path];orig=r['PRE9']
        keys=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
        assert isinstance(orig,dict)and set(orig)==set(keys)and all(isinstance(orig[k],str)and orig[k].isdigit()for k in keys)
        expected=[int(orig[k])for k in keys]
        assert pins[path]['PRE9']==expected and(len(raws[path]),sha(raws[path]))==(r['bytes'],r['sha256'])"""
ADDENDUM="""    lines+=['','Final own publisher2 denied before report publication because its author-byte expectation omitted one trailing newline; its11 owned inputs closed once. Own publisher3 then denied before report publication because the draft compared Root197 decimal-string nine-field objects to ordered integer tuples; its14 inputs closed once. Both original failed intervals and expected pins remain unchanged. This explicit publisher adapter validates all nine exact Root field names and decimal-string values before converting them to the existing tuple order; it neither changes candidate bytes nor refreshes any historical tuple. The two failed publisher receipts and diagnosis are part of the finite reference manifest.']
"""
def main(raws,pins,ledger):
    raw=raws[str(OLD)]
    assert len(raw)==OLD_BYTES and hashlib.sha256(raw).hexdigest()==OLD_SHA
    text=raw.decode()
    assert text.count(BEFORE)==1 and text.count('    def pub(name,raw):')==1
    adapted=text.replace(BEFORE,AFTER).replace('    def pub(name,raw):',ADDENDUM+'    def pub(name,raw):')
    ledger['explicitOwnPublisherSchemaAdapter']={'originalPath':str(OLD),'originalSha256':OLD_SHA,'originalBytes':OLD_BYTES,
      'nineFields':['dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns'],'allOriginalValuesRequired':True,
      'candidateBytesChanged':False,'historicalPinRefresh':False,'adaptedCompileSha256':hashlib.sha256(adapted.encode()).hexdigest()}
    ns={'__file__':__file__,'__name__':'finite_reject_publisher3_exact_nine_schema'}
    exec(compile(adapted,__file__+'::explicit-held-original-adaptation','exec'),ns)
    return ns['main'](raws,pins,ledger)
