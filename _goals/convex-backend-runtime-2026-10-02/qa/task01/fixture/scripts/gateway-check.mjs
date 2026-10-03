import { writeFileSync } from "node:fs";
import { client } from "./client.mjs";
const c=client();
const result=await c.action("inference:capability",{interface:"chat"});
writeFileSync("../evidence/gateway-chat.json",JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
