import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { externalSourceInput } from "../../../src/client-runtime/external";
import { semanticHash } from "../../../src/domain/profile";

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("../../fixtures/external-evidence/archive.json", import.meta.url)), "utf8")) as {
  sourceCorpusSha256: string; interpretation: string;
  records: { label: string; messageId: string; originalContentHash: string; input: unknown }[];
};

describe("small archived evidence custody fixture (offline contract coverage)", () => {
  test("preserves all four exact bodies, immutable hashes, external authors and separate observation/source times", async () => {
    expect(fixture.records.map(row => row.messageId)).toEqual(["1570583966946172939", "1570591021941661728", "1570458814560604221", "1570682255565918260"]);
    expect(fixture.sourceCorpusSha256).toMatch(/^[a-f0-9]{64}$/);
    for (const row of fixture.records) {
      const input = externalSourceInput(row.input);
      expect(input.externalSourceId.endsWith("/" + row.messageId)).toBe(true);
      expect(await semanticHash(input.originalText)).toBe(row.originalContentHash);
      expect(input.author.id).toMatch(/^\d+$/);
      expect(input.author.name).toBeTruthy();
      expect(input.authoredAt).toBeLessThan(input.observedAt);
      expect(input).toMatchObject({ attribution: "unverified_external", extraction: "none", externalRevision: 1, assetReferences: [] });
    }
  });

  test("retains delayed qualification and retraction as distinct source messages, without promoting a solve", () => {
    const [proposal, qualification, claim, retraction] = fixture.records.map(row => externalSourceInput(row.input));
    expect(proposal.originalText).toContain("church/starting point");
    expect(qualification.originalText).toContain("It's just a theory");
    expect(qualification.originalText).toContain("haven't applied it with any success yet");
    expect(qualification.author).toEqual(proposal.author);
    expect(qualification.authoredAt! - proposal.authoredAt!).toBeGreaterThan(20 * 60_000);
    expect(claim.originalText).toBe("Part 2 done also 👍🏴‍☠️");
    expect(retraction.originalText).toBe("Lol yes I was joking");
    expect(retraction.authoredAt).toBeGreaterThan(claim.authoredAt!);
    expect(new Set([proposal, qualification, claim, retraction].map(row => row.externalSourceId)).size).toBe(4);
    expect(fixture.interpretation).toContain("explicitly synthetic");
  });

  test("copies no bulk bodies, attachment URLs or signed transport tokens", () => {
    const sources = fixture.records.map(row => externalSourceInput(row.input));
    expect(sources.reduce((total, row) => total + new TextEncoder().encode(row.originalText).length, 0)).toBe(689);
    expect(JSON.stringify(fixture)).not.toMatch(/https?:\/\/|[?&](?:ex|is|hm|token|signature)=/i);
    expect(sources.every(row => row.provenance.location?.startsWith("discord://"))).toBe(true);
  });
});
