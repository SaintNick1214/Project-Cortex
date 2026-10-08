import { writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { openOwnedContext } from "../task09-text-client-functional-v2-20261008/native-actual/common.mjs";
const c=await openOwnedContext();
try {
 const paths=[];
 for (const [name,subject,lifetime] of [["expired","cortex-owner",-120],["foreign","foreign-user",7200]]) {
  const path=join(c.handoff.privateDirectory,"task09-ui-"+name+"1.txt");
  await writeFile(path,c.token(subject,lifetime),{mode:0o600});await chmod(path,0o600);
  paths.push({name,path,mode:"0600",subject,lifetimeSeconds:lifetime});
 }
 await writeFile(new URL("./browser-negative-auth-metadata1.json",import.meta.url),JSON.stringify({version:1,paths,valuesPrinted:false,credentialFilesInPrivateDirectory:true,scopeMutation:false,inferenceCalls:0},null,2)+"\n");
 console.log(JSON.stringify({status:"READY",valuesPrinted:false,files:paths.map(x=>x.name)}));
} finally { await c.close(); }
