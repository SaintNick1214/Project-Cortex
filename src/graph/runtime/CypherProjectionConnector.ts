/** Node-only transport for backend-authorized work. It never accepts Cypher from a caller. */
import neo4j, { type Driver, type Transaction } from "neo4j-driver";
import type {
  GraphProjectionPayloadV1, GraphProjectionReceiptV1, GraphProjectionScope, GraphProjectionWorkV1, GraphExpansionResultV1,
} from "../../domain/graph-projection.js";
import { GRAPH_PROJECTION_LIMITS, compareGraphFence } from "../../domain/graph-projection.js";
import { canonicalModelJson } from "../../domain/model-policy.js";
import { assertSupportedEmbeddingProfile, semanticHash } from "../../domain/profile.js";

export interface CypherProjectionConnectorConfig {
  engine: "neo4j" | "memgraph";
  uri: string; username: string; password: string; database?: string;
  tenantId: string; memorySpaceId: string; connectorId: string;
  /** Bounds a remote transaction; the backend separately owns lease/retry policy. */
  timeoutMs?: number;
}
export interface GraphFenceDiagnostics {
  tenantEpoch: number; memorySpaceEpoch: number; revision: number;
  leaseVersion: number; payloadHash: string; tombstoned: boolean; profileId: string;
}
export class GraphConnectorError extends Error {
  constructor(readonly code: string) { super(code); this.name = "GraphConnectorError"; }
}
const labels = ["CortexRuntimeGraphScope", "CortexRuntimeGraphSource", "CortexRuntimeGraphFact",
  "CortexRuntimeGraphEntity", "CortexRuntimeGraphReceipt"] as const;
function text(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 4096; }
function positive(value: unknown): value is number { return Number.isSafeInteger(value) && typeof value === "number" && value > 0; }
function number(value: unknown): number {
  const result = neo4j.isInt(value) && value.inSafeRange() ? value.toNumber() : value;
  if (typeof result !== "number" || !Number.isSafeInteger(result) || result < 0) throw new GraphConnectorError("INVALID_REMOTE_GRAPH_FENCE");
  return result;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new GraphConnectorError("INVALID_REMOTE_GRAPH_FENCE");
  return value;
}

