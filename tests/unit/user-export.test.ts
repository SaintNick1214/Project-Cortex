import { operationalExportExclusions, runtimeExportUnsupported } from "../../convex-dev/lib/userDataScope";
import { createServer, type Server } from "node:http";
import type { Socket } from "node:net";
import { convexToJson } from "convex/values";
import { UsersAPI } from "../../src/users";
import {
  USER_EXPORT_DOMAINS,
  createUserExportTransport,
  UserExportTransportError,
  type UserExportNode,
  type UserExportFileNode,
} from "../../src/users/export";
import * as backend from "../../convex-dev/userExport";
import schema from "../../convex-dev/schema";
import { exportFingerprint } from "../../convex-dev/lib/userDataScope";

const identity = {
  userId: "task16a-unit",
  scope: { kind: "tenantless" as const },
};
const node = { domain: "immutable", id: "unit-immutable" } as UserExportNode;
const fileNode = {
  domain: "attachments",
  id: "unit-attachment",
} as UserExportFileNode;
const fp = "1".repeat(64);
let server: Server, url: string;
const sockets = new Set<Socket>();
const requestSockets = new Set<Socket>();
let handler: (name: string, args: Record<string, unknown>) => unknown;
let mode = "normal";
const received: {
  path: string;
  args: Record<string, unknown>;
  auth?: string;
}[] = [];
beforeAll(async () => {
  server = createServer((request, response) => {
    void (async () => {
      response.setHeader("Connection", "close");
      requestSockets.add(request.socket);
      request.socket.once("close", () => requestSockets.delete(request.socket));
      const parts: Buffer[] = [];
      for await (const part of request) parts.push(Buffer.from(part));
      const body = JSON.parse(Buffer.concat(parts).toString()) as {
        path: string;
        args: Record<string, unknown>;
      };
      received.push({ ...body, auth: request.headers.authorization });
      if (mode === "stall") return;
      if (mode === "stream") {
        response.writeHead(200);
        response.write('{"status":"success","value":');
        return;
      }
      if (mode === "large") {
        response.end("x".repeat(9 * 1024 * 1024));
        return;
      }
      response.end(
        JSON.stringify({
          status: "success",
          value: convexToJson(handler(body.path, body.args) as never),
        }),
      );
    })().catch(() => response.destroy());
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("owned listener unavailable");
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  requestSockets.clear();
  mode = "normal";
  received.length = 0;
  handler = () => ({
    ...identity,
    protocolVersion: 1,
    observationTime: 1,
    kind: "inspect",
    capability: "transport-only",
    profile: null,
    supportedDomains: [...USER_EXPORT_DOMAINS],
  });
});

it("registers exactly five internal operations and mirrors the independent schema table set", () => {
  expect(Object.keys(backend).sort()).toEqual([
    "inspect",
    "inspectEdge",
    "page",
    "readNode",
    "resolveFile",
  ]);
  for (const operation of Object.values(backend))
    expect(operation).toHaveProperty("isInternal", true);
  expect(
    new Set([
      ...USER_EXPORT_DOMAINS,
      ...Object.keys(operationalExportExclusions),
      ...runtimeExportUnsupported,
    ]),
  ).toEqual(new Set(Object.keys(schema.tables)));
  expect(USER_EXPORT_DOMAINS).toHaveLength(17);
  expect(Object.keys(operationalExportExclusions).sort()).toEqual([
    "cortexErasureReceipts",
    "cortexReferenceEdges",
    "cortexReferenceState",
    "cortexReferenceTargets",
  ]);
});
it("reachable factory uses five literal native paths, one admin header, canonical raw values and no identity mutation", async () => {
  const sdk = new UsersAPI({} as never);
  const transport = sdk.createExportTransport({
    url,
    deploymentKey: "task16a-test-secret",
  });
  expect(Object.keys(transport).sort()).toEqual([
    "inspect",
    "inspectEdge",
    "page",
    "readNode",
    "resolveFile",
  ]);
  const envelope = { ...identity, protocolVersion: 1, observationTime: 1 };
  handler = (name) =>
    name.endsWith(":inspect")
      ? {
          ...envelope,
          kind: "inspect",
          capability: "transport-only",
          profile: null,
          supportedDomains: [...USER_EXPORT_DOMAINS],
        }
      : name.endsWith(":page")
        ? {
            ...envelope,
            kind: "page",
            page: [],
            continueCursor: "end",
            isDone: true,
          }
        : name.endsWith(":inspectEdge")
          ? {
              ...envelope,
              kind: "edge",
              witness: {
                childNode: node,
                childFingerprint: fp,
                kind: "probe",
                ordinal: 0,
                status: "missing",
                observationTime: 1,
              },
            }
          : name.endsWith(":readNode")
            ? {
                ...envelope,
                kind: "node",
                node,
                fingerprint: fp,
                disposition: "record",
                record: {
                  _id: "raw-id",
                  _creationTime: 2,
                  maximum: 9223372036854775807n,
                  bytes: new Uint8Array([0, 255]).buffer,
                  negativeZero: -0,
                  nan: NaN,
                },
              }
            : {
                ...envelope,
                kind: "file",
                node: fileNode,
                fingerprint: fp,
                file: {
                  storageId: "storage",
                  url: url + "/private-file",
                  size: 2,
                  mimeType: "application/octet-stream",
                  sha256: fp,
                },
              };
  await transport.inspect(identity);
  await transport.page({
    ...identity,
    selection: { kind: "rootProjections", domain: "immutable" },
    cursor: null,
    numItems: 1,
  });
  await transport.inspectEdge({
    ...identity,
    node,
    expectedFingerprint: fp,
    edgeOrdinal: 0,
  });
  const result = await transport.readNode({
    ...identity,
    node,
    expectedFingerprint: fp,
  });
  expect(result.record).toEqual({
    _id: "raw-id",
    _creationTime: 2,
    maximum: 9223372036854775807n,
    bytes: new Uint8Array([0, 255]).buffer,
    negativeZero: -0,
    nan: NaN,
  });
  await transport.resolveFile({
    ...identity,
    node: fileNode,
    expectedFingerprint: fp,
  });
  expect(received.map((r) => r.path)).toEqual([
    "userExport:inspect",
    "userExport:page",
    "userExport:inspectEdge",
    "userExport:readNode",
    "userExport:resolveFile",
  ]);
  expect(received.every((r) => r.auth === "Convex task16a-test-secret")).toBe(
    true,
  );
  expect(
    received.every(
      (r) =>
        !Object.keys(r.args).some((k) =>
          ["admin", "token", "actingAsIdentity"].includes(k),
        ),
    ),
  ).toBe(true);
});
it("refuses malformed scope/protocol/identity echoes, arbitrary paths and missing keys without exposing secrets", async () => {
  expect(() => createUserExportTransport({ url, deploymentKey: "" })).toThrow(
    "EXPORT_PROTOCOL",
  );
  const t = createUserExportTransport({
    url,
    deploymentKey: "secret-not-in-errors",
  });
  await expect(
    t.inspect({ ...identity, function: "admin:clearAll" } as never),
  ).rejects.toThrow("EXPORT_PROTOCOL");
  expect(received).toHaveLength(0);
  for (const change of [
    { protocolVersion: 2 },
    { userId: "foreign" },
    { scope: { kind: "tenant", tenantId: "foreign" } },
    { observationTime: NaN },
  ]) {
    const original = handler;
    handler = () => ({ ...(original("", {}) as object), ...change });
    await expect(t.inspect(identity)).rejects.toThrow("EXPORT_PROTOCOL");
    handler = original;
  }
});
it.each(["stall", "stream"])(
  "cancel/deadline closes actual owned %s response within its cleanup deadline",
  async (state) => {
    mode = state;
    const t = createUserExportTransport({
      url,
      deploymentKey: "secret",
      timeoutMs: 150,
    });
    const controller = new AbortController();
    const pending = t.inspect(identity, { signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 40));
    controller.abort();
    await expect(pending).rejects.toThrow("EXPORT_CANCELLED");
    // Observe peer closure instead of assuming its event arrives within 20ms.
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all(
          [...requestSockets].filter((socket) => !socket.destroyed).map(
            (socket) => new Promise<void>((resolve) => socket.once("close", () => resolve())),
          ),
        ),
        new Promise((_, reject) => {
          deadline = setTimeout(() => reject(new Error("owned response socket leak")), 1000);
        }),
      ]);
    } finally {
      clearTimeout(deadline);
    }
    expect([...requestSockets].filter((s) => !s.destroyed)).toHaveLength(0);
    await expect(t.inspect(identity)).rejects.toThrow("EXPORT_DEADLINE");
  },
);
it("bounds encoded request/response and pre-cancelled requests without false successful output", async () => {
  const t = createUserExportTransport({ url, deploymentKey: "secret" });
  await expect(
    t.inspect({ ...identity, userId: "x".repeat(70000) }),
  ).rejects.toThrow("EXPORT_REQUEST_TOO_LARGE");
  expect(received).toHaveLength(0);
  const controller = new AbortController();
  controller.abort();
  await expect(
    t.inspect(identity, { signal: controller.signal }),
  ).rejects.toThrow("EXPORT_CANCELLED");
  expect(received).toHaveLength(0);
  mode = "large";
  await expect(t.inspect(identity)).rejects.toThrow(
    "EXPORT_RESPONSE_TOO_LARGE",
  );
});
it.each(["unsettled", "rejected"])(
  "a hostile %s administrative response cancellation refuses within its teardown deadline",
  async (failure) => {
    const originalFetch = globalThis.fetch;
    let cancelCalls = 0;
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(9 * 1024 * 1024));
          },
          cancel() {
            cancelCalls++;
            return failure === "rejected"
              ? Promise.reject(new Error("unexpected cleanup failure"))
              : new Promise<void>(() => undefined);
          },
        }),
      );
    try {
      const transport = createUserExportTransport({
        url,
        deploymentKey: "owned-test-key",
        timeoutMs: 50,
      });
      const started = Date.now();
      await expect(transport.inspect(identity)).rejects.toThrow(
        failure === "unsettled" ? "EXPORT_DEADLINE" : "EXPORT_TRANSPORT",
      );
      expect(cancelCalls).toBe(1);
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

// 16B tests use authoritative fixed projections/witnesses; no payload resolver is called.
import {
  discoverUserExportClosure,
  resolveUserExportIdentity,
  type UserExportProjection,
  type UserExportTransport,
  type UserExportPageRequest,
} from "../../src/users/export";
function projected(
  domain: string,
  id: string,
  root = false,
): UserExportProjection {
  return {
    node: { domain, id } as unknown as UserExportNode,
    fingerprint: fp,
    logicalId: id,
    disposition: root ? "root" : "unownedCandidate",
    edgeDescriptors: [],
    ...(id === "profile" ? { rootReason: "scopedProfile" } : {}),
  } as UserExportProjection;
}
function projectionTransport(records: UserExportProjection[]) {
  const requests: UserExportPageRequest[] = [];
  const envelope = {
    ...identity,
    protocolVersion: 1 as const,
    observationTime: 1,
  };
  const transport: UserExportTransport = {
    inspect: async () => ({
      ...envelope,
      kind: "inspect",
      capability: "transport-only",
      profile: projected("immutable", "profile").node,
      supportedDomains: [...USER_EXPORT_DOMAINS],
    }),
    page: async (request) => {
      requests.push(request);
      return {
        ...envelope,
        kind: "page",
        page: records.filter(
          (p) =>
            p.node.domain === request.selection.domain &&
            (request.selection.kind === "rootProjections"
              ? p.disposition !== "unownedCandidate"
              : p.disposition === "unownedCandidate"),
        ),
        continueCursor: "terminal",
        isDone: true,
      };
    },
    inspectEdge: async () => {
      throw new Error("unexpected edge");
    },
    readNode: async () => {
      throw new Error("payload must remain gated");
    },
    resolveFile: async () => {
      throw new Error("files must remain gated");
    },
  };
  return { transport, requests, envelope };
}
it("computes the least rooted closure through 10 alternating fact/memory edges, excluding disconnected cycles and foreign breaks", async () => {
  const records = [
    projected("immutable", "profile", true),
    projected("facts", "F0", true),
  ];
  const parents = new Map<string, UserExportProjection>();
  let previous = records[1];
  for (let i = 1; i <= 20; i++) {
    const child = projected(i % 2 ? "memories" : "facts", `chain-${i}`);
    child.edgeDescriptors.push({
      ordinal: 0,
      kind: "link",
      domain: previous.node.domain,
      storedLogicalTarget: previous.node.id,
      purpose: "inclusion",
    });
    parents.set(child.node.id, previous);
    records.push(child);
    previous = child;
  }
  const disconnected = [
    projected("facts", "cycle1"),
    projected("memories", "cycle2"),
  ];
  for (let i = 0; i < 2; i++) {
    const parent = disconnected[1 - i];
    disconnected[i].edgeDescriptors.push({
      ordinal: 0,
      kind: "link",
      domain: parent.node.domain,
      storedLogicalTarget: parent.node.id,
      purpose: "inclusion",
    });
    parents.set(disconnected[i].node.id, parent);
  }
  records.push(...disconnected);
  const broken = projected("facts", "foreignBreak"),
    independentlyOwned = projected("facts", "independent", true);
  broken.edgeDescriptors.push({
    ordinal: 0,
    kind: "link",
    domain: "memories",
    purpose: "inclusion",
  });
  records.push(broken, independentlyOwned);
  const { transport, envelope } = projectionTransport(records);
  transport.inspectEdge = async (request) => ({
    ...envelope,
    kind: "edge",
    witness: {
      childNode: request.node,
      childFingerprint: fp,
      ordinal: 0,
      kind: "link",
      observationTime: 1,
      ...(request.node.id === "foreignBreak"
        ? { status: "foreignOwner" as const }
        : {
            status: "admissible" as const,
            parentNode: parents.get(request.node.id)!.node,
            parentFingerprint: fp,
          }),
    },
  });
  const result = await discoverUserExportClosure(transport, identity);
  expect(new Set(result.reachable.map((x) => x.projection.node.id))).toEqual(
    new Set([
      "profile",
      "F0",
      "independent",
      ...Array.from({ length: 20 }, (_, i) => `chain-${i + 1}`),
    ]),
  );
  expect(result.witnesses).toHaveLength(20);
  expect(result.diagnostics).toEqual([]);
});
it.each([
  [false, "none"],
  [true, "none"],
  [false, "null"],
  [true, "null"],
  [false, "omitted"],
  [true, "omitted"],
] as const)(
  "bounded native end equality completes only its child range (nonempty=%s, recommendation=%s), preserving all 44 independently expected IDs and nested split tail",
  async (nonempty, recommendation) => {
    const records = [
      projected("immutable", "profile", true),
      ...Array.from({ length: 43 }, (_, i) =>
        projected("immutable", `row-${i}`, true),
      ),
    ];
    const { transport, envelope, requests } = projectionTransport(records);
    const old = transport.page;
    transport.page = async (request, options) => {
      if (
        request.selection.domain !== "immutable" ||
        request.selection.kind !== "rootProjections"
      )
        return old(request, options);
      requests.push(request);
      const range = `${request.cursor ?? "start"}/${request.endCursor ?? "tail"}`;
      const answer = (
        page: UserExportProjection[],
        cursor: string,
        done: boolean,
        status?: "SplitRequired" | "SplitRecommended",
        split?: string | null,
      ) => {
        const response = {
          ...envelope,
          kind: "page" as const,
          page,
          continueCursor: cursor,
          isDone: done,
          ...(status ? { pageStatus: status } : {}),
          ...(split !== undefined ? { splitCursor: split } : {}),
        };
        if (
          status === "SplitRecommended" &&
          (split === null || split === undefined) &&
          recommendation !== "none"
        )
          expect(Object.hasOwn(response, "splitCursor")).toBe(
            recommendation === "null",
          );
        return response;
      };
      if (range === "start/tail")
        return answer(
          [projected("immutable", "discard-provisional", true)],
          "C",
          false,
          "SplitRecommended",
          "B",
        );
      if (range === "start/B")
        return answer(
          [projected("immutable", "discard-required", true)],
          "B",
          false,
          "SplitRequired",
          "A",
        );
      if (range === "start/A")
        return answer(
          nonempty ? records.slice(0, 1) : [],
          "A",
          false,
          recommendation === "none" ? undefined : "SplitRecommended",
          recommendation === "null" ? null : undefined,
        );
      if (range === "A/B")
        return answer(
          records.slice(nonempty ? 1 : 0, 12),
          "B",
          false,
          recommendation === "none" ? undefined : "SplitRecommended",
          recommendation === "null" ? null : undefined,
        );
      if (range === "B/C") return answer(records.slice(12, 27), "C", false);
      if (range === "C/tail") return answer(records.slice(27), "end", true);
      throw new Error(`unexpected ${range}`);
    };
    const closure = await discoverUserExportClosure(transport, identity);
    expect(new Set(closure.reachable.map((x) => x.projection.node.id))).toEqual(
      new Set(records.map((x) => x.node.id)),
    );
    expect(
      requests
        .filter(
          (r) =>
            r.selection.domain === "immutable" &&
            r.selection.kind === "rootProjections",
        )
        .map((r) => [r.cursor, r.endCursor]),
    ).toEqual([
      [null, null],
      [null, "B"],
      [null, "A"],
      ["A", "B"],
      ["B", "C"],
      ["C", null],
    ]);
  },
);
it.each(["repeat", "cycle", "changed"])(
  "refuses %s projection pagination without false completion or an unbounded retry",
  async (kind) => {
    const { transport, envelope } = projectionTransport([
      projected("immutable", "profile", true),
    ]);
    let calls = 0;
    transport.page = async (request) => {
      calls++;
      return {
        ...envelope,
        kind: "page",
        page:
          kind === "changed"
            ? [
                {
                  ...projected("immutable", "profile", true),
                  fingerprint: (calls === 1 ? "1" : "2").repeat(64),
                },
              ]
            : [],
        continueCursor:
          kind === "repeat" ? (request.cursor ?? "A") : calls % 2 ? "A" : "B",
        isDone: false,
      };
    };
    await expect(
      discoverUserExportClosure(transport, identity),
    ).rejects.toThrow(
      kind === "changed" ? "EXPORT_CHANGED" : "EXPORT_PROTOCOL",
    );
    expect(calls).toBeLessThan(10);
  },
);
it("copies exact context/per-call/default scope once, refuses conflicts and pre-cancellation without transport", async () => {
  expect(resolveUserExportIdentity("u")).toEqual({
    userId: "u",
    scope: { kind: "tenantless" },
  });
  expect(resolveUserExportIdentity("u", undefined, "A").scope).toEqual({
    kind: "tenant",
    tenantId: "A",
  });
  expect(() => resolveUserExportIdentity("u", "B", "A")).toThrow(
    "EXPORT_SCOPE",
  );
  const { transport, requests } = projectionTransport([
    projected("immutable", "profile", true),
  ]);
  const selected = { ...identity, scope: { kind: "tenantless" as const } };
  const old = transport.inspect;
  transport.inspect = async (...args) => {
    selected.userId = "changed";
    return old(...args);
  };
  const closure = await discoverUserExportClosure(transport, selected);
  expect(closure.identity.userId).toBe(identity.userId);
  expect(requests.every((r) => r.userId === identity.userId)).toBe(true);
  const controller = new AbortController();
  controller.abort();
  const count = requests.length;
  await expect(
    discoverUserExportClosure(transport, identity, {
      signal: controller.signal,
    }),
  ).rejects.toThrow("EXPORT_CANCELLED");
  expect(requests).toHaveLength(count);
});
it("accepts 100001 advancing pages and a true terminal page without imposing a total page cap", async () => {
  const profile = projected("immutable", "profile", true);
  const { transport, envelope } = projectionTransport([profile]);
  let calls = 0;
  const old = transport.page;
  transport.page = async (r, options) =>
    r.selection.domain === "immutable" && r.selection.kind === "rootProjections"
      ? {
          ...envelope,
          kind: "page",
          page: ++calls === 100001 ? [profile] : [],
          continueCursor: String(calls),
          isDone: calls === 100001,
        }
      : old(r, options);
  expect(
    (await discoverUserExportClosure(transport, identity)).reachable.map(
      (x) => x.projection.node.id,
    ),
  ).toEqual(["profile"]);
  expect(calls).toBe(100001);
}, 30000);
it.each(["missing", "unresolved", "changedParent"])(
  "retained physical missing source is diagnostic, while %s never guesses or releases replacement data",
  async (status) => {
    const profile = projected("immutable", "profile", true),
      history = projected("factHistory", "history", true);
    history.edgeDescriptors = [
      {
        ordinal: 0,
        kind: "historySourceFact",
        domain: "facts",
        purpose: "inclusion",
        storedDocumentTarget: "deleted-original",
        storedLogicalTarget: "reused-logical",
      },
    ];
    const replacement = projected("facts", "replacement", false);
    const { transport, envelope } = projectionTransport([
      profile,
      history,
      replacement,
    ]);
    transport.inspectEdge = async (r) => ({
      ...envelope,
      kind: "edge",
      witness: {
        childNode: r.node,
        childFingerprint: fp,
        ordinal: 0,
        kind: "historySourceFact",
        observationTime: 1,
        status: (status === "changedParent" ? "admissible" : status) as
          | "admissible"
          | "missing"
          | "unresolved",
        ...(status === "changedParent"
          ? { parentNode: replacement.node, parentFingerprint: "2".repeat(64) }
          : {}),
      },
    });
    if (status !== "missing")
      await expect(
        discoverUserExportClosure(transport, identity),
      ).rejects.toThrow(
        status === "unresolved"
          ? "FACT_HISTORY_PROVENANCE_UNRESOLVED"
          : "EXPORT_CHANGED",
      );
    else {
      const result = await discoverUserExportClosure(transport, identity);
      expect(result.reachable.map((x) => x.projection.node.id)).toEqual([
        "profile",
        "history",
      ]);
      expect(result.diagnostics[0].status).toBe("missing");
    }
  },
);
it("supportSpace is record-to-space only, and does not root unrelated contents of the same space", async () => {
  const profile = projected("immutable", "profile", true),
    owned = projected("facts", "owned", true),
    space = projected("memorySpaces", "space"),
    unrelated = projected("memories", "unrelated");
  owned.edgeDescriptors = [
    {
      ordinal: 0,
      kind: "supportSpace",
      domain: "memorySpaces",
      purpose: "support",
    },
  ];
  unrelated.edgeDescriptors = [
    {
      ordinal: 0,
      kind: "supportSpace",
      domain: "memorySpaces",
      purpose: "support",
    },
  ];
  const { transport, envelope } = projectionTransport([
    profile,
    owned,
    space,
    unrelated,
  ]);
  transport.inspectEdge = async (r) => ({
    ...envelope,
    kind: "edge",
    witness: {
      childNode: r.node,
      childFingerprint: fp,
      ordinal: 0,
      kind: "supportSpace",
      status: "admissible",
      parentNode: space.node,
      parentFingerprint: fp,
      observationTime: 1,
    },
  });
  const result = await discoverUserExportClosure(transport, identity);
  expect(result.reachable.map((x) => x.projection.node.id)).toEqual([
    "profile",
    "owned",
    "space",
  ]);
  expect(result.reachable[2].supportWitness?.childNode.id).toBe("owned");
  expect(result.witnesses).toHaveLength(1);
});
it.each(["supersedes", "supersededBy"])(
  "walks exact physical facts %s without reversing actor-history association",
  async (direction) => {
    const profile = projected("immutable", "profile", true),
      old = projected("facts", "old", true),
      next = projected("facts", "next"),
      history = projected("factHistory", "actor", true),
      actorSource = projected("facts", "actorSource");
    old.edgeDescriptors = [
      {
        ordinal: 0,
        kind: "physicalFact:" + direction,
        domain: "facts",
        purpose: "inclusion",
        storedDocumentTarget: "next",
      },
    ];
    history.edgeDescriptors = [
      {
        ordinal: 0,
        kind: "historySourceFact",
        domain: "facts",
        purpose: "inclusion",
        storedDocumentTarget: "actorSource",
      },
    ];
    const { transport, envelope } = projectionTransport([
      profile,
      old,
      next,
      history,
      actorSource,
    ]);
    transport.inspectEdge = async (r) => ({
      ...envelope,
      kind: "edge",
      witness: {
        childNode: r.node,
        childFingerprint: fp,
        ordinal: 0,
        kind:
          r.node.id === "old"
            ? "physicalFact:" + direction
            : "historySourceFact",
        status: "admissible",
        parentNode: r.node.id === "old" ? next.node : actorSource.node,
        parentFingerprint: fp,
        observationTime: 1,
      },
    });
    const result = await discoverUserExportClosure(transport, identity);
    expect(new Set(result.reachable.map((x) => x.projection.node.id))).toEqual(
      new Set(["profile", "old", "next", "actor"]),
    );
    expect(
      result.reachable.find((x) => x.projection.node.id === "next")!
        .reverseFactWitness?.childNode.id,
    ).toBe("old");
  },
);

//16C actual stream outcome tests. Payloads retain the backend canonical fingerprint.
import { createHash } from "node:crypto";
import {
  exportUserData,
  canonicalUserExportValue,
  serializeUserExportEvent,
  type UserExportEvent,
} from "../../src/users/export";
function payloadTransport(includeAttachment = false) {
  const rows = [
    {
      _id: "profile",
      _creationTime: 1,
      type: "user",
      id: identity.userId,
      data: {
        bytes: new Uint8Array([0, 255]).buffer,
        extreme: BigInt("9223372036854775807"),
        minusZero: -0,
        nan: NaN,
        list: ["é", "🧠"],
      },
    },
    ...(includeAttachment
      ? [
          {
            _id: "attachment",
            _creationTime: 2,
            storageId: "storage",
            size: 70001,
            mimeType: "application/octet-stream",
          },
        ]
      : []),
  ];
  const records = rows.map((r, i) => {
    const p = projected(i ? "attachments" : "immutable", r._id, true);
    p.fingerprint = createHash("sha256")
      .update(JSON.stringify(canonicalUserExportValue(r)))
      .digest("hex");
    return p;
  });
  const base = projectionTransport(records);
  let reads = 0;
  base.transport.readNode = async (request) => {
    reads++;
    const row = rows.find((r) => r._id === request.node.id)!;
    return {
      ...base.envelope,
      kind: "node",
      node: request.node,
      fingerprint: request.expectedFingerprint,
      disposition: "record",
      record: row,
    };
  };
  return { ...base, rows, records, reads: () => reads };
}
it.each([
  [1, "1"],
  [-1, "-1"],
  [0, "0"],
  [1e-6, "0.000001"],
  [9.999999999999997e-7, "9.999999999999997e-7"],
  [1e-7, "1e-7"],
  [1e20, "100000000000000000000"],
  [1e21, "1e+21"],
  [1.0000000000000001e18, "1000000000000000100"],
  [Number.MIN_VALUE, "5e-324"],
  [-Number.MIN_VALUE, "-5e-324"],
  [Number.MAX_VALUE, "1.7976931348623157e+308"],
])("reachable canonical serializer retains number %s as %s", (number, text) => {
  const event = {
    type: "record",
    record: { number },
  } as unknown as UserExportEvent;
  const api = new UsersAPI({} as never);
  expect(api.serializeExportEvent(event)).toBe(
    '{"record":{"number":' + text + '},"type":"record"}',
  );
  expect(event).toEqual({ type: "record", record: { number } });
});
it("canonical event text preserves Convex tags, UTF-16 key order and stored arrays", () => {
  const record = canonicalUserExportValue({
    specials: [
      BigInt("9223372036854775807"),
      new Uint8Array([0, 255]).buffer,
      -0,
      NaN,
      Infinity,
      -Infinity,
    ],
    keys: { "2": "two", "10": "ten" },
    array: [3, 1, 2],
  }) as Record<string, unknown>;
  // Storage field names are ASCII, while the pure event text seam also has a
  // defined ordering for arbitrary UTF-16 keys.
  record.keys = {
    "2": "two",
    "10": "ten",
    "\uffff": "last",
    "🧠": "beforeLast",
  };
  const event = { type: "record", record } as unknown as UserExportEvent;
  const before = JSON.stringify(event);
  const text = serializeUserExportEvent(event);
  expect(text).toContain('"array":[3,1,2]');
  expect(text).toContain(
    '"keys":{"10":"ten","2":"two","🧠":"beforeLast","\uffff":"last"}',
  );
  expect(JSON.parse(text).record.specials).toEqual(record.specials);
  expect(JSON.stringify(event)).toBe(before);
});
it("canonical event text uses well-formed JSON strings and permits repeated aliases", () => {
  const shared = [
    true,
    false,
    null,
    '"\\\b\t\n\f\r\x00',
    "\ud83e\udde0",
    "\ud800",
    "\udfff",
    "\u2028\u2029",
  ];
  const event = {
    type: "record",
    record: { b: shared, a: shared },
  } as unknown as UserExportEvent;
  const encoded = JSON.stringify(shared);
  expect(serializeUserExportEvent(event)).toBe(
    '{"record":{"a":' + encoded + ',"b":' + encoded + '},"type":"record"}',
  );
});
it.each([
  NaN,
  Infinity,
  -Infinity,
  -0,
  BigInt(1),
  new Uint8Array([1]),
  new Date(),
  undefined,
  { $unknown: "bad" },
  { $bytes: "not base64" },
  { $integer: "AA==" },
  { $float: "AAAAAAAA8D8=" },
  { $bytes: "AA==", extra: true },
  [1, , 2],
  { [Symbol("key")]: 1 },
])(
  "canonical event text refuses unsupported values without successful output: %s",
  (value) => {
    const event = {
      type: "record",
      record: { value },
    } as unknown as UserExportEvent;
    expect(() => new UsersAPI({} as never).serializeExportEvent(event)).toThrow(
      "EXPORT_PROTOCOL at serialize",
    );
  },
);
it("canonical event text refuses cycles and unsupported event kinds", () => {
  const cycle: unknown[] = [];
  cycle.push(cycle);
  for (const event of [
    { type: "record", record: cycle },
    { type: "unsupported" },
    null,
  ])
    expect(() =>
      serializeUserExportEvent(event as unknown as UserExportEvent),
    ).toThrow("EXPORT_PROTOCOL at serialize");
});
async function collectExport(transport: UserExportTransport) {
  const output: UserExportEvent[] = [];
  for await (const e of exportUserData(identity, { transport })) output.push(e);
  return output;
}
it("emits canonical retained values and completes only after final reads, recording exact paging observations", async () => {
  const fixture = payloadTransport();
  const events = await collectExport(fixture.transport);
  expect(fixture.reads()).toBe(2);
  expect(events.map((e) => e.type)).toEqual(["header", "record", "manifest"]);
  const record = events[1];
  expect(record.type).toBe("record");
  if (record.type === "record")
    expect(record.record).toEqual(canonicalUserExportValue(fixture.rows[0]));
  const manifest = events.at(-1)!;
  if (manifest.type !== "manifest") throw new Error("missing manifest");
  expect(manifest.consistency).toBe("rolling-read");
  expect(manifest.pageObservations).toHaveLength(34);
  expect(manifest.tableManifest.find((x) => x.domain === "immutable")).toEqual({
    domain: "immutable",
    records: 1,
    projections: 0,
    pages: 2,
  });
});
it("a changed final raw payload and late response error leave no manifest", async () => {
  for (const mode of ["changed", "throw"]) {
    const fixture = payloadTransport(),
      original = fixture.transport.readNode;
    let calls = 0;
    fixture.transport.readNode = async (request, opts) => {
      calls++;
      if (calls === 2) {
        if (mode === "throw") throw new Error("late read");
        return {
          ...(await original(request, opts)),
          record: { ...fixture.rows[0], data: { changed: true } },
        };
      }
      return original(request, opts);
    };
    const emitted: UserExportEvent[] = [];
    await expect(
      (async () => {
        for await (const e of exportUserData(identity, {
          transport: fixture.transport,
        }))
          emitted.push(e);
      })(),
    ).rejects.toThrow();
    expect(emitted.map((e) => e.type)).toEqual(["header", "record"]);
  }
});
it("membership projections emit only backend projection and never resolve files", async () => {
  const fixture = payloadTransport(),
    member = projected("artifacts", "member", true);
  member.disposition = "membershipProjection";
  const page = fixture.transport.page;
  fixture.transport.page = async (r, o) => {
    const result = await page(r, o);
    if (
      r.selection.domain === "artifacts" &&
      r.selection.kind === "rootProjections"
    )
      result.page.push(member);
    return result;
  };
  const read = fixture.transport.readNode;
  fixture.transport.readNode = async (r, o) =>
    r.node.id === "member"
      ? {
          ...fixture.envelope,
          kind: "node",
          node: r.node,
          fingerprint: fp,
          disposition: "membershipProjection",
          record: {
            _id: "member",
            _creationTime: 2,
            collaborators: [
              { type: "user", id: identity.userId, role: "viewer" },
            ],
          },
        }
      : read(r, o);
  fixture.transport.resolveFile = async () => {
    throw new Error("projection must not fetch");
  };
  const events = await collectExport(fixture.transport);
  expect(events.filter((e) => e.type === "record")).toHaveLength(2);
  expect(events.at(-1)?.type).toBe("manifest");
});
it.each(["correct", "wrong-length", "wrong-hash"])(
  "streams binary %s with fixed chunks and no false manifest",
  async (mode) => {
    const bytes = Buffer.alloc(70001);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    const sockets = new Set<Socket>();
    const local = createServer((_request, response) => {
      response.setHeader("content-type", "application/octet-stream");
      response.setHeader("content-length", String(bytes.length));
      response.end(bytes);
    });
    local.on("connection", (s) => {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
    });
    await new Promise<void>((r) => local.listen(0, "127.0.0.1", r));
    const address = local.address();
    if (!address || typeof address === "string") throw new Error("address");
    try {
      const fixture = payloadTransport(true),
        hash = createHash("sha256").update(bytes).digest("hex");
      fixture.transport.resolveFile = async (r) => ({
        ...fixture.envelope,
        kind: "file",
        node: r.node,
        fingerprint: r.expectedFingerprint,
        file: {
          storageId: "storage" as never,
          url: `http://127.0.0.1:${address.port}/file`,
          size: mode === "wrong-length" ? bytes.length - 1 : bytes.length,
          mimeType: "application/octet-stream",
          sha256: mode === "wrong-hash" ? "0".repeat(64) : hash,
        },
      });
      const events: UserExportEvent[] = [];
      const execution = (async () => {
        for await (const e of exportUserData(identity, {
          transport: fixture.transport,
        }))
          events.push(e);
      })();
      if (mode === "correct") {
        await execution;
        const chunks = events.filter(
          (e): e is Extract<UserExportEvent, { type: "chunk" }> =>
            e.type === "chunk",
        );
        expect(chunks.map((x) => Buffer.from(x.data, "base64").length)).toEqual(
          [65536, 4465],
        );
        expect(
          Buffer.concat(chunks.map((x) => Buffer.from(x.data, "base64"))),
        ).toEqual(bytes);
        expect(events.at(-1)?.type).toBe("manifest");
      } else {
        await expect(execution).rejects.toThrow("EXPORT_FILE_METADATA");
        expect(events.some((x) => x.type === "manifest")).toBe(false);
      }
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((r) => local.close(() => r()));
    }
  },
);
it("early return during a blocked file response closes the owned connection before return", async () => {
  const sockets = new Set<Socket>();
  let closed!: () => void;
  const connectionClosed = new Promise<void>((resolve) => {
    closed = resolve;
  });
  const local = createServer((_request, response) => {
    response.writeHead(200);
    response.write(Buffer.alloc(65536));
  });
  local.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => {
      sockets.delete(s);
      closed();
    });
  });
  await new Promise<void>((r) => local.listen(0, "127.0.0.1", r));
  const a = local.address();
  if (!a || typeof a === "string") throw new Error("address");
  try {
    const fixture = payloadTransport(true);
    fixture.transport.resolveFile = async (r) => ({
      ...fixture.envelope,
      kind: "file",
      node: r.node,
      fingerprint: r.expectedFingerprint,
      file: {
        storageId: "storage" as never,
        url: `http://127.0.0.1:${a.port}/file`,
        size: 70001,
        mimeType: "application/octet-stream",
        sha256: "0".repeat(64),
      },
    });
    const iterator = exportUserData(identity, { transport: fixture.transport });
    for (;;) {
      const e = await iterator.next();
      if (e.value?.type === "chunk") break;
    }
    const started = Date.now();
    await iterator.return(undefined);
    await Promise.race([
      connectionClosed,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("socket leak")), 1000),
      ),
    ]);
    expect(Date.now() - started).toBeLessThan(1000);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((r) => local.close(() => r()));
  }
});
it.each(["unsettled", "rejected"])(
  "early file return refuses %s hostile stream cleanup within its teardown deadline",
  async (failure) => {
    const originalFetch = globalThis.fetch;
    let cancelCalls = 0;
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(65536));
          },
          cancel() {
            cancelCalls++;
            return failure === "rejected"
              ? Promise.reject(new Error("unexpected cleanup failure"))
              : new Promise<void>(() => undefined);
          },
        }),
      );
    const fixture = payloadTransport(true);
    fixture.transport.resolveFile = async (r) => ({
      ...fixture.envelope,
      kind: "file",
      node: r.node,
      fingerprint: r.expectedFingerprint,
      file: {
        storageId: "storage" as never,
        url: "http://127.0.0.1:1/owned-file",
        size: 70001,
        mimeType: "application/octet-stream",
        sha256: "0".repeat(64),
      },
    });
    const iterator = exportUserData(identity, { transport: fixture.transport });
    try {
      for (;;) {
        const event = await iterator.next();
        if (event.value?.type === "chunk") break;
        expect(event.value?.type).not.toBe("manifest");
      }
      const started = Date.now();
      await expect(iterator.return(undefined)).rejects.toThrow(
        failure === "unsettled" ? "EXPORT_DEADLINE" : "EXPORT_TRANSPORT",
      );
      expect(cancelCalls).toBe(1);
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
it("freezes scope selection and protects internal state from mutations to emitted event objects", async () => {
  const fixture = payloadTransport(),
    selected = {
      userId: identity.userId,
      scope: { kind: "tenantless" as const },
    },
    iterator = exportUserData(selected, { transport: fixture.transport });
  const header = await iterator.next();
  if (header.value?.type !== "header") throw new Error("header");
  header.value.identity.userId = "changed";
  selected.userId = "changed";
  const record = await iterator.next();
  if (record.value?.type !== "record") throw new Error("record");
  record.value.node.id = "changed" as never;
  const end = await iterator.next();
  expect(end.value?.type).toBe("manifest");
  if (end.value?.type === "manifest")
    expect(end.value.identity.userId).toBe(identity.userId);
  const api = new UsersAPI({} as never, undefined, undefined, {
    tenantId: "A",
  } as never);
  expect(() =>
    api.exportData(identity.userId, {
      transport: fixture.transport,
      tenantId: "B",
    }),
  ).toThrow("EXPORT_SCOPE");
});
it("cancellation during an actual blocked binary read closes its requested socket within the cleanup deadline", async () => {
  const sockets = new Set<Socket>();
  let requestedSocket: Socket | undefined;
  let received!: () => void;
  const requested = new Promise<void>((r) => {
    received = r;
  });
  let closed!: () => void;
  const connectionClosed = new Promise<void>((r) => {
    closed = r;
  });
  const local = createServer((request, response) => {
    requestedSocket = request.socket;
    response.writeHead(200);
    response.flushHeaders();
    received();
  });
  local.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => {
      sockets.delete(s);
      if (s === requestedSocket) closed();
    });
  });
  await new Promise<void>((r) => local.listen(0, "127.0.0.1", r));
  const a = local.address();
  if (!a || typeof a === "string") throw new Error("address");
  try {
    const fixture = payloadTransport(true),
      controller = new AbortController();
    fixture.transport.resolveFile = async (r) => ({
      ...fixture.envelope,
      kind: "file",
      node: r.node,
      fingerprint: r.expectedFingerprint,
      file: {
        storageId: "storage" as never,
        url: `http://127.0.0.1:${a.port}/file`,
        size: 70001,
        mimeType: "application/octet-stream",
        sha256: "0".repeat(64),
      },
    });
    const iterator = exportUserData(identity, {
      transport: fixture.transport,
      signal: controller.signal,
    });
    for (;;) {
      const e = await iterator.next();
      if (e.value?.type === "blob") break;
    }
    const blocked = iterator.next();
    await requested;
    controller.abort();
    await expect(blocked).rejects.toThrow("EXPORT_CANCELLED");
    await Promise.race([
      connectionClosed,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("socket leak")), 1000),
      ),
    ]);
    // Native fetch can preconnect a new idle pool socket after aborting this
    // request. Only the socket that served the blocked read belongs to it.
    expect(requestedSocket?.destroyed).toBe(true);
    expect([...sockets].filter((socket) => socket === requestedSocket)).toHaveLength(0);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((r) => local.close(() => r()));
  }
});
it("binary order follows the first retained version reference even when storage IDs sort differently", async () => {
  const fixture = payloadTransport();
  const artifact = {
    _id: "artifact-order",
    _creationTime: 2,
    versionPointer: 3,
    fileRef: { storageId: "a-current" },
    versionHistory: [
      { version: 1, fileRef: { storageId: "z-original" } },
      { version: 2, fileRef: { storageId: "m-middle" } },
      { version: 3, fileRef: { storageId: "a-current" } },
    ],
  };
  const p = projected("artifacts", "artifact-order", true);
  p.fingerprint = createHash("sha256")
    .update(JSON.stringify(canonicalUserExportValue(artifact)))
    .digest("hex");
  const page = fixture.transport.page;
  fixture.transport.page = async (r, o) => {
    const value = await page(r, o);
    if (
      r.selection.domain === "artifacts" &&
      r.selection.kind === "rootProjections"
    )
      value.page.push(p);
    return value;
  };
  const read = fixture.transport.readNode;
  fixture.transport.readNode = async (r, o) =>
    r.node.id === p.node.id
      ? {
          ...fixture.envelope,
          kind: "node",
          node: r.node,
          fingerprint: r.expectedFingerprint,
          disposition: "record",
          record: artifact,
        }
      : read(r, o);
  const bytes = Buffer.from([0, 255]),
    sha = createHash("sha256").update(bytes).digest("hex"),
    local = createServer((_, response) => {
      response.end(bytes);
    });
  await new Promise<void>((r) => local.listen(0, "127.0.0.1", r));
  const a = local.address();
  if (!a || typeof a === "string") throw new Error("address");
  try {
    fixture.transport.resolveFile = async (r) => ({
      ...fixture.envelope,
      kind: "file",
      node: r.node,
      fingerprint: r.expectedFingerprint,
      file: {
        storageId: ["z-original", "m-middle", "a-current"][
          r.version! - 1
        ] as never,
        url: `http://127.0.0.1:${a.port}/file`,
        size: 2,
        mimeType: "application/octet-stream",
        sha256: sha,
        version: r.version,
      },
    });
    const events = await collectExport(fixture.transport);
    expect(
      events
        .filter((e) => e.type === "blob")
        .map(
          (e) => (e as Extract<UserExportEvent, { type: "blob" }>).storageId,
        ),
    ).toEqual(["z-original", "m-middle", "a-current"]);
    const manifest = events.at(-1);
    if (manifest?.type !== "manifest") throw new Error("manifest");
    expect(manifest.blobs.map((x) => x.storageId)).toEqual([
      "z-original",
      "m-middle",
      "a-current",
    ]);
    expect(
      events
        .filter((e) => e.type === "chunk")
        .map(
          (e) => (e as Extract<UserExportEvent, { type: "chunk" }>).byteLength,
        ),
    ).toEqual([2, 2, 2]);
  } finally {
    local.closeAllConnections();
    await new Promise<void>((r) => local.close(() => r()));
  }
});

