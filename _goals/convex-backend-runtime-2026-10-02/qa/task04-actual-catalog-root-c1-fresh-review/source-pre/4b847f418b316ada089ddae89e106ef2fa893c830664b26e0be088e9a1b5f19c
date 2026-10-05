import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { ConvexClient } from "convex/browser";
import { ArtifactsAPI } from "../../../src/artifacts";
import { AttachmentsAPI } from "../../../src/attachments";
import { AssetCapabilityUnavailableError } from "../../../src/assets/errors";
import { ResilienceLayer } from "../../../src/resilience";
import { api } from "../../../convex-dev/_generated/api";

const methods = ["artifact-upload", "artifact-url", "attachment-upload-url", "attachment-url"] as const;
describe.each(["absent", "disabled", "enabled"] as const)("asset safety bridge resilience=%s", (mode) => {
  let client: ConvexClient;
  let resilience: ResilienceLayer;
  afterEach(async () => { await client.close(); await resilience.shutdown(); jest.restoreAllMocks(); });

  function fixture() {
    client = new ConvexClient("https://example.convex.cloud", { disabled: true, logger: false });
    const query = jest.spyOn(client, "query"); const mutation = jest.spyOn(client, "mutation"); const action = jest.spyOn(client, "action");
    const fetch = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected transport"));
    const retry = jest.fn(); resilience = new ResilienceLayer({ enabled: mode === "enabled", onRetry: retry });
    const execute = jest.spyOn(resilience, "execute");
    const authGetter = jest.fn(() => { throw new Error("private identity getter"); });
    const auth = { userId: "private-user", get tenantId(): string { return authGetter(); } };
    const layer = mode === "absent" ? undefined : resilience;
    return { query, mutation, action, fetch, retry, execute, authGetter, artifacts: new ArtifactsAPI(client, undefined, layer, auth), attachments: new AttachmentsAPI(client, layer, auth) };
  }

  it.each(methods)("%s uniformly rejects before every transport/resilience/file/identity effect", async (method) => {
    const f = fixture();
    const blob = new Blob(["private body"]);
    const blobSize = jest.fn(() => { throw new Error("private blob size"); });
    Object.defineProperty(blob, "size", { get: blobSize });
    const blobRead = jest.spyOn(blob, "arrayBuffer");
    const inputGetter = jest.fn(() => { throw new Error("private file/metadata/identity data"); });
    const params = {
      get artifactId(): string { return inputGetter(); },
      get file(): Blob { return inputGetter(); },
      get filename(): string { return inputGetter(); },
      get mimeType(): string { return inputGetter(); },
      get metadata(): Record<string, unknown> { return inputGetter(); },
    };
    const promise = method === "artifact-upload" ? f.artifacts.uploadFile(params)
      : method === "artifact-url" ? f.artifacts.getFileUrl("art-private-id")
        : method === "attachment-upload-url" ? f.attachments.generateUploadUrl()
          : f.attachments.getUrl("attach-private-id");
    const error = await promise.catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AssetCapabilityUnavailableError);
    expect(error).toMatchObject({ version: 1, code: "CAPABILITY_UNAVAILABLE", retryable: false, outcome: "not_dispatched" });
    expect((error as Error).message).toBe("Authenticated asset upload and delivery are unavailable in this SDK deployment.");
    expect(JSON.parse(JSON.stringify(error))).toEqual({ version: 1, code: "CAPABILITY_UNAVAILABLE", retryable: false, outcome: "not_dispatched", name: "AssetCapabilityUnavailableError" });
    expect(String(error)).not.toMatch(/private|storageId|tenant|uploadUrl|fileRef/);
    expect(f.query).not.toHaveBeenCalled(); expect(f.mutation).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled(); expect(f.retry).not.toHaveBeenCalled(); expect(f.authGetter).not.toHaveBeenCalled();
    expect(inputGetter).not.toHaveBeenCalled(); expect(blobSize).not.toHaveBeenCalled(); expect(blobRead).not.toHaveBeenCalled();
  });

  it("an actual supplied Blob is not inspected or read by uploadFile", async () => {
    const f = fixture(); const blob = new Blob(["private file"]);
    const size = jest.fn(() => { throw new Error("private size"); }); Object.defineProperty(blob, "size", { get: size });
    const read = jest.spyOn(blob, "arrayBuffer");
    await expect(f.artifacts.uploadFile({ artifactId: "art-private-id", file: blob, filename: "private-name", mimeType: "private-type", metadata: { private: "private-metadata" } })).rejects.toBeInstanceOf(AssetCapabilityUnavailableError);
    expect(size).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled(); expect(f.execute).not.toHaveBeenCalled(); expect(f.mutation).not.toHaveBeenCalled();
  });

  it("unavailable capability is uniform even for empty IDs", async () => {
    const f = fixture();
    await expect(f.artifacts.getFileUrl("")).rejects.toBeInstanceOf(AssetCapabilityUnavailableError);
    await expect(f.attachments.getUrl("")).rejects.toBeInstanceOf(AssetCapabilityUnavailableError);
    expect(f.query).not.toHaveBeenCalled(); expect(f.execute).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });

  it("neighboring attachment and artifact get methods retain their public transport", async () => {
    client = new ConvexClient("https://example.convex.cloud", { disabled: true, logger: false });
    const query = jest.spyOn(client, "query").mockResolvedValue(null);
    resilience = new ResilienceLayer({ enabled: mode === "enabled" }); const execute = jest.spyOn(resilience, "execute");
    const layer = mode === "absent" ? undefined : resilience; const auth = { userId: "user-a", tenantId: "tenant-a" };
    await expect(new ArtifactsAPI(client, undefined, layer, auth).get("art-abc123")).resolves.toBeNull();
    await expect(new AttachmentsAPI(client, layer, auth).get("attach-abc123")).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(1, api.artifacts.get, { artifactId: "art-abc123", tenantId: "tenant-a" });
    expect(query).toHaveBeenNthCalledWith(2, api.attachments.get, { attachmentId: "attach-abc123", tenantId: "tenant-a" });
    expect(execute.mock.calls.map((call) => call[1])).toEqual(mode === "absent" ? [] : ["artifacts:get", "attachments:get"]);
  });
});
