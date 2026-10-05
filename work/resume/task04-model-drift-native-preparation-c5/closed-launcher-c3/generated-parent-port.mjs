import crypto from 'node:crypto';
import path from 'node:path';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
/** Exactly the original hash-bound two-field DUMMY recipe; no caller substitutions. */
export function generateParent(recipe,source){
 if(Buffer.byteLength(source)!==recipe.sourceBytes||hash(source)!==recipe.sourceSHA256||recipe.substitutionsExactly!==2||recipe.historicalActualRead!=='NONE')throw Error('QA_BRIDGE_PARENT_SOURCE');
 const fields=[['historicalSources',recipe.sources],['historicalLocatorHashes',recipe.locatorHashes]];
 let generated=source;
 for(const [field,value]of fields){
  const re=new RegExp('export const '+field+'=Object.freeze\\(\\{[\\s\\S]*?\\}\\);','g'),matches=[...generated.matchAll(re)];
  if(matches.length!==1)throw Error('QA_BRIDGE_PARENT_RECIPE');
  const m=matches[0],replacement='export const '+field+'=Object.freeze('+JSON.stringify(value)+');';
  generated=generated.slice(0,m.index)+replacement+generated.slice(m.index+m[0].length);
 }
 if(Buffer.byteLength(generated)!==recipe.generatedBytes||hash(generated)!==recipe.generatedSHA256)throw Error('QA_BRIDGE_PARENT_RECIPE');
 return generated;
}
export function validateGeneratedParent({recipe,source,generated,destination,policy}){
 const expected=generateParent(recipe,source);
 if(generated!==expected)throw Error('QA_BRIDGE_PARENT_RECIPE');
 if(path.basename(destination)!==recipe.allowedFilename)throw Error('QA_BRIDGE_PARENT_PATH');
 policy.writePath(destination);return generated;
}
