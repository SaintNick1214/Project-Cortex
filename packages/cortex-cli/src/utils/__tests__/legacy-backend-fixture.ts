/** Test-only current candidate over immutable legacy backend bytes; current runtime uses dist/backend/v1. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { SDK_VERSION } from "../schema-sync.js";

const fixtureHash = "51efacc3e45bea05838aac7d7d8adecc5a1be6f243b1a7a2e739cc4867c76b15";
const sourceCommit = "b274c7ae15adf1c796cc3b810a7316fb2407c8eb";
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

export function createLegacySdkFixture(): string {
  const packed = fs.readFileSync(new URL("../../../tests/fixtures/legacy-backend-b274.json.gz", import.meta.url));
  if (hash(packed) !== fixtureHash) throw new Error("Legacy fixture digest changed");
  const fixture = JSON.parse(gunzipSync(packed, { maxOutputLength: 2 * 1024 * 1024 }).toString("utf8")) as {
    sourceCommit: string;
    sdkPackageJson: string;
    files: Record<string, { sha256: string; gitBlob: string; text: string }>;
  };
  if (fixture.sourceCommit !== sourceCommit || Object.keys(fixture.files).length !== 77)
    throw new Error("Legacy fixture source identity changed");
  for (const [name, entry] of Object.entries(fixture.files)) {
    if ((name !== "tsconfig.json" && !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/.test(name)) ||
      name.split("/").includes("_generated") || hash(Buffer.from(entry.text)) !== entry.sha256)
      throw new Error("Legacy fixture source bytes/path changed");
  }
  const archivedManifest = JSON.parse(fixture.sdkPackageJson);
  if (archivedManifest.name !== "@cortexmemory/sdk" || archivedManifest.version !== "0.38.0")
    throw new Error("Legacy fixture archived manifest identity changed");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-legacy-sdk-fixture-"));
  try {
    // The product accepts a fixed current SDK candidate. This test-only metadata
    // overlay exercises retained composer invariants against exact archived source;
    // it does not qualify an old SDK release or change the archived package bytes.
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ ...archivedManifest, version: SDK_VERSION }));
    for (const [name, entry] of Object.entries(fixture.files)) {
      const target = path.join(root, "convex-dev", name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.text);
    }
    return root;
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
