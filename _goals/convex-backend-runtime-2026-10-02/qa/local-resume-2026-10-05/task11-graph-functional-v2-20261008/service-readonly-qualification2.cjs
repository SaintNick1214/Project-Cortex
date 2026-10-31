const fs = require("node:fs");
const path = require("node:path");
const {createRequire} = require("node:module");
const load = createRequire(path.resolve("package.json"));
const neo4j = load("neo4j-driver");
const assert = require("node:assert/strict");
const credentials = JSON.parse(fs.readFileSync("/Users/SaintNick/.codex/tmp/cortex-task11-graph-6c189764d39e/credentials.json", "utf8"));
const out = {version:1, scope:"ACTUAL_OWNED_LINUX_GRAPH_READONLY_PREREQUISITE",node:process.version,task11Accepted:false,productWorkerQualified:false,services:JSON.parse(fs.readFileSync(path.join(__dirname,"service-readonly-qualification1.json"),"utf8")).services,previousPartialReceipt:"service-readonly-qualification1.json",priorFailure:"Memgraph returned explicit Unauthenticated; original test oracle omitted that legitimate denial code"};
(async()=>{
  for(const [kind,c] of Object.entries(credentials).filter(([kind])=>kind==="memgraph")){
    const driver = neo4j.driver(c.uri,neo4j.auth.basic(c.username,c.password),{maxConnectionPoolSize:2,connectionAcquisitionTimeout:5000,maxTransactionRetryTime:0});
    let last;
    const started=Date.now();
    try{
      while(Date.now()-started<45000){
        const session=driver.session();
        try { const result=await session.run("RETURN 1 AS value",{}, {timeout:5000});assert.equal(result.records[0].get("value").toNumber(),1);last=null;break; }
        catch(error){last=error;await new Promise(resolve=>setTimeout(resolve,1000));}
        finally{await session.close();}
      }
      if(last)throw last;
      const session=driver.session();let count;
      try{count=(await session.run("MATCH (n) RETURN count(n) AS total",{}, {timeout:5000})).records[0].get("total").toNumber();assert.equal(count,0);}
      finally{await session.close();}
      const denied=neo4j.driver(c.uri,neo4j.auth.basic(c.username,"wrong-test-only-password"),{maxConnectionPoolSize:1,connectionAcquisitionTimeout:5000,maxTransactionRetryTime:0});
      const wrong=denied.session();let denial;
      try{await wrong.run("RETURN 1 AS value",{}, {timeout:5000});throw new Error("WRONG_PASSWORD_ACCEPTED");}
      catch(error){if(error.message==="WRONG_PASSWORD_ACCEPTED")throw error;denial=String(error.code??error.name);assert.match(denial,/Unauthorized|Authentication|Unauthenticated/);}
      finally{await wrong.close();await denied.close();}
      out.services.push({service:kind,containerId:c.containerId,uri:c.uri,authenticatedReturnOne:true,emptyProspectiveBaseline:true,nodeCount:count,wrongPasswordDenied:true,denialCode:denial,elapsedMs:Date.now()-started,clientsClosed:true});
    }finally{await driver.close();}
  }
  out.status="PASS";
})().catch(error=>{out.status="FAIL";out.error={name:error.name,code:error.code,message:String(error.message).replaceAll(credentials.neo4j.password,"[redacted]").replaceAll(credentials.memgraph.password,"[redacted]")};process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(__dirname,"service-readonly-qualification2.json"),JSON.stringify(out,null,2)+"\n");console.log(JSON.stringify(out));});
