import { canonicalModelJson, resolveModelPolicy, validateModelRequest } from "../../../src/domain/model-policy";
import type { ModelCallRequest, ModelPolicySnapshotV1 } from "../../../src/domain/model-policy";
import { privateFrameVideoInputBound } from "../../../src/domain/media-input";
import { deriveQualifiedInputBound } from "../../../convex-dev/runtimeModelPolicy";
import type { QualifiedDispatchEvidence } from "../../../convex-dev/runtimeModelPolicyBootstrap";
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
const image = (size = 8) => `data:image/png;base64,${btoa(String.fromCharCode(...signature, ...new Array<number>(size - 8).fill(0)))}`;
const body = () => ({ model: "google/veo-3.1", prompt: "Move the camera slowly.", resolution: "720p", duration: 4, generate_audio: false,
  frame_images: [{ type: "image_url", frame_type: "first_frame", image_url: { url: image() } }] });
const pins = { promptVersion: "private-frame-v1", schemaVersion: "private-frame-v1", extractionVersion: "private-frame-v1", toolRegistryVersion: "none-v1", priceRevision: "synthetic-price", boundRevision: "synthetic-bound" };
const limits = { inputTokens: 8192, contextTokens: 16384, outputTokens: 1, toolSteps: 0, timeoutMs: 60000, operationBudgetUnits: 2_000_000, runBudgetUnits: 2_000_000, tenantBudgetUnits: 10_000_000, concurrency: 2 };
const scope = { tenantId: "tenant", tenantEpoch: 1, memorySpaceId: "space", memorySpaceEpoch: 1, principalId: "owner", principalVersion: 1, membershipId: "membership", membershipVersion: 1, grantId: "grant", grantVersion: 1 };
const resolution = () => ({ context: { operationKey: "media.video.generate", scope, runBudgetId: "run", authorizedOverrides: [] },
  policies: [{ policyId: "test-video", version: 1, scope: "deployment", rules: { modelId: "google/veo-3.1", nativeInterface: "video", allowedModels: ["google/veo-3.1"], interfaces: ["video"], capabilities: ["video"], allowedOptions: [], allowedTools: [], fallbackModels: [], limits, pins } }],
  qualifications: [{ receiptId: "SYNTHETIC-ONLY", modelId: "google/veo-3.1", nativeInterface: "video", capabilities: ["video"], allowedOptions: [], limits, costBound: { kind: "qualified-call-ceiling", maximumCostUnits: 2_000_000, provenance: "Controlled test only, no actual price claim", coversAllProviderCharges: true }, priceRevision: pins.priceRevision, boundRevision: pins.boundRevision }] });
const proof: QualifiedDispatchEvidence = { receiptId: "SYNTHETIC-ONLY", evidenceHash: "a".repeat(64), providerVersion: "synthetic", nativeInterface: "video", modelId: "google/veo-3.1",
  inputBound: { ruleId: "private-frame-video-json-v1", revision: 1, featureEnvelope: "private-frame-video-v1", nativeTransformHash: "b".repeat(64), documentHash: "c".repeat(64), proofHash: "d".repeat(64) },
  resultBound: { maximumPrivateResultBytes: 4096, maximumOutputTokens: 0, maximumEmbeddingValues: 1, proofHash: "e".repeat(64) }, checkedAt: 1, expiresAt: 2, terminalCost: "unavailable", terminalProof: "provider-terminal-v1", priceRevision: pins.priceRevision, boundRevision: pins.boundRevision };
