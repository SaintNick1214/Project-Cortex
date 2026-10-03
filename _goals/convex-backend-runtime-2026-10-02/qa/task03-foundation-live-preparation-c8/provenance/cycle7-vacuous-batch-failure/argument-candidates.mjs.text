/** Validator-valid shapes. Every v.id resolves an actually seeded ID, never an encoded guess.
 * Semantic fixture bindings remain per-path reviewer obligations. */
export function candidate(schema,ctx,key='argument') {
 const p=ctx.run+':arg-'+key;
 if(schema.type==='optional')return ['tenantId','memorySpaceId'].includes(key)?candidate(schema.parameters[0],ctx,key):undefined;
 if(schema.type==='object'){const result={};for(const [name,child]of Object.entries(schema.fields)){const value=candidate(child,ctx,name);if(value!==undefined)result[name]=value;}return result;}
 if(schema.type==='string'){
  const fixed={tenantId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.memorySpaceId,userId:ctx.users.reader,principalId:ctx.principals.reader,membershipId:ctx.references.reader.membershipId,grantId:ctx.grants.reader,ownerPrincipalId:ctx.principals.reader,agentId:ctx.run+':agents-owned',artifactId:ctx.run+':artifacts-owned',issuer:ctx.issuer,subject:ctx.identities.reader};return fixed[key]??p;
 }
 if(['number','float64'].includes(schema.type))return key.toLowerCase().includes('timestamp')?Date.now():1;
 if(schema.type==='boolean')return false;
 if(schema.type==='null')return null;
 if(schema.type==='any')return {};
 if(schema.type==='literal')return schema.parameters[0].value;
 if(schema.type==='literalValue')return schema.value;
 if(schema.type==='union')return candidate(schema.parameters[0],ctx,key);
 if(schema.type==='array')return [];
 if(schema.type==='record')return {};
 if(schema.type==='bytes')return new ArrayBuffer(0);
 if(schema.type==='int64')return 1n;
 if(schema.type==='id'){
  const table=schema.parameters[0].value;
  const id=table==='_storage'?ctx.files[0]?.id:ctx.refs.find(ref=>ref.table===table)?.id;
  if(!id)throw new Error('BLOCKED_REAL_ID_REQUIRED:'+table);return id;
 }
 if(schema.type==='objectValidator')return candidate(schema.parameters[0],ctx,key);
 // v.object() uses an object parameter; same descriptor name is disambiguated above.
 throw new Error('BLOCKED_UNSUPPORTED_VALIDATOR:'+schema.type);
}
export function argumentsFor(row,ctx){return candidate(row.validatorSchema,ctx);}
