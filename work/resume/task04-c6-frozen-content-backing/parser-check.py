from closure import scalarobjects
from pack import W,dump
import json
x={'numbers':[1,12,-12,1.1956,1e-9,-2.34e+56,0.0], 'refs':[{'path':'/a/escaped"\\unicodeé雪','sha256':'a'*64,'bytes':123456,'identity':{'n':-1e-100}},{'backing':'/x','encodedSHA256':'b'*64,'encodedBytes':123}], 'null':None,'true':True}
def expect(v):
 out=[]
 def visit(v):
  if isinstance(v,dict):
   for z in v.values():visit(z)
   scalar={k:z for k,z in v.items() if not isinstance(z,(dict,list))}
   if scalar:out.append(scalar)
  elif isinstance(v,list):
   for z in v:visit(z)
 visit(v);return out
p=W/'parser-input.json';p.write_text(json.dumps(x,ensure_ascii=False))
checks=[]
for n in [1,2,3,4,5,7,11,31,65536]:
 assert list(scalarobjects(p,n))==expect(x),(n,list(scalarobjects(p,n)),expect(x));checks.append(n)
p=W/'parser-truncated.json';p.write_text('{"x":1.1956e-')
for n in [1,2,7,65536]:
 try:list(scalarobjects(p,n));raise RuntimeError('accepted truncated')
 except (AssertionError,json.JSONDecodeError):pass
print(json.dumps({'stdlibValueEquality':True,'chunkSizes':checks,'escapedUnicodeNumbersExponentSignNestedReferences':True,'truncationRejected':True}))
