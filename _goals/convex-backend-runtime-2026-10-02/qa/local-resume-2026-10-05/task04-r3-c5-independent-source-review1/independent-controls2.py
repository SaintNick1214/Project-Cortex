"""Distinct additional SOURCE controls; no candidate/native entry execution."""
import ast,hashlib,json,os,stat,time,traceback
from pathlib import Path
J=Path(__file__).resolve().parent;P=J.parent
A=P/'task04-current-producer-native-public-repair3'
B=P/'task04-current-producer-native-public-consumer-repair3';FIX=J/'owned-fixtures'

def chain(e):
    out=[];seen=set()
    while e is not None and id(e)not in seen:
        seen.add(id(e));out.append({'class':type(e).__name__,'text':str(e)});e=e.__cause__or e.__context__
    return out

def main():
    hns={'__file__':str(J/'independent-controls1.py'),'__name__':'isolated_additional_controls','held_source':held_source,'cohort_pins':cohort_pins,'source_ledger':source_ledger}
    exec(compile(held_source(str(J/'independent-controls1.py')),str(J/'independent-controls1.py'),'exec'),hns)
    c=held_source(str(B/'programs/consumer.py'))
    for fault in('read','fstat','lstat'):
        for index in(1,3,5):hns['read_case'](c,fault,index)
    raw=held_source(str(A/'source/native_export.py'));tree=ast.parse(raw)
    tree.body=[n for n in tree.body if not isinstance(n,(ast.Import,ast.ImportFrom))]
    rows=[]
    for fault in('positive','constructor','fence','close','close-and-primary'):
        for index in((1,)if fault=='positive'else(1,2,3)):
            ns={'__name__':'isolated_native_export','__file__':str(A/'source/native_export.py')}
            exec(compile(tree,str(A/'source/native_export.py'),'exec'),ns)
            ns.update(Path=Path,os=os,hashlib=hashlib,FIXED=tuple('input'+str(i)+'.json'for i in range(3)))
            attempts=[];opens=[];objects=[];fences=[]
            class H:
                def __init__(self,path,cap):
                    self.fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);self.i=len(opens)+1;self.path=path;opens.append(self.fd);objects.append(self)
                    self.size=os.fstat(self.fd).st_size;self.digest='0'*64;self.pin={}
                    if fault=='constructor'and self.i==index:
                        fd=self.fd;self.fd=None;attempts.append(self.i);os.close(fd);raise OSError('CONSTRUCTOR_MARKER_'+str(index))
                def row(self):return {'path':self.path,'bytes':self.size}
                def fence(self,full=False):
                    fences.append(self.i)
                    if(fault=='fence'and self.i==index)or(fault=='close-and-primary'and self.i==3):raise ValueError('PRIMARY_FENCE_MARKER_'+str(self.i))
                def close(self):
                    fd=self.fd;self.fd=None
                    if fd is not None:
                        attempts.append(self.i);os.close(fd)
                        if fault in('close','close-and-primary')and self.i==index:raise OSError('CLOSE_MARKER_'+str(index))
            ns['Held']=H;error=None;answer=None
            try:answer=ns['manifest'](FIX,FIX/'no-public-root',FIX/'no-public-manifest.json')
            except BaseException as e:error=e
            rescued=[]
            for obj in objects:
                if obj.fd is not None:
                    fd=obj.fd;obj.fd=None;os.close(fd);rescued.append({'index':obj.i,'fd':fd})
            expected=list(range(1,len(opens)+1));texts=[r['text']for r in chain(error)]
            ok=attempts==expected and len(attempts)==len(set(attempts))and(error is None if fault=='positive'else error is not None)
            if fault=='close-and-primary':ok=ok and any('PRIMARY_FENCE_MARKER'in t for t in texts)and any('CLOSE_MARKER'in t for t in texts)
            rows.append({'name':'R3.native_export.manifest.'+fault+'.'+str(index),'status':'PASS'if ok else'FAIL',
                         'actualWholeFunction':True,'fixtureNoDockerEffects':True,'closeAttempts':attempts,
                         'openedCount':len(opens),'fenceAttempts':fences,'rescuedOnlyOwnedNeverAttempted':rescued,
                         'errorChain':chain(error),'answer':answer})
    rows=hns['ROWS']+rows
    value={'scope':'INDEPENDENT_ADDITIONAL_ISOLATED_SOURCE_CONTROLS_ONLY','rows':rows,
           'pass':sum(r['status']=='PASS'for r in rows),'fail':sum(r['status']=='FAIL'for r in rows),
           'ledger':source_ledger(),'nativeExecuted':False,'Docker':False,'fixtureFDsAllClosedByHarness':True}
    target=J/'independent-controls2.json';target.write_text(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n')
    return {'pass':value['pass'],'fail':value['fail'],'path':str(target),'failNames':[r['name']for r in rows if r['status']=='FAIL']}
