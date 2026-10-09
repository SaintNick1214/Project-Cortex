"use client";

import { RUNTIME_ASSET_MAX_BYTES } from "@cortexmemory/sdk/runtime";
import type { CortexRuntimeClient, RuntimeArtifact, RuntimeAssetPreview, RuntimeAssetVersion, RuntimeMediaJob } from "@cortexmemory/sdk/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

const button = "rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-cortex-400";
const input = "w-full rounded-lg border border-white/20 bg-gray-950 p-3 text-white focus-visible:outline-2 focus-visible:outline-cortex-400";
const terminal = new Set(["ready", "failed", "cancelled", "expired"]);
export function runtimeErrorCode(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : "RUNTIME_REQUEST_FAILED";
}
function authorityFailure(code: string) {
  return ["FORBIDDEN", "UNAUTHENTICATED", "SESSION_CHANGED", "AUTHORITY_CHANGED", "AUTHORITY_EXPIRED", "AUTHENTICATION_TIMEOUT", "AUTH_TOKEN_FETCH_FAILED", "RPC_DEADLINE_EXCEEDED", "CLIENT_CLOSED"].includes(code);
}

/** Observes backend jobs. Reconciliation polls an existing operation and never resubmits inference. */
export function RuntimeMediaPanel({ client, conversationId, jobIds, onDenied }: {
  client: CortexRuntimeClient; conversationId?: string; jobIds: readonly string[]; onDenied: (error: unknown) => void;
}) {
  const [kind, setKind] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<RuntimeAssetVersion | null>(null);
  const [jobs, setJobs] = useState<RuntimeMediaJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [jobId, setJobId] = useState("");
  const [observedIds, setObservedIds] = useState<string[]>([]);
  const active = useRef(true);
  const upload = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; upload.current?.abort(); }; }, []);
  const fail = useCallback((caught: unknown) => {
    if (!active.current) return;
    const code = runtimeErrorCode(caught); setError(code);
    if (authorityFailure(code)) { setJobs([]); setUploaded(null); onDenied(caught); }
  }, [onDenied]);
  const ids = JSON.stringify([...new Set([...jobIds, ...observedIds])].slice(0, 20));
  useEffect(() => {
    let current = true, timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      try {
        const listed = await client.listMediaJobs({ ...(conversationId ? { conversationId } : {}), limit: 20 });
        // Canonical references can point outside the latest page. Read each with fresh authorization.
        const wanted: string[] = JSON.parse(ids);
        const missing = wanted.filter(id => !listed.jobs.some(job => job.jobId === id)).slice(0, 20);
        const extra = await Promise.all(missing.map(id => client.getMediaJob(id)));
        if (!current) return;
        const next = [...extra, ...listed.jobs]; setJobs(next); setLoading(false); setError(null);
        // Continue fresh delivery checks while mounted, including ready assets after response completion.
        timer = setTimeout(() => void refresh(), next.some(job => !terminal.has(job.state)) ? 2500 : 5000);
      } catch (caught) { if (current) { setJobs([]); setLoading(false); fail(caught); } }
    }
    // Begin an external subscription asynchronously; cleanup also fences this initial callback.
    queueMicrotask(() => { if (current) { setLoading(true); setJobs([]); void refresh(); } });
    return () => { current = false; clearTimeout(timer); };
  }, [client, conversationId, ids, generation, fail]);
  async function store(event: FormEvent) {
    event.preventDefault(); if (!file || busy) return;
    setError(null); setBusy(true); setUploading(true); setUploaded(null);
    const controller = new AbortController(); upload.current = controller;
    try {
      if (file.size > RUNTIME_ASSET_MAX_BYTES) throw { code: "ASSET_TOO_LARGE" };
      const result = await client.uploadAsset(file, { requestId: crypto.randomUUID(), mimeType: file.type || "application/octet-stream",
        filename: file.name, signal: controller.signal });
      if (active.current) setUploaded(result);
    } catch (caught) { fail(caught); }
    finally { if (upload.current === controller) upload.current = null; if (active.current) { setBusy(false); setUploading(false); } }
  }
  async function generate(event: FormEvent) {
    event.preventDefault(); if (!prompt.trim() || busy) return;
    setError(null); setBusy(true);
    try {
      await client.submitMediaJob({ requestId: crypto.randomUUID(), kind, prompt,
        ...(conversationId ? { conversationId } : {}),
        ...(kind === "video" && uploaded ? { inputAsset: { assetId: uploaded.assetId, version: uploaded.assetVersion } } : {}) });
      if (active.current) { setPrompt(""); setGeneration(value => value + 1); }
    } catch (caught) { fail(caught); }
    finally { if (active.current) setBusy(false); }
  }
  async function update(job: RuntimeMediaJob, operation: "cancel" | "reconcile") {
    try {
      const next = operation === "cancel" ? await client.cancelMediaJob(job.jobId) : await client.reconcileMediaJob(job.jobId);
      if (active.current) setJobs(old => old.map(item => item.jobId === next.jobId ? next : item));
    } catch (caught) { fail(caught); }
  }
  async function observe(event: FormEvent) {
    event.preventDefault(); if (!jobId.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const job = await client.getMediaJob(jobId.trim());
      if (active.current) setObservedIds(old => [...new Set([job.jobId, ...old])].slice(0, 20));
    } catch (caught) { fail(caught); }
    finally { if (active.current) setBusy(false); }
  }
  const inputInvalid = kind === "video" && uploaded !== null && uploaded.mimeType !== "image/png";
  return <section aria-label="Media and artifacts" className="mt-6 rounded-xl border border-white/15 p-5">
    <h2 className="text-lg font-semibold">Media and artifacts</h2>
    <p className="mt-2 text-sm text-gray-300">Cortex saves a pending job and artifact before generation. Jobs remain available after the chat response finishes.</p>
    <form onSubmit={store} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1">Private file (up to 20,000,000 bytes)<input className={input} type="file" disabled={busy}
        onChange={event => { setFile(event.target.files?.[0] ?? null); setUploaded(null); }} /></label>
      <button className={button} disabled={!file || busy}>Upload private file</button>
      {uploading && <button type="button" className={button} onClick={() => upload.current?.abort()}>Cancel upload</button>}
    </form>
    {uploaded && <div className="mt-3 rounded-lg bg-white/5 p-3" data-testid="uploaded-asset">
      <p>{uploaded.filename ?? "Private file"} · {uploaded.sizeBytes.toLocaleString()} bytes · version {uploaded.assetVersion}</p>
      <button className={`${button} mt-3`} onClick={() => setUploaded(null)}>Clear selected video input</button>
      <PrivateAsset client={client} assetId={uploaded.assetId} version={uploaded.assetVersion} label={uploaded.filename ?? "Private upload"} onError={fail} />
    </div>}
    <form onSubmit={generate} className="mt-5 flex flex-wrap items-end gap-3">
      <label>Generate<select className={input} value={kind} disabled={busy} onChange={event => setKind(event.target.value as "image" | "video")}>
        <option value="image">Image</option><option value="video">Video</option></select></label>
      <label className="min-w-0 flex-1">Media prompt<textarea className={input} rows={2} value={prompt} disabled={busy} required onChange={event => setPrompt(event.target.value)} /></label>
      <button className={button} disabled={busy || !prompt.trim() || inputInvalid}>{busy ? "Working…" : "Create media job"}</button>
    </form>
    <p className="mt-2 text-sm text-gray-400">Models and generation options are set by your administrator. Video can use the uploaded PNG; other uploads remain private files. Missing service capabilities return an explicit error.</p>
    {inputInvalid && <p role="alert" className="mt-2 text-amber-300">Video input requires a PNG. Select a PNG or clear the upload by choosing another file.</p>}
    <form onSubmit={observe} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1">Observe an existing media job<input className={input} value={jobId} onChange={event => setJobId(event.target.value)} /></label>
      <button className={button} disabled={busy || !jobId.trim()}>Observe media job</button>
    </form>
    <p className="mt-2 text-sm text-gray-400">A job ID does not grant access. Cortex checks the current job, artifact and file permissions.</p>
    <button className={`${button} mt-4`} onClick={() => setGeneration(value => value + 1)} disabled={loading}>Refresh jobs</button>
    <div aria-live="polite" className="mt-4 space-y-3">
      {loading && <p>Loading retained jobs…</p>}
      {!loading && !jobs.length && <p className="text-gray-400">No media jobs in this view.</p>}
      {jobs.map(job => <article key={job.jobId} className="rounded-lg border border-white/10 p-4" data-testid="media-job">
        <p className="font-medium">{job.kind === "image" ? "Image" : "Video"} · {job.state}</p>
        <p className="mt-1 break-all text-sm text-gray-400">Job: {job.jobId}</p>
        <p className="mt-2 text-sm">Cost: {job.costStatus === "incurred_unknown" ? "incurred amount unknown; reservation retained" : job.costStatus}</p>
        {job.state === "submission_unknown" && <p className="mt-2 text-sm text-amber-300">Submission outcome is unknown. Refreshing or reconnecting does not generate a replacement.</p>}
        {job.upstreamCancellation === "not_supported" && <p className="mt-2 text-sm text-amber-300">Local delivery is cancelled. The upstream service may still run and incur costs.</p>}
        {job.failureCode && <p role="alert" className="mt-2 text-red-300">{job.failureCode}</p>}
        <div className="mt-3 flex flex-wrap gap-3">
          <button className={button} disabled={terminal.has(job.state)} onClick={() => void update(job, "cancel")}>Cancel local job</button>
          <button className={button} disabled={terminal.has(job.state) || job.state === "submission_unknown"} onClick={() => void update(job, "reconcile")}>Recover job status</button>
        </div>
        <RetainedArtifact key={`${job.artifactId}:${job.revision}`} client={client} artifactId={job.artifactId} onError={fail} />
      </article>)}
    </div>
    {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
  </section>;
}