it.each([null, undefined])(
  "accepts advancing and terminal unbounded Recommended pages with split %s",
  async (splitCursor) => {
    const profile = projected("immutable", "profile", true);
    const other = projected("immutable", "last", true);
    const { transport, envelope } = projectionTransport([profile, other]);
    const old = transport.page;
    const requested: (string | null)[] = [];
    transport.page = async (request, options) => {
      if (
        request.selection.domain !== "immutable" ||
        request.selection.kind !== "rootProjections"
      )
        return old(request, options);
      requested.push(request.cursor);
      return {
        ...envelope,
        kind: "page",
        page: request.cursor === null ? [profile] : [other],
        continueCursor: request.cursor === null ? "next" : "done",
        isDone: request.cursor !== null,
        pageStatus: "SplitRecommended",
        ...(splitCursor === null ? { splitCursor: null } : {}),
      };
    };
    const result = await discoverUserExportClosure(transport, identity);
    expect(result.reachable.map((x) => x.projection.node.id).sort()).toEqual([
      "last",
      "profile",
    ]);
    expect(requested).toEqual([null, "next"]);
  },
);

it.each([
  ["SplitRequired", "null"],
  ["SplitRequired", "omitted"],
  ["SplitRequired", "empty"],
  ["SplitRequired", "wrongType"],
  ["SplitRequired", "start"],
  ["SplitRequired", "end"],
  ["SplitRequired", "continuation"],
  ["SplitRecommended", "empty"],
  ["SplitRecommended", "wrongType"],
  ["SplitRecommended", "start"],
  ["SplitRecommended", "end"],
  ["SplitRecommended", "continuation"],
] as const)(
  "refuses %s invalid bounded split %s before payload release",
  async (pageStatus, malformed) => {
    const { transport, envelope } = projectionTransport([
      projected("immutable", "profile", true),
    ]);
    let calls = 0;
    transport.page = async (request) => {
      calls++;
      if (request.cursor === null && request.endCursor === null)
        return {
          ...envelope,
          kind: "page",
          page: [projected("immutable", "discard-provisional", true)],
          continueCursor: "end",
          isDone: false,
          pageStatus: "SplitRequired",
          splitCursor: "start",
        };
      if (request.cursor === null && request.endCursor === "start")
        return {
          ...envelope,
          kind: "page",
          page: [],
          continueCursor: "start",
          isDone: false,
          pageStatus: "SplitRecommended",
          splitCursor: null,
        };
      expect([request.cursor, request.endCursor]).toEqual(["start", "end"]);
      const split: unknown = {
        null: null,
        empty: "",
        wrongType: 123,
        start: "start",
        end: "end",
        continuation: "within",
        omitted: undefined,
      }[malformed];
      return {
        ...envelope,
        kind: "page",
        page: [projected("immutable", "must-not-release", true)],
        continueCursor: "within",
        isDone: false,
        pageStatus,
        ...(malformed !== "omitted" ? { splitCursor: split } : {}),
      } as never;
    };
    let released = 0,
      caught = false;
    try {
      for await (const event of new UsersAPI({} as never).exportData(
        identity.userId,
        { transport },
      ))
        if (event.type === "record" || event.type === "manifest") released++;
    } catch (error) {
      caught = true;
      expect(error).toMatchObject({ code: "EXPORT_PROTOCOL", stage: "page" });
    }
    expect(caught).toBe(true);
    expect(released).toBe(0);
    expect(calls).toBe(3);
  },
);

