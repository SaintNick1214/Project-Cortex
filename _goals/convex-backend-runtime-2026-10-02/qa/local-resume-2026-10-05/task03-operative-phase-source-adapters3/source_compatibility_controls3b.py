"""Actual closed U3 list-concatenation edge, borrowed held Source bodies only."""
import ast
import copy
from types import SimpleNamespace

def run(adapter,api,port_raw,runner_raw):
    conditions=[]
    def test(name,fn):
        try:fn();conditions.append(dict(name=name,PASS=True))
        except BaseException as error:conditions.append(dict(name=name,PASS=False,error=repr(error)))
    def expr(raw):
        tree=ast.parse(raw);nodes=[n for n in ast.walk(tree)if isinstance(n,ast.BinOp)and isinstance(n.op,ast.Add)
            and "currentPrograms"in ast.dump(n)and "Q6Seeds"in ast.dump(n)and "originalComparands"in ast.dump(n)]
        assert len(nodes)==1
        return nodes[0]
    def exact_edge():
        left=expr(port_raw);right=expr(runner_raw)
        assert ast.dump(left)==ast.dump(right)
        journal=adapter.MutationJournal();recipe=adapter.freeze({'cohorts':{'currentPrograms':[str(i)for i in range(32)],'Q6Seeds':[str(i)for i in range(32,37)],'originalComparands':[str(i)for i in range(37,50)]}},journal)
        expression=ast.fix_missing_locations(ast.Expression(body=left))
        result=eval(compile(expression,'ACTUAL_CLOSED_U3_COHORT_CONCAT_EDGE','eval'),{'view':SimpleNamespace(recipe=recipe)})
        assert type(result)is list and result==[str(i)for i in range(50)]and journal.version==0
        result.clear();assert len(recipe['cohorts']['currentPrograms'])==32
    test('actual_U3_port_and_runner_same_AST32_plus5_plus13_detached_native_list',exact_edge)
    def detach():
        journal=adapter.MutationJournal();owned=adapter.freeze([{'nine':{'ctime_ns':'1'}}],journal)
        result=owned+owned;assert result==[{'nine':{'ctime_ns':'1'}},{'nine':{'ctime_ns':'1'}}]
        result[0]['nine']['ctime_ns']='2';assert result[1]['nine']['ctime_ns']=='1'and owned[0]['nine']['ctime_ns']=='1'
        assert journal.version==0
    test('concatenation_both_operands_deep_detached_from_owner_and_each_other',detach)
    def slice_and_reverse():
        journal=adapter.MutationJournal();owned=adapter.freeze([{'value':1}],journal)
        sliced=owned[:];assert type(sliced)is list;sliced[0]['value']=2;assert owned[0]['value']==1
        prefixed=[{'value':0}]+owned;prefixed[1]['value']=2;assert owned[0]['value']==1and journal.version==0
    test('native_list_slice_and_reverse_concatenation_detached',slice_and_reverse)
    def unsupported():
        journal=adapter.MutationJournal();owned=adapter.freeze(['a'],journal)
        try:owned+('b',)
        except TypeError:pass
        else:raise AssertionError('original list plus tuple must deny')
        assert owned==['a']and owned!=('a',)and journal.version==0
    test('original_list_equality_and_invalid_tuple_concat_safe_validation',unsupported)
    return dict(scope='AUTHOR_SOURCE_MOCK_CLOSED_U3_ABI_ONLY',conditions=conditions,PASS=sum(r['PASS']for r in conditions),FAIL=sum(not r['PASS']for r in conditions),effects=0,sourceEligibility=False)
