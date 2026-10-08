/** Trusted Node service worker. Core owns authorization, admission, retry and graph freshness. */
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { GraphExpansionResultV1, GraphExpansionWorkV1, GraphProjectionLeaseV1,
  GraphProjectionReceiptV1, GraphProjectionWorkV1 } from "../../domain/graph-projection.js";
import { GRAPH_PROJECTION_LIMITS } from "../../domain/graph-projection.js";
import { canonicalModelJson } from "../../domain/model-policy.js";
import { GraphConnectorError } from "./CypherProjectionConnector.js";

export interface GraphWorkerIdentity {
  tenantId: string; memorySpaceId: string; connectorId: string; workerId: string;
}
export interface GraphWorkerTransport {
  claim(args: GraphWorkerIdentity & { leaseMs?: number }): Promise<GraphProjectionWorkV1 | null>;
  current(args: GraphProjectionLeaseV1): Promise<GraphProjectionWorkV1>;
  complete(args: GraphProjectionLeaseV1 & { receipt: GraphProjectionReceiptV1 }): Promise<unknown>;
  fail(args: GraphProjectionLeaseV1 & { outcome: "failed" | "unknown" }): Promise<unknown>;
  claimExpansion(args: GraphWorkerIdentity): Promise<GraphExpansionWorkV1 | null>;
  currentExpansion(args: GraphProjectionLeaseV1): Promise<{ version: 1; current: true }>;
  completeExpansion(args: GraphProjectionLeaseV1 & { result: GraphExpansionResultV1 }): Promise<unknown>;
  failExpansion(args: GraphProjectionLeaseV1): Promise<unknown>;
}
export interface GraphWorkerConnector {
  connect(): Promise<void>;
  apply(work: GraphProjectionWorkV1): Promise<GraphProjectionReceiptV1>;
  expand(work: Pick<GraphExpansionWorkV1, "scope" | "sourceId" | "profileId" | "revision" | "limit">): Promise<GraphExpansionResultV1>;
  close(): Promise<void>;
}
export interface ConvexGraphWorkerTransportOptions {
  deploymentUrl: string;
  /** Return a current service JWT. Convex verifies it and the connector's pinned current service grant. */
  fetchToken: (signal: AbortSignal) => Promise<string>;
  timeoutMs?: number;
}
const mutation = (name: string) => makeFunctionReference<"mutation", Record<string, unknown>, unknown>(`runtimeGraph:${name}`);
// Pre-effect reads must run freshly: expiry alone does not invalidate a cached query.
const refs = { claim: mutation("claim"), current: mutation("current"), complete: mutation("complete"), fail: mutation("fail"),
  claimExpansion: mutation("claimExpansion"), currentExpansion: mutation("currentExpansion"), completeExpansion: mutation("completeExpansion"), failExpansion: mutation("failExpansion") };
function validIdentifier(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= 4096; }
function positive(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }

/** Official HTTP contract, with fresh JWT per call and bounded requests. No deployment administrator key. */
export class ConvexGraphWorkerTransport implements GraphWorkerTransport {
  private readonly options: Readonly<ConvexGraphWorkerTransportOptions>;
  private readonly timeoutMs: number;
  constructor(options: ConvexGraphWorkerTransportOptions) {
    this.options = Object.freeze({ ...options }); this.timeoutMs = options.timeoutMs ?? 10_000;
    if (typeof options.fetchToken !== "function" || !Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 500 || this.timeoutMs > 30_000) {
      throw new GraphConnectorError("INVALID_GRAPH_WORKER_TRANSPORT");
    }
    // Validate the official URL contract now, before any task or token acquisition.
    new ConvexHttpClient(options.deploymentUrl, { logger: false });
  }
  private async call(ref: ReturnType<typeof mutation>, args: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new GraphConnectorError("GRAPH_BACKEND_TIMEOUT")); }, this.timeoutMs);
    });
    const invoke = async () => {
      const token = await this.options.fetchToken(controller.signal);
      controller.signal.throwIfAborted();
      if (typeof token !== "string" || token.split(".").length !== 3) throw new GraphConnectorError("INVALID_GRAPH_WORKER_TOKEN");
      const client = new ConvexHttpClient(this.options.deploymentUrl, { logger: false, auth: token,
        fetch: (input, init) => globalThis.fetch(input, { ...init,
          signal: init?.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal }) });
      try {
        return await client.mutation(ref, args);
      } finally { client.clearAuth(); }
    };
    try { return await Promise.race([invoke(), deadline]); }
    finally { if (timer) clearTimeout(timer); controller.abort(); }
  }
  async claim(args: GraphWorkerIdentity & { leaseMs?: number }): Promise<GraphProjectionWorkV1 | null> { return await this.call(refs.claim, { ...args }) as GraphProjectionWorkV1 | null; }
  async current(args: GraphProjectionLeaseV1): Promise<GraphProjectionWorkV1> { return await this.call(refs.current, { ...args }) as GraphProjectionWorkV1; }
  async complete(args: GraphProjectionLeaseV1 & { receipt: GraphProjectionReceiptV1 }): Promise<unknown> { return this.call(refs.complete, { ...args }); }
  async fail(args: GraphProjectionLeaseV1 & { outcome: "failed" | "unknown" }): Promise<unknown> { return this.call(refs.fail, { ...args }); }
  async claimExpansion(args: GraphWorkerIdentity): Promise<GraphExpansionWorkV1 | null> { return await this.call(refs.claimExpansion, { ...args }) as GraphExpansionWorkV1 | null; }
  async currentExpansion(args: GraphProjectionLeaseV1): Promise<{ version: 1; current: true }> { return await this.call(refs.currentExpansion, { ...args }) as { version: 1; current: true }; }
  async completeExpansion(args: GraphProjectionLeaseV1 & { result: GraphExpansionResultV1 }): Promise<unknown> { return this.call(refs.completeExpansion, { ...args }); }
  async failExpansion(args: GraphProjectionLeaseV1): Promise<unknown> { return this.call(refs.failExpansion, { ...args }); }
}
export type GraphWorkerStepResult = { kind: "idle" } | { kind: "projection" | "expansion"; jobId: string;
  state: "complete" | "failed" | "unknown"; backendAcknowledged: boolean };
export interface CortexGraphWorkerOptions extends GraphWorkerIdentity {
  transport: GraphWorkerTransport; connector: GraphWorkerConnector; leaseMs?: number; pollMs?: number;
}
const lease = (work: GraphProjectionLeaseV1): GraphProjectionLeaseV1 => ({ tenantId: work.tenantId, memorySpaceId: work.memorySpaceId,
  connectorId: work.connectorId, jobId: work.jobId, workerId: work.workerId, leaseVersion: work.leaseVersion });
