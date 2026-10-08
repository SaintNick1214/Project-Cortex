/** Checkpoint16C actual fixed internal production handlers and public SDK stream. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { jsonToConvex } from "convex/values";
import { UsersAPI } from "../src/users";
import {
  type UserExportEvent,
  type UserExportNode,
  type UserExportScope,
  type UserExportTransport,
} from "../src/users/export";
const proof =
  "/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/cli-sandbox-2026/user-export-16c";
const inherited =
  "/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/cli-sandbox-2026/fact-history-provenance";
type Seed = {
  userId: string;
  scope: UserExportScope;
  mode: string;
  ids: Record<string, UserExportNode>;
};
function owned() {
  expect(process.env.HOME).toBe(proof + "/home");
  expect(process.env.CORTEX_TEST_HOME_ROOT).toBe(process.env.HOME);
  expect(process.env.CONVEX_URL).toBe("http://127.0.0.1:45410");
  const owner = JSON.parse(readFileSync(inherited + "/ownership.json", "utf8"));
  expect(owner.owner).toBe("task18-fact-history-provenance");
  process.kill(owner.pid, 0);
  return JSON.parse(
    readFileSync(
      inherited + "/project/.convex/local/default/config.json",
      "utf8",
    ),
  ).adminKey as string;
}
function transport(): UserExportTransport {
  return new UsersAPI({} as never).createExportTransport({
    url: "http://127.0.0.1:45410",
    deploymentKey: owned(),
  });
}
const seeds = () =>
  (JSON.parse(readFileSync(proof + "/seeds.json", "utf8")) as { saved: Seed[] })
    .saved;
it.each(["tenantless", "A", "B"])(
  "public administrative export completes exact %s record set and every current/retained binary",
  async (scopeName) => {
    const seed = seeds().find(
      (x) =>
        x.mode === "valid" &&
        (x.scope.kind === "tenant" ? x.scope.tenantId : "tenantless") ===
          scopeName,
    )!;
    const api = new UsersAPI({} as never),
      t = transport(),
      events: UserExportEvent[] = [];
    for await (const e of api.exportData(seed.userId, {
      transport: t,
      ...(seed.scope.kind === "tenant"
        ? { tenantId: seed.scope.tenantId }
        : {}),
    }))
      events.push(e);
    const records = events.filter(
      (e): e is Extract<UserExportEvent, { type: "record" }> =>
        e.type === "record",
    );
    expect(records.map((e) => e.node.domain + ":" + e.node.id).sort()).toEqual(
      Object.values(seed.ids)
        .map((n) => n.domain + ":" + n.id)
        .sort(),
    );
    const manifest = events.at(-1);
    if (manifest?.type !== "manifest")
      throw new Error("missing terminal manifest");
    expect(manifest.complete).toBe(true);
    expect(manifest.consistency).toBe("rolling-read");
    expect(manifest.tableManifest).toHaveLength(17);
    expect(manifest.pageObservations.length).toBe(manifest.pageCount);
    expect(manifest.blobs).toHaveLength(3);
    const profile = jsonToConvex(
      records.find((e) => e.node.id === seed.ids.profile.id)!.record,
    ) as {
      previousVersions: unknown[];
      data: { nested: { minusZero: number; nan: number; maximum: bigint } };
    };
    expect(profile.previousVersions).toHaveLength(1);
    expect(Object.is(profile.data.nested.minusZero, -0)).toBe(true);
    expect(Number.isNaN(profile.data.nested.nan)).toBe(true);
    expect(profile.data.nested.maximum).toBe(9223372036854775807n);
    for (const blob of manifest.blobs) {
      const chunks = events.filter(
          (e): e is Extract<UserExportEvent, { type: "chunk" }> =>
            e.type === "chunk" && e.storageId === blob.storageId,
        ),
        recovered = Buffer.concat(
          chunks.map((e) => Buffer.from(e.data, "base64")),
        );
      expect(recovered.length).toBe(blob.size);
      expect(createHash("sha256").update(recovered).digest("hex")).toBe(
        blob.sha256,
      );
      expect(chunks.map((x) => x.sequence)).toEqual(chunks.map((_, i) => i));
      if (blob.size === 70001) {
        expect(chunks.map((x) => Buffer.from(x.data, "base64").length)).toEqual(
          [65536, 4465],
        );
        expect(blob.referrers).toHaveLength(2);
      }
      if (blob.size === 0) expect(chunks).toHaveLength(0);
    }
  },
);
it.each(["badSize", "badChecksum"])(
  "native %s fails without a terminal bundle",
  async (mode) => {
    const seed = seeds().find((x) => x.mode === mode)!,
      events: UserExportEvent[] = [];
    await expect(
      (async () => {
        for await (const e of new UsersAPI({} as never).exportData(
          seed.userId,
          { transport: transport() },
        ))
          events.push(e);
      })(),
    ).rejects.toThrow("EXPORT_FILE_METADATA");
    expect(events.some((e) => e.type === "manifest")).toBe(false);
  },
);
it("all five production operations deny ordinary/wrong-key clients before handling, and reject mismatched physical table identity", async () => {
  owned();
  const seed = seeds().find(
      (x) => x.mode === "valid" && x.scope.kind === "tenantless",
    )!,
    selected = { userId: seed.userId, scope: seed.scope },
    ordinary = new ConvexHttpClient("http://127.0.0.1:45410", {
      logger: false,
    }),
    wrong = new ConvexHttpClient("http://127.0.0.1:45410", { logger: false });
  (wrong as unknown as { setAdminAuth(key: string): void }).setAdminAuth(
    "task16c-wrong-key",
  );
  const fp = "1".repeat(64);
  for (const [name, args] of [
    ["inspect", selected],
    [
      "page",
      {
        ...selected,
        selection: { kind: "rootProjections", domain: "immutable" },
        cursor: null,
        numItems: 1,
      },
    ],
    [
      "inspectEdge",
      {
        ...selected,
        node: seed.ids.profile,
        expectedFingerprint: fp,
        edgeOrdinal: 0,
      },
    ],
    [
      "readNode",
      { ...selected, node: seed.ids.profile, expectedFingerprint: fp },
    ],
    [
      "resolveFile",
      { ...selected, node: seed.ids.attachment, expectedFingerprint: fp },
    ],
  ] as const) {
    await expect(
      ordinary.query(
        makeFunctionReference<"query">("userExport:" + name),
        args,
      ),
    ).rejects.toThrow();
    for (const c of [ordinary, wrong])
      await expect(
        (
          c as unknown as {
            function(
              name: string,
              component: undefined,
              args: unknown,
            ): Promise<unknown>;
          }
        ).function("userExport:" + name, undefined, args),
      ).rejects.toThrow();
  }
  await expect(
    transport().readNode({
      ...selected,
      node: {
        domain: "facts",
        id: seed.ids.profile.id,
      } as unknown as UserExportNode,
      expectedFingerprint: fp,
    }),
  ).rejects.toThrow("EXPORT_TRANSPORT");
});
