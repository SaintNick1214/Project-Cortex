import { describe, expect, it } from "@jest/globals";
import { createHash, webcrypto } from "node:crypto";
import { semanticHash } from "../../../src/domain/profile";
import { canonicalModelJson } from "../../../src/domain/model-policy";

/** Independent references: Node crypto and the exact previous WebCrypto expression. */
async function references(value: string) {
  const node = createHash("sha256").update(value, "utf8").digest("hex");
  const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const previous = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return { node, previous };
}
async function parity(value: string) {
  const expected = await references(value), pending = semanticHash(value);
  expect(pending).toBeInstanceOf(Promise);
  const actual = await pending;
  expect(actual).toBe(expected.node); expect(actual).toBe(expected.previous);
  expect(actual).toMatch(/^[a-f0-9]{64}$/);
  return actual;
}
describe("semantic SHA-256 byte compatibility", () => {
  it.each([
    ["empty", "", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["multiblock", "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
    ["million a", "a".repeat(1_000_000), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"],
  ])("matches standard known vector %s and both independent implementations", async (_name, value, expected) => {
    expect(await parity(value!)).toBe(expected);
  });
  it.each([
    "é", "e\u0301", "雪/مرحبا/क", "🧠🙂", "\ud800", "\udfff", "x\ud800y\udfffz", "\ud800\ud800\udfff\udfff",
    "\u0000\t \r\n\n ", "a\ufeffb\u2028c\u2029", "\udbff\udfff", "a".repeat(55), "a".repeat(56), "a".repeat(63), "a".repeat(64), "a".repeat(65),
  ])("preserves TextEncoder Unicode/replacement/padding bytes %#", async value => { await parity(value); });
  it.each([32_768, 60_000, 180_000, 1_000_000])("matches complete canonical model/source body of %i bytes", async size => {
    const empty = canonicalModelJson({ version: 8, role: "user", content: "" });
    const body = canonicalModelJson({ version: 8, role: "user", content: "x".repeat(size - Buffer.byteLength(empty)) });
    expect(Buffer.byteLength(body)).toBe(size); await parity(body);
  });
  it("hashes actual bytes without normalization or canonicalizing supplied strings", async () => {
    for (const [left, right] of [["é", "e\u0301"], ["a\r\nb", "a\nb"], [" value", "value"], ['{"a":1,"b":2}', '{"b":2,"a":1}']]) {
      expect(await parity(left!)).not.toBe(await parity(right!));
    }
    expect(await parity("\ud800")).toBe(await parity("\ufffd"));
  });
  it("preserves TextEncoder coercion and rejected-promise behavior at the existing async API", async () => {
    for (const value of [undefined, null, 42, true]) {
      const typed = value as unknown as string, expected = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(typed));
      expect(await semanticHash(typed)).toBe(Buffer.from(expected).toString("hex"));
    }
    let pending: Promise<string> | undefined;
    expect(() => { pending = semanticHash(Symbol("invalid") as unknown as string); }).not.toThrow();
    await expect(pending).rejects.toMatchObject({ name: "TypeError" });
  });
});