it("nullable Recommended without cursor progress still refuses without a terminal manifest", async () => {
  const { transport, envelope } = projectionTransport([
    projected("immutable", "profile", true),
  ]);
  let calls = 0;
  transport.page = async () => {
    calls++;
    return {
      ...envelope,
      kind: "page",
      page: [],
      continueCursor: "repeat",
      isDone: false,
      pageStatus: "SplitRecommended",
      splitCursor: null,
    };
  };
  await expect(
    discoverUserExportClosure(transport, identity),
  ).rejects.toMatchObject({ code: "EXPORT_PROTOCOL", stage: "page" });
  expect(calls).toBe(2);
});

// Repair1 measures the production scheduler, not a duplicate traversal implementation.
function adversarialClosureFixture(length: number) {
  const records = [
    projected("immutable", "profile", true),
    projected("facts", "root", true),
  ];
  const parentByChild = new Map<string, UserExportProjection>();
  let parent = records[1],
    matchingReads = 0;
  for (let i = 1; i <= length; i++) {
    const child = projected(
      i % 2 ? "memories" : "facts",
      String(length - i).padStart(6, "0"),
    );
    child.edgeDescriptors.push({
      ordinal: 0,
      kind: "chain",
      domain: parent.node.domain,
      purpose: "inclusion",
      storedLogicalTarget: parent.node.id,
    });
    parentByChild.set(child.node.id, parent);
    records.push(child);
    parent = child;
  }
  for (let i = 0; i < 512; i++) {
    const child = projected("facts", `poison-${i}`);
    child.edgeDescriptors.push({
      ordinal: 0,
      kind: "poison",
      domain: "facts",
      purpose: "inclusion",
      storedLogicalTarget: `poison-${(i + 1) % 512}`,
    });
    records.push(child);
  }
  for (const projection of records) {
    const logical = projection.logicalId;
    Object.defineProperty(projection, "logicalId", {
      enumerable: true,
      get() {
        matchingReads++;
        return logical;
      },
    });
    for (const descriptor of projection.edgeDescriptors) {
      const target = descriptor.storedLogicalTarget;
      Object.defineProperty(descriptor, "storedLogicalTarget", {
        enumerable: true,
        get() {
          matchingReads++;
          return target;
        },
      });
    }
  }
  const fixture = projectionTransport(records);
  const calls: string[] = [];
  fixture.transport.inspectEdge = async (request) => {
    calls.push(request.node.id);
    const parent = parentByChild.get(request.node.id);
    if (!parent) throw new Error("disconnected poison must not be inspected");
    return {
      ...fixture.envelope,
      kind: "edge",
      witness: {
        childNode: request.node,
        childFingerprint: fp,
        kind: "chain",
        ordinal: 0,
        status: "admissible",
        parentNode: parent.node,
        parentFingerprint: fp,
        observationTime: 1,
      },
    };
  };
  return { ...fixture, records, calls, matchingReads: () => matchingReads };
}
it.each([64, 128, 256, 1024])(
  "FIFO scheduler has bounded matching work for %i descending chain edges plus disconnected poison",
  async (length) => {
    const fixture = adversarialClosureFixture(length);
    const closure = await discoverUserExportClosure(
      fixture.transport,
      identity,
    );
    expect(closure.reachable.map((x) => x.projection.node.id).sort()).toEqual(
      [
        "profile",
        "root",
        ...Array.from({ length }, (_, i) => String(i).padStart(6, "0")),
      ].sort(),
    );
    expect(fixture.calls).toHaveLength(length);
    expect(new Set(fixture.calls).size).toBe(length);
    expect(fixture.matchingReads()).toBeLessThanOrEqual(
      16 * (fixture.records.length + length + 512),
    );
    expect(closure.witnesses.map((w) => w.childNode.id)).toEqual(
      fixture.records
        .slice(2, length + 2)
        .sort(
          (a, b) =>
            USER_EXPORT_DOMAINS.indexOf(a.node.domain) -
              USER_EXPORT_DOMAINS.indexOf(b.node.domain) ||
            a.node.id.localeCompare(b.node.id),
        )
        .map((p) => p.node.id),
    );
  },
);
it.each(["index", "frontier"])(
  "FIFO %s work delivers timer cancellation even with immediate transport",
  async (stage) => {
    const fixture = adversarialClosureFixture(1024),
      controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (stage === "index") timer = setTimeout(() => controller.abort(), 0);
    else {
      const inspect = fixture.transport.inspectEdge;
      fixture.transport.inspectEdge = async (r, o) => {
        if (!timer) timer = setTimeout(() => controller.abort(), 0);
        return inspect(r, o);
      };
    }
    try {
      await expect(
        discoverUserExportClosure(fixture.transport, identity, {
          signal: controller.signal,
        }),
      ).rejects.toThrow("EXPORT_CANCELLED");
      expect(controller.signal.aborted).toBe(true);
      expect(fixture.calls.length).toBeLessThanOrEqual(
        stage === "index" ? 0 : 128,
      );
      if (stage === "frontier") expect(fixture.calls.length).toBeGreaterThan(0);
    } finally {
      if (timer) clearTimeout(timer);
    }
  },
);
it("FIFO exact physical waiting parents, duplicate logical keys and tuple collisions retain deterministic first witnesses", async () => {
  const profile = projected("immutable", "profile", true),
    root = projected("facts", "root", true);
  const early = projected("conversations", "early", true),
    delayed = projected("memories", "delayed");
  const child = projected("contexts", "child"),
    collision = projected("facts", "collision");
  const matching = projected("facts", "matching", true),
    foreign = projected("facts", "foreign");
  matching.logicalId = "x:y";
  matching.memorySpaceId = "z";
  root.logicalId = "x";
  root.memorySpaceId = "y:z";
  foreign.disposition = "excluded";
  early.edgeDescriptors.push({
    ordinal: 0,
    kind: "early-link",
    domain: "memories",
    purpose: "inclusion",
    storedDocumentTarget: "delayed",
  });
  delayed.edgeDescriptors.push({
    ordinal: 0,
    kind: "link",
    domain: "facts",
    purpose: "inclusion",
    storedDocumentTarget: "root",
  });
  child.edgeDescriptors.push(
    {
      ordinal: 0,
      kind: "chosen",
      domain: "memories",
      purpose: "inclusion",
      storedDocumentTarget: "delayed",
    },
    {
      ordinal: 1,
      kind: "alternate",
      domain: "facts",
      purpose: "inclusion",
      storedDocumentTarget: "root",
    },
  );
  collision.memorySpaceId = "z";
  collision.edgeDescriptors.push({
    ordinal: 0,
    kind: "collision-safe",
    domain: "facts",
    purpose: "inclusion",
    storedLogicalTarget: "x:y",
  });
  const duplicate = projected("facts", "second-key", true);
  duplicate.logicalId = matching.logicalId;
  duplicate.memorySpaceId = "z";
  const records = [
    profile,
    root,
    early,
    delayed,
    child,
    collision,
    matching,
    foreign,
    duplicate,
  ];
  const fixture = projectionTransport(records),
    calls = new Map<string, number>();
  const parents = new Map([
    ["early:0", delayed],
    ["delayed:0", root],
    ["child:0", delayed],
    ["child:1", root],
    ["collision:0", matching],
  ]);
  fixture.transport.inspectEdge = async (r) => {
    const id = r.node.id + ":" + r.edgeOrdinal;
    calls.set(id, (calls.get(id) ?? 0) + 1);
    const p = records.find((p) => p.node.id === r.node.id)!,
      descriptor = p.edgeDescriptors[r.edgeOrdinal],
      parent = parents.get(id)!;
    return {
      ...fixture.envelope,
      kind: "edge",
      witness: {
        childNode: r.node,
        childFingerprint: fp,
        kind: descriptor.kind,
        ordinal: r.edgeOrdinal,
        status: "admissible",
        parentNode: parent.node,
        parentFingerprint: fp,
        observationTime: 1,
      },
    };
  };
  const first = await discoverUserExportClosure(fixture.transport, identity);
  expect(first.reachable.map((x) => x.projection.node.id)).toEqual([
    "profile",
    "early",
    "delayed",
    "collision",
    "matching",
    "root",
    "second-key",
    "child",
  ]);
  expect(
    first.reachable.find((x) => x.projection.node.id === "child")
      ?.spanningWitness?.kind,
  ).toBe("alternate");
  expect([...calls.values()]).toEqual([1, 1, 1, 1, 1]);
  records.reverse();
  calls.clear();
  expect(await discoverUserExportClosure(fixture.transport, identity)).toEqual(
    first,
  );
  expect([...calls.values()]).toEqual([1, 1, 1, 1, 1]);
  // A catalog duplicate triggers one authoritative exact-key proof, not a picked logical row.
  fixture.transport.inspectEdge = async (r) => {
    if (r.node.id === "collision")
      throw new UserExportTransportError(
        "EXPORT_REFERENCE_AMBIGUOUS",
        "inspectEdge",
      );
    return {
      ...fixture.envelope,
      kind: "edge",
      witness: {
        childNode: r.node,
        childFingerprint: fp,
        kind: records.find((p) => p.node.id === r.node.id)!.edgeDescriptors[
          r.edgeOrdinal
        ].kind,
        ordinal: r.edgeOrdinal,
        status: "admissible",
        parentNode: parents.get(r.node.id + ":" + r.edgeOrdinal)!.node,
        parentFingerprint: fp,
        observationTime: 1,
      },
    };
  };
  await expect(
    discoverUserExportClosure(fixture.transport, identity),
  ).rejects.toThrow("EXPORT_REFERENCE_AMBIGUOUS");
});

