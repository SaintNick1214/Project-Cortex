from pack import *
def ref(p):
 h,s,_=read(p);return {'path':str(p),'sha256':h,'bytes':s.st_size,'identity':ident(s)}
def main():
 sourcescheck_import=__import__('archive').sourcescheck
 final=sourcescheck_import();assert json.loads((Q/'read-back-verification.json').read_bytes())['physicalRestorationOrRuntimeAcceptance']==False
 # Explicit references bind source manifests themselves, source/frozen ledgers, all indexes and every authenticated locator part.
 references=[ref(root/name) for root,name,_ in SOURCES]
 for root,pinh in [(B/'task04-c5-fresh-review-content-backing','52cfb99229356db5c0b15d12755b48b906611c786570b6a0bac3e5522f3b2e07'),(R/'work/resume/task04-c5-fresh-review-content-backing','e036c65d3137ee6f4c358f4904b0992928a3ca0a284b02a932f93a588bece9cb'),(P,'ddaf7f384beff7a2cca16923b9066fbab5e632019ff9a56cfa59903c0c19168b')]:
  packet=json.loads(pin(root/'selfseal.json',pinh));assert packet['excludedSelfOnly']==['selfseal.json'] and packet['root']==str(root)
  assert {str(p.relative_to(root)) for p in paths(root) if p!=root/'selfseal.json'}=={r['path'] for r in packet['rows']}
  for row in packet['rows']:checkrow(root/row['path'],row)
  references.append(ref(root/'selfseal.json'))
 for p in [Path('/tmp/cortex-root-storage-rescue/c5-prior-content-catalog/catalog.json'),P/'union-catalog.json',P/'index.transport.json.gz',P/'union-catalog.transport.json.gz']:references.append(ref(p))
 for p in [Q/'pack-receipt.json',Q/'read-back-verification.json',W/'virtual-source-mapping.json',T/'index.json',T/'index.transport.json.gz',T/'union-catalog.json',T/'union-catalog.transport.json.gz',T/'source-rows.jsonl',T/'external-references-final.jsonl',T/'captured-preimage-resolutions.json',T/'authenticated-prior-locators.json']:
  references.append(ref(p))
 deps=json.loads((T/'authenticated-prior-locators.json').read_bytes())
 for backing in deps['backings']:
  r=ref(Path(backing['indexPath']));assert r['sha256']==backing['indexSHA256'];references.append(r)
  for part in backing['parts']:
   r=ref(Path(part['sourcePath']));assert r['sha256']==part['sha256'] and r['bytes']==part['bytes'];references.append(r)
 for p in [B/'task04-native-c6-root-frozen-current-schema-inspection.json',B/'task04-native-c6-capture-performance-source-aid-root-inspection.json',B/'task04-c5-fresh-review-content-backing/pack-receipt.json',B/'task04-c5-fresh-review-content-backing-root-inspection.json']:
  references.append(ref(p))
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
  with seal.open('w') as f:json.dump({'root':str(root),'excludedSelfOnly':['selfseal.json'],'scope':'ONLY_NEW_CONTENT_TRANSPORT_NO_ACCEPTANCE_NO_HISTORICAL_REPAIR','sourceFinalCheck':final,'rows':rows,'references':references+sealed},f,separators=(',',':'));f.write('\n')
  for row in rows:checkrow(root/row['path'],row)
  r=ref(seal);sealed.append(r);print(json.dumps({'root':str(root),'rows':len(rows),'selfseal':r}),flush=True)
if __name__=='__main__':main()
