import { createHash } from "node:crypto";
import { createSha256, bytesToBase64, randomUUID, digestConvexValue } from "../../src/common/crypto";

it.each([0, 1, 55, 56, 63, 64, 65, 65535, 65536, 65537])("matches native SHA-256 across streamed boundary size %i", (size) => {
  const bytes = Uint8Array.from({ length: size }, (_, index) => index % 251);
  const digest = createSha256();
  for (let offset = 0; offset < size; offset += 17) digest.update(bytes.subarray(offset, offset + 17));
  expect(digest.digestHex()).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
});
it("preserves Unicode canonical evidence bytes", () => {
  const text = 'café/雪 🧠';
  expect(createSha256().update(text).digestHex()).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
});

it("keeps secure Node operation IDs when WebCrypto is absent", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });
    expect(randomUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
    else Reflect.deleteProperty(globalThis, "crypto");
  }
});

it.each([
  { z: "雪", a: 1, absent: undefined },
  { nested: { b: -0, a: Number.NaN }, bytes: new Uint8Array([0, 255]).buffer, integer: 9223372036854775807n },
  ["array", { z: true, a: null }],
])("preserves the backend canonical Convex erasure digest", async (value) => {
  const { digest } = await import("../../convex-dev/lib/factHistoryProvenance");
  expect(digestConvexValue(value)).toBe(digest(value));
});