function registeredShareFixture(tenantId?: string, incoming = false) {
  const selected = {
    userId: identity.userId,
    scope:
      tenantId === undefined
        ? { kind: "tenantless" as const }
        : { kind: "tenant" as const, tenantId },
  };
  const scoped = tenantId === undefined ? {} : { tenantId };
  const rows: Record<string, Record<string, unknown>[]> = {
    immutable: [
      {
        _id: "profile",
        _creationTime: 1,
        type: "user",
        id: identity.userId,
        data: { raw: ["kept"] },
        version: 1,
        previousVersions: [],
        createdAt: 1,
        updatedAt: 1,
        ...scoped,
      },
    ],
    conversationShares: [
      {
        _id: "share",
        _creationTime: 2,
        shareId: "share-only",
        conversationId: "private-conversation",
        grantedBy: incoming ? "other" : identity.userId,
        sourceMemorySpaceId: "share-only-space",
        grantType: incoming ? "user" : "link",
        ...(incoming ? { grantedTo: identity.userId } : {}),
        permissions: {
          canView: true,
          canViewFacts: false,
          canViewMemories: false,
          canContinue: false,
          canFork: false,
          canExport: false,
        },
        viewCount: 5,
        maxViews: 1,
        redactSensitive: true,
        redactBefore: 1,
        expiresAt: 1,
        status: "revoked",
        createdAt: 2,
        ...scoped,
      },
    ],
    memorySpaces: [
      {
        _id: "space",
        _creationTime: 3,
        memorySpaceId: "share-only-space",
        name: "Space",
        type: "team",
        participants: [{ type: "human", id: "other", joinedAt: 1 }],
        metadata: { privateSentinel: "do-not-release" },
        status: "active",
        createdAt: 1,
        updatedAt: 1,
        ...scoped,
      },
    ],
    conversations: [
      {
        _id: "private",
        _creationTime: 4,
        conversationId: "private-conversation",
        memorySpaceId: "share-only-space",
        type: "user-agent",
        participants: { userId: "other", agentId: "private-agent" },
        messages: [
          {
            id: "message",
            role: "user",
            content: "do-not-release",
            timestamp: 1,
          },
        ],
        messageCount: 1,
        createdAt: 1,
        updatedAt: 1,
        ...scoped,
      },
    ],
  };
  const operations: { operation: string; args: unknown }[] = [];
  const context = {
    db: {
      normalizeId: (domain: string, id: string) =>
        Object.prototype.hasOwnProperty.call(rows, domain) &&
        rows[domain].some((row) => row._id === id)
          ? id
          : null,
      get: async (id: string) =>
        Object.values(rows)
          .flat()
          .find((row) => row._id === id) ?? null,
      query: (domain: string) => {
        let matches = rows[domain] ?? [];
        return {
          withIndex: (
            _name: string,
            choose: (q: {
              eq: (field: string, value: unknown) => unknown;
            }) => unknown,
          ) => {
            const eq = (field: string, value: unknown) => {
              matches = matches.filter((row) => row[field] === value);
              return { eq };
            };
            choose({ eq });
            return {
              first: async () => matches[0] ?? null,
              take: async (n: number) => matches.slice(0, n),
              paginate: async () => ({
                page: matches,
                continueCursor: "terminal",
                isDone: true,
              }),
            };
          },
        };
      },
    },
  };
  const transport = Object.fromEntries(
    Object.keys(backend).map((operation) => [
      operation,
      async (args: unknown) => {
        operations.push({ operation, args });
        // Native registration is tested elsewhere; this invokes the actual registered handlers.
        const registered = backend[
          operation as keyof typeof backend
        ] as unknown as {
          _handler: (context: unknown, args: unknown) => Promise<unknown>;
        };
        return registered._handler(context, args);
      },
    ]),
  ) as unknown as UserExportTransport;
  return { selected, rows, transport, operations };
}
it.each([undefined, "A", "B"])(
  "actual registered handlers release outgoing share-only space projection in scope %s",
  async (tenantId) => {
    const fixture = registeredShareFixture(tenantId),
      events: UserExportEvent[] = [];
    for await (const event of exportUserData(fixture.selected, {
      transport: fixture.transport,
    }))
      events.push(event);
    const records = events.filter(
      (event): event is Extract<UserExportEvent, { type: "record" }> =>
        event.type === "record",
    );
    expect(records.map((record) => record.node.id)).toEqual([
      "profile",
      "share",
      "space",
    ]);
    expect(records[1].record).toEqual(
      canonicalUserExportValue(fixture.rows.conversationShares[0] as never),
    );
    expect(records[2].record).toEqual({
      _id: "space",
      _creationTime: 3,
      memorySpaceId: "share-only-space",
      name: "Space",
      type: "team",
      status: "active",
      participants: [],
      ...(tenantId === undefined ? {} : { tenantId }),
    });
    expect(events.at(-1)).toHaveProperty("complete", true);
    expect(JSON.stringify(events)).not.toContain("do-not-release");
    expect(
      fixture.operations.filter((call) => call.operation === "resolveFile"),
    ).toHaveLength(0);
    const releases = fixture.operations
      .filter((call) => call.operation === "readNode")
      .map(
        (call) =>
          call.args as { node: UserExportNode; witness?: { kind: string } },
      );
    const spaceReleases = releases.filter((call) => call.node.id === "space");
    expect(spaceReleases).toHaveLength(2); // Payload release and final revalidation.
    expect(
      spaceReleases.every((call) => call.witness?.kind === "shareSpace"),
    ).toBe(true);
  },
);
it("incoming share projection cannot synthesize an outgoing support witness or release source content", async () => {
  const fixture = registeredShareFixture(undefined, true),
    events: UserExportEvent[] = [];
  for await (const event of exportUserData(fixture.selected, {
    transport: fixture.transport,
  }))
    events.push(event);
  expect(
    events
      .filter((event) => event.type === "record")
      .map((event) => event.node.id),
  ).toEqual(["profile", "share"]);
  expect(
    fixture.operations.filter(
      (call) =>
        call.operation === "inspectEdge" || call.operation === "resolveFile",
    ),
  ).toHaveLength(0);
  await expect(
    fixture.transport.inspectEdge({
      ...fixture.selected,
      node: { domain: "conversationShares", id: "share" } as UserExportNode,
      expectedFingerprint: exportFingerprint(
        fixture.rows.conversationShares[0],
      ),
      edgeOrdinal: 0,
    }),
  ).rejects.toThrow("EXPORT_PROTOCOL");
});
it.each([
  "duplicate",
  "foreign",
  "missing",
  "changedShare",
  "changedSpace",
  "forgedKind",
  "forgedOrdinal",
])("actual support release preserves %s refusal/diagnostic", async (mode) => {
  const fixture = registeredShareFixture("A"),
    child = { domain: "conversationShares", id: "share" } as UserExportNode;
  const request = {
    ...fixture.selected,
    node: child,
    expectedFingerprint: exportFingerprint(fixture.rows.conversationShares[0]),
    edgeOrdinal: 0,
  };
  if (mode === "duplicate") {
    fixture.rows.memorySpaces.push({
      ...fixture.rows.memorySpaces[0],
      _id: "duplicate",
    });
    await expect(fixture.transport.inspectEdge(request)).rejects.toThrow(
      "EXPORT_REFERENCE_AMBIGUOUS",
    );
    const events: UserExportEvent[] = [];
    await expect(
      (async () => {
        for await (const event of exportUserData(fixture.selected, {
          transport: fixture.transport,
        }))
          events.push(event);
      })(),
    ).rejects.toThrow("EXPORT_REFERENCE_AMBIGUOUS");
    expect(events.map((event) => event.type)).toEqual(["header"]);
    return;
  }
  if (mode === "foreign" || mode === "missing") {
    if (mode === "foreign") fixture.rows.memorySpaces[0].tenantId = "B";
    else fixture.rows.memorySpaces = [];
    const proof = await fixture.transport.inspectEdge(request);
    expect(proof.witness.status).toBe("missing");
    expect(proof.witness.parentNode).toBeUndefined();
    const events: UserExportEvent[] = [];
    for await (const event of exportUserData(fixture.selected, {
      transport: fixture.transport,
    }))
      events.push(event);
    expect(
      events
        .filter((event) => event.type === "record")
        .map((event) => event.node.id),
    ).toEqual(["profile", "share"]);
    expect(events.at(-1)).toMatchObject({
      type: "manifest",
      complete: true,
      diagnostics: [{ status: "missing", kind: "shareSpace" }],
    });
    expect(JSON.stringify(events)).not.toContain("do-not-release");
    return;
  }
  const proof = await fixture.transport.inspectEdge(request);
  if (mode === "changedShare")
    fixture.rows.conversationShares[0].sourceMemorySpaceId = "changed";
  if (mode === "changedSpace") fixture.rows.memorySpaces[0].name = "changed";
  if (mode === "forgedKind") proof.witness.kind = "supportSpace";
  if (mode === "forgedOrdinal") proof.witness.ordinal = 1;
  await expect(
    fixture.transport.readNode({
      ...fixture.selected,
      node: proof.witness.parentNode!,
      expectedFingerprint: proof.witness.parentFingerprint!,
      witness: proof.witness,
    }),
  ).rejects.toThrow(
    mode === "forgedOrdinal" ? "EXPORT_PROTOCOL" : "EXPORT_CHANGED",
  );
});

