import "./accepted-reader-compat";
import { expect, test } from "@jest/globals";
import { ConvexError } from "convex/values";
import { fixture } from "./fixture";

const failure = { version: 1, code: "BACKEND_OPERATION_FAILED", message: "Artifact operation failed.", retryable: false, outcome: "not_committed" };
const denial = { version: 1, code: "FORBIDDEN", message: "Access denied", retryable: false, outcome: "not_dispatched" };
function diagnostic(kind: string): unknown {
  if (kind === "plain") return new Error("private control diagnostic");
  const error = new ConvexError<Record<string, string | number | boolean>>({ ...denial });
  if (kind === "private-code") error.data = { code: "FORBIDDEN", message: "private diagnostic", privateDocumentId: "private-doc" };
  if (kind === "extra") Object.assign(error.data, { privateDocumentId: "private-doc" });
  if (kind === "hidden-extra") Object.defineProperty(error.data, "private", { value: "private diagnostic", enumerable: false });
  if (kind === "symbol-extra") Object.defineProperty(error.data, Symbol("private"), { value: "private diagnostic" });
  if (kind === "field-getter") Object.defineProperty(error.data, "code", { get: () => "FORBIDDEN" });
  if (kind === "throwing-field-getter") Object.defineProperty(error.data, "message", { get: () => { throw new Error("private diagnostic"); } });
  if (kind === "data-getter") Object.defineProperty(error, "data", { get: () => ({ ...denial }) });
  if (kind === "throwing-data-getter") Object.defineProperty(error, "data", { get: () => { throw new Error("private diagnostic"); } });
  if (kind === "inherited") Object.setPrototypeOf(error.data, { privateDocumentId: "private-doc" });
  if (kind === "malformed") error.data.version = 2;
  return error;
}
const kinds = ["plain", "private-code", "extra", "hidden-extra", "symbol-extra", "field-getter", "throwing-field-getter", "data-getter", "throwing-data-getter", "inherited", "malformed"];
for (const operation of ["get", "create", "update"]) {
  for (const position of operation === "get" ? ["initial-identity", "initial-scope"] : ["initial-identity", "initial-scope", "read-identity", "read-scope"]) {
    test.each(kinds)(`${operation} ${position} %s is an opaque failure before effects`, async (kind) => {
      const f = fixture(); if (operation !== "create") f.row();
      const before = structuredClone(f.db.rows("artifacts"));
      let calls = 0; let injections = 0;
      const error = diagnostic(kind);
      if (position.endsWith("identity")) {
        const identity = f.ctx.auth.getUserIdentity;
        f.ctx.auth.getUserIdentity = async () => {
          if (++calls === (position.startsWith("read") ? 2 : 1)) { injections++; throw error; }
          return await identity();
        };
      } else {
        f.db.hook = (event) => {
          if (event.action === "query" && event.table === "runtimeAuthScopes" && ++calls === (position.startsWith("read") ? 3 : 1)) { injections++; throw error; }
        };
      }
      await expect(f.invoke(operation, { artifactId: operation === "create" ? "fresh" : "artifact-a", memorySpaceId: "space-a", content: "uncommitted" })).rejects.toHaveProperty("data", failure);
      expect(injections).toBe(1); expect(f.db.attempts).toEqual([]); expect(f.db.writes).toEqual([]);
      expect(f.db.rows("artifacts")).toEqual(before);
    });
  }
}
for (const operation of ["create", "update"]) {
  test(`${operation} exact ordinary initial READ denial retains safe receipt`, async () => {
    const f = fixture(); if (operation === "update") f.row();
    let calls = 0; let injections = 0; const identity = f.ctx.auth.getUserIdentity;
    f.ctx.auth.getUserIdentity = async () => { if (++calls === 2) { injections++; throw new ConvexError(denial); } return await identity(); };
    const id = operation === "create" ? "fresh" : "artifact-a";
    expect(await f.invoke(operation, { artifactId: id, memorySpaceId: "space-a", content: "committed" })).toEqual({ success: true, artifactId: id });
    expect(injections).toBe(1); expect(f.db.attempts).toHaveLength(1); expect(f.db.writes).toHaveLength(1); expect(f.db.rows("artifacts")[0].content).toBe("committed");
  });
  test(`${operation} protected reader ordinary missing scope remains a denial`, async () => {
    const f = fixture(); if (operation === "update") f.row();
    f.db.tables.set("runtimeAuthScopes", []);
    await expect(f.invoke(operation, { artifactId: operation === "create" ? "fresh" : "artifact-a", memorySpaceId: "space-a", content: "uncommitted" })).rejects.toHaveProperty("data", denial);
    expect(f.db.attempts).toEqual([]); expect(f.db.writes).toEqual([]);
  });
  test(`${operation} admitted READ preserves exact payload`, async () => {
    const f = fixture(); if (operation === "update") f.row();
    const id = operation === "create" ? "fresh" : "artifact-a";
    const result = await f.invoke(operation, { artifactId: id, memorySpaceId: "space-a", content: "committed" });
    expect(result.artifactId).toBe(id); expect(result.content).toBe("committed");
    expect(result.ownerPrincipalId).toBe(f.principal._id); expect(f.db.writes).toHaveLength(1);
  });
  test.each(kinds)(`${operation} post-effect scope %s rolls back`, async (kind) => {
    const f = fixture(); if (operation === "update") f.row();
    const before = structuredClone(f.db.rows("artifacts")); let after = false; let injections = 0;
    f.db.hook = (event) => {
      if (["insert", "patch"].includes(event.action) && event.table === "artifacts") after = true;
      if (after && event.action === "query" && event.table === "runtimeAuthScopes" && injections === 0) { injections++; throw diagnostic(kind); }
    };
    await expect(f.invoke(operation, { artifactId: operation === "create" ? "fresh" : "artifact-a", memorySpaceId: "space-a", content: "uncommitted" })).rejects.toHaveProperty("data", failure);
    expect(injections).toBe(1); expect(f.db.attempts).toHaveLength(1); expect(f.db.writes).toEqual([]); expect(f.db.rows("artifacts")).toEqual(before);
  });
}