function RetainedArtifact({ client, artifactId, onError }: { client: CortexRuntimeClient; artifactId: string; onError: (error: unknown) => void }) {
  const [artifact, setArtifact] = useState<RuntimeArtifact | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function read() {
    setBusy(true);
    try { const value = await client.getArtifact(artifactId); if (active.current) setArtifact(value); }
    catch (caught) { if (active.current) { setArtifact(null); onError(caught); } }
    finally { if (active.current) setBusy(false); }
  }
  return <div className="mt-3">
    <button className={button} disabled={busy} onClick={() => void read()}>{busy ? "Reading artifact…" : "Open retained artifact"}</button>
    {artifact && <div className="mt-3" data-testid="retained-artifact">
      <p>{artifact.title} · {artifact.streamingState} · version {artifact.versionPointer}</p>
      {artifact.content && <pre className="mt-2 whitespace-pre-wrap break-words text-sm">{artifact.content}</pre>}
      {artifact.file && <PrivateAsset client={client} assetId={artifact.file.assetId} version={artifact.file.version} label={artifact.title} onError={onError} />}
    </div>}
  </div>;
}

/** Only authenticated, hash-verified bounded bytes become a local Blob URL. */
function PrivateAsset({ client, assetId, version, label, onError }: {
  client: CortexRuntimeClient; assetId: string; version: number; label: string; onError: (error: unknown) => void;
}) {
  const [preview, setPreview] = useState<RuntimeAssetPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const owned = useRef<RuntimeAssetPreview | null>(null);
  const request = useRef<AbortController | null>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); owned.current?.revoke(); owned.current = null; }; }, [client, assetId, version]);
  async function load() {
    request.current?.abort(); owned.current?.revoke(); owned.current = null; setPreview(null); setBusy(true);
    const controller = new AbortController(); request.current = controller;
    try {
      const value = await client.createAssetUrl({ assetId, version }, { signal: controller.signal });
      if (!active.current || controller.signal.aborted) { value.revoke(); return; }
      owned.current = value; setPreview(value);
    } catch (caught) { if (active.current) onError(caught); }
    finally { if (active.current) setBusy(false); }
  }
  function hide() { request.current?.abort(); owned.current?.revoke(); owned.current = null; setPreview(null); }
  return <div className="mt-3">
    <button className={button} disabled={busy} onClick={() => void load()}>{busy ? "Fetching private bytes…" : "Preview or download private file"}</button>
    {preview && <div className="mt-3 space-y-3">
      {/* A local authenticated Blob cannot use Next's image optimizer or a public storage URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview.mimeType.startsWith("image/") && <img className="max-h-96 max-w-full rounded-lg" src={preview.url} alt={label} />}
      {preview.mimeType.startsWith("video/") && <video className="max-h-96 max-w-full rounded-lg" controls preload="metadata" src={preview.url} aria-label={label} />}
      {preview.mimeType.startsWith("audio/") && <audio controls src={preview.url} aria-label={label} />}
      <a className={`${button} inline-block`} href={preview.url} download={label}>Download private file ({preview.sizeBytes.toLocaleString()} bytes)</a>
      <button className={`${button} ml-3`} onClick={hide}>Close preview</button>
    </div>}
  </div>;
}
