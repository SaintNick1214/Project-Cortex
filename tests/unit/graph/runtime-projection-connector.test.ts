import { jest } from "@jest/globals";
import { CypherProjectionConnector } from "../../../src/graph/runtime/index.js";
import type { GraphProjectionWorkV1 } from "../../../src/graph/runtime/index.js";
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from "../../../src/domain/profile.js";
import { canonicalModelJson } from "../../../src/domain/model-policy.js";

async function fixture(timeoutMs = 10_000) {
  const payload = { version: 1 as const, scope: { tenantId: "tenant", memorySpaceId: "space", tenantEpoch: 1, memorySpaceEpoch: 1 },
    source: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, contentHash: "b".repeat(64), ownerPrincipalId: "owner" },
    revision: 1, operation: "replace" as const, profile: DEFAULT_EMBEDDING_PROFILE, facts: [] };
  const work: GraphProjectionWorkV1 = { version: 1, tenantId: "tenant", memorySpaceId: "space", connectorId: "connector",
    workerId: "worker", jobId: "job", leaseVersion: 1, leaseExpiresAt: Date.now() + 60_000, payload, payloadHash: await semanticHash(canonicalModelJson(payload)) };
  const row = (values: Record<string, unknown>) => ({ get: (key: string) => values[key] });
  const tx = { run: jest.fn(async (query: string) => ({ records: query.includes("RETURN s.tenantEpoch") ? [row({ tenantEpoch: 1, memorySpaceEpoch: 1 })]
    : query.includes("RETURN f.tenantEpoch") ? [row({ tenantEpoch: 1, memorySpaceEpoch: 1, revision: 0, payloadHash: "", payloadCanonical: "", leaseVersion: 0 })] : [] })),
    commit: jest.fn(async () => {}), rollback: jest.fn(async () => {}), close: jest.fn(async () => {}), isOpen: jest.fn(() => true) };
  const session = { beginTransaction: jest.fn(async () => tx), close: jest.fn(async () => {}) };
  const driver = { session: jest.fn(() => session), close: jest.fn(async () => {}) };
  const connector = new CypherProjectionConnector({ engine: "neo4j", uri: "bolt://127.0.0.1:1", username: "test", password: "test",
    tenantId: "tenant", memorySpaceId: "space", connectorId: "connector", timeoutMs });
  // Controlled-driver ownership checks exercise the real public method, with no service-success claim.
  Object.assign(connector, { driver, ready: true });
  return { work, tx, session, driver, connector };
}
describe("graph connector controlled-driver ownership and pre-I/O denial", () => {
  it("closes the created session after failed transaction acquisition", async () => {
    const f = await fixture(); f.session.beginTransaction.mockRejectedValue(new Error("network unavailable at BEGIN"));
    await expect(f.connector.apply(f.work)).rejects.toMatchObject({ code: "GRAPH_WRITE_FAILED_OR_UNKNOWN" });
    expect(f.session.close).toHaveBeenCalledTimes(1); expect(f.tx.close).not.toHaveBeenCalled(); await f.connector.close();
  });
  it("closes the session and retires the connection even if transaction cleanup fails after commit", async () => {
    const f = await fixture(); f.tx.close.mockRejectedValue(new Error("cleanup failed"));
    await expect(f.connector.apply(f.work)).rejects.toMatchObject({ code: "GRAPH_WRITE_FAILED_OR_UNKNOWN" });
    expect(f.tx.commit).toHaveBeenCalledTimes(1); expect(f.session.close).toHaveBeenCalledTimes(1); expect(f.driver.close).toHaveBeenCalledTimes(1);
    await f.connector.close(); expect(f.driver.close).toHaveBeenCalledTimes(1);
  });
  it("keeps original graph fence failure while closing both owned resources", async () => {
    const f = await fixture(); f.tx.run.mockRejectedValue(new Error("socket lost")); f.tx.close.mockRejectedValue(new Error("cleanup failed"));
    await expect(f.connector.apply(f.work)).rejects.toMatchObject({ code: "GRAPH_WRITE_FAILED_OR_UNKNOWN" });
    expect(f.tx.rollback).toHaveBeenCalledTimes(1); expect(f.session.close).toHaveBeenCalledTimes(1); expect(f.driver.close).toHaveBeenCalledTimes(1);
  });
  it.each(["scope", "hash", "expired", "sparse"])("denies %s payload before acquiring a graph session", async kind => {
    const f = await fixture(); const work = structuredClone(f.work);
    if (kind === "scope") work.payload.scope.tenantId = "foreign";
    if (kind === "hash") work.payloadHash = "c".repeat(64);
    if (kind === "expired") work.leaseExpiresAt = Date.now() - 1;
    if (kind === "sparse") work.payload.facts = new Array(1);
    await expect(f.connector.apply(work)).rejects.toBeInstanceOf(Error); expect(f.driver.session).not.toHaveBeenCalled(); await f.connector.close();
  });
  it("does not invoke input accessors before rejecting the noncanonical work", async () => {
    const f = await fixture(); const getter = jest.fn(() => f.work.payload);
    Object.defineProperty(f.work, "payload", { get: getter, enumerable: true });
    await expect(f.connector.apply(f.work)).rejects.toMatchObject({ code: "INVALID_GRAPH_WORK" });
    expect(getter).not.toHaveBeenCalled(); expect(f.driver.session).not.toHaveBeenCalled(); await f.connector.close();
  });
  it("normal success closes transaction and session exactly once", async () => {
    const f = await fixture(); expect(await f.connector.apply(f.work)).toMatchObject({ state: "applied", currentRevision: 1 });
    expect(f.tx.commit).toHaveBeenCalledTimes(1); expect(f.tx.close).toHaveBeenCalledTimes(1); expect(f.session.close).toHaveBeenCalledTimes(1); await f.connector.close();
  });
  it("retires a silent transport at the configured client deadline without claiming cancellation of an issued write", async () => {
    const f = await fixture(500); let reject = (_error: Error) => {};
    f.tx.run.mockImplementation(() => new Promise<never>((_resolve, denied) => { reject = denied; }));
    f.driver.close.mockImplementation(async () => { reject(new Error("official driver close interrupted pending connection")); });
    await expect(f.connector.apply(f.work)).rejects.toMatchObject({ code: "GRAPH_WRITE_FAILED_OR_UNKNOWN" });
    expect(f.driver.close).toHaveBeenCalledTimes(1); expect(f.session.close).toHaveBeenCalledTimes(1); expect(f.tx.close).toHaveBeenCalledTimes(1);
    expect(f.tx.commit).not.toHaveBeenCalled(); await f.connector.close(); expect(f.driver.close).toHaveBeenCalledTimes(1);
  });
  it("rejects its I/O await even when official socket close leaves RUN and transaction close promises pending", async () => {
    const f = await fixture(500);
    f.tx.run.mockImplementation(() => new Promise<never>(() => {}));
    f.tx.close.mockImplementation(() => new Promise<void>(() => {}));
    const started = Date.now();
    await expect(f.connector.apply(f.work)).rejects.toMatchObject({ code: "GRAPH_WRITE_FAILED_OR_UNKNOWN" });
    expect(Date.now() - started).toBeLessThan(3000); expect(f.driver.close).toHaveBeenCalledTimes(1);
    expect(f.session.close).toHaveBeenCalledTimes(1); expect(f.tx.close).toHaveBeenCalledTimes(1);
    expect(f.tx.rollback).not.toHaveBeenCalled(); expect(f.tx.commit).not.toHaveBeenCalled(); await f.connector.close();
  });
});
