/** Checkpoint16C actual fixed internal production handlers and public SDK stream. */
import { nativeAdmin, nativeTarget, proofPrefix } from "./helpers/native-ci";
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
type Seed = {
  userId: string;
  scope: UserExportScope;
  mode: string;
  ids: Record<string, UserExportNode>;
  storageIds: string[];
};
const saved: Seed[] = [];
const seeds = () => saved;
function transport(): UserExportTransport {
  const { url, key } = nativeTarget();
  return new UsersAPI({} as never).createExportTransport({ url, deploymentKey: key });
}
beforeAll(async () => {
  const admin = nativeAdmin(), prefix = proofPrefix("task16c-ci");
  const { storageIds } = await admin.function("ownedExportPayloadFixture:upload", undefined, {userId:prefix}) as { storageIds:string[] };
  for (const scope of [{kind:"tenantless"}, {kind:"tenant",tenantId:"A"}, {kind:"tenant",tenantId:"B"}] as UserExportScope[])
    saved.push(await admin.function("ownedExportPayloadFixture:seed", undefined, {userId:prefix+"-"+(scope.kind === "tenant" ? scope.tenantId : "none"),scope,storageIds,mode:"valid"}) as Seed);
  for (const mode of ["badSize", "badChecksum"])
    saved.push(await admin.function("ownedExportPayloadFixture:seed", undefined, {userId:prefix+"-"+mode,scope:{kind:"tenantless"},storageIds,mode}) as Seed);
}, 30000);
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
  nativeTarget();
  const seed = seeds().find(
      (x) => x.mode === "valid" && x.scope.kind === "tenantless",
    )!,
    selected = { userId: seed.userId, scope: seed.scope },
    ordinary = new ConvexHttpClient(nativeTarget().url, {
      logger: false,
    }),
    wrong = new ConvexHttpClient(nativeTarget().url, { logger: false });
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

it("complete export and supported erasure refuse a provisioned runtime scope before any profile effects", async () => {
  const admin=nativeAdmin(), {url,key}=nativeTarget(), userId=proofPrefix("task16c-ci-runtime"), tenantId=proofPrefix("runtime-native-export");
  const seed=await admin.function("ownedExportPayloadFixture:seed",undefined,{userId,scope:{kind:"tenant",tenantId},storageIds:seeds()[0].storageIds,mode:"valid"}) as Seed;
  const before=await admin.function("ownedExportPayloadFixture:profile",undefined,{userId,id:seed.ids.profile.id});
  await admin.function("runtimeAuth:provision",undefined,{issuer:"https://cortex-ci.test",subject:userId,actorKind:"user",metadataUserId:userId,tenantId,memorySpaceId:userId+"-runtime-space",capabilities:["read","write","admin"],resourceAccess:"space"});
  const api=new UsersAPI({} as never), events:UserExportEvent[]=[];
  const erasureTransport=new UsersAPI({} as never).createErasureTransport({url,deploymentKey:key});
  try {
    await expect(admin.function("userExport:inspect",undefined,{userId,scope:seed.scope})).rejects.toThrow("UNSUPPORTED_OPERATION");
    await expect((async()=>{for await(const event of api.exportData(userId,{tenantId,transport:transport()}))events.push(event);})()).rejects.toThrow();
    expect(events.map(event=>event.type)).toEqual(["header"]);
    await expect(api.delete(userId,{tenantId,cascade:true,erasureTransport})).rejects.toThrow("UNSUPPORTED_OPERATION");
    expect(await admin.function("ownedExportPayloadFixture:profile",undefined,{userId,id:seed.ids.profile.id})).toEqual(before);
  } finally { erasureTransport.close(); }
});