it("FIFO competing edges select kind then ordinal independently of stored descriptor order", async () => {
  const profile = projected("immutable", "profile", true);
  const root = projected("facts", "root", true);
  const child = projected("contexts", "child");
  child.edgeDescriptors = [
    {
      ordinal: 0,
      kind: "z-last",
      domain: "facts",
      purpose: "inclusion",
      storedDocumentTarget: "root",
    },
    {
      ordinal: 1,
      kind: "a-first",
      domain: "facts",
      purpose: "inclusion",
      storedDocumentTarget: "root",
    },
  ];
  const records = [child, root, profile];
  const fixture = projectionTransport(records);
  const calls: number[] = [];
  fixture.transport.inspectEdge = async (request) => {
    calls.push(request.edgeOrdinal);
    const descriptor = child.edgeDescriptors.find(
      (edge) => edge.ordinal === request.edgeOrdinal,
    )!;
    return {
      ...fixture.envelope,
      kind: "edge",
      witness: {
        childNode: child.node,
        childFingerprint: fp,
        ordinal: descriptor.ordinal,
        kind: descriptor.kind,
        status: "admissible",
        parentNode: root.node,
        parentFingerprint: fp,
        observationTime: 1,
      },
    };
  };
  const result = await discoverUserExportClosure(fixture.transport, identity);
  expect(calls).toEqual([1, 0]);
  expect(
    result.reachable.find((entry) => entry.projection.node.id === "child")
      ?.spanningWitness?.kind,
  ).toBe("a-first");
  expect(result.witnesses.map((edge) => edge.kind)).toEqual([
    "a-first",
    "z-last",
  ]);
  records.reverse();
  calls.length = 0;
  expect(await discoverUserExportClosure(fixture.transport, identity)).toEqual(
    result,
  );
  expect(calls).toEqual([1, 0]);
});