function request(native = canonicalModelJson(body())): ModelCallRequest {
  return { semanticId: "private-input", childCallId: "call", texts: [native], messages: [{ role: "user", parts: [{ type: "text", text: native }] }],
    inputTokens: 1, outputTokens: 0, toolSteps: 0, timeoutMs: 60000, reservationUnits: 2_000_000, promptVersion: pins.promptVersion, schemaVersion: pins.schemaVersion, extractionVersion: pins.extractionVersion, toolRegistryVersion: pins.toolRegistryVersion, tools: [], options: { maxRetries: 0 } };
}
describe("fixed private first-frame video admission (controlled, no provider)", () => {
  it("binds complete native JSON bytes under a genuine video operation", () => {
    const native = canonicalModelJson(body()), snapshot = resolveModelPolicy(resolution());
    expect(snapshot.nativeInterface).toBe("video"); expect(snapshot.operationKey).toBe("media.video.generate");
    const validated = validateModelRequest(snapshot, request(native));
    expect(privateFrameVideoInputBound(native, snapshot.modelId)).toBe(new TextEncoder().encode(native).length);
    expect(deriveQualifiedInputBound(proof, validated.request)).toBe(new TextEncoder().encode(native).length);
  });
  it("keeps absent and mismatched media qualifications unavailable", () => {
    const r = resolution(); r.qualifications = [];
    expect(() => resolveModelPolicy(r)).toThrow("CAPABILITY_UNAVAILABLE");
    expect(() => resolveModelPolicy({ ...resolution(), context: { ...resolution().context, operationKey: "media.image.generate" } })).toThrow("CAPABILITY_UNAVAILABLE");
    const other = resolution(); other.qualifications[0].boundRevision = "other"; expect(() => resolveModelPolicy(other)).toThrow("CAPABILITY_UNAVAILABLE");
  });
  it.each([
    { ...body(), model: "google/veo-3.1-fast" }, { ...body(), duration: 8 }, { ...body(), resolution: "1080p" }, { ...body(), generate_audio: true },
    { ...body(), n: 2 }, { ...body(), webhook_url: "https://foreign.example" }, { ...body(), seed: 1 }, { ...body(), size: "1280x720" },
    { ...body(), frame_images: [{ type: "image_url", frame_type: "last_frame", image_url: { url: image() } }] },
    { ...body(), frame_images: [body().frame_images[0], body().frame_images[0]] },
    { ...body(), frame_images: [{ type: "image_url", frame_type: "first_frame", image_url: { url: "https://storage.example/bearer" } }] },
    { ...body(), frame_images: [{ type: "image_url", frame_type: "first_frame", image_url: { url: image(4097) } }] },
    { ...body(), prompt: "é".repeat(513) }, { ...body(), prompt: "\ud800" },
    { ...body(), frame_images: [{ type: "image_url", frame_type: "first_frame", image_url: { url: "data:image/png;base64,AAAA==" } }] },
    { ...body(), prompt: "\u0000".repeat(500), frame_images: [{ type: "image_url", frame_type: "first_frame", image_url: { url: image(4096) } }] },
  ])("denies unqualified options, bytes or protocol framing %#", candidate => {
    expect(() => privateFrameVideoInputBound(canonicalModelJson(candidate), "google/veo-3.1")).toThrow("POLICY_DENIED");
  });
  it("requires canonical JSON and the exact compiled transform/interface/revision", () => {
    expect(() => privateFrameVideoInputBound(JSON.stringify(body()), "google/veo-3.1")).toThrow("POLICY_DENIED");
    expect(() => deriveQualifiedInputBound({ ...proof, nativeInterface: "chat" }, request())).toThrow();
    expect(() => deriveQualifiedInputBound({ ...proof, inputBound: { ...proof.inputBound, revision: 2 } }, request())).toThrow();
  });
  it.each([{ outputTokens: 1 }, { toolSteps: 1 }, { tools: [{ name: "secondary", definition: {} }] }, { options: { maxRetries: 0, temperature: 1 } },
    { texts: [canonicalModelJson(body()), "another"] }, { messages: [{ role: "assistant", parts: [{ type: "text", text: canonicalModelJson(body()) }] }] }])("denies expanded billing/secondary call envelope %#", change => {
    expect(() => deriveQualifiedInputBound(proof, { ...request(), ...change } as ModelCallRequest)).toThrow();
  });
  it("keeps cost/context ceilings and per-function pins mandatory", () => {
    const snapshot = resolveModelPolicy(resolution());
    expect(() => validateModelRequest(snapshot, { ...request(), reservationUnits: 1 })).toThrow("POLICY_DENIED");
    expect(() => validateModelRequest(snapshot, { ...request(), promptVersion: "changed" })).toThrow("POLICY_DENIED");
    expect(() => validateModelRequest({ ...snapshot, limits: { ...snapshot.limits, operationBudgetUnits: 1 } } as ModelPolicySnapshotV1, request())).toThrow("POLICY_DENIED");
  });
});
