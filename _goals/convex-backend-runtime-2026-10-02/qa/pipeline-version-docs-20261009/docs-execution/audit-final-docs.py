from pathlib import Path
import json,re,hashlib,subprocess
site=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-docs');docs=site/'docs-site/docs';core=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');qa=core/'_goals/convex-backend-runtime-2026-10-02/qa/pipeline-version-docs-20261009/docs-execution'
before=json.load(open(qa/'inventory-before.json'));hashes={x['path']:x['sha256'] for x in before}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
changes=[];changedids=[];stale=[];broken=[];links=[]
for p in sorted(docs.rglob('*.mdx')):
 path=str(p.relative_to(docs));s=p.read_text();action='created' if path not in hashes else 'unchanged' if hashes[path]==sha(p) else 'modified'
 changes.append({'path':'docs-site/docs/'+path,'action':action,'sha256':sha(p),'lines':s.count('\n')})
 old=next((x for x in before if x['path']==path),None)
 if old:
  oldid=re.search(r'^id:\s*(.+)',old['frontmatter'],re.M);newid=re.search(r'^id:\s*(.+)',s,re.M)
  if (oldid.group(1).strip() if oldid else None)!=(newid.group(1).strip() if newid else None):changedids.append(path)
 current=s.split('## Historical releases')[0] if path=='whats-new.mdx' else s
 for pattern in [r'@cortexmemory/sdk@0\.(?:37|38)',r'@cortexmemory/vercel-ai-provider@0\.(?:37|38)',r'--template chat-sdk --template-version 1\.4\.0',r'AI SDK 6',r'Cloud Mode only']:
  if re.search(pattern,current):stale.append({'page':path,'pattern':pattern})
 current=re.sub(r'^```[^\n]*\n[\s\S]*?^```','',current,flags=re.M)
 for target in re.findall(r'\]\(([^)]+)\)',current):
  file=target.split('#')[0]
  if file.endswith(('.mdx','.md')) and not file.startswith(('http:','https:','/')):
   links.append(target)
   if not (p.parent/file).resolve().exists():broken.append({'page':path,'target':target})
old=subprocess.run(['git','show','HEAD:docs-site/docs/whats-new.mdx'],cwd=site,capture_output=True,text=True,check=True).stdout;new=(docs/'whats-new.mdx').read_text()
released=lambda text:[m.group(1).strip() for m in re.finditer(r'^#{2,6}\s+(.+)',text,re.M) if re.search(r'v\d+\.\d+',m.group(1)) and 'Unreleased' not in m.group(1) and not m.group(1).startswith('Planned')]
historymissing=[h for h in released(old) if h not in released(new)]
prereqs=sum(p.read_text().count('Convex must enable Gateway async-video access') for p in docs.rglob('*.mdx'))
categorychanges=[x['path'] for x in before if x['path'].endswith('.json') and sha(docs/x['path'])!=x['sha256']]
result={'pages':len(changes),'localMarkdownLinks':len(links),'brokenLocalLinks':broken,'staleDefaultPatterns':stale,'changedOriginalIds':changedids,'changedCategoryFiles':categorychanges,'releasedHistoryHeadings':len(released(old)),'missingReleasedHistoryHeadings':historymissing,'supersededHistoricalUnreleasedEntries':['0.37.0','0.38.0'],'videoAccessPrerequisites':prereqs}
json.dump(result,open(qa/'content-link-audit.json','w'),indent=2);json.dump(changes,open(qa/'page-changes.json','w'),indent=2)
inputs=json.load(open(qa/'preserved-inputs.json'))
for x in inputs:x['actualSha256']=sha(Path(x['path']));x['unchanged']=x['actualSha256']==x['sha256']
json.dump(inputs,open(qa/'preserved-input-verification.json','w'),indent=2)
receipt=json.load(open(qa/'source-check-receipt.json'))
for file in receipt['packageVersions']:receipt['packageVersions'][file]=json.load(open(core/file))['version']
for x in receipt['declarations']:x['sha256']=sha(Path(x['path']))
receipt['examples']=len(json.load(open(qa/'examples-inventory.json')))
receipt['sourceContracts']=list(dict.fromkeys(receipt['sourceContracts']+['src/types/index.ts','src/memory/index.ts','src/memory/validators.ts','src/facts/index.ts','src/facts/validators.ts','src/domain/deduplication.ts','src/facts/belief-revision.ts','src/users/export.ts','src/users/erasure.ts','src/contexts/index.ts','src/agents/index.ts','src/governance/index.ts','src/graph/types.ts','src/graph/adapters/CypherGraphAdapter.ts','src/graph/rebuildTransport.ts','src/graph/erasureTransport.ts','src/graph/sync/batchSync.ts','src/graph/schema/initSchema.ts','src/graph/erasure.ts','src/auth/context.ts','src/auth/validators.ts']))
receipt['checks']={name:json.load(open(qa/(name+'-result.json'))) for name in ['examples-typecheck','docusaurus-typecheck','docusaurus-build'] if (qa/(name+'-result.json')).exists()}
json.dump(receipt,open(qa/'source-check-receipt.json','w'),indent=2)
print(json.dumps(result,indent=2));print('Preserved primary inputs:',all(x['unchanged'] for x in inputs));print('Current app versions:',{p:v for p,v in receipt['packageVersions'].items() if 'templates/' in p or 'quickstart/' in p})
assert not broken and not stale and not changedids and not categorychanges and not historymissing and prereqs==1 and all(x['unchanged'] for x in inputs)
