import {createServer,type Server,type RequestListener} from "node:http";
import type {AddressInfo} from "node:net";
import {createErasureTransport,ErasureTransportError} from "../../src/users/erasure";
let server:Server;let url:string;let calls=0;
const domain={kind:"user",tenantId:"A",userId:"u"};
const request={domain};
const marker="private-key-must-not-leak";
async function serve(handler:RequestListener) {
  calls=0;server=createServer((req,res)=>{calls++;handler!(req,res);});
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
afterEach(async()=>{server?.closeAllConnections();if(server?.listening)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
for(const status of [200,560])test(`complete official runtime error ${status} confirms rollback without printing native text`,async()=>{
  await serve((_req,res)=>{res.writeHead(status);res.end(JSON.stringify({status:"error",errorMessage:marker}));});
  const t=createErasureTransport({url,deploymentKey:marker});
  try{await expect(t.eraseRecord(request)).rejects.toMatchObject({code:"ERASURE_NATIVE_REFUSAL",outcome:"rolledBack"});expect(calls).toBe(1);}
  finally{t.close();}
});
test("native structured refusal code is sanitized",async()=>{
  await serve((_req,res)=>{res.end(JSON.stringify({status:"error",errorMessage:marker,errorData:{code:marker}}));});
  const t=createErasureTransport({url,deploymentKey:marker});
  try{await expect(t.eraseRecord(request)).rejects.toMatchObject({code:"ERASURE_NATIVE_REFUSAL",outcome:"rolledBack"});expect(calls).toBe(1);}
  finally{t.close();}
});
test("malformed official error envelope remains unknown without resend",async()=>{
  await serve((_req,res)=>{res.writeHead(560);res.end('{"errorMessage":"'+marker+'"}');});
  const t=createErasureTransport({url,deploymentKey:marker});
  try{await expect(t.eraseRecord(request)).rejects.toMatchObject({outcome:"unknown"});expect(calls).toBe(1);}
  finally{t.close();}
});
test("genuine HTTP401 is denied before mutation and does not expose response/key",async()=>{
  await serve((_req,res)=>{res.writeHead(401);res.end(marker);});
  const t=createErasureTransport({url,deploymentKey:marker});
  try{await expect(t.eraseRecord(request)).rejects.toMatchObject({code:"ERASURE_AUTHORIZATION",outcome:"rolledBack"});expect(calls).toBe(1);}
  finally{t.close();}
});
test("close aborts one owned in-flight response and prevents another admission",async()=>{
  let admitted!:()=>void;const seen=new Promise<void>(resolve=>admitted=resolve);
  await serve((_req,_res)=>admitted());
  const t=createErasureTransport({url,deploymentKey:marker});
  const pending=t.eraseRecord(request).catch(error=>error);await seen;t.close();
  const error=await pending;expect(error).toBeInstanceOf(ErasureTransportError);expect(error).toMatchObject({code:"ERASURE_CANCELLED",outcome:"unknown"});
  await expect(t.eraseRecord(request)).rejects.toMatchObject({outcome:"notSent"});expect(calls).toBe(1);
});
