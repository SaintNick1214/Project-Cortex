/** CLI commands use a fresh host JWT callback and always release the connection. */
import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { RuntimeRunHandle, RuntimeObservation, CortexRuntimeClientOptions } from "@cortexmemory/sdk/runtime";
import type { RuntimeConfig, RuntimeFactory } from "./cortex.js";
import { AppError, CortexRuntimeError, hostToken, withRuntime, identifier } from "./cortex.js";
import { chat, observe, watch } from "./chat.js";
function printObservation(value: RuntimeObservation) {
  console.log(`Run ${value.run.runId}: ${value.state}; memory ${value.run.memoryStatus}; graph ${value.run.graphStatus}`);
  for (const item of value.parts) if (item.part.type === "text" || item.part.type === "text-delta") process.stdout.write(item.part.text);
  if (value.approvals.length) console.log("\nTool approvals:", JSON.stringify(value.approvals));
}
export function createCli(options: { config?: RuntimeConfig; factory?: RuntimeFactory; fetchToken?: CortexRuntimeClientOptions["fetchToken"] } = {}) {
  let conversationId: string | undefined, current: RuntimeRunHandle | undefined;
  return async (line: string): Promise<boolean> => {
    const text = line.trim(); if (!text) return true;
    if (["/exit", "/quit"].includes(text)) return false;
    if (text === "/new") { conversationId = undefined; current = undefined; console.log("Next send starts a new conversation."); return true; }
    if (text === "/clear") { console.clear(); return true; }
    if (text === "/help") { console.log("/send <requestId> <text>, /observe [runId], /watch [runId], /cancel [runId], /approve-input [runId], /approve-tool <operationId> <toolName> <requestHash>, /recall <requestId> <query>, /history, /conversations, /profile, /readiness, /session, /new, /exit. Plain text generates one request ID before submission; it is never automatically retried."); return true; }
    await withRuntime(options.fetchToken ?? (async () => hostToken()), async (client, config) => {
      const [command, ...args] = text.split(/\s+/);
      const handle = async () => { const id = args[0] ?? current?.runId; if (!id) throw new AppError("RUN_ID_REQUIRED"); return client.attach(identifier(id)); };
      if (command === "/session") console.log(JSON.stringify(await client.session()));
      else if (command === "/profile") console.log(JSON.stringify(await client.getDefaultProfile()));
      else if (command === "/readiness") console.log(JSON.stringify(await client.memoryReadiness()));
      else if (command === "/conversations") console.log(JSON.stringify(await client.listConversations()));
      else if (command === "/history") { if (!conversationId) throw new AppError("CONVERSATION_REQUIRED"); console.log(JSON.stringify(await client.messages(conversationId))); }
      else if (command === "/recall") { const [requestId, ...query] = args; console.log(JSON.stringify(await client.recall({ requestId: identifier(requestId), text: query.join(" "), limit: 10 }))); }
      else if (command === "/cancel") console.log(JSON.stringify(await client.cancel(await handle())));
      else if (command === "/approve-input") { const owned = await handle(); await client.approveInput(owned); console.log(JSON.stringify(await client.start(owned, { streaming: true }))); }
      else if (command === "/approve-tool") { if (!current) throw new AppError("RUN_ID_REQUIRED"); const [operationId, toolName, requestHash] = args; console.log(JSON.stringify(await client.approveTool(await client.attach(current.runId), { operationId: identifier(operationId), toolName: identifier(toolName), requestHash: identifier(requestHash) }))); }
      else if (command === "/observe") { const owned = await handle(); current = owned; conversationId = owned.conversationId; printObservation(await observe(client, owned.runId)); }
      else if (command === "/watch") { const owned = await handle(); current = owned; conversationId = owned.conversationId; await watch(client, owned, printObservation); }
      else {
        if (command.startsWith("/") && command !== "/send") throw new AppError("UNKNOWN_COMMAND");
        const requestId = command === "/send" ? identifier(args[0]) : randomUUID(), message = command === "/send" ? args.slice(1).join(" ") : text;
        console.log(`Request ID: ${requestId}`);
        const result = await chat(client, config, { requestId, message, ...(conversationId ? { conversationId } : {}) });
        current = result.handle; conversationId = current.conversationId;
        console.log(`Run ${current.runId}: ${result.run.responseStatus}. Use /observe or /watch to resume; /cancel asks the backend to cancel.`);
      }
    }, options);
    return true;
  };
}
export async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout }), command = createCli();
  console.log("Cortex Basic remote runtime. /help lists commands. Host JWTs are verified by the backend.");
  const stop = () => rl.close(); process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try { while (true) {
    let line: string; try { line = await rl.question("You: "); } catch { break; }
    try { if (!await command(line)) break; } catch (error) {
      const code = error instanceof AppError || error instanceof CortexRuntimeError ? error.code : "RUNTIME_UNAVAILABLE";
      console.error(`Command failed: ${code}. Retain the request/run ID; no paid request is automatically retried.`);
    }
  } } finally { rl.close(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().catch(() => { console.error("CLI configuration failed."); process.exitCode = 1; });
