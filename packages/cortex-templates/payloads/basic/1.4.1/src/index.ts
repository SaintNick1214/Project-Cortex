/** CLI commands use a fresh host JWT callback and always release the connection. */
import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { RuntimeRunHandle, RuntimeObservation, CortexRuntimeClientOptions } from "@cortexmemory/sdk/runtime";
import type { RuntimeConfig, RuntimeFactory } from "./cortex.js";
import { AppError, CortexRuntimeError, hostToken, withRuntime, identifier } from "./cortex.js";
import { chat, observe, terminal, watch } from "./chat.js";
/** Display only freshly delivered backend parts; reconcile canonical final text with its streamed prefix. */
function observationPrinter(onFirstPrinted?: () => void): (value: RuntimeObservation) => void {
  let attempt: number | undefined, cursor = 0, displayed = "", finalText = "", finalStarted = false, approvals = "", firstQueued = false;
  const print = (text: string, answerText = text) => {
    if (!text) return;
    if (onFirstPrinted && !firstQueued && answerText.trim().length > 0) {
      firstQueued = true; process.stdout.write(text, error => { if (!error) { try { onFirstPrinted(); } catch { /* Optional diagnostics only. */ } } });
    } else process.stdout.write(text);
  };
  return value => {
    if (attempt !== undefined && attempt !== value.run.attemptNumber) {
      if (displayed) process.stdout.write("\n");
      cursor = 0; displayed = ""; finalText = ""; finalStarted = false; approvals = "";
    }
    attempt = value.run.attemptNumber;
    for (const { sequence, part } of value.parts) {
      if (sequence <= cursor) continue; cursor = sequence;
      if (part.type === "text-delta" && !finalStarted) { print(part.text); displayed += part.text; }
      else if (part.type === "text") { finalStarted = true; finalText += part.text; }
    }
    const pending = JSON.stringify(value.approvals);
    if (value.approvals.length && pending !== approvals) console.log("\nTool approvals:", pending);
    approvals = pending;
    if (terminal(value)) {
      // Final text may span multiple chunks/pages. Compare only its complete
      // canonical projection, including a shorter prefix of the streamed draft.
      if (finalStarted && finalText.startsWith(displayed)) print(finalText.slice(displayed.length));
      else if (finalStarted) print(`\nFinal answer:\n${finalText}`, finalText);
      console.log(`\nRun ${value.run.runId}: ${value.state}; memory ${value.run.memoryStatus}; graph ${value.run.graphStatus}`);
    }
  };
}
export interface CliOptions { config?: RuntimeConfig; factory?: RuntimeFactory; fetchToken?: CortexRuntimeClientOptions["fetchToken"]; signal?: AbortSignal }
export function createCli(options: CliOptions = {}) {
  let conversationId: string | undefined, current: RuntimeRunHandle | undefined, commandSequence = 0, latencyAt = 0;
  const clock = () => {
    let at: number | undefined; try { at = performance.now(); } catch { /* Diagnostic clock fallback only. */ }
    if (at === undefined || !Number.isFinite(at)) { try { at = Date.now(); } catch { at = latencyAt; } }
    latencyAt = Math.max(latencyAt, Number.isFinite(at) ? at : 0); return latencyAt;
  };
  return async (line: string): Promise<boolean> => {
    if (options.signal?.aborted) throw new AppError("REQUEST_ABORTED", 499);
    const trace = process.env.CORTEX_RUNTIME_LATENCY_TRACE === "1", submittedAt = trace ? clock() : undefined;
    const text = line.trim(); if (!text) return true;
    if (["/exit", "/quit"].includes(text)) return false;
    if (text === "/new") { conversationId = undefined; current = undefined; console.log("Next send starts a new conversation."); return true; }
    if (text === "/clear") { console.clear(); return true; }
    if (text === "/help") { console.log("/send <requestId> <text>, /observe [runId], /watch [runId], /cancel [runId], /approve-input [runId], /approve-tool <operationId> <toolName> <requestHash>, /recall <requestId> <query>, /history, /conversations, /profile, /readiness, /session, /new, /exit. Plain text generates one request ID and displays the backend response; /send returns the handle for later observation. No request is automatically retried."); return true; }
    const isSubmission = !text.startsWith("/") || text.split(/\s+/, 1)[0] === "/send", commandId = ++commandSequence;
    const latency = (phase: "submit.begin" | "answer.first_printed", atMs: number) => {
      if (!trace || !isSubmission || submittedAt === undefined) return;
      try { console.error(JSON.stringify({ type: "cortex-cli-latency", version: 1, phase, atMs, commandId, method: "cli.chat",
        ...(phase === "answer.first_printed" ? { durationMs: Math.max(0, atMs - submittedAt) } : {}) })); } catch { /* Optional diagnostics only. */ }
    };
    if (submittedAt !== undefined) latency("submit.begin", submittedAt);
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
      else if (command === "/observe") { const owned = await handle(); current = owned; conversationId = owned.conversationId; observationPrinter()(await observe(client, owned.runId)); }
      else if (command === "/watch") { const owned = await handle(); current = owned; conversationId = owned.conversationId; await watch(client, owned, observationPrinter(), options.signal); }
      else {
        if (command.startsWith("/") && command !== "/send") throw new AppError("UNKNOWN_COMMAND");
        const requestId = command === "/send" ? identifier(args[0]) : randomUUID(), message = command === "/send" ? args.slice(1).join(" ") : text;
        console.log(`Request ID: ${requestId}`);
        const result = await chat(client, config, { requestId, message, ...(conversationId ? { conversationId } : {}) });
        if (options.signal?.aborted) throw new AppError("REQUEST_ABORTED", 499);
        current = result.handle; conversationId = current.conversationId;
        console.log(`Run ${current.runId}: ${result.run.responseStatus}. Use /observe or /watch to resume; /cancel asks the backend to cancel.`);
        if (command !== "/send") await watch(client, current, observationPrinter(trace ? () => latency("answer.first_printed", clock()) : undefined), options.signal);
      }
    }, options);
    return true;
  };
}
export async function main(options: Omit<CliOptions, "signal"> & { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream } = {}) {
  const controller = new AbortController(), rl = createInterface({ input: options.input ?? process.stdin, output: options.output ?? process.stdout });
  const command = createCli({ ...options, signal: controller.signal });
  console.log("Cortex Basic remote runtime. /help lists commands. Host JWTs are verified by the backend.");
  const stop = () => { controller.abort(); rl.close(); }; process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try { while (!controller.signal.aborted) {
    let line: string; try { line = await rl.question("You: "); } catch { break; }
    try { if (!await command(line)) break; } catch (error) {
      if (controller.signal.aborted) break;
      const code = error instanceof AppError || error instanceof CortexRuntimeError ? error.code : "RUNTIME_UNAVAILABLE";
      console.error(`Command failed: ${code}. Retain the request/run ID; no paid request is automatically retried.`);
    }
  } } finally { controller.abort(); rl.close(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().catch(() => { console.error("CLI configuration failed."); process.exitCode = 1; });
