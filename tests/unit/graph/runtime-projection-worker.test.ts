import { jest } from "@jest/globals";
import { CortexGraphWorker, ConvexGraphWorkerTransport, GraphConnectorError } from "../../../src/graph/runtime/index.js";
import type { GraphWorkerTransport, GraphProjectionWorkV1, GraphProjectionReceiptV1, GraphExpansionWorkV1 } from "../../../src/graph/runtime/index.js";
import { DEFAULT_EMBEDDING_PROFILE } from "../../../src/domain/profile.js";

const identity = { tenantId: "tenant", memorySpaceId: "space", connectorId: "connector", workerId: "service-worker" };
const scope = { tenantId: "tenant", memorySpaceId: "space", tenantEpoch: 1, memorySpaceEpoch: 1 };
function fixture() {
  const work: GraphProjectionWorkV1 = { ...identity, version: 1, jobId: "job", leaseVersion: 1, leaseExpiresAt: Date.now() + 60_000,
    payloadHash: "a".repeat(64), payload: { version: 1, scope, source: { sourceId: "source", sourceEventId: "event", sourceRevision: 1,
      contentHash: "b".repeat(64), ownerPrincipalId: "owner" }, revision: 1, operation: "replace", profile: DEFAULT_EMBEDDING_PROFILE, facts: [] } };
  const receipt: GraphProjectionReceiptV1 = { ...identity, version: 1, jobId: work.jobId, payloadHash: work.payloadHash, sourceId: "source",
    tenantEpoch: 1, memorySpaceEpoch: 1, revision: 1, state: "applied", currentRevision: 1 };
  const expansion: GraphExpansionWorkV1 = { ...identity, version: 1, jobId: "read-job", leaseVersion: 1,
    leaseExpiresAt: Date.now() + 60_000, scope, sourceId: "source", profileId: DEFAULT_EMBEDDING_PROFILE.profileId, revision: 1, limit: 2 };
  const transport = { claim: jest.fn<GraphWorkerTransport["claim"]>().mockResolvedValue(work), current: jest.fn<GraphWorkerTransport["current"]>().mockResolvedValue(work),
    complete: jest.fn<GraphWorkerTransport["complete"]>().mockResolvedValue({ complete: true }), fail: jest.fn<GraphWorkerTransport["fail"]>().mockResolvedValue(null),
    claimExpansion: jest.fn<GraphWorkerTransport["claimExpansion"]>().mockResolvedValue(null), currentExpansion: jest.fn<GraphWorkerTransport["currentExpansion"]>().mockResolvedValue({ version: 1, current: true }),
    completeExpansion: jest.fn<GraphWorkerTransport["completeExpansion"]>().mockResolvedValue(null), failExpansion: jest.fn<GraphWorkerTransport["failExpansion"]>().mockResolvedValue(null) };
  const connector = { connect: jest.fn(async () => {}), apply: jest.fn(async (_work: GraphProjectionWorkV1) => receipt),
    expand: jest.fn(async () => ({ version: 1 as const, scope, sourceId: expansion.sourceId, profileId: expansion.profileId, revision: expansion.revision, factIds: ["fact"] })), close: jest.fn(async () => {}) };
  const worker = new CortexGraphWorker({ ...identity, transport, connector, pollMs: 100 });
  return { work, receipt, expansion, transport, connector, worker };
}
describe("trusted graph worker controlled transport outcomes", () => {
  it("rechecks current work, makes one remote attempt and acknowledges its exact receipt", async () => {
    const f = fixture();
    expect(await f.worker.step()).toEqual({ kind: "projection", jobId: "job", state: "complete", backendAcknowledged: true });
    expect(f.connector.apply).toHaveBeenCalledTimes(1); expect(f.connector.apply).toHaveBeenCalledWith(f.work);
    expect(f.transport.complete).toHaveBeenCalledWith({ ...identity, jobId: "job", leaseVersion: 1, receipt: f.receipt });
    expect(f.transport.fail).not.toHaveBeenCalled(); await f.worker.close(); expect(f.connector.close).toHaveBeenCalledTimes(1);
  });
  it.each(["claim", "current"] as const)("denies foreign work returned by %s before remote I/O", async field => {
    const f = fixture(); f.transport[field].mockResolvedValue({ ...f.work, tenantId: "foreign" });
    if (field === "claim") await expect(f.worker.step()).rejects.toMatchObject({ code: "GRAPH_WORKER_IDENTITY_CHANGED" });
    else expect(await f.worker.step()).toMatchObject({ state: "failed" });
    expect(f.connector.connect).not.toHaveBeenCalled(); expect(f.connector.apply).not.toHaveBeenCalled(); await f.worker.close();
  });
  it("denies a same-identity changed payload before remote I/O", async () => {
    const f = fixture(); f.transport.current.mockResolvedValue({ ...f.work, payloadHash: "c".repeat(64) });
    expect(await f.worker.step()).toMatchObject({ state: "failed", backendAcknowledged: true });
    expect(f.connector.connect).not.toHaveBeenCalled(); expect(f.connector.apply).not.toHaveBeenCalled(); await f.worker.close();
  });
  it("passes definite connection failure to Core without a local write retry", async () => {
    const f = fixture(); f.connector.connect.mockRejectedValue(new GraphConnectorError("GRAPH_CONNECTION_UNAVAILABLE"));
    expect(await f.worker.step()).toMatchObject({ state: "failed", backendAcknowledged: true });
    expect(f.transport.fail).toHaveBeenCalledWith({ ...identity, jobId: "job", leaseVersion: 1, outcome: "failed" });
    expect(f.connector.apply).not.toHaveBeenCalled(); await f.worker.close();
  });
  it.each(["remote", "ack", "stale"])("retains %s ambiguity as unknown and cannot mark it complete", async failure => {
    const f = fixture();
    if (failure === "remote") f.connector.apply.mockRejectedValue(new Error("socket lost after RUN"));
    if (failure === "ack") f.transport.complete.mockRejectedValue(new Error("ack response lost"));
    if (failure === "stale") f.connector.apply.mockResolvedValue({ ...f.receipt, state: "stale", currentRevision: 2 });
    expect(await f.worker.step()).toMatchObject({ state: "unknown", backendAcknowledged: true });
    expect(f.transport.fail).toHaveBeenCalledWith({ ...identity, jobId: "job", leaseVersion: 1, outcome: "unknown" });
    expect(f.connector.apply).toHaveBeenCalledTimes(1); if (failure !== "ack") expect(f.transport.complete).not.toHaveBeenCalled(); await f.worker.close();
  });
  it("revoked/expired acknowledgement cannot turn ambiguous work into success", async () => {
    const f = fixture(); f.transport.complete.mockRejectedValue(new Error("FORBIDDEN")); f.transport.fail.mockRejectedValue(new Error("FORBIDDEN"));
    expect(await f.worker.step()).toMatchObject({ state: "unknown", backendAcknowledged: false }); await f.worker.close();
  });
  it("uses exact current expansion identity and leaves fact delivery to Core", async () => {
    const f = fixture(); f.transport.claim.mockResolvedValue(null); f.transport.claimExpansion.mockResolvedValue(f.expansion);
    expect(await f.worker.step()).toMatchObject({ kind: "expansion", state: "complete" });
    expect(f.transport.currentExpansion).toHaveBeenCalledWith({ ...identity, jobId: "read-job", leaseVersion: 1 });
    expect(f.connector.expand).toHaveBeenCalledWith(f.expansion);
    expect(f.transport.completeExpansion).toHaveBeenCalledWith(expect.objectContaining({ result: { version: 1, scope,
      sourceId: "source", profileId: f.expansion.profileId, revision: 1, factIds: ["fact"] } })); await f.worker.close();
  });
  it("failed expansion never delivers remote fact text or falls back to unfenced reads", async () => {
    const f = fixture(); f.transport.claim.mockResolvedValue(null); f.transport.claimExpansion.mockResolvedValue(f.expansion);
    f.connector.expand.mockRejectedValue(new Error("read unavailable"));
    expect(await f.worker.step()).toMatchObject({ kind: "expansion", state: "failed" });
    expect(f.transport.completeExpansion).not.toHaveBeenCalled(); expect(f.transport.failExpansion).toHaveBeenCalledTimes(1); await f.worker.close();
  });
  it("rejects parallel steps and closes an in-flight worker before issuing graph I/O", async () => {
    const f = fixture(); let release = () => {};
    f.connector.connect.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
    const first = f.worker.step(); for (let n = 0; n < 6; n++) await Promise.resolve();
    await expect(f.worker.step()).rejects.toMatchObject({ code: "GRAPH_WORKER_BUSY" });
    const closing = f.worker.close(); release(); expect(await first).toMatchObject({ state: "failed" }); await closing;
    expect(f.connector.apply).not.toHaveBeenCalled(); expect(f.connector.close).toHaveBeenCalledTimes(1);
    await expect(f.worker.step()).rejects.toMatchObject({ code: "GRAPH_WORKER_CLOSED" });
  });
  it("host polling stops on abort and can be closed without any application client", async () => {
    const f = fixture(); f.transport.claim.mockResolvedValue(null); const abort = new AbortController();
    f.transport.claimExpansion.mockImplementation(async () => { abort.abort(); return null; });
    await f.worker.run(abort.signal); expect(f.transport.claim).toHaveBeenCalledTimes(1); await f.worker.close();
    expect(f.connector.apply).not.toHaveBeenCalled(); expect(f.connector.close).toHaveBeenCalledTimes(1);
  });
});
describe("official Convex graph HTTP client ABI", () => {
  afterEach(() => { jest.restoreAllMocks(); });
  it("uses fresh official mutations for expiry-sensitive checks and refreshes service JWT for every RPC", async () => {
    const requests: { url: string; path: string; auth: string | null }[] = [];
    const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const body = JSON.parse(String(init?.body)) as { path: string };
      requests.push({ url: String(input), path: body.path, auth: new Headers(init?.headers).get("Authorization") });
      return new Response(JSON.stringify({ status: "success", value: null }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    let count = 0; const fetchToken = jest.fn(async () => `qa.jwt.${++count}`);
    const transport = new ConvexGraphWorkerTransport({ deploymentUrl: "https://graph-fixture.convex.cloud", fetchToken });
    const args = { ...identity, jobId: "job", leaseVersion: 1 };
    await transport.claim(identity); await transport.current(args); await transport.currentExpansion(args); await transport.failExpansion(args);
    expect(requests.map(r => [new URL(r.url).pathname, r.path])).toEqual([
      ["/api/mutation", "runtimeGraph:claim"], ["/api/mutation", "runtimeGraph:current"],
      ["/api/mutation", "runtimeGraph:currentExpansion"], ["/api/mutation", "runtimeGraph:failExpansion"],
    ]);
    expect(requests.map(r => r.auth)).toEqual(["Bearer qa.jwt.1", "Bearer qa.jwt.2", "Bearer qa.jwt.3", "Bearer qa.jwt.4"]);
    expect(fetchToken).toHaveBeenCalledTimes(4); expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("bounds uncooperative token acquisition and suppresses a late HTTP mutation", async () => {
    let resolve = (_value: string) => {}, held: AbortSignal | undefined;
    const fetch = jest.spyOn(globalThis, "fetch");
    const transport = new ConvexGraphWorkerTransport({ deploymentUrl: "https://graph-fixture.convex.cloud", timeoutMs: 500,
      fetchToken: signal => { held = signal; return new Promise<string>(done => { resolve = done; }); } });
    await expect(transport.claim(identity)).rejects.toMatchObject({ code: "GRAPH_BACKEND_TIMEOUT" });
    expect(held?.aborted).toBe(true); resolve("qa.jwt.late"); for (let n = 0; n < 6; n++) await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
  });
});
