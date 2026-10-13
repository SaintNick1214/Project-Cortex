import { expect, it, vi } from "vitest";
import { createApp } from "../server.js";
import { config, runtimeMock } from "./helpers/test-utils.js";
it.each(["https://foreign.example", "null", "http://foreign.example:3001"])("actual runtime route refuses foreign browser origin %s before remote auth or submission", async origin => {
  const mock=runtimeMock(), factory=vi.fn(()=>mock.client), app=createApp({config,factory});
  const response=await app.request("http://127.0.0.1:3001/chat", {method:"POST",headers:{origin,authorization:"Bearer a.b.c","content-type":"application/json"},body:JSON.stringify({requestId:"ordinary-owned",message:"hello"})});
  expect(response.status).toBe(403);expect(factory).not.toHaveBeenCalled();expect(mock.client.submitAndStart).not.toHaveBeenCalled();
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
});
it("matching local browser origin retains verified ordinary canonical submission and closes the owned client", async()=>{
  const mock=runtimeMock(),factory=vi.fn(()=>mock.client),app=createApp({config,factory});
  const response=await app.request("http://127.0.0.1:3001/chat",{method:"POST",headers:{origin:"http://127.0.0.1:3001",authorization:"Bearer a.b.c","content-type":"application/json"},body:JSON.stringify({requestId:"ordinary-owned",message:"hello"})});
  expect(response.status).toBe(202);expect(mock.client.submitAndStart).toHaveBeenCalledWith(expect.objectContaining({clientRequestId:"ordinary-owned",parts:[{type:"text",text:"hello"}]}), { streaming: true });
  expect(mock.client.close).toHaveBeenCalledOnce();
});
