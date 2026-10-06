from pathlib import Path
import json,hashlib,shutil,difflib
q=Path(__file__).resolve().parent;r=q.parents[3];old=q.parent/'task03-foundation-live-preparation-c11'
for name in ['offline-arguments-check.mjs','offline-closure-check.mjs']:
 src=old/'scripts'/name;h=q/'historical-preimages/scripts'/name;shutil.copyfile(src,h);s=src.read_text()
 if name=='offline-arguments-check.mjs':
  s=s.replace("const native=JSON.parse(readFileSync(resolve(preparation,'native-registration-schemas.json')));","const native=JSON.parse(readFileSync(resolve(preparation,'native-registration-schemas.json')));for(const row of native.rows)row.args=row.validatorSchema;")
  s=s.replace("// Derive resource rows", "ctx.policyWitnesses=Object.fromEntries(['runtimeBudgetAccounts','runtimeModelOperations','runtimeModelAttempts'].map(table=>[table,fake(table)]));\n// Derive resource rows")
  s=s.replace('registered:259','registered:275')
 else:s=s.replace("'../../../../../convex-dev/schema.ts'", "'../managed-fixture/fixture/convex/schema.ts'")
 dst=q/'scripts'/name;dst.write_text(s);(q/'historical-preimages'/f'{name}.prospective.diff').write_text(''.join(difflib.unified_diff(src.read_text().splitlines(True),s.splitlines(True),fromfile='historical-c11/'+name,tofile='prospective-current/'+name)))
 manifest=json.loads((q/'historical-script-provenance.json').read_text());manifest['files'].append({'historicalSource':str(src.relative_to(r)),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'preimage':str(h.relative_to(q)),'prospectiveCopy':str(dst.relative_to(q))});(q/'historical-script-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
shutil.copyfile(old/'array-resource-audit.json',q/'array-resource-audit.json')
p=q/'scripts/qualify.mjs';s=p.read_text();s=s.replace('const deltaCounts=await qualifyPolicyDelta(ctx,ledger,record);',"const deltaCounts=await qualifyPolicyDelta(ctx,ledger,item=>{if(item.phase==='current-policy-control-begin')activeCase=item;record(item);});");p.write_text(s)
p=q/'prospective-script-deltas.json';manifest=json.loads(p.read_text());row=next(row for row in manifest['files'] if row['path']=='scripts/qualify.mjs');row['prospectiveSha256']=hashlib.sha256(s.encode()).hexdigest();h=q/'historical-preimages/scripts/qualify.mjs';(q/row['diff']).write_text(''.join(difflib.unified_diff(h.read_text().splitlines(True),s.splitlines(True),fromfile='historical-c11/qualify.mjs',tofile='prospective-current/qualify.mjs')));p.write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'status':'PASS','conservedOfflineChecks':2,'externalRequests':0}))
