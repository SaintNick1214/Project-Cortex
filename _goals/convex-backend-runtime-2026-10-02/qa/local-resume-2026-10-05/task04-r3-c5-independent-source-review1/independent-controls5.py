"""Distinct corrections of independent oracle only; earlier raw FAIL retained."""
import ast,json,os,types,time
from pathlib import Path
J=Path(__file__).resolve().parent;P=J.parent
A=P/'task04-current-producer-native-public-repair3'
B=P/'task04-current-producer-native-public-consumer-repair3'
FIX=J/'owned-fixtures'
def main():
    raw=held_source(str(J/'independent-controls2.py'))
    changes=[
      (b'__cause__or ',b'__cause__ or '),
      (b"for index in(1,3,5):hns['read_case'](c,fault,index)",b"for index in((1,2,3) if fault=='lstat' else (1,3,5)):hns['read_case'](c,fault,index)"),
      (b'ok=attempts==expected and len(attempts)',b'ok=sorted(attempts)==expected and len(attempts)'),
      (b"target=J/'independent-controls2.json'",b"target=J/'independent-controls5.json'")]
    for old,new in changes:
        assert raw.count(old)==1;raw=raw.replace(old,new)
    ns={'__file__':str(J/'independent-controls2.py'),'__name__':'independent_oracle_correction','held_source':held_source,'cohort_pins':cohort_pins,'source_ledger':source_ledger}
    exec(compile(raw,str(J/'independent-controls2.py')+'.explicit-own-oracle-delta','exec'),ns)
    answer=ns['main']()
    hns={'__file__':str(J/'independent-controls1.py'),'__name__':'independent_bootstrap_control','held_source':held_source,'cohort_pins':cohort_pins,'source_ledger':source_ledger}
    exec(compile(held_source(str(J/'independent-controls1.py')),str(J/'independent-controls1.py'),'exec'),hns)
    raw=held_source(str(B/'infrastructure/final-close3.py'));tree=ast.parse(raw)
    first_try=next(n for n in tree.body if isinstance(n,ast.Try))
    defs=[n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name in ('ident','close_bootstrap')]
    compiled=compile(ast.Module(body=defs+[first_try],type_ignores=[]),str(B/'infrastructure/final-close3.py'),'exec')
    import stat,hashlib,sys
    rows=[]
    class Root:
        def __truediv__(self,rel):
            return FIX/('input0.json'if rel=='programs/consumer.py'else'input1.json')
    for fault in ('positive','open','fstat','read','close','primary-and-close'):
        indices=(1,)if fault=='positive'else((1,3)if fault=='read'else(1,2))
        for index in indices:
            io=hns['IO'](fault if fault in ('open','fstat','read')else None,index)
            if fault in ('close','primary-and-close'):
                io.kind='read';io.index=1
                oldclose=io.close
                def close(fd):
                    io.attempts.append(fd);os.close(fd);io.closed.append(fd)
                    if len(io.attempts)==index:raise OSError('BOOTSTRAP_CLOSE_MARKER_'+str(index))
                io.close=close
            cs={'N':Root(),'C':None,'bootstrap':[],'raws':{},'first':[],'FIELDS':('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'),
                'time':time,'stat':stat,'os':io,'sys':sys,'hashlib':hashlib}
            error=None
            try:exec(compiled,cs)
            except BaseException as e:error=e
            if fault=='positive':
                try:cs['close_bootstrap'](cs['bootstrap'])
                except BaseException as e:error=e
            first=io.attempts[:]
            try:cs['close_bootstrap'](cs['bootstrap'])
            except BaseException as e:
                if error is None:error=e
            expected=[r['fd']for r in io.opens];rescued=io.rescue()
            okay=sorted(io.attempts)==sorted(expected)and io.attempts==first and not rescued and(error is None if fault=='positive'else error is not None)
            if fault in ('close','primary-and-close'):
                texts=[r['text']for r in hns['chain'](error)]
                okay=okay and any('INJECTED_read'in t for t in texts)and any('BOOTSTRAP_CLOSE_MARKER'in t for t in texts)
            rows.append({'name':'C5.bootstrap.actualFirstTry.'+fault+'.'+str(index),'status':'PASS'if okay else'FAIL',
              'actualAST':True,'closeAttempts':io.attempts,'opened':io.opens,'noRetry':io.attempts==first,
              'rescued':rescued,'errorChain':hns['chain'](error),'noCandidateProgramEntry':True})
    # Keep the corrected additional raw receipt separate from its immutable preimage.
    value={'scope':'INDEPENDENT_BOOTSTRAP_ACTUAL_AST_CONTROLS_ONLY','rows':rows,
           'pass':sum(r['status']=='PASS'for r in rows),'fail':sum(r['status']=='FAIL'for r in rows),
           'ledger':source_ledger(),'candidateExecuted':False,'priorRaw2FailuresPreserved':True,
           'oracleCorrectionReasons':['constructor cleanup order unconstrained; all attempts required','three actual lstat calls; injection5 unreachable'],
           'fixtureFDsAllClosedByHarness':True}
    target=J/'independent-bootstrap-controls1.json';target.write_text(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n')
    return {'additional':answer,'bootstrapPass':value['pass'],'bootstrapFail':value['fail'],'bootstrapPath':str(target),'failNames':[r['name']for r in rows if r['status']=='FAIL']}

