/** Controlled contracts and the installed official V4 transform. No credentials,
 * service calls, observed qualification claims, or model inference. */
import { describe, expect, it } from "@jest/globals";
import Ajv from "ajv";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ModelCallRequest, ModelPolicySnapshotV1 } from "../../../src/domain/model-policy";
import { canonicalModelJson, MEMORY_JSON_OBJECT_CONTRACT, MEMORY_JSON_SCHEMA_CONTRACT as contract,
  memoryJsonObjectRequestBody, memoryJsonSchemaRequestBody, memoryJsonSchemaInputBound,
  validateModelRequest } from "../../../src/domain/model-policy";
import { FACTS_JSON_SCHEMA, FACTS_NATIVE_JSON_SCHEMA_V1 } from "../../../src/domain/extraction";
import { parseSourceFactsResponse } from "../../../src/domain/sources";
import type { SourceContent } from "../../../src/domain/contracts";

const source: SourceContent = { tenantId: "tenant", memorySpaceId: "space", ownerPrincipalId: "owner",
  lineage: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, role: "user", trust: "user_assertion" },
  content: "What kind of tea do I prefer?", contentHash: "a".repeat(64), createdAt: 1 };
const messages: NonNullable<ModelCallRequest["messages"]> = [{ role: "system", parts: [{ type: "text", text: "Extract facts as JSON." }] },
  { role: "user", parts: [{ type: "text", text: source.content }] }];
