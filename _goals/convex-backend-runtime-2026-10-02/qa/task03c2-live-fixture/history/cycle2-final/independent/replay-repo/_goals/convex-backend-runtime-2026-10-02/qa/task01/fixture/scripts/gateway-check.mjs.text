import { writeFileSync } from "node:fs";
import { client } from "./client.mjs";
import { evidenceFile } from "./paths.mjs";
evidenceFile("gateway-chat.json");
const c=client();
const result=await c.action("inference:capability",{interface:"chat"});
writeFileSync(evidenceFile("gateway-chat.json"),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
