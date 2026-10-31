import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildBackendDistribution } from "../../../../../../../scripts/backend/build-distribution.mjs";
const qa = path.dirname(fileURLToPath(import.meta.url));
const root = "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion";
const output = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-dependency-manifest-"));
try {
 const manifest = await buildBackendDistribution({sourceRoot: root, outputRoot: output});
 const before = JSON.parse(await fs.readFile(path.join(root, "dist/backend/v1/manifest.json"), "utf8"));
 const filesUnchanged = JSON.stringify(before.files) === JSON.stringify(manifest.files);
 if (!filesUnchanged || manifest.dependencies["@types/node"] !== "26.6.4") throw new Error("Unexpected source/dependency delta");
 await fs.writeFile(path.join(qa, "generated-current-manifest2.json"), JSON.stringify(manifest, null, 2) + "\n");
 const report = {files:manifest.files.length,tables:manifest.tables.length,components:manifest.components,filesUnchanged,dependencyDelta:{"@types/node":{before:before.dependencies["@types/node"]??null,after:manifest.dependencies["@types/node"]}},manifestSha256:crypto.createHash("sha256").update(await fs.readFile(path.join(output,"manifest.json"))).digest("hex"),rootDistModified:false,serviceEffect:false};
 await fs.writeFile(path.join(qa,"generated-dependency-delta2.json"),JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify(report));
} finally {await fs.rm(output,{recursive:true,force:true});}
