import ast,json,resource
from pathlib import Path
from stream_json import Reader,loads
rows=[]
def parse(raw,step=1):
 reader=Reader((raw[i:i+step] for i in range(0,len(raw),step)),valueLimit=len(raw));items=[];result=reader.top(arrayKeys=('rows',),item=lambda key,row:items.append(row));result['rows']=items;return result,reader
for value in [9007199254740993,-9007199254740993,1.234e-17,1e23,"a\\u0041",{"key":"é"}]:
 raw=json.dumps({'rows':[value]},ensure_ascii=True).encode();actual,_=parse(raw);assert actual['rows']==[value]
rows.append({'name':'split chunk integer exponent escaped Unicode','pass':True})
for raw in [b'{"rows":[{"a":1,"\\u0061":2}]}',b'{"rows":[],"rows":[]}',b'{"rows":[1]} trailing',b'{"rows":[1',b'{"rows":[1e]}',b'{"rows":[NaN]}',b'{"rows":[Infinity]}']:
 try:parse(raw)
 except (ValueError,json.JSONDecodeError):pass
 else:raise AssertionError(raw)
rows.append({'name':'duplicate decoded nested keys EOF truncation malformed numbers','pass':True})
value={'members':['member'+str(i) for i in range(12000)]};raw=json.dumps({'rows':[value]},separators=(',',':')).encode();actual,reader=parse(raw,4096);assert actual['rows']==[value] and reader.maxValueBytes>65536
rows.append({'name':'large members array preserved','pass':True,'bytes':len(raw),'maxValueBytes':reader.maxValueBytes,'peakBufferBytes':reader.peakBuffer})
for p in Path(__file__).parent.glob('*.py'):ast.parse(p.read_text())
for p in (Path(__file__).parent/'candidate').glob('*.py'):ast.parse(p.read_text())
rows.append({'name':'all current Python source parses','pass':True})
print(json.dumps({'rows':rows,'peakRSSKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'originals':'HELD'}))
