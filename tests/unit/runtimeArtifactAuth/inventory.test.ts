import "./accepted-reader-compat";
import { expect, test } from "@jest/globals";
import fs from "node:fs";
import * as artifacts from "../../../convex-dev/artifacts";
import { fixture, selected } from "./fixture";
import { ConvexError, type Value } from "convex/values";

type Native = { isPublic?: boolean; isInternal?: boolean; isMutation?: boolean; exportArgs(): string };
const internal = new Set(["purgeAll", "setFileRef", "generateArtifactUploadUrl", "getArtifactFileUrl"]);
const expected = new Set([...selected, ...internal, "completeArtifactUpload", "detachFile", "attachAsset"]);
type Validator = { type: string; value?: unknown; tableName?: string };
function sample(v: Validator): unknown {
  if (v.type === "string") return "fixture";
  if (v.type === "number") return 1;
  if (v.type === "boolean") return false;
  if (v.type === "literal") return v.value;
  if (v.type === "null") return null;
  if (v.type === "id") return `${v.tableName}:fixture`;
  if (v.type === "any") return {};
  if (v.type === "array") return [sample(v.value as Validator)];
  if (v.type === "union") return sample((v.value as Validator[])[0]);
  if (v.type === "object") return Object.fromEntries(Object.entries(v.value as Record<string, { fieldType: Validator; optional: boolean }>).filter(([, value]) => !value.optional).map(([key, value]) => [key, sample(value.fieldType)]));
  throw new Error(`Unsupported native validator ${v.type}`);
}

test("current actual artifact registrations expose guarded mutations and internal raw-storage helpers", async () => {
  const calls = Object.entries(artifacts).map(([name, registration]) => ({ name, registration: registration as unknown as Native }));
  expect(new Set(calls.map(call => call.name))).toEqual(expected);
  expect(calls).toHaveLength(28);
  expect(calls.filter(call => call.registration.isPublic)).toHaveLength(24);
  for (const { name, registration } of calls) {
    expect(!!registration.isInternal).toBe(internal.has(name));
    expect(!!registration.isPublic).toBe(!internal.has(name));
    if (internal.has(name)) continue;
    expect(registration.isMutation).toBe(true);
    const validators = JSON.parse(registration.exportArgs()) as Validator;
    const fields = validators.value as Record<string, { fieldType: Validator; optional: boolean }>;
    expect(fields.tenantId).toEqual({ fieldType: { type: "string" }, optional: true });
    expect(fields.memorySpaceId.fieldType).toEqual({ type: "string" });
    expect(typeof fields.memorySpaceId.optional).toBe("boolean");
    const f = fixture(); f.identity(null);
    const error = await f.invoke(name, sample(validators) as Record<string, unknown>).then(() => undefined, (failure: unknown) => failure);
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<Value>).data).toMatchObject({ version: 1, code: "UNAUTHENTICATED", retryable: false, outcome: "not_dispatched" });
    expect(f.db.writes).toEqual([]); expect(f.db.attempts).toEqual([]);
  }
});

test("the archived original inventory remains historical evidence, independent of current source bytes", () => {
  const original = "_goals/convex-backend-runtime-2026-10-02/qa/task03b2f-asset-foundation/original/native-validators17.json";
  const archived = JSON.parse(fs.readFileSync(original, "utf8")) as { registrations: { path: string }[] };
  expect(archived.registrations).toHaveLength(17);
  expect(archived.registrations.some(row => row.path === "attachments:create")).toBe(false);
  expect(archived.registrations.some(row => row.path === "artifacts:completeArtifactUpload")).toBe(true);
});
