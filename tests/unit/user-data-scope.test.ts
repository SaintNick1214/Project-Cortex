import { createHash } from "node:crypto";
import schema from "../../convex-dev/schema";
import {
  canonical,
  directExportDisposition as rule,
  exportDomains,
  operationalExportExclusions,
  exportEdges,
  exportEdgesForUser,
  exportFingerprint,
} from "../../convex-dev/lib/userDataScope";
const scope = { kind: "tenant" as const, tenantId: "A" };
const base = { tenantId: "A", memorySpaceId: "shared-space" };
const disposition = (
  table: (typeof exportDomains)[number],
  row: Record<string, unknown>,
) => rule(table, { ...base, ...row }, "target", scope).disposition;
it("assigns all independently parsed schema tables and excludes unattributed operational registries", () => {
  expect(
    [...exportDomains, ...Object.keys(operationalExportExclusions)].sort(),
  ).toEqual(Object.keys(schema.tables).sort());
  expect(Object.keys(operationalExportExclusions).sort()).toEqual([
    "cortexErasureReceipts",
    "cortexReferenceEdges",
    "cortexReferenceState",
    "cortexReferenceTargets",
  ]);
  expect(exportDomains).toHaveLength(17);
  for (const table of [
    "agents",
    "governancePolicies",
    "governanceEnforcement",
    "graphSyncQueue",
  ] as const)
    expect(
      disposition(table, { userId: "target", metadata: { userId: "target" } }),
    ).toBe("excluded");
});
it("uses exact known tenant selection and scoped profile identity, never a foreign profile's spoofed owner", () => {
  expect(
    disposition("immutable", { type: "user", id: "target", userId: "other" }),
  ).toBe("root");
  expect(
    disposition("immutable", { type: "user", id: "other", userId: "target" }),
  ).toBe("excluded");
  for (const table of [
    "immutable",
    "mutable",
    "sessions",
    "attachments",
  ] as const) {
    expect(disposition(table, { userId: "target" })).toBe("root");
    expect(disposition(table, { userId: "target", tenantId: "B" })).toBe(
      "excluded",
    );
    expect(disposition(table, { userId: "target", tenantId: undefined })).toBe(
      "excluded",
    );
  }
  expect(
    rule("sessions", { userId: "target" }, "target", { kind: "tenantless" })
      .disposition,
  ).toBe("root");
});
it("associates the complete joint conversation and target-created snapshot without message attribution", () => {
  expect(
    disposition("conversations", {
      participants: { userId: "other", userIds: ["other", "target"] },
      messages: [
        { participantId: "other", approvalStatus: "pending" },
        { role: "system" },
      ],
    }),
  ).toBe("root");
  expect(
    disposition("conversations", {
      participants: { memorySpaceIds: ["shared-space"] },
      metadata: { userId: "target" },
    }),
  ).toBe("excluded");
  expect(
    disposition("conversationSnapshots", {
      createdBy: "target",
      participants: { userId: "other" },
      redaction: { piiRedacted: true },
    }),
  ).toBe("root");
  expect(
    disposition("conversationSnapshots", {
      createdBy: "other",
      participants: { userId: "target" },
    }),
  ).toBe("excluded");
});
it("preserves explicit artifact co-owners while viewer/editor and incoming grants cannot expand foreign content", () => {
  for (const role of ["owner", "editor", "viewer"]) {
    const row = {
      ...base,
      userId: "other",
      collaborators: [{ type: "user", role, id: "target" }],
      conversationRef: { conversationId: "joint" },
      memoryRefs: [{ memoryId: "private" }],
    };
    expect(disposition("artifacts", row)).toBe(
      role === "owner" ? "root" : "membershipProjection",
    );
    if (role !== "owner")
      expect(exportEdgesForUser("artifacts", row, "target", scope)).toEqual([]);
  }
  for (const canExport of [true, false])
    for (const status of ["active", "expired", "revoked"]) {
      const row = {
        ...base,
        grantedBy: "other",
        grantType: "user",
        grantedTo: "target",
        permissions: { canExport },
        status,
        maxViews: 1,
        viewCount: 2,
        sourceMemorySpaceId: "other-space",
      };
      expect(disposition("conversationShares", row)).toBe(
        "membershipProjection",
      );
      expect(
        exportEdgesForUser("conversationShares", row, "target", scope),
      ).toEqual([]);
    }
});
it("foreign explicit memory/fact/context ownership breaks closure despite source-user, space or metadata hints", () => {
  expect(
    disposition("memories", { userId: "other", sourceUserId: "target" }),
  ).toBe("excluded");
  expect(disposition("memories", { sourceUserId: "target" })).toBe("root");
  for (const table of ["memories", "facts", "contexts"] as const) {
    expect(
      disposition(table, { userId: "other", metadata: { userId: "target" } }),
    ).toBe("excluded");
    expect(disposition(table, {})).toBe("unownedCandidate");
  }
  expect(
    disposition("memorySpaces", {
      participants: [{ type: "human", id: "target" }],
    }),
  ).toBe("membershipProjection");
  expect(
    disposition("memorySpaces", {
      participants: [{ type: "ai-tool", id: "target" }],
    }),
  ).toBe("unownedCandidate");
});
it("durable history distinguishes actor/owner/association and never assigns unknown legacy scope", () => {
  expect(
    disposition("factHistory", {
      scopeVersion: 1,
      userId: "target",
      ownerKnown: true,
      ownerUserId: "other",
    }),
  ).toBe("root");
  expect(
    exportEdgesForUser(
      "factHistory",
      {
        ...base,
        scopeVersion: 1,
        userId: "target",
        ownerKnown: true,
        ownerUserId: "other",
        factId: "f",
        sourceFactId: "physical",
      },
      "target",
      scope,
    ).some((e) => e.purpose === "support"),
  ).toBe(false);
  expect(
    disposition("factHistory", {
      scopeVersion: 1,
      userId: "other",
      ownerKnown: true,
      ownerUserId: "target",
    }),
  ).toBe("root");
  expect(
    disposition("factHistory", {
      scopeVersion: 1,
      userId: "other",
      ownerKnown: true,
      associationKnown: true,
      associatedUserIds: ["target"],
    }),
  ).toBe("root");
  expect(
    rule("factHistory", { userId: "target", tenantId: "B" }, "target", scope),
  ).toMatchObject({
    disposition: "unownedCandidate",
    rootReason: "legacyProvenanceUnresolved",
  });
});
it("fixed edges retain physical supersession identities and classify contradictory or unknown endpoints unresolved", () => {
  const known = {
    state: "known",
    logicalFactId: "old",
    factDocumentId: "physical-old",
    scopeVersion: 1,
    tenantId: "A",
    memorySpaceId: "shared-space",
  };
  const row = {
    ...base,
    factId: "new",
    sourceRef: { memoryId: "m" },
    supersedes: "old",
    supersedesEndpoint: known,
  };
  expect(exportEdges("facts", row)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "factMemory",
        purpose: "inclusion",
        storedLogicalTarget: "m",
      }),
      expect.objectContaining({
        kind: "physicalFact:supersedes",
        storedDocumentTarget: "physical-old",
      }),
      expect.objectContaining({ kind: "supportSpace", purpose: "support" }),
    ]),
  );
  for (const endpoint of [
    { state: "unknown" },
    { state: "absent" },
    { ...known, logicalFactId: "reused" },
    { ...known, tenantId: "B" },
  ])
    expect(
      exportEdges("facts", { ...row, supersedesEndpoint: endpoint }).find(
        (e) => e.kind === "physicalFact:supersedes",
      ),
    ).toMatchObject({ unresolved: true });
  expect(
    exportEdges("facts", { ...base, factId: "fresh" }).some((e) =>
      e.kind.startsWith("physicalFact"),
    ),
  ).toBe(false);
});
it("fingerprints canonical Convex values and large retained histories without loss", () => {
  const row = {
    ...base,
    _id: "physical",
    _creationTime: 1,
    data: {
      bytes: new Uint8Array([0, 255]).buffer,
      int: 9223372036854775807n,
      nan: NaN,
      negativeZero: -0,
    },
    previousVersions: [{ content: "x".repeat(900000), version: 1 }],
  };
  expect(exportFingerprint(row)).toBe(
    createHash("sha256").update(canonical(row)).digest("hex"),
  );
  expect(
    exportFingerprint({ ...row, data: { ...row.data, negativeZero: 0 } }),
  ).not.toBe(exportFingerprint(row));
});
