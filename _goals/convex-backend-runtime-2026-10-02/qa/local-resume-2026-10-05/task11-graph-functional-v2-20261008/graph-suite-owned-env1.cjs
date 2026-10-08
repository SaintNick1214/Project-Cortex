const fs=require("node:fs");
const credentials=JSON.parse(fs.readFileSync("/Users/SaintNick/.codex/tmp/cortex-task11-graph-6c189764d39e/credentials.json","utf8"));
for(const [kind,c] of Object.entries(credentials)){
 const prefix=kind.toUpperCase();process.env[prefix+"_URI"]=c.uri;process.env[prefix+"_USERNAME"]=c.username;process.env[prefix+"_PASSWORD"]=c.password;
}
process.env.GRAPH_TESTING_ENABLED="true";
process.env.CONVEX_URL="http://127.0.0.1:1";
process.env.CONVEX_TEST_MODE="local";