function fixture() {
  const pins = { promptVersion: contract.promptVersion, schemaVersion: contract.schemaVersion, extractionVersion: "e1",
    toolRegistryVersion: contract.toolRegistryVersion, priceRevision: "controlled-price", boundRevision: contract.boundRevision };
  const snapshot: ModelPolicySnapshotV1 = { version: 1, operationKey: "memory.extract", requestedModelId: contract.modelId,
    modelId: contract.modelId, nativeInterface: "chat", capabilities: ["text", "structured"], allowedModels: [contract.modelId],
    allowedOptions: [], allowedTools: [], limits: { inputTokens: 8192, contextTokens: 16384, outputTokens: 512,
      toolSteps: 0, timeoutMs: 60000, operationBudgetUnits: 100000, runBudgetUnits: 3000000, tenantBudgetUnits: 10000000, concurrency: 2 },
    pins, policyVersions: [], qualificationReceiptId: "CONTROLLED-NOT-ACTUAL",
    costBound: { kind: "qualified-call-ceiling", maximumCostUnits: 100000, provenance: "CONTROLLED-NOT-PRICE-EVIDENCE", coversAllProviderCharges: true },
    scope: { tenantId: "tenant", tenantEpoch: 1, memorySpaceId: "space", memorySpaceEpoch: 1, principalId: "owner", principalVersion: 1,
      membershipId: "member", membershipVersion: 1, grantId: "grant", grantVersion: 1 }, runBudgetId: "run", fallbackCandidates: [], currency: "USD", monetaryUnit: "micro-USD" };
  const request: ModelCallRequest = { semanticId: "extract", childCallId: "child", texts: messages.map(message => (message.parts[0] as { text: string }).text),
    messages, inputTokens: memoryJsonSchemaInputBound(messages, 512), outputTokens: 512, toolSteps: 0, timeoutMs: 60000,
    reservationUnits: 100000, promptVersion: pins.promptVersion, schemaVersion: pins.schemaVersion, extractionVersion: pins.extractionVersion,
    toolRegistryVersion: pins.toolRegistryVersion, tools: [], outputSchema: JSON.parse(JSON.stringify(FACTS_JSON_SCHEMA)) as Record<string, unknown>,
    responseFormat: JSON.parse(JSON.stringify(contract.responseFormat)) as ModelCallRequest["responseFormat"], options: { maxRetries: 0 } };
  return { snapshot, request };
}
describe("separately pinned native strict extraction schema", () => {
  it("is equivalent to the unchanged semantic schema for optional fullValue and rejects null/unknown data", () => {
    const ajv = new Ajv({ allErrors: true }); const old = ajv.compile(FACTS_JSON_SCHEMA), strict = ajv.compile(FACTS_NATIVE_JSON_SCHEMA_V1);
    const fact = { fact: "User likes SF", factType: "preference", subject: "User", predicate: "likes", object: "SF", confidence: 0.9,
      tags: [], relations: [], entities: [] as unknown[] };
    const cases: [unknown, boolean][] = [[{ facts: [] }, true], [{ facts: [fact] }, true],
      ...[{ name: "SF", type: "place" }, { name: "SF", type: "place", fullValue: "San Francisco" }, { name: "SF", type: "place", fullValue: "" }]
        .map(entity => [{ facts: [{ ...fact, entities: [entity] }] }, true] as [unknown, boolean]),
      ...[{ name: "SF", type: "place", fullValue: null }, { name: "SF", type: "place", fullValue: 1 }, { name: "SF", type: "place", other: true },
        { name: "SF" }, { name: "", type: "place" }].map(entity => [{ facts: [{ ...fact, entities: [entity] }] }, false] as [unknown, boolean]),
      [{ facts: [], entities: [], relations: [] }, false]];
    for (const [value, valid] of cases) {
      expect(old(value)).toBe(valid); expect(strict(value)).toBe(valid);
      if (valid) expect(parseSourceFactsResponse(JSON.stringify(value), source)).toHaveLength((value as { facts: unknown[] }).facts.length);
      else expect(() => parseSourceFactsResponse(JSON.stringify(value), source)).toThrow();
    }
    const inspect = (schema: unknown): void => {
      if (!schema || typeof schema !== "object") return;
      const row = schema as Record<string, unknown>;
      if (row.type === "object") {
        expect(row.additionalProperties).toBe(false);
        expect([...(row.required as string[])].sort()).toEqual(Object.keys(row.properties as object).sort());
      }
      for (const value of Object.values(row)) if (Array.isArray(value)) value.forEach(inspect); else inspect(value);
    };
    inspect(FACTS_NATIVE_JSON_SCHEMA_V1);
    expect(Object.isFrozen(contract.responseFormat.schema)).toBe(true);
    expect(contract.promptVersion).toBe(MEMORY_JSON_OBJECT_CONTRACT.promptVersion);
    expect(contract.boundRevision).not.toBe(MEMORY_JSON_OBJECT_CONTRACT.boundRevision);
  });
  it("matches the installed official compatible V4 strict wire including every schema byte in its bound", async () => {
    const bodies: unknown[] = [];
    const provider = createOpenAICompatible({ name: "convexGateway", baseURL: "https://offline.invalid/v1", supportsStructuredOutputs: true,
      fetch: async (_url, init) => { bodies.push(JSON.parse(init!.body as string));
        return new Response(JSON.stringify({ id: "controlled-empty", model: contract.modelId,
          choices: [{ index: 0, message: { role: "assistant", content: '{"facts":[]}' }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 4, total_tokens: 5 } }), { headers: { "content-type": "application/json" } }); } });
    const result = await provider(contract.modelId).doGenerate({ prompt: [{ role: "system", content: "Extract facts as JSON." },
      { role: "user", content: [{ type: "text", text: source.content }] }], maxOutputTokens: 512, responseFormat: contract.responseFormat });
    expect(bodies).toEqual([memoryJsonSchemaRequestBody(messages, 512)]);
    expect(memoryJsonSchemaInputBound(messages, 512)).toBe(Buffer.byteLength(JSON.stringify(bodies[0]), "utf8") + 9);
    expect(result.content).toEqual([{ type: "text", text: '{"facts":[]}' }]);
    const old = memoryJsonObjectRequestBody(messages, 512);
    expect(old.response_format).toEqual({ type: "json_object" }); expect(old.messages).toEqual((bodies[0] as typeof old).messages);
  });
  it("pins the strict native schema/name in the canonical admitted identity", () => {
    const { snapshot, request } = fixture(); const checked = validateModelRequest(snapshot, request);
    expect(checked.request.responseFormat).toEqual(contract.responseFormat);
    expect(checked.canonical).toContain('"name":"cortex_facts_v1"');
    expect(checked.request.outputSchema).toEqual(FACTS_JSON_SCHEMA);
  });
  it.each(["name", "schema", "json-object", "extra", "tools", "retry", "prompt", "semantic-schema", "output", "input", "interface", "operation", "old-bound"])
    ("rejects changed %s instead of falling through to JSON-object or plain output", kind => {
      const { snapshot, request } = fixture(); const candidate = JSON.parse(canonicalModelJson(request)) as Record<string, unknown>;
      if (kind === "name") candidate.responseFormat = { ...contract.responseFormat, name: "other" };
      if (kind === "schema") candidate.responseFormat = { ...contract.responseFormat, schema: FACTS_JSON_SCHEMA };
      if (kind === "json-object") candidate.responseFormat = { type: "json" };
      if (kind === "extra") candidate.responseFormat = { ...contract.responseFormat, strict: true };
      if (kind === "tools") candidate.tools = [{ name: "inject", definition: {} }];
      if (kind === "retry") candidate.options = { maxRetries: 1 };
      if (kind === "prompt") candidate.promptVersion = "other";
      if (kind === "semantic-schema") candidate.outputSchema = {};
      if (kind === "output") candidate.outputTokens = 513;
      if (kind === "input") candidate.inputTokens = 8193;
      const changed = { ...snapshot, ...(kind === "interface" ? { nativeInterface: "responses" as const } : {}),
        ...(kind === "operation" ? { operationKey: "facts.resolve" as const } : {}),
        pins: { ...snapshot.pins, ...(kind === "old-bound" ? { boundRevision: MEMORY_JSON_OBJECT_CONTRACT.boundRevision } : {}) } };
      expect(() => validateModelRequest(changed, candidate)).toThrow();
    });
  it.each([0, 513, 1.5])("rejects unsupported output cap %s before producing wire bytes", cap => {
    expect(() => memoryJsonSchemaRequestBody(messages, cap)).toThrow();
    expect(() => memoryJsonSchemaInputBound(messages, cap)).toThrow();
  });
  it("rejects getters and malformed Unicode without reading attacker properties", () => {
    const { snapshot, request } = fixture(); let reads = 0;
    Object.defineProperty(request, "responseFormat", { enumerable: true, get() { reads++; return contract.responseFormat; } });
    expect(() => validateModelRequest(snapshot, request)).toThrow(); expect(reads).toBe(0);
    expect(() => memoryJsonSchemaInputBound([{ role: "system", parts: [{ type: "text", text: "\ud800" }] }, messages[1]!], 512)).toThrow();
  });
});
