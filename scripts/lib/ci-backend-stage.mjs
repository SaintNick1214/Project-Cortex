/** Build only the disposable native CI project; no credentials or deployment. */
import { cp, lstat, mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";

const excludedDirectories = new Set(["node_modules", "tests", "fixtures", "__tests__", "archives", "_DEPRECATED"]);

async function copyActiveSources(source, destination) {
  await cp(source, destination, {
    recursive: true,
    filter: async file => {
      const parts = relative(source, file).split(sep);
      if (parts.some(part => part.startsWith(".") || excludedDirectories.has(part))) return false;
      const entry = await lstat(file);
      if (entry.isSymbolicLink()) return false;
      const name = basename(file);
      return entry.isDirectory() || (entry.isFile() && !/\.(?:test|spec)\./.test(name)
        && (/\.(?:[cm]?js|tsx?)$/.test(name) || name === "tsconfig.json"));
    },
  });
}

export async function stageNativeCiBackend({ sourceRoot, stageRoot }) {
  // Canonical Convex modules import ../src at runtime and for shared types.
  // Keep their original paths, including transitive SDK imports, in this stage.
  await copyActiveSources(join(sourceRoot, "convex-dev"), join(stageRoot, "convex-dev"));
  await copyActiveSources(join(sourceRoot, "src"), join(stageRoot, "src"));
  await symlink(join(sourceRoot, "node_modules"), join(stageRoot, "node_modules"), "dir");
  const manifest = JSON.parse(await readFile(join(sourceRoot, "package.json"), "utf8"));
  await writeFile(join(stageRoot, "package.json"), JSON.stringify({ name: "cortex-native-ci-fixture", private: true, type: "module",
    dependencies: { ...manifest.peerDependencies, ...manifest.devDependencies, ...manifest.dependencies } }));
  await writeFile(join(stageRoot, "convex.json"), JSON.stringify({ functions: "convex-dev/" }));
  await mkdir(join(stageRoot, "convex-dev"), { recursive: true });
  for (const name of await readdir(join(sourceRoot, "tests/fixtures/native"))) {
    if (!name.endsWith(".ts")) continue;
    const source = await readFile(join(sourceRoot, "tests/fixtures/native", name), "utf8");
    await writeFile(join(stageRoot, "convex-dev", name), source.replaceAll("../../../convex-dev/", "./"));
  }
}
