"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { CortexRuntimeClient, runtimePublicPart } from "@cortexmemory/sdk/runtime";
import type { RuntimeRun, RuntimeRunHandle, RuntimeSession, RuntimeObservation, RuntimeToolApproval,
  RuntimeEmbeddingProfile, RuntimeRecallResult, RuntimeMemoryReadiness, RuntimeMemoryStage, RuntimePublicPart } from "@cortexmemory/sdk/runtime";
import { MemoryEffortControl, MemoryEffortStatus } from "./MemoryEffortControl";
import type { MemoryEffort } from "@cortexmemory/sdk/runtime";
import { CortexRemoteTransport } from "@cortexmemory/vercel-ai-provider/remote";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { RuntimeLatencyEvent } from "@cortexmemory/sdk/runtime";
import { RuntimeMediaPanel } from "./RuntimeMediaPanel";
import { createChatLatencyTrace } from "@/lib/chat-latency";

const button = "rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-cortex-400";
const input = "w-full rounded-lg border border-white/20 bg-gray-950 p-3 text-white focus-visible:outline-2 focus-visible:outline-cortex-400";
function browserNow() { return performance.now(); }
function errorCode(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : "RUNTIME_REQUEST_FAILED";
}
type Connection = { client: CortexRuntimeClient; session: RuntimeSession };
function transcriptParts(parts: readonly unknown[]): UIMessage["parts"] {
  return parts.flatMap(part => {
    const value = runtimePublicPart(part);
    if (value.type === "text") return [value] as UIMessage["parts"];
    if (value.type === "media-job") return [{ type: "data-cortex-media-job", data: value }] as UIMessage["parts"];
    if (value.type === "artifact") return [{ type: "data-cortex-artifact", data: value }] as UIMessage["parts"];
    if (value.type === "tool") return [{ type: "data-cortex-tool", data: value }] as UIMessage["parts"];
    return [];
  });
}
function RuntimePart({ part, onOpenMedia }: { part: UIMessage["parts"][number]; onOpenMedia: () => void }) {
  if (part.type === "text") return <p className="whitespace-pre-wrap break-words">{part.text}</p>;
  if (!["data-cortex-tool", "data-cortex-artifact", "data-cortex-media-job"].includes(part.type) || !("data" in part)) return null;
  let value: RuntimePublicPart;
  try { value = runtimePublicPart(part.data); } catch { return null; }
  if (value.type === "tool") return <p className="mt-2 text-sm text-gray-300">Backend tool: {value.name} · {value.phase}</p>;
  if (value.type === "artifact") return <p className="mt-2 break-all text-sm text-gray-300">Memory operation receipt: {value.artifactId}</p>;
  if (value.type === "media-job") return <button className={`${button} mt-3`} onClick={onOpenMedia}>Open saved {value.kind} job</button>;
  return null;
}