export class CypherProjectionConnector {
  private driver?: Driver;
  private ready = false;
  private opening?: Promise<void>;
  private readonly timeoutMs: number;
  private readonly scopeKey: string;
  constructor(private readonly config: Readonly<CypherProjectionConnectorConfig>) {
    this.config = Object.freeze({ ...config });
    if (!text(config.tenantId) || !text(config.memorySpaceId) || !text(config.connectorId)
      || !text(config.username) || !text(config.password) || !text(config.uri)
      || !["neo4j", "memgraph"].includes(config.engine)
      || (config.database !== undefined && !text(config.database))) throw new GraphConnectorError("INVALID_GRAPH_CONNECTOR_CONFIG");
    let uri: URL;
    try { uri = new URL(config.uri); } catch { throw new GraphConnectorError("INVALID_GRAPH_CONNECTOR_CONFIG"); }
    if (uri.username || uri.password || !["bolt:", "bolt+s:", "bolt+ssc:", "neo4j:", "neo4j+s:", "neo4j+ssc:"].includes(uri.protocol)) {
      throw new GraphConnectorError("INVALID_GRAPH_CONNECTOR_CONFIG");
    }
    this.timeoutMs = config.timeoutMs ?? 10_000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 500 || this.timeoutMs > 30_000) throw new GraphConnectorError("INVALID_GRAPH_CONNECTOR_CONFIG");
    this.scopeKey = canonicalModelJson([config.tenantId, config.memorySpaceId]);
  }
  /** Authenticates before readiness. Safe point for a test-owned network proxy to be armed. */
  async connect(): Promise<void> {
    if (this.ready) return;
    if (this.opening) return await this.opening;
    this.opening = this.open();
    try { await this.opening; } finally { this.opening = undefined; }
  }
  private async open(): Promise<void> {
    const driver = neo4j.driver(this.config.uri, neo4j.auth.basic(this.config.username, this.config.password), {
      maxConnectionPoolSize: 2, connectionTimeout: this.timeoutMs,
      connectionAcquisitionTimeout: this.timeoutMs, maxTransactionRetryTime: 0,
    });
    this.driver = driver;
    const watch = this.watch(driver);
    try {
      const session = driver.session(this.sessionConfig());
      try {
        await watch.race(driver.verifyConnectivity());
        await watch.race(session.run("RETURN 1 AS authenticated", {}, { timeout: this.timeoutMs }));
        for (const label of labels) {
        // Labels are fixed above. Values/identities always use parameters.
        const query = this.config.engine === "neo4j"
          ? `CREATE CONSTRAINT cortex_runtime_${label.toLowerCase()} IF NOT EXISTS FOR (n:${label}) REQUIRE n.key IS UNIQUE`
          : `CREATE CONSTRAINT ON (n:${label}) ASSERT n.key IS UNIQUE`;
        try { await watch.race(session.run(query, {}, { timeout: this.timeoutMs })); }
        catch (error) {
          // Memgraph reports an existing equivalent constraint instead of IF NOT EXISTS.
          if (this.config.engine !== "memgraph" || !(error instanceof Error) || !/already exists|already exist/i.test(error.message)) throw error;
        }
      }
        const constraints = await watch.race(session.run(this.config.engine === "neo4j"
        ? "SHOW CONSTRAINTS YIELD type, labelsOrTypes, properties RETURN type, labelsOrTypes, properties"
        : "SHOW CONSTRAINT INFO", {}, { timeout: this.timeoutMs }));
        for (const label of labels) {
        const present = constraints.records.some(row => {
          const type: unknown = row.get(this.config.engine === "neo4j" ? "type" : "constraint type");
          const foundLabels: unknown = row.get(this.config.engine === "neo4j" ? "labelsOrTypes" : "label");
          const properties: unknown = row.get("properties");
          return typeof type === "string" && /unique/i.test(type)
            && (foundLabels === label || Array.isArray(foundLabels) && foundLabels.length === 1 && foundLabels[0] === label)
            && Array.isArray(properties) && properties.length === 1 && properties[0] === "key";
        });
          if (!present) throw new GraphConnectorError("GRAPH_FENCE_CONSTRAINT_UNAVAILABLE");
        }
      } finally { if (!await this.cleanup(() => session.close())) throw new GraphConnectorError("GRAPH_CONNECTION_UNAVAILABLE"); }
      if (watch.expired()) throw new GraphConnectorError("GRAPH_CONNECTION_UNAVAILABLE");
      this.ready = true;
    } catch {
      this.ready = false;
      this.driver = undefined;
      await this.cleanup(() => watch.retire());
      throw new GraphConnectorError("GRAPH_CONNECTION_UNAVAILABLE");
    } finally { if (!await watch.finish()) throw new GraphConnectorError("GRAPH_CONNECTION_UNAVAILABLE"); }
  }
  private sessionConfig() { return this.config.database ? { database: this.config.database } : {}; }
  async close(): Promise<void> {
    if (this.opening) await this.opening.catch(() => undefined);
    this.ready = false;
    const driver = this.driver; this.driver = undefined;
    if (driver) await driver.close();
  }
  private requireDriver(): Driver {
    if (!this.ready || !this.driver) throw new GraphConnectorError("GRAPH_CONNECTOR_NOT_CONNECTED");
    return this.driver;
  }
  private async cleanup(action: () => PromiseLike<unknown>): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([Promise.resolve().then(action).then(() => true, () => false),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 1000); })]); }
    finally { if (timer) clearTimeout(timer); }
  }
  /** Client-side silence must not hold the host worker forever before the server sees a RUN. */
  private watch(driver: Driver) {
    let retirement: Promise<void> | undefined;
    let expired = false, rejectDeadline = (_error: GraphConnectorError) => {};
    const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
    void deadline.catch(() => undefined);
    const retire = () => {
      if (!retirement) {
        if (this.driver === driver) { this.ready = false; this.driver = undefined; }
        // Close native sockets; a previously awaited Result may remain unresolved.
        // The independent deadline below rejects our await. No upstream cancellation is claimed.
        retirement = driver.close(); void retirement.catch(() => undefined);
      }
      return retirement;
    };
    const timer = setTimeout(() => { expired = true; void retire().catch(() => undefined); rejectDeadline(new GraphConnectorError("GRAPH_IO_TIMEOUT")); }, this.timeoutMs);
    return { expired: () => expired, retire, race: <T>(value: PromiseLike<T>) => Promise.race([Promise.resolve(value), deadline]),
      finish: async () => { clearTimeout(timer); return retirement ? await this.cleanup(() => retirement!) : true; } };
  }
  private scope(scope: GraphProjectionScope): void {
    if (!scope || scope.tenantId !== this.config.tenantId || scope.memorySpaceId !== this.config.memorySpaceId
      || !positive(scope.tenantEpoch) || !positive(scope.memorySpaceEpoch)) throw new GraphConnectorError("GRAPH_SCOPE_MISMATCH");
  }
  private async payload(work: GraphProjectionWorkV1): Promise<{ work: GraphProjectionWorkV1; canonical: string }> {
    // Detach through the descriptor-aware canonical parser before reading input fields.
    let detached: GraphProjectionWorkV1;
    try { detached = JSON.parse(canonicalModelJson(work)) as GraphProjectionWorkV1; }
    catch { throw new GraphConnectorError("INVALID_GRAPH_WORK"); }
    work = detached;
    const p = detached?.payload;
    if (!p?.scope || !p.source || !p.profile) throw new GraphConnectorError("INVALID_GRAPH_WORK");
    this.scope(p.scope);
    if (work.version !== 1 || p.version !== 1 || work.tenantId !== p.scope.tenantId || work.memorySpaceId !== p.scope.memorySpaceId
      || work.connectorId !== this.config.connectorId || !text(work.jobId) || !text(work.workerId)
      || !positive(work.leaseVersion) || !positive(work.leaseExpiresAt) || work.leaseExpiresAt <= Date.now()
      || !positive(p.revision) || !text(p.source.sourceId) || !text(p.source.sourceEventId)
      || !positive(p.source.sourceRevision) || !text(p.source.ownerPrincipalId)
      || !/^[a-f0-9]{64}$/.test(p.source.contentHash) || !["replace", "tombstone"].includes(p.operation)
      || !Array.isArray(p.facts) || p.facts.length > GRAPH_PROJECTION_LIMITS.maximumFacts
      || (p.operation === "tombstone" && p.facts.length !== 0)) throw new GraphConnectorError("INVALID_GRAPH_WORK");
    assertSupportedEmbeddingProfile(p.profile);
    const ids = new Set<string>();
    for (const fact of p.facts) {
      if (!fact || !text(fact.factId) || ids.has(fact.factId) || !positive(fact.revision) || typeof fact.text !== "string" || !fact.text
        || !Array.isArray(fact.entities) || !Array.isArray(fact.relations)
        || fact.entities.some(e => !e || !text(e.name) || !text(e.type))
        || fact.relations.some(r => !r || !text(r.subject) || !text(r.predicate) || !text(r.object))) throw new GraphConnectorError("INVALID_GRAPH_WORK");
      ids.add(fact.factId);
    }
    const canonical = canonicalModelJson(p);
    if (new TextEncoder().encode(canonical).length > GRAPH_PROJECTION_LIMITS.maximumPayloadBytes
      || await semanticHash(canonical) !== work.payloadHash) throw new GraphConnectorError("INVALID_GRAPH_PAYLOAD_HASH");
    return { work: detached, canonical };
  }
  /** No automatic transport retry. An ambiguous commit is reconciled by the durable backend job. */
  async apply(work: GraphProjectionWorkV1): Promise<GraphProjectionReceiptV1> {
    const prepared = await this.payload(work), canonical = prepared.canonical;
    work = prepared.work;
    const driver = this.requireDriver(), p = work.payload;
    const session = driver.session(this.sessionConfig());
    const watch = this.watch(driver);
    let tx: Transaction | undefined;
    let failed = false;
    try {
      tx = await watch.race(session.beginTransaction({ timeout: this.timeoutMs }));
      const args = { scopeKey: this.scopeKey, sourceKey: canonicalModelJson([this.scopeKey, p.source.sourceId]),
        tenantId: p.scope.tenantId, memorySpaceId: p.scope.memorySpaceId,
        tenantEpoch: neo4j.int(p.scope.tenantEpoch), memorySpaceEpoch: neo4j.int(p.scope.memorySpaceEpoch),
        sourceId: p.source.sourceId };
      // This is the FIRST projection RUN, before either fence lock is held.
      // Neo4j locks before the dependent property read; Memgraph aborts write conflicts.
      const scoped = await watch.race(tx.run(`MERGE (s:CortexRuntimeGraphScope {key:$scopeKey})
        ON CREATE SET s.tenantEpoch=$tenantEpoch, s.memorySpaceEpoch=$memorySpaceEpoch, s.touch=0
        SET s.touch=1-coalesce(s.touch,0)
        RETURN s.tenantEpoch AS tenantEpoch, s.memorySpaceEpoch AS memorySpaceEpoch`, args));
      const scopeRow = scoped.records[0];
      const currentScope = { tenantEpoch: number(scopeRow.get("tenantEpoch")), memorySpaceEpoch: number(scopeRow.get("memorySpaceEpoch")), revision: 1 };
      const scopeOrder = compareGraphFence({ ...p.scope, revision: 1 }, currentScope);
      if (scopeOrder < 0) {
        const receipt = this.receipt(work, "stale", 0); await watch.race(this.storeReceipt(tx, receipt, work.leaseVersion)); await watch.race(tx.commit()); return receipt;
      }
      if (scopeOrder > 0) {
        await watch.race(tx.run(`MATCH (s:CortexRuntimeGraphScope {key:$scopeKey}) SET s.tenantEpoch=$tenantEpoch, s.memorySpaceEpoch=$memorySpaceEpoch`, args));
        for (const label of ["CortexRuntimeGraphFact", "CortexRuntimeGraphEntity"] as const) {
          await watch.race(tx.run(`MATCH (n:${label} {scopeKey:$scopeKey}) WHERE n.tenantEpoch<>$tenantEpoch OR n.memorySpaceEpoch<>$memorySpaceEpoch DETACH DELETE n`, args));
        }
        await watch.race(tx.run(`MATCH (s:CortexRuntimeGraphSource {scopeKey:$scopeKey}) WHERE s.tenantEpoch<>$tenantEpoch OR s.memorySpaceEpoch<>$memorySpaceEpoch REMOVE s.payloadCanonical`, args));
      }
      const locked = await watch.race(tx.run(`MERGE (f:CortexRuntimeGraphSource {key:$sourceKey})
        ON CREATE SET f.scopeKey=$scopeKey, f.sourceId=$sourceId, f.tenantEpoch=$tenantEpoch,
          f.memorySpaceEpoch=$memorySpaceEpoch, f.revision=0, f.payloadHash='', f.payloadCanonical='', f.leaseVersion=0, f.touch=0
        SET f.touch=1-coalesce(f.touch,0)
        RETURN f.tenantEpoch AS tenantEpoch, f.memorySpaceEpoch AS memorySpaceEpoch, f.revision AS revision,
          f.payloadHash AS payloadHash, f.payloadCanonical AS payloadCanonical, f.leaseVersion AS leaseVersion`, args));
      const row = locked.records[0], revision = number(row.get("revision"));
      const order = revision === 0 ? 1 : compareGraphFence({ ...p.scope, revision: p.revision }, {
        tenantEpoch: number(row.get("tenantEpoch")), memorySpaceEpoch: number(row.get("memorySpaceEpoch")), revision,
      });
      let state: GraphProjectionReceiptV1["state"];
      if (order < 0) state = "stale";
      else if (order === 0) {
        if (string(row.get("payloadHash")) !== work.payloadHash || row.get("payloadCanonical") !== canonical) throw new GraphConnectorError("GRAPH_FENCE_CONFLICT");
        state = "duplicate";
      } else {
        await watch.race(this.replace(tx, p, args));
        await watch.race(tx.run(`MATCH (f:CortexRuntimeGraphSource {key:$sourceKey}) SET f.tenantEpoch=$tenantEpoch,
          f.memorySpaceEpoch=$memorySpaceEpoch, f.revision=$revision, f.payloadHash=$payloadHash,
          f.payloadCanonical=$payloadCanonical, f.tombstoned=$tombstoned, f.profileId=$profileId,
          f.sourceRevision=$sourceRevision, f.sourceEventId=$sourceEventId, f.contentHash=$contentHash`, {
          ...args, revision: neo4j.int(p.revision), payloadHash: work.payloadHash, payloadCanonical: canonical,
          tombstoned: p.operation === "tombstone", profileId: p.profile.profileId,
          sourceRevision: neo4j.int(p.source.sourceRevision), sourceEventId: p.source.sourceEventId, contentHash: p.source.contentHash,
        }));
        state = "applied";
      }
      if (state !== "stale") await watch.race(tx.run(`MATCH (f:CortexRuntimeGraphSource {key:$sourceKey})
        SET f.leaseVersion=CASE WHEN f.leaseVersion<$leaseVersion THEN $leaseVersion ELSE f.leaseVersion END`, { ...args, leaseVersion: neo4j.int(work.leaseVersion) }));
      const receipt = this.receipt(work, state, state === "applied" ? p.revision : revision);
      await watch.race(this.storeReceipt(tx, receipt, work.leaseVersion)); await watch.race(tx.commit());
      if (watch.expired()) throw new GraphConnectorError("GRAPH_WRITE_FAILED_OR_UNKNOWN"); return receipt;
    } catch (error) {
      failed = true;
      if (!watch.expired() && tx?.isOpen()) await watch.race(tx.rollback()).catch(() => undefined);
      if (error instanceof GraphConnectorError && error.code !== "GRAPH_IO_TIMEOUT") throw error;
      throw new GraphConnectorError("GRAPH_WRITE_FAILED_OR_UNKNOWN");
    } finally {
      let cleanupFailed = false;
      if (tx) { const owned = tx; if (!await this.cleanup(() => owned.close())) cleanupFailed = true; }
      if (!await this.cleanup(() => session.close())) cleanupFailed = true;
      if (cleanupFailed) {
        if (!await this.cleanup(() => watch.retire())) cleanupFailed = true;
      }
      if (!await watch.finish()) cleanupFailed = true;
      if (cleanupFailed) {
        if (!failed) throw new GraphConnectorError("GRAPH_WRITE_FAILED_OR_UNKNOWN");
      }
    }
  }
  private receipt(work: GraphProjectionWorkV1, state: GraphProjectionReceiptV1["state"], currentRevision: number): GraphProjectionReceiptV1 {
    return { version: 1, connectorId: work.connectorId, jobId: work.jobId, payloadHash: work.payloadHash,
      tenantId: work.tenantId, memorySpaceId: work.memorySpaceId, sourceId: work.payload.source.sourceId,
      tenantEpoch: work.payload.scope.tenantEpoch, memorySpaceEpoch: work.payload.scope.memorySpaceEpoch,
      revision: work.payload.revision, state, currentRevision };
  }
  private async storeReceipt(tx: Transaction, receipt: GraphProjectionReceiptV1, leaseVersion: number): Promise<void> {
    const canonical = canonicalModelJson(receipt), key = await semanticHash(canonicalModelJson([this.scopeKey, leaseVersion, receipt]));
    await tx.run(`MERGE (r:CortexRuntimeGraphReceipt {key:$key}) ON CREATE SET r.scopeKey=$scopeKey,
      r.sourceId=$sourceId, r.receiptCanonical=$receiptCanonical, r.leaseVersion=$leaseVersion`, {
      key, scopeKey: this.scopeKey, sourceId: receipt.sourceId, receiptCanonical: canonical, leaseVersion: neo4j.int(leaseVersion),
    });
  }
  private async replace(tx: Transaction, p: GraphProjectionPayloadV1, args: Record<string, unknown>): Promise<void> {
    for (const label of ["CortexRuntimeGraphFact", "CortexRuntimeGraphEntity"] as const) {
      await tx.run(`MATCH (n:${label} {scopeKey:$scopeKey, sourceId:$sourceId}) DETACH DELETE n`, args);
    }
    const entityTypes = new Map<string, Set<string>>();
    for (const fact of p.facts) for (const entity of fact.entities) {
      let types = entityTypes.get(entity.name);
      if (!types) { types = new Set<string>(); entityTypes.set(entity.name, types); }
      types.add(entity.type);
    }
    for (const fact of p.facts) for (const relation of fact.relations) for (const name of [relation.subject, relation.object]) {
      if (!entityTypes.has(name)) entityTypes.set(name, new Set(["unknown"]));
    }
    for (const [name, types] of entityTypes) {
      await tx.run(`CREATE (e:CortexRuntimeGraphEntity {key:$entityKey, scopeKey:$scopeKey,
        sourceId:$sourceId, tenantEpoch:$tenantEpoch, memorySpaceEpoch:$memorySpaceEpoch, name:$name, types:$types})`, {
        ...args, name, types: [...types].sort(), entityKey: canonicalModelJson([this.scopeKey, p.source.sourceId, name]),
      });
    }
    for (const fact of p.facts) {
      const factKey = canonicalModelJson([this.scopeKey, p.source.sourceId, fact.factId]);
      const data = { ...args, factKey, factId: fact.factId, factRevision: neo4j.int(fact.revision), text: fact.text,
        profileId: p.profile.profileId, projectionRevision: neo4j.int(p.revision) };
      await tx.run(`CREATE (f:CortexRuntimeGraphFact {key:$factKey, scopeKey:$scopeKey, sourceId:$sourceId,
        tenantEpoch:$tenantEpoch, memorySpaceEpoch:$memorySpaceEpoch, factId:$factId, revision:$factRevision,
        text:$text, profileId:$profileId, projectionRevision:$projectionRevision})`, data);
      const names = new Set([...fact.entities.map(e => e.name), ...fact.relations.flatMap(r => [r.subject, r.object])]);
      for (const name of names) {
        const entityKey = canonicalModelJson([this.scopeKey, p.source.sourceId, name]);
        await tx.run(`MATCH (f:CortexRuntimeGraphFact {key:$factKey}), (e:CortexRuntimeGraphEntity {key:$entityKey})
          MERGE (f)-[:CORTEX_MENTIONS]->(e)`, { ...data, entityKey });
      }
      for (const relation of fact.relations) {
        const subjectKey = canonicalModelJson([this.scopeKey, p.source.sourceId, relation.subject]);
        const objectKey = canonicalModelJson([this.scopeKey, p.source.sourceId, relation.object]);
        await tx.run(`MATCH (a:CortexRuntimeGraphEntity {key:$subjectKey}), (b:CortexRuntimeGraphEntity {key:$objectKey})
          MERGE (a)-[r:CORTEX_RELATION {factId:$factId, predicate:$predicate}]->(b)`, { ...data, subjectKey, objectKey, predicate: relation.predicate });
      }
    }
  }
  /** Only IDs leave the graph. The backend rehydrates with current reader/source authority. */
  async expand(args: { scope: GraphProjectionScope; sourceId: string; profileId: string; revision: number; limit: number }): Promise<GraphExpansionResultV1> {
    this.scope(args.scope);
    if (!text(args.sourceId) || !text(args.profileId) || !positive(args.revision) || !positive(args.limit) || args.limit > GRAPH_PROJECTION_LIMITS.maximumExpansion) throw new GraphConnectorError("INVALID_GRAPH_EXPANSION");
    const driver = this.requireDriver(), session = driver.session(this.sessionConfig()), watch = this.watch(driver);
    try {
      const result = await watch.race(session.run(`MATCH (s:CortexRuntimeGraphScope {key:$scopeKey}),
        (fence:CortexRuntimeGraphSource {scopeKey:$scopeKey, sourceId:$sourceId})
        WHERE s.tenantEpoch=$tenantEpoch AND s.memorySpaceEpoch=$memorySpaceEpoch
          AND fence.tenantEpoch=$tenantEpoch AND fence.memorySpaceEpoch=$memorySpaceEpoch
          AND fence.profileId=$profileId AND fence.revision=$revision AND fence.tombstoned=false
        MATCH (seed:CortexRuntimeGraphFact {scopeKey:$scopeKey, sourceId:$sourceId, profileId:$profileId})
        WHERE seed.projectionRevision=fence.revision
        OPTIONAL MATCH (seed)-[:CORTEX_MENTIONS]->(anchor:CortexRuntimeGraphEntity)
        WITH seed, collect(anchor.name) AS names
        OPTIONAL MATCH (related:CortexRuntimeGraphEntity {scopeKey:$scopeKey})<-[:CORTEX_MENTIONS]-(neighbor:CortexRuntimeGraphFact {scopeKey:$scopeKey, profileId:$profileId})
        WHERE related.name IN names AND related.tenantEpoch=$tenantEpoch AND related.memorySpaceEpoch=$memorySpaceEpoch
        WITH collect(DISTINCT seed)+collect(DISTINCT neighbor) AS candidates
        UNWIND candidates AS fact
        MATCH (current:CortexRuntimeGraphSource {scopeKey:$scopeKey, sourceId:fact.sourceId})
        WHERE current.tenantEpoch=$tenantEpoch AND current.memorySpaceEpoch=$memorySpaceEpoch
          AND current.profileId=$profileId AND current.tombstoned=false
          AND fact.tenantEpoch=$tenantEpoch AND fact.memorySpaceEpoch=$memorySpaceEpoch
          AND fact.projectionRevision=current.revision
        RETURN DISTINCT fact.factId AS factId ORDER BY factId LIMIT $limit`, {
        scopeKey: this.scopeKey, sourceId: args.sourceId, profileId: args.profileId, revision: neo4j.int(args.revision),
        tenantEpoch: neo4j.int(args.scope.tenantEpoch), memorySpaceEpoch: neo4j.int(args.scope.memorySpaceEpoch), limit: neo4j.int(args.limit),
      }, { timeout: this.timeoutMs }));
      if (watch.expired()) throw new GraphConnectorError("GRAPH_READ_UNAVAILABLE");
      return { version: 1, scope: args.scope, sourceId: args.sourceId, profileId: args.profileId, revision: args.revision, factIds: result.records.map(row => string(row.get("factId"))) };
    } catch (error) {
      if (error instanceof GraphConnectorError && error.code !== "GRAPH_IO_TIMEOUT") throw error;
      throw new GraphConnectorError("GRAPH_READ_UNAVAILABLE");
    } finally {
      const closed = await this.cleanup(() => session.close()), retired = await watch.finish();
      if (!closed || !retired) throw new GraphConnectorError("GRAPH_READ_UNAVAILABLE");
    }
  }
  async inspectSource(sourceId: string): Promise<GraphFenceDiagnostics | null> {
    if (!text(sourceId)) throw new GraphConnectorError("INVALID_GRAPH_SOURCE");
    const session = this.requireDriver().session(this.sessionConfig());
    try {
      const result = await session.run(`MATCH (f:CortexRuntimeGraphSource {key:$key}) RETURN f.tenantEpoch AS tenantEpoch,
        f.memorySpaceEpoch AS memorySpaceEpoch, f.revision AS revision, f.leaseVersion AS leaseVersion,
        f.payloadHash AS payloadHash, f.tombstoned AS tombstoned, f.profileId AS profileId`, {
        key: canonicalModelJson([this.scopeKey, sourceId]),
      }, { timeout: this.timeoutMs });
      if (result.records.length === 0) return null;
      const row = result.records[0];
      return { tenantEpoch: number(row.get("tenantEpoch")), memorySpaceEpoch: number(row.get("memorySpaceEpoch")),
        revision: number(row.get("revision")), leaseVersion: number(row.get("leaseVersion")), payloadHash: string(row.get("payloadHash")),
        tombstoned: row.get("tombstoned") === true, profileId: string(row.get("profileId")) };
    } finally { await session.close(); }
  }
}
