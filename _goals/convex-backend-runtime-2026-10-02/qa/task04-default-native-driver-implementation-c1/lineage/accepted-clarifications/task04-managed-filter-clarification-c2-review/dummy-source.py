from pathlib import Path
import hashlib,json
# DUMMY ASCII-only contract examples. Not installed codec, handler, index or native evidence.
fields=('tenantHash','spaceHash','ownerHash','profileHash')
base={k: str(i+1)*64 for i,k in enumerate(fields)}
def composite(v):
 assert set(v)==set(fields)
 assert all(isinstance(v[k],str) and len(v[k])==64 and all(c in '0123456789abcdef' for c in v[k]) for k in fields)
 obj={'domain':'cortex.experiment.scope-profile.v1','version':1,**v}
 raw=json.dumps(obj,sort_keys=True,separators=(',',':'),ensure_ascii=False)
 return raw,hashlib.sha256(raw.encode('utf-8')).hexdigest()
raw,want=composite(base)
out={'label':'DUMMY SEMANTIC EXAMPLES ONLY','canonical':raw,'digest':want,'cases':[]}
out['cases'].append({'case':'same tuple ordered differently','pass':composite(dict(reversed(list(base.items()))))[1]==want})
for k in fields:
 other={**base,k:'a'*64}; honest=composite(other)[1]
 out['cases'].append({'case':'honest wrong '+k+' equality excluded','pass':honest!=want})
 out['cases'].append({'case':'forged expected composite wrong '+k+' semantic denied','pass':not(honest==want and other==base)})
out['cases'].append({'case':'otherwise valid row wrong composite denied','pass':'0'*64!=want})
swapped={**base,'tenantHash':base['spaceHash'],'spaceHash':base['tenantHash']}
out['cases'].append({'case':'named tuple position swap distinct','pass':composite(swapped)[1]!=want})
for name,bad in [('delimiter', {**base,'tenantHash':'1|2'}),('wrong type',{**base,'tenantHash':1}),('extra key',{**base,'extra':'1'*64}),('uppercase',{**base,'tenantHash':'A'*64})]:
 try: composite(bad); denied=False
 except AssertionError: denied=True
 out['cases'].append({'case':name+' denied','pass':denied})
assert all(x['pass'] for x in out['cases'])
Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-managed-filter-clarification-c2-review/dummy-semantic.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'label':out['label'],'assertions':len(out['cases']),'passed':True}))
