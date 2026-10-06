const fs = require("node:fs");
const path = require("node:path");
const attempts=[];
function deny(surface) { return function() { attempts.push(surface); throw new Error("OFFLINE_EXTERNAL_REQUEST_PROHIBITED:"+surface); }; }
globalThis.fetch=deny("fetch");
for (const [module,names] of [["node:http",["request","get"]],["node:https",["request","get"]],["node:net",["connect","createConnection"]],["node:tls",["connect"]],["node:dns",["lookup","resolve","resolve4","resolve6"]]]) {
 const api=require(module); for(const name of names) api[name]=deny(module+":"+name);
}
process.once("exit",()=>fs.writeFileSync(path.join(__dirname,"tmp","network-"+process.pid+".json"),JSON.stringify({pid:process.pid,deniedAttempts:attempts.length,surfaces:attempts},null,2)+"\n",{flag:"wx"}));
