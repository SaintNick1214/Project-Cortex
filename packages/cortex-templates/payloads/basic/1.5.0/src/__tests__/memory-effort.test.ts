import {afterEach,describe,expect,it,vi} from "vitest";
import {createCli} from "../index.js";
import {createApp} from "../server.js";
import {config,runtimeMock} from "./helpers/test-utils.js";
afterEach(()=>vi.restoreAllMocks());
const quiet=()=>vi.spyOn(console,"log").mockImplementation(()=>{});
describe("ordinary runtime effort controls",()=>{
 it("shows Normal locally and preserves omitted legacy request bindings",async()=>{
  const log=quiet(),f=runtimeMock(),factory=vi.fn(()=>f.client),cli=createCli({config,factory,fetchToken:async()=>"opaque"});
  await cli("/effort show");expect(log).toHaveBeenCalledWith(expect.stringContaining("Memory effort: normal"));expect(factory).not.toHaveBeenCalled();
  await cli("/send old-key hello");expect(f.client.submitAndStart.mock.calls[0][0]).not.toHaveProperty("memory");
 });
 it.each(["fast","normal","high","max"])("applies %s only to subsequent submit and recall requests",async effort=>{
  quiet();const f=runtimeMock(),factory=vi.fn(()=>f.client),cli=createCli({config,factory,fetchToken:async()=>"opaque"});
  await cli(`/effort ${effort}`);expect(factory).not.toHaveBeenCalled();await cli("/send selected-key hello");await cli("/recall recall-key useful evidence");
  expect(f.client.submitAndStart.mock.calls[0][0]).toMatchObject({clientRequestId:"selected-key",memory:{effort},parts:[{type:"text",text:"hello"}]});
  expect(f.client.recall).toHaveBeenCalledWith({requestId:"recall-key",text:"useful evidence",memory:{effort}});
 });
 it.each(["instant","FAST","max extra"])("rejects %s without auth/RPC or changing the request mode",async effort=>{
  quiet();const f=runtimeMock(),factory=vi.fn(()=>f.client),cli=createCli({config,factory});
  await expect(cli(`/effort ${effort}`)).rejects.toThrow("INVALID_MEMORY_EFFORT");expect(factory).not.toHaveBeenCalled();
  await cli("/effort show");expect(console.log).toHaveBeenLastCalledWith(expect.stringContaining("Memory effort: normal"));
 });
 it("snapshots selection before an awaited session so later changes cannot mutate pending work",async()=>{
  quiet();const f=runtimeMock();let ready!:()=>void;const pending=new Promise<void>(resolve=>{ready=resolve;});
  f.client.session.mockImplementationOnce(async()=>{await pending;return f.verified;});
  const cli=createCli({config,factory:()=>f.client,fetchToken:async()=>"opaque"});await cli("/effort fast");const first=cli("/send first hello");await cli("/effort max");ready();await first;
  await cli("/send next hello");expect(f.client.submitAndStart.mock.calls.map(([request])=>request.memory)).toEqual([{effort:"fast"},{effort:"max"}]);
 });
 it("HTTP preserves lower request ceilings and Max without an implicit ten-result cap",async()=>{
  const f=runtimeMock(),app=createApp({config,factory:()=>f.client});const headers={authorization:"Bearer a.b.c","content-type":"application/json"};
  const response=await app.request("http://127.0.0.1:3001/chat",{method:"POST",headers,body:JSON.stringify({requestId:"http-chat",message:"hello",memory:{effort:"high",maxEntries:0,maxContextTokens:100}})});
  expect(response.status).toBe(202);expect(f.client.submitAndStart.mock.calls[0][0].memory).toEqual({effort:"high",maxEntries:0,maxContextTokens:100});
  const recall=await app.request("http://127.0.0.1:3001/recall",{method:"POST",headers,body:JSON.stringify({requestId:"http-recall",query:"facts",memory:{effort:"max"}})});
  expect(recall.status).toBe(200);expect(f.client.recall).toHaveBeenCalledWith({requestId:"http-recall",text:"facts",memory:{effort:"max"}});
 });
 it.each([{effort:"instant"},{maxEntries:-1},{maxContextTokens:0},{maxDepth:9},{model:"foreign"}])("HTTP rejects invalid memory %j before constructing a client",async memory=>{
  const f=runtimeMock(),factory=vi.fn(()=>f.client),app=createApp({config,factory});
  const response=await app.request("http://127.0.0.1:3001/chat",{method:"POST",headers:{authorization:"Bearer a.b.c","content-type":"application/json"},body:JSON.stringify({requestId:"invalid",message:"hello",memory})});
  expect(response.status).toBe(400);expect(await response.json()).toMatchObject({code:"INVALID_MEMORY_EFFORT"});expect(factory).not.toHaveBeenCalled();
 });
});
