from pathlib import Path
import json,hashlib,difflib,shutil
q=Path(__file__).resolve().parent
for name in ['offline-arguments.stdout','offline-arguments.stderr','conservation-offline-command-receipts.json']:
 shutil.copyfile(q/name,q/('native-argument-binding-original-failure-'+name))
p=q/'scripts/argument-candidates.mjs';s=p.read_text();insert="""/** Installed Convex exportArgs JSON has value/fieldType/tableName descriptors; the
 * conserved C11 AST descriptors use fields/parameters. Never silently interchange them. */
function nativeCandidate(schema,ctx,key='argument') {
 if(schema.type==='object'){const result={};for(const [name,field] of Object.entries(schema.value)){if(field.optional&&!['tenantId','memorySpaceId'].includes(name))continue;result[name]=nativeCandidate(field.fieldType,ctx,name);}return result;}
 if(schema.type==='union')return nativeCandidate(schema.value[0],ctx,key);
 if(schema.type==='literal')return schema.value;
 if(schema.type==='array')return [];
 if(schema.type==='record')return {};
 if(schema.type==='id'){const table=schema.tableName,id=table==='_storage'?ctx.files[0]?.id:ctx.refs.find(ref=>ref.table===table)?.id??ctx.policyWitnesses?.[table];if(!id)throw new Error('BLOCKED_REAL_ID_REQUIRED:'+table);return id;}
 if(schema.type==='bigint')return 1n;
 return candidate(schema,ctx,key);
}
""";point='export function argumentsFor(row,ctx){const args=candidate(row.validatorSchema,ctx);';assert point in s;s=s.replace(point,insert+"export function argumentsFor(row,ctx){const args=row.argumentSchemaFormat==='NATIVE_EXPORT_ARGS_JSON_V1'?nativeCandidate(row.validatorSchema,ctx):candidate(row.validatorSchema,ctx);");p.write_text(s)
p=q/'path-ledger.json';l=json.loads(p.read_text());changed=0
for row in l['cases']:
 if row['group']=='model-policy-delta':row['argumentSchemaFormat']='NATIVE_EXPORT_ARGS_JSON_V1';row['argumentsStatus']='NATIVE_VALIDATOR_SHAPE_VERIFIED_REAL_IDS_REQUIRED_LIVE';changed+=1
assert changed==16;p.write_text(json.dumps(l,indent=2)+'\n')
p=q/'prospective-script-deltas.json';m=json.loads(p.read_text());row=next(x for x in m['files'] if x['path']=='scripts/argument-candidates.mjs');row['prospectiveSha256']=hashlib.sha256(s.encode()).hexdigest();h=q/'historical-preimages/scripts/argument-candidates.mjs';(q/row['diff']).write_text(''.join(difflib.unified_diff(h.read_text().splitlines(True),s.splitlines(True),fromfile='historical-c11/argument-candidates.mjs',tofile='prospective-current/argument-candidates.mjs')));p.write_text(json.dumps(m,indent=2)+'\n')
(q/'native-argument-binding-repair.json').write_text(json.dumps({'scope':'PROSPECTIVE_QA_ONLY','originalFailure':'Installed native JSON addition schema was passed to the historical AST-only argument author. Explicit native schema format/reader added for16 new rows; original259 schema author unchanged.','changedAdditionRows':16,'productSourceAlterations':0,'liveCalls':0,'originalFailureReceipt':'native-argument-binding-original-failure-conservation-offline-command-receipts.json'},indent=2)+'\n')
print(json.dumps({'status':'REPAIRED_QA_ONLY_RERUN_REQUIRED','changedAdditionRows':16,'productSourceAlterations':0}))
