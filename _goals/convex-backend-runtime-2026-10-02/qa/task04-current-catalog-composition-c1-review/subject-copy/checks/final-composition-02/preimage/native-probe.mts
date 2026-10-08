import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.argv[2];
// Source-pin verified dynamic loader uses the exact installed source module type.
import type schemaType from '../../../../convex-dev/schema';
const schema=(await import(pathToFileURL(path.join(root,'convex-dev/schema.ts')).href)).default as typeof schemaType;
const fragment=await import(pathToFileURL(path.join(root,'convex-dev/runtimePolicySchema.ts')).href) as typeof import('../../../../convex-dev/runtimePolicySchema');
const artifacts=await import(pathToFileURL(path.join(root,'convex-dev/artifacts.ts')).href);
const policies=await import(pathToFileURL(path.join(root,'convex-dev/runtimeModelPolicy.ts')).href);
const bootstrap=await import(pathToFileURL(path.join(root,'convex-dev/runtimeModelPolicyBootstrap.ts')).href);
const definitions=Object.entries(schema.tables).map(([table,definition])=>({table,indexes:definition[' indexes'](),exported:definition.export()}));
const additions=Object.entries(fragment.runtimePolicyTables).map(([table,definition])=>({table,indexes:definition[' indexes'](),exported:definition.export()}));
type NativeRegistration={isPublic?:boolean;isInternal?:boolean;exportArgs():string;exportReturns():string|null};
const isRegistration=(value:unknown):value is NativeRegistration=>(typeof value==='object'||typeof value==='function')&&value!==null&&'exportArgs' in value&&typeof value.exportArgs==='function'&&'exportReturns' in value&&typeof value.exportReturns==='function';
const registrations=(module:Record<string,unknown>)=>Object.fromEntries(Object.entries(module).flatMap(([name,v])=>isRegistration(v)?[[name,{isPublic:v.isPublic,isInternal:v.isInternal,args:v.exportArgs(),returns:v.exportReturns()}]]:[]));
const result={definitions,additions,artifactRegistrations:registrations(artifacts),policyRegistrations:registrations(policies),rootLookup:bootstrap.lookupDeploymentManifest('fixture-forged',1)??null,forgedRootTrusted:bootstrap.isTrustedDeploymentManifest({classification:'reviewed-actual'})};
fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
