/** App source owns these paths. Installed SDK modules and official generated
 * bindings have separate SDK/backend checks; they are never rewritten by app lint. */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selected = [
  "app",
  "artifacts",
  "components",
  "hooks",
  "lib",
  "tests",
  "scripts",
  "convex/app",
  "convex/app.schema.ts",
  "convex/sdk.registration.ts",
  "convex/schema.ts",
  ...readdirSync(root).filter(
    (name) => /\.(?:ts|tsx|js|mjs)$/.test(name) && name !== "next-env.d.ts"
  ),
].filter((name) => existsSync(path.join(root, name)));
const formatting = process.argv[2] === "--format";
try {
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/@biomejs/biome/bin/biome"),
      formatting ? "check" : "lint",
      ...selected,
      ...process.argv.slice(formatting ? 3 : 2),
    ],
    { cwd: root, stdio: "inherit" }
  );
} catch (error) {
  process.exitCode = Number.isInteger(error.status) ? error.status : 1;
}
