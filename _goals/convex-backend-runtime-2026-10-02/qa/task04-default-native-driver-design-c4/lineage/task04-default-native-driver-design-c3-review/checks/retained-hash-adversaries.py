"""Independent finite hash obligation examples; no product/native execution."""
import copy,hashlib,json
H=lambda x:hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
a={'active':'C09','known':None,'reserved':29031,'attempt':{'trigger':'revoke','stageHash':'a'*64,'stageIdentityHash':'b'*64,'known':None,'slotReleased':False}}
original=H(a);late=copy.deepcopy(a);late.update(active=None,known=40,reserved=0);late['attempt'].update(known=40,slotReleased=True)
assert H(late)!=original # Legitimate late terminal/money cannot compare whole current account to old purge snapshot.
changed=copy.deepcopy(a);changed['attempt']['stageIdentityHash']='c'*64
assert H(changed)!=original # A corrupted trigger likewise changes account hash: distinct allowed/denied causes require a projection.
receipt={'version':1,'operation':'purge','intentHash':'d'*64,'beforeHash':'e'*64,'afterHash':'f'*64,'evidenceSnapshotHash':'0'*64,'accountLiabilityHash':original}
assert all(k not in receipt for k in ['stageReceipts','stageIdentityHash','triggerIdentityHash'])
# Illustrative repair alternative only: explicitly retain a canonical immutable trigger projection.
p=lambda s:{'version':1,'dispatch':'1'*64,'trigger':s['attempt']['trigger'],'stageHash':s['attempt']['stageHash'],'stageIdentityHash':s['attempt']['stageIdentityHash']}
assert H(p(a))==H(p(late)) and H(p(a))!=H(p(changed))
print(json.dumps({'result':'PASS','groups':4,'scope':'HASH_OBLIGATION_EXAMPLES_ONLY','skipped':0,'actualNativeManaged':'NOT_RUN'},indent=2))