/** Run in a host service process independent of application observation. One remote attempt per step. */
export class CortexGraphWorker {
  private readonly identity: Readonly<GraphWorkerIdentity>;
  private readonly options: Readonly<CortexGraphWorkerOptions>;
  private closed = false;
  private active?: Promise<GraphWorkerStepResult>;
  private loop?: Promise<void>;
  private readonly stopSignal = new AbortController();
  constructor(options: CortexGraphWorkerOptions) {
    if (![options.tenantId, options.memorySpaceId, options.connectorId, options.workerId].every(validIdentifier)
      || options.leaseMs !== undefined && (!positive(options.leaseMs) || options.leaseMs < 100 || options.leaseMs > GRAPH_PROJECTION_LIMITS.leaseMs)
      || options.pollMs !== undefined && (!positive(options.pollMs) || options.pollMs < 100 || options.pollMs > 10_000)) throw new GraphConnectorError("INVALID_GRAPH_WORKER_CONFIG");
    this.options = Object.freeze({ ...options }); this.identity = Object.freeze({ tenantId: options.tenantId,
      memorySpaceId: options.memorySpaceId, connectorId: options.connectorId, workerId: options.workerId });
  }
  private currentIdentity(work: GraphProjectionLeaseV1 & { version: number; leaseExpiresAt: number }): void {
    if (!work || canonicalModelJson({ tenantId: work.tenantId, memorySpaceId: work.memorySpaceId, connectorId: work.connectorId, workerId: work.workerId }) !== canonicalModelJson(this.identity)
      || work.version !== 1 || !positive(work.leaseVersion) || !validIdentifier(work.jobId)
      || !positive(work.leaseExpiresAt) || work.leaseExpiresAt <= Date.now()) throw new GraphConnectorError("GRAPH_WORKER_IDENTITY_CHANGED");
  }
  step(): Promise<GraphWorkerStepResult> {
    if (this.closed) return Promise.reject(new GraphConnectorError("GRAPH_WORKER_CLOSED"));
    if (this.active) return Promise.reject(new GraphConnectorError("GRAPH_WORKER_BUSY"));
    const active = this.execute(); this.active = active;
    void active.finally(() => { if (this.active === active) this.active = undefined; }).catch(() => undefined);
    return active;
  }
  private async execute(): Promise<GraphWorkerStepResult> {
    const transport = this.options.transport, connector = this.options.connector;
    const claimed = await transport.claim({ ...this.identity, ...(this.options.leaseMs === undefined ? {} : { leaseMs: this.options.leaseMs }) });
    if (claimed) {
      this.currentIdentity(claimed); const ownedLease = lease(claimed); let issued = false;
      try {
        const current = await transport.current(ownedLease); this.currentIdentity(current);
        if (canonicalModelJson(current) !== canonicalModelJson(claimed)) throw new GraphConnectorError("GRAPH_WORK_CHANGED");
        await connector.connect();
        if (this.closed) throw new GraphConnectorError("GRAPH_WORKER_CLOSED");
        // A preflight cannot fence an already-issued write. The connector transaction enforces epochs/revisions.
        issued = true; const receipt = await connector.apply(current);
        if (receipt.state === "stale") throw new GraphConnectorError("STALE_REMOTE_GRAPH_FENCE");
        await transport.complete({ ...ownedLease, receipt });
        return { kind: "projection", jobId: claimed.jobId, state: "complete", backendAcknowledged: true };
      } catch {
        const state = issued ? "unknown" as const : "failed" as const;
        let backendAcknowledged = false;
        try { await transport.fail({ ...ownedLease, outcome: state }); backendAcknowledged = true; } catch { /* Expired/revoked work remains fenced by Core. */ }
        return { kind: "projection", jobId: claimed.jobId, state, backendAcknowledged };
      }
    }
    const expansion = await transport.claimExpansion({ ...this.identity });
    if (!expansion) return { kind: "idle" };
    this.currentIdentity(expansion); const ownedLease = lease(expansion);
    try {
      const current = await transport.currentExpansion(ownedLease);
      if (current.version !== 1 || current.current !== true) throw new GraphConnectorError("GRAPH_WORK_CHANGED");
      await connector.connect(); if (this.closed) throw new GraphConnectorError("GRAPH_WORKER_CLOSED");
      const result = await connector.expand(expansion);
      await transport.completeExpansion({ ...ownedLease, result });
      return { kind: "expansion", jobId: expansion.jobId, state: "complete", backendAcknowledged: true };
    } catch {
      let backendAcknowledged = false;
      try { await transport.failExpansion(ownedLease); backendAcknowledged = true; } catch { /* Lease/auth denial cannot be bypassed. */ }
      return { kind: "expansion", jobId: expansion.jobId, state: "failed", backendAcknowledged };
    }
  }
  /** Core persists work while the service is stopped. This loop adds no in-process retry or memory writer. */
  run(signal?: AbortSignal): Promise<void> {
    if (this.closed) return Promise.reject(new GraphConnectorError("GRAPH_WORKER_CLOSED"));
    if (this.loop) return Promise.reject(new GraphConnectorError("GRAPH_WORKER_BUSY"));
    const combined = signal ? AbortSignal.any([signal, this.stopSignal.signal]) : this.stopSignal.signal;
    const invoke = async () => {
      while (!combined.aborted && !this.closed) {
        await this.step();
        if (combined.aborted || this.closed) break;
        await new Promise<void>(resolve => {
          const done = () => { clearTimeout(timer); combined.removeEventListener("abort", done); resolve(); };
          const timer = setTimeout(done, this.options.pollMs ?? 500); combined.addEventListener("abort", done, { once: true });
          if (combined.aborted) done();
        });
      }
    };
    const loop = invoke(); this.loop = loop;
    void loop.finally(() => { if (this.loop === loop) this.loop = undefined; }).catch(() => undefined);
    return loop;
  }
  async close(): Promise<void> {
    if (this.closed) return; this.closed = true; this.stopSignal.abort();
    try { if (this.active) await this.active.catch(() => undefined); if (this.loop) await this.loop.catch(() => undefined); }
    finally { await this.options.connector.close(); }
  }
}
