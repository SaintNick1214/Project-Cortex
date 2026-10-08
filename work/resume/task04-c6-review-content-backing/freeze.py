from pack import *
from measure import sourcecheck

def ref(p):
 h,s,_=read(p);return {'path':str(p),'sha256':h,'bytes':s.st_size,'identity':ident(s)}
def main():
 final=sourcecheck();receipt=json.loads((Q/'pack-receipt.json').read_text());assert json.loads((Q/'read-back-verification.json').read_text())['acceptance'] is False
 refs=[]
 for root,name in [(B/'task04-native-c6-full-composition-restored-review','seal.json'),(R/'work/resume/task04-native-c6-full-composition-restored-review','seal.json'),(Path('/dev/shm/cortex-native-c6-restored-review'),'seal.json'),(B/'task04-c7-exact-identity-source-aid','selfseal.json'),(R/'work/resume/task04-c7-exact-identity-source-aid','selfseal.json')]:refs.append(ref(root/name))
 base=json.loads((T/'baseline-proof.json').read_text())
 for r in base['seals']:refs.append(ref(Path(r['path'])))
 # Bind the exact referenced baseline index and every earlier backing index/part without copying or modifying their bytes.
 basepacket=json.loads(read(Path('/dev/shm/cortex-root-c6-frozen-content-backing/selfseal.json'),True)[2])
 for r in basepacket['references']:
  got=ref(Path(r['path']));assert got['sha256']==r['sha256'] and got['bytes']==r['bytes'];refs.append(got)
 for p in [B/'task04-c6-frozen-content-backing-root-inspection.json',Path(base['indexPath']),Path(base['priorLocatorPath']),T/'index.json',T/'index.transport.json.gz',T/'union-catalog.json',T/'union-catalog.transport.json.gz',T/'baseline-proof.json',T/'source-rows.jsonl',T/'external-references-final.jsonl',T/'captured-preimage-resolutions.json',W/'virtual-source-mapping.json',Q/'pack-receipt.json',Q/'read-back-verification.json',Q/'captured-encoded-post-check.json']:
  refs.append(ref(p))
 for part in base['archive']['parts']:
  got=ref(Path('/dev/shm/cortex-root-c6-frozen-content-backing')/part['name']);assert got['sha256']==part['sha256'] and got['bytes']==part['bytes'];refs.append(got)
 sealed=[]
 for root in [T,W,Q]:
  seal=root/'selfseal.json';seal.open('x').close();rows=[]
  for p in sorted(paths(root),key=lambda p:str(p.relative_to(root))):
   if p==seal:continue
   s=p.lstat();row={'path':str(p.relative_to(root)),'identity':ident(s)}
   if stat.S_ISREG(s.st_mode):h,s,_=read(p);row.update(kind='file',sha256=h,bytes=s.st_size)
   elif stat.S_ISDIR(s.st_mode):row.update(kind='directory',members=sorted(os.listdir(p)))
   elif stat.S_ISLNK(s.st_mode):row.update(kind='symlink',target=os.readlink(p))
   else:raise AssertionError(str(p))
   rows.append(row)
  with seal.open('w') as f:json.dump({'root':str(root),'excludedSelfOnly':['selfseal.json'],'scope':'ONLY_CONTENT_TRANSPORT_NO_ACCEPTANCE_NO_HISTORICAL_REPAIR','sourceFinalCheck':final,'rows':rows,'references':refs+sealed},f,separators=(',',':'));f.write('\n')
  for row in rows:checkrow(root/row['path'],row)
  got=ref(seal);sealed.append(got);print(json.dumps(got),flush=True)
if __name__=='__main__':main()
