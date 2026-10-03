import fs from 'node:fs';
import schema from '../../../../convex-dev/schema.ts';
import * as artifacts from '../../../../convex-dev/artifacts.ts';
const definitions=Object.entries(schema.tables).map(([table,definition])=>({table,indexes:definition[' indexes'](),exported:definition.export()}));
const duplicates=definitions.flatMap(({table,indexes})=>indexes.flatMap((index,i)=>indexes.slice(i+1).filter(other=>JSON.stringify(index.fields)===JSON.stringify(other.fields)).map(other=>({table,indexes:[index.indexDescriptor,other.indexDescriptor],fields:index.fields}))));
const registrations=Object.fromEntries(Object.entries(artifacts).map(([name,value])=>[name,{isPublic:value.isPublic,isInternal:value.isInternal,args:value.exportArgs(),returns:value.exportReturns()}]));
const result={tableCount:definitions.length,indexCount:definitions.reduce((n,t)=>n+t.indexes.length,0),directMainIndexChainCount:(fs.readFileSync('convex-dev/schema.ts','utf8').match(/\.index\(/g)||[]).length,duplicates,definitions,registrations};
fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({tableCount:result.tableCount,indexCount:result.indexCount,directMainIndexChainCount:result.directMainIndexChainCount,duplicates}));