/** Development auth adapter. Host JWTs are verified only by Convex; tokens never enter storage. */
export function RuntimeQuickstart() {
  const token = useRef<string | null>(null);
  const owned = useRef<CortexRuntimeClient | null>(null);
  const [credential, setCredential] = useState("");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const assetHttpUrl = process.env.NEXT_PUBLIC_CORTEX_HTTP_URL;
  const [agentId, setAgentId] = useState(process.env.NEXT_PUBLIC_CORTEX_AGENT_ID ?? "");
  const [requestedAgentId, setRequestedAgentId] = useState(process.env.NEXT_PUBLIC_CORTEX_AGENT_ID ?? "");
  const [agentVersion, setAgentVersion] = useState(Number(process.env.NEXT_PUBLIC_CORTEX_AGENT_VERSION ?? "1"));
  const [requestedVersion, setRequestedVersion] = useState(process.env.NEXT_PUBLIC_CORTEX_AGENT_VERSION ?? "1");
  const [effortSupported,setEffortSupported]=useState(false);
  const [memoryMode, setMemoryMode] = useState<string | null>(null);
  const denyConnection = useCallback((caught: unknown) => {
    if (!owned.current) return;
    setError(errorCode(caught)); setConnection(null); token.current = null;
    const client = owned.current; owned.current = null; void client?.close();
  }, []);
  useEffect(() => () => { token.current = null; void owned.current?.close(); owned.current = null; }, []);
  async function authenticate(event: FormEvent) {
    event.preventDefault(); if (!url || !credential.trim() || busy) return;
    setBusy(true); setError(null); token.current = credential.trim(); setCredential("");
    try {
      if (connection) {
        await connection.client.refreshAuth();
        const current = await connection.client.session();
        if (current.principalId !== connection.session.principalId || current.tenantId !== connection.session.tenantId
          || current.memorySpaceId !== connection.session.memorySpaceId) throw { code: "AUTHORITY_CHANGED" };
      } else {
        await owned.current?.close();
        let candidate: CortexRuntimeClient | undefined;
        const client = new CortexRuntimeClient({ deploymentUrl: url, fetchToken: async () => token.current,
          ...(assetHttpUrl ? { assetHttpUrl } : {}),
          ...(process.env.NEXT_PUBLIC_CORTEX_LATENCY_TRACE === "1" ? { onLatencyEvent: (event: RuntimeLatencyEvent) => console.log(JSON.stringify({ type: "cortex-client-latency", ...event })) } : {}),
          ...(process.env.NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID ? { scope: { memorySpaceId: process.env.NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID } } : {}),
          onAuthChange: authenticated => {
            if (!authenticated && candidate && owned.current === candidate) {
              setConnection(null); setError("UNAUTHENTICATED"); owned.current = null; token.current = null; void candidate.close();
            }
          } });
        candidate = client;
        owned.current = client; const session = await client.session();
        if (!agentId) throw { code: "AGENT_REQUIRED" };
        const definition = await client.getDefinition(agentId, agentVersion); setMemoryMode(definition.memoryMode); setEffortSupported(definition.inputSelectionVersion===2&&definition.memoryEffortPolicyVersion===1);
        setConnection({ client, session }); setChatKey(key => key + 1);
      }
    } catch (caught) {
      const client = owned.current; owned.current = null; token.current = null;
      setConnection(null); setError(errorCode(caught)); await client?.close();
    } finally { setBusy(false); }
  }
  async function disconnect() {
    const client = owned.current; owned.current = null; token.current = null;
    setConnection(null); setCredential(""); setError(null); await client?.close();
  }
  async function selectVersion(event: FormEvent) {
    event.preventDefault(); if (!connection || !requestedAgentId.trim()) return;
    setBusy(true); setError(null);
    try {
      const version = Number(requestedVersion);
      const definition = await connection.client.getDefinition(requestedAgentId.trim(), version);
      setAgentId(definition.agentId); setAgentVersion(version); setMemoryMode(definition.memoryMode); setEffortSupported(definition.inputSelectionVersion===2&&definition.memoryEffortPolicyVersion===1); setChatKey(key => key + 1);
    } catch (caught) { setError(errorCode(caught)); } finally { setBusy(false); }
  }
  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-sm font-medium text-cortex-400">Cortex</p><h1 className="text-3xl font-semibold">Memory chat</h1>
        <p className="mt-2 text-gray-300">Responses and memory updates stay available across connections.</p></div>
      {connection && <button className={button} onClick={() => void disconnect()}>Sign out</button>}
    </header>
    {(!url || !agentId || !Number.isSafeInteger(agentVersion) || agentVersion < 1) && <p role="alert" className="mb-4 rounded-lg border border-amber-400/40 p-4">Configure the Convex URL and a published agent version before connecting.</p>}
    <section className="mb-6 rounded-xl border border-white/15 p-5" aria-label="Authentication">
      <h2 className="text-lg font-semibold">{connection ? "Refresh credentials" : "Connect"}</h2>
      <p className="mb-4 mt-2 text-sm text-gray-300">Use an access token issued by your host authentication provider. It stays in memory for this session.</p>
      <form onSubmit={authenticate} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1">Access token<input type="password" autoComplete="off" spellCheck={false} className={input}
          value={credential} onChange={event => setCredential(event.target.value)} required /></label>
        <button className={button} type="submit" disabled={busy || !credential.trim() || !url || !agentId}>{busy ? "Connecting…" : connection ? "Refresh token" : "Connect"}</button>
      </form>
      {connection && <p className="mt-3 break-all text-sm text-gray-300" data-testid="verified-scope">Connected to {connection.session.memorySpaceId} in {connection.session.tenantId}.</p>}
      {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
    </section>
    {connection && <form onSubmit={selectVersion} className="mb-6 flex flex-wrap items-end gap-3" aria-label="Agent configuration">
      <label className="w-full min-w-0 sm:min-w-64 sm:flex-1">Published agent<input className={input} value={requestedAgentId} onChange={event => setRequestedAgentId(event.target.value)} required /></label>
      <label className="w-32">Agent version<input type="number" min={1} step={1} className={input} value={requestedVersion} onChange={event => setRequestedVersion(event.target.value)} /></label>
      <button className={button} disabled={busy}>Use agent version</button>
      <p className="w-full py-2 text-sm text-gray-300">Current version: {agentVersion} · Memory mode: {memoryMode ?? "loading"}</p>
    </form>}
    {connection && agentId && <RuntimeChat key={chatKey} connection={connection} effortSupported={effortSupported} agentId={agentId} agentVersion={agentVersion} onNewChat={() => setChatKey(key => key + 1)} onDenied={denyConnection} />}
  </main>;
}

function RuntimeChat({ connection, agentId, agentVersion, onNewChat, onDenied, effortSupported }: { effortSupported:boolean; connection: Connection; agentId: string; agentVersion: number; onNewChat: () => void; onDenied: (error: unknown) => void }) {
  const [effort,setEffort]=useState<MemoryEffort>("normal");
  const [prompt, setPrompt] = useState("");
  const [handle, setHandle] = useState<RuntimeRunHandle | null>(null);
  const [run, setRun] = useState<RuntimeRun | null>(null);
  const [retainedRunId, setRetainedRunId] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<RuntimeToolApproval[]>([]);
  const [tools, setTools] = useState<Record<string, string>>({});
  const [runId, setRunId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [profile, setProfile] = useState<RuntimeEmbeddingProfile | null>(null);
  const [query, setQuery] = useState("");
  const [recall, setRecall] = useState<RuntimeRecallResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [historyIncomplete, setHistoryIncomplete] = useState(false);
  const [readiness, setReadiness] = useState<RuntimeMemoryReadiness | null>(null);
  const [stages, setStages] = useState<RuntimeMemoryStage[]>([]);
  const [checking, setChecking] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [mediaRefs, setMediaRefs] = useState<Record<string, Extract<RuntimePublicPart, { type: "media-job" }>>>({});
  const latency = useMemo(() => createChatLatencyTrace(process.env.NEXT_PUBLIC_CORTEX_LATENCY_TRACE === "1", {
    now: browserNow, emit: event => console.log(JSON.stringify(event)), visibility: () => document.visibilityState,
    afterPaint: callback => {
      let second = 0;
      const first = requestAnimationFrame(() => { second = requestAnimationFrame(callback); });
      return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
    },
  }), []);
  const transport = useMemo(() => new CortexRemoteTransport({ client: connection.client, agentId, agentVersion,
    onRun: value => { latency.bind(value.runId); setHandle(value); setRunId(value.runId); setRun(null); setRetainedRunId(null); setTools({}); setMediaRefs({}); },
    onObservation: (value: RuntimeObservation) => {
      setRun(value.run); setApprovals(value.approvals);
      // The transport already protects live delivery. Hand its drained terminal
      // response to a continuing guard for retained text and later memory status.
      if (value.parts.length < 100 && ["complete", "failed", "cancelled"].includes(value.run.responseStatus)) setRetainedRunId(value.run.runId);
      setTools(old => {
        const next = { ...old };
        for (const entry of value.parts) if (entry.part.type === "tool") next[entry.part.toolCallId] = `${entry.part.name}: ${entry.part.phase}`;
        return next;
      });
      setMediaRefs(old => {
        const next = { ...old };
        for (const entry of value.parts) if (entry.part.type === "media-job") next[entry.part.jobId] = entry.part;
        return next;
      });
    } }), [connection.client, agentId, agentVersion, latency]);
  const chat = useChat({ transport, onFinish: result => {
    if (!result.isAbort && !result.isDisconnect && !result.isError && result.finishReason === "stop") latency.transportComplete(result.message.id);
  }, onError: caught => {
    latency.failed();
    setError(errorCode(caught));
    // A failed stream may leave previously delivered private text on screen.
    // Keep that projection guarded even when no terminal page was delivered.
    setRetainedRunId(transport.run?.runId ?? null);
    if (["FORBIDDEN", "UNAUTHENTICATED", "SESSION_CHANGED", "AUTHORITY_CHANGED", "AUTHORITY_EXPIRED", "AUTHENTICATION_TIMEOUT", "AUTH_TOKEN_FETCH_FAILED", "RPC_DEADLINE_EXCEEDED", "CLIENT_CLOSED"].includes(errorCode(caught))) onDenied(caught);
  } });
  const setMessages = chat.setMessages;
  useLayoutEffect(() => { latency.committed(chat.messages); }, [latency, chat.messages, chat.status]);
  useLayoutEffect(() => { if (run?.responseStatus === "complete") latency.responseStatusComplete(run.runId); }, [latency, run?.runId, run?.responseStatus]);
  useEffect(() => () => latency.dispose(), [latency]);
  const deny = useCallback((caught: unknown) => {
    setError(errorCode(caught)); setMessages([]); setRecall(null); setApprovals([]); setTools({}); setMediaRefs({}); setReadiness(null); setProfile(null);
    if (["FORBIDDEN", "UNAUTHENTICATED", "SESSION_CHANGED", "AUTHORITY_CHANGED", "AUTHORITY_EXPIRED", "AUTHENTICATION_TIMEOUT", "AUTH_TOKEN_FETCH_FAILED", "RPC_DEADLINE_EXCEEDED", "CLIENT_CLOSED"].includes(errorCode(caught))) onDenied(caught);
  }, [onDenied, setMessages]);
  useEffect(() => () => transport.disconnect(), [transport]);
  useEffect(() => {
    let active = true;
    connection.client.getEmbeddingProfile().then(value => { if (active) setProfile(value.profile); }).catch(caught => { if (active) setError(errorCode(caught)); });
    return () => { active = false; };
  }, [connection.client]);
  useEffect(() => {
    if (!handle || disconnected || retainedRunId !== handle.runId) return;
    // Keep final delivery authorization reactive after response completion and while memory catches up.
    const stopDelivery = connection.client.watchObservation(handle, value => setRun(value.run), deny, { finalOnly: true });
    return () => { stopDelivery(); };
  }, [connection.client, handle, disconnected, retainedRunId, deny]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!prompt.trim()) return;
    setError(null); setDisconnected(false); const text = prompt; setPrompt("");
    latency.begin(chat.messages.length);
    try { await chat.sendMessage({ text },effortSupported?{body:{memory:{effort}}}:undefined); } catch (caught) { latency.failed(); setError(errorCode(caught)); }
  }
  async function resume(attach = false) {
    setError(null);
    try {
      if (attach) {
        const value = await connection.client.attach(runId.trim());
        const record = await connection.client.get(value);
        const page = await connection.client.messages(value.conversationId, { limit: 100 });
        const finalIds = new Set(record.outputMessageIds);
        const history: UIMessage[] = page.page.flatMap(message => {
          if (finalIds.has(message.id) || message.role === "tool" || !message.parts.length
            || message.role === "assistant" && message.status !== "success") return [];
          return [{ id: message.id, role: message.role, parts: transcriptParts(message.parts) }];
        });
        transport.attach(value); setHandle(value); chat.setMessages(history); setHistoryIncomplete(!page.isDone);
      }
      setDisconnected(false); await chat.resumeStream();
    } catch (caught) { setError(errorCode(caught)); }
  }
  async function search(event: FormEvent) {
    event.preventDefault(); setSearching(true); setRecall(null); setError(null);
    try { setRecall(await connection.client.recall({ text: query, requestId: crypto.randomUUID(), memory:{effort} })); }
    catch (caught) { setError(errorCode(caught)); } finally { setSearching(false); }
  }
  async function checkReadiness(event: FormEvent) {
    event.preventDefault(); setChecking(true); setReadiness(null); setError(null);
    try { setReadiness(await connection.client.memoryReadiness({ strictStages: stages, ...(profile ? { expectedProfileId: profile.profileId } : {}) })); }
    catch (caught) { setError(errorCode(caught)); }
    finally { setChecking(false); }
  }
  const mediaJobIds = useMemo(() => {
    const ids = new Set(Object.keys(mediaRefs));
    for (const message of chat.messages) for (const part of message.parts) if (part.type === "data-cortex-media-job") {
      try { const value = runtimePublicPart(part.data); if (value.type === "media-job") ids.add(value.jobId); } catch { /* Invalid projections grant no access and are not rendered. */ }
    }
    return [...ids].slice(0, 20);
  }, [mediaRefs, chat.messages]);
  const active = chat.status === "submitted" || chat.status === "streaming";
  const terminal = !!run && ["complete", "failed", "cancelled"].includes(run.responseStatus);
  return <>
    <section aria-label="Chat" className="rounded-xl border border-white/15 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Conversation</h2><button className={button} onClick={onNewChat} disabled={active && !disconnected}>New chat</button></div>
      <div className="min-h-40 space-y-4" aria-label="Messages" aria-live="polite" aria-relevant="additions text">
        {!chat.messages.length && <p className="text-gray-400">Tell Cortex something you want to remember, or ask about earlier context.</p>}
        {chat.messages.map(message => <article key={message.id} className="rounded-lg bg-white/5 p-4"><p className="mb-2 text-sm font-medium text-cortex-300">{message.role === "user" ? "You" : "Cortex"}</p>
          {message.parts.map((part, index) => <RuntimePart key={index} part={part} onOpenMedia={() => setShowMedia(true)} />)}</article>)}
      </div>
      {historyIncomplete && <p className="mt-3 text-sm text-amber-300">This view contains the first 100 transcript messages. Older or later pages remain available through the paginated transcript API.</p>}
      <MemoryEffortControl value={effort} onChange={setEffort} supported={effortSupported} disabled={active||disconnected} />
      <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1">Message<textarea className={input} value={prompt} onChange={event => setPrompt(event.target.value)} rows={3} required disabled={active || disconnected} /></label>
        <button className={button} disabled={active || disconnected || !prompt.trim()}>{active ? "Responding…" : "Send"}</button></form>
      <MemoryEffortStatus trace={run?.memoryEffort} />
      {run && <div className="mt-5 rounded-lg border border-white/10 p-3 text-sm" aria-live="polite" data-testid="run-status"><p>Response: <strong>{run.responseStatus}</strong></p><p>Memory: <strong>{run.memoryStatus}</strong></p>
        {run.contextCompleteness && <p>Context: {run.contextCompleteness}</p>}{(run.failureCode || run.contextFailureCode) && <p role="alert" className="text-red-300">{run.failureCode ?? run.contextFailureCode}</p>}
        <p className="mt-2 break-all text-gray-400">Run: {run.runId}</p></div>}
      {!!Object.keys(tools).length && <ul className="mt-3 text-sm text-gray-300" aria-label="Backend tool activity">{Object.entries(tools).map(([id, text]) => <li key={id}>{text}</li>)}</ul>}
      {run?.responseStatus === "waiting_approval" && !run.attemptNumber && <button className={`${button} mt-3`} onClick={() => void transport.approveInput().catch(caught => setError(errorCode(caught)))}>Approve submitted message</button>}
      {approvals.map(approval => <button className={`${button} mt-3 mr-2`} key={approval.operationId} onClick={() => void transport.approveTool(approval).catch(caught => setError(errorCode(caught)))}>Approve {approval.toolName}</button>)}
      <div className="mt-4 flex flex-wrap gap-3"><button className={button} disabled={!handle || terminal || disconnected} onClick={() => { transport.disconnect(); setDisconnected(true); }}>Disconnect observer</button>
        <button className={button} disabled={!handle || !disconnected} onClick={() => void resume()}>Reconnect observer</button><button className={button} disabled={!handle || terminal} onClick={() => void transport.stop().catch(caught => setError(errorCode(caught)))}>Cancel run</button></div>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void resume(true); }}><label className="min-w-0 flex-1">Observe an existing run<input className={input} value={runId} onChange={event => setRunId(event.target.value)} /></label>
        <button className={button} disabled={active || !runId.trim()}>Observe run</button></form>
      {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
    </section>
    <section aria-label="Memory search" className="mt-6 rounded-xl border border-white/15 p-5"><h2 className="text-lg font-semibold">Memory search</h2>
      {profile && <p className="mt-2 text-sm text-gray-300" data-testid="embedding-profile">{profile.profileId} · {profile.dimensions} dimensions</p>}
      <form onSubmit={search} className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1">Search your memory<input className={input} value={query} onChange={event => setQuery(event.target.value)} required /></label>
        <button className={button} disabled={searching || !query.trim()}>{searching ? "Searching…" : "Search memory"}</button></form>
      {recall && <div className="mt-4" aria-live="polite"><MemoryEffortStatus trace={recall.memoryEffort} />{!recall.items.length && <p>{recall.memoryEffort?.unavailableStages.length?"No results; some memory sources are unavailable.":recall.memoryEffort&&recall.memoryEffort.stopReasons.some(reason=>reason!=="exhausted")?"No results within the retrieval limits.":"No indexed memories match this search."}</p>}<ul className="space-y-3">{recall.items.map(item => <li key={`${item.type}:${item.id}`} className="rounded-lg bg-white/5 p-3"><span className="mr-2 text-sm text-cortex-300">{item.type}</span>{item.content}</li>)}</ul></div>}
      <form onSubmit={checkReadiness} className="mt-5 rounded-lg border border-white/10 p-3">
        <fieldset><legend className="font-medium">Memory readiness</legend>
          <p className="mt-2 text-sm text-gray-300">Read current indexing status, or require the selected stages to be complete. This check starts no model call.</p>
          <div className="my-3 flex flex-wrap gap-4">{(["facts", "vectors", "graph"] as const).map(stage => <label key={stage} className="flex items-center gap-2">
            <input type="checkbox" checked={stages.includes(stage)} onChange={event => setStages(old => event.target.checked ? [...old, stage] : old.filter(value => value !== stage))} />Require {stage}</label>)}</div>
        </fieldset>
        <button className={button} disabled={checking}>{checking ? "Checking readiness…" : "Check memory readiness"}</button>
        {readiness && <ul className="mt-3 text-sm" data-testid="memory-readiness">{Object.entries(readiness.stages).map(([stage, value]) => <li key={stage}>
          {stage}: {value.complete ? "complete" : "incomplete"} · indexed through {value.indexedThrough} of {value.cutoff}{value.hole ? ` · ${value.hole.state} at ${value.hole.sequence}` : ""}</li>)}</ul>}
      </form>
    </section>
    <button className={`${button} mt-6`} aria-expanded={showMedia} onClick={() => setShowMedia(value => !value)}>
      {showMedia ? "Hide media tools" : "Show media tools"}{mediaJobIds.length ? ` (${mediaJobIds.length} retained references)` : ""}
    </button>
    {showMedia && <RuntimeMediaPanel client={connection.client} conversationId={handle?.conversationId} jobIds={mediaJobIds} onDenied={deny} />}
  </>;
}
