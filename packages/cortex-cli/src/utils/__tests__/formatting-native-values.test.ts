import { describe, it, expect } from "@jest/globals";
import { convexToJson, jsonToConvex } from "convex/values";
import { formatJSON, formatCSV } from "../formatting.js";

describe("CLI formatting of supported Convex values", () => {
  it("round-trips nested native values instead of throwing or losing data", () => {
    const bytes = Uint8Array.from([0, 1, 127, 255]).buffer;
    const data = {
      memorySpaceId: "fixture", metadata: {
        integer: 9223372036854775807n, bytes, nan: NaN,
        positiveInfinity: Infinity, negativeInfinity: -Infinity,
        negativeZero: -0, text: "Unicode café 🧠", nested: [1n, bytes],
      },
    };
    const encoded = JSON.parse(formatJSON(data));
    expect(encoded).toEqual(convexToJson(data));
    expect(jsonToConvex(encoded)).toEqual(data);
    expect(Object.is((jsonToConvex(encoded) as typeof data).metadata.negativeZero, -0)).toBe(true);
  });

  it("formats scalar native integers and bytes with the official codec", () => {
    for (const value of [1n, Uint8Array.from([42]).buffer]) {
      expect(JSON.parse(formatJSON(value))).toEqual(convexToJson(value));
    }
  });

  it("preserves ordinary JSON output and Date serialization", () => {
    const data = { name: "fixture", count: 1, optional: undefined, date: new Date(0), values: [null, true, "text"] };
    expect(formatJSON(data)).toBe(JSON.stringify(data, null, 2));
  });

  it("encodes nested native CSV cells without losing their values or quoting", () => {
    const metadata = { integer: 1n, bytes: Uint8Array.from([0, 255]).buffer, text: "comma, quote\" and\nnewline" };
    const csv = formatCSV([{ id: "fixture", metadata }], ["id", "metadata"]);
    const prefix = 'id,metadata\nfixture,"';
    expect(csv.startsWith(prefix)).toBe(true);
    expect(csv.endsWith('"')).toBe(true);
    const encoded = JSON.parse(csv.slice(prefix.length, -1).replace(/""/g, '"'));
    expect(encoded).toEqual(convexToJson(metadata));
    expect(jsonToConvex(encoded)).toEqual(metadata);
  });

  it("preserves ordinary scalar and nested CSV cells", () => {
    expect(formatCSV([{ id: "fixture", count: 2, metadata: { ready: true } }]))
      .toBe('id,count,metadata\nfixture,2,"{""ready"":true}"');
  });
});
