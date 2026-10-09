import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { constants, closeSync, copyFileSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const purpose = "cortex-cli-offline-command-fixtures-v1";
const fail = code => { throw new Error(`COMMAND_FIXTURE_${code}`); };
const hash = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const json = file => JSON.parse(readFileSync(file, "utf8"));
const childEnv = () => ({ PATH: process.env.PATH ?? "", LANG: "C", NO_COLOR: "1" });

function physicalDirectory(directory) {
  if (!isAbsolute(directory) || /[\r\n\0]/.test(directory)) fail("DIRECTORY_INVALID");
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(directory) !== directory) fail("DIRECTORY_UNSAFE");
  return stat;
}

function physicalFile(file) {
  if (!isAbsolute(file) || /[\r\n\0]/.test(file)) fail("FILE_INVALID");
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || realpathSync(file) !== file) fail("FILE_UNSAFE");
  return stat;
}

function probe(node, version) {
  physicalFile(node);
  const result = spawnSync(node, ["--version"], { encoding: "utf8", timeout: 10000, maxBuffer: 4096, env: childEnv() });
  if (result.error || result.signal || result.status !== 0 || result.stdout.trim() !== `v${version}`) fail("NODE_VERSION_UNVERIFIED");
  return { version, binarySHA256: hash(node) };
}

export function npmRootFromPath(path = process.env.PATH ?? "") {
  for (const entry of path.split(delimiter)) {
    if (!entry || !isAbsolute(entry) || !existsSync(join(entry, "npm"))) continue;
    const executable = realpathSync(join(entry, "npm"));
    const root = dirname(dirname(executable));
    if (!existsSync(join(root, "package.json"))) continue;
    const manifest = json(join(root, "package.json"));
    if (manifest.name === "npm" && manifest.version === "12.2.0") { physicalDirectory(root); return root; }
  }
  fail("NPM_12_2_REQUIRED");
}

function packageRoot(require, name) {
  // Follow the actual package search order without assuming a require export.
  // The independent templates catalog deliberately exports only the import channel.
  for (const search of require.resolve.paths(name) ?? []) {
    const directory = join(search, name);
    if (existsSync(join(directory, "package.json"))) {
      const selected = realpathSync(directory);
      if (json(join(selected, "package.json")).name !== name) fail("DEPENDENCY_MANIFEST_INVALID");
      return selected;
    }
  }
  fail("DEPENDENCY_MANIFEST_MISSING");
}

/** Hash current built bytes, and resolve the CLI's actual selected dependency edges. */
export function dependencyBinding(root, npmRoot) {
  physicalDirectory(root);
  const cli = join(root, "packages/cortex-cli");
  const manifest = json(join(cli, "package.json"));
  for (const file of ["dist/index.js", "dist/cli-main.js", "dist/utils/node-runtime.js"]) {
    if (!existsSync(join(cli, file))) fail("CLI_BUILD_REQUIRED");
    physicalFile(join(cli, file));
  }
  if (readFileSync(join(cli, "dist/index.js"), "utf8").split("\n")[0] !== "#!/usr/bin/env -S node --") fail("CLI_BOOTSTRAP_INVALID");
  const require = createRequire(join(cli, "package.json"));
  const semver = createRequire(join(npmRoot, "package.json"))("semver");
  const dependencies = {};
  for (const [name, range] of Object.entries(manifest.dependencies)) {
    const directory = packageRoot(require, name);
    physicalDirectory(directory);
    const selected = json(join(directory, "package.json"));
    if (!semver.satisfies(selected.version, range)) fail("DEPENDENCY_VERSION_MISMATCH");
    dependencies[name] = { directory, version: selected.version, declaredRange: range,
      manifestSHA256: hash(join(directory, "package.json")) };
  }
  const sdk = dependencies["@cortexmemory/sdk"]?.directory;
  if (!sdk || !existsSync(join(sdk, "dist/backend/v1/manifest.json"))) fail("SDK_BUILD_REQUIRED");
  const sdkArtifacts = {};
  function bind(directory) {
    for (const entry of readdirSync(join(sdk, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) bind(file);
      else if (entry.isFile()) sdkArtifacts[file] = hash(join(sdk, file));
      else fail("SDK_DIST_UNSAFE");
    }
  }
  bind("dist");
  return { version: 1, source: "Current built SDK and CLI-resolved dependency edges; read-only links, no registry install or copied history.",
    sdkManifestSHA256: hash(join(sdk, "package.json")), sdkArtifacts, generated: {}, dependencies };
}

export function checksumFor(text, filename) {
  const rows = text.split("\n").filter(line => line.trim().split(/\s+/).at(-1)?.replace(/^\*/, "") === filename);
  if (rows.length !== 1 || !/^[a-f0-9]{64}\s+\*?[^\s]+$/.test(rows[0])) fail("CHECKSUM_INVALID");
  return rows[0].slice(0, 64);
}

async function download(url, destination, maxBytes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let fd;
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "error" });
    if (!response.ok || Number(response.headers.get("content-length")) > maxBytes) fail("DOWNLOAD_FAILED");
    fd = openSync(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > maxBytes) fail("DOWNLOAD_TOO_LARGE");
      writeFileSync(fd, chunk);
    }
  } finally { clearTimeout(timer); if (fd !== undefined) closeSync(fd); }
}

/** Official, checksum-verified real runtimes are used only for early-refusal negatives. */
async function officialNode(directory, version) {
  if (!["linux", "darwin"].includes(process.platform) || !["x64", "arm64"].includes(process.arch)) fail("PLATFORM_UNSUPPORTED");
  const name = `node-v${version}-${process.platform}-${process.arch}`;
  const filename = `${name}.tar.xz`;
  const origin = `https://nodejs.org/dist/v${version}/`;
  const checksums = join(directory, `${name}-SHASUMS256.txt`), archive = join(directory, filename);
  await download(`${origin}SHASUMS256.txt`, checksums, 256 * 1024);
  const expected = checksumFor(readFileSync(checksums, "utf8"), filename);
  await download(`${origin}${filename}`, archive, 80 * 1024 * 1024);
  if (hash(archive) !== expected) fail("ARCHIVE_CHECKSUM_MISMATCH");
  const destination = join(directory, name);
  mkdirSync(destination, { mode: 0o700 });
  // Extract exactly the verified binary. No archive links, npm files, or arbitrary members.
  const extracted = spawnSync("tar", ["-xJf", archive, "--directory", destination, "--strip-components=1", `${name}/bin/node`],
    { encoding: "utf8", timeout: 30000, maxBuffer: 4096, env: childEnv() });
  if (extracted.error || extracted.signal || extracted.status !== 0) fail("ARCHIVE_EXTRACTION_FAILED");
  const node = join(destination, "bin/node");
  return { path: node, ...probe(node, version), archiveSHA256: expected, checksumURL: `${origin}SHASUMS256.txt`, archiveURL: `${origin}${filename}` };
}

function newDirectory(directory, root) {
  if (!isAbsolute(directory) || resolve(directory) !== directory || /[\r\n\0]/.test(directory)
    || directory === root || directory.startsWith(`${root}${sep}`)) fail("OUTPUT_DIRECTORY_INVALID");
  physicalDirectory(dirname(directory));
  // lstat also refuses a dangling symlink, unlike existsSync.
  try { lstatSync(directory); fail("OUTPUT_ALREADY_EXISTS"); } catch (error) { if (error.code !== "ENOENT") throw error; }
}

export function cleanupCommandFixtures(directory) {
  if (!isAbsolute(directory) || resolve(directory) !== directory || /[\r\n\0]/.test(directory)) fail("CLEANUP_DIRECTORY_INVALID");
  try { lstatSync(directory); } catch (error) { if (error.code === "ENOENT") return { status: "ALREADY_ABSENT" }; throw error; }
  const stat = physicalDirectory(directory);
  const marker = join(directory, "owner.json");
  physicalFile(marker);
  const owner = json(marker);
  if ((stat.mode & 0o077) || (process.getuid && stat.uid !== process.getuid()) || owner.purpose !== purpose
    || owner.directory !== directory || owner.uid !== stat.uid || owner.ino !== stat.ino || owner.dev !== stat.dev) fail("CLEANUP_NOT_OWNED");
  rmSync(directory, { recursive: true, force: false });
  return { status: "OWNED_FIXTURES_REMOVED" };
}

export async function prepareCommandFixtures({ directory, root = repository, npmRoot = npmRootFromPath(),
  minimum = realpathSync(process.execPath), node20Paths, envFile }) {
  newDirectory(directory, root);
  physicalDirectory(npmRoot);
  const npm = json(join(npmRoot, "package.json"));
  if (npm.name !== "npm" || npm.version !== "12.2.0") fail("NPM_12_2_REQUIRED");
  const minimumProof = probe(minimum, "24.15.0");
  const binding = dependencyBinding(root, npmRoot);
  if (node20Paths) for (const version of ["20.0.0", "20.20.2"]) probe(node20Paths[version], version);
  if (envFile) {
    const stat = physicalFile(envFile);
    if (stat.nlink !== 1 || (process.getuid && stat.uid !== process.getuid())) fail("ENV_FILE_UNSAFE");
  }
  mkdirSync(directory, { mode: 0o700 });
  const stat = lstatSync(directory);
  writeFileSync(join(directory, "owner.json"), JSON.stringify({ purpose, directory, uid: stat.uid, ino: stat.ino, dev: stat.dev }), { mode: 0o600, flag: "wx" });
  try {
    const dependencies = join(directory, "dependencies");
    mkdirSync(dependencies, { mode: 0o700 });
    for (const [name, selected] of Object.entries(binding.dependencies)) {
      const target = join(dependencies, name);
      mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
      symlinkSync(selected.directory, target, "dir");
    }
    const bindingPath = join(directory, "dependency-binding.json");
    writeFileSync(bindingPath, JSON.stringify(binding, null, 2), { mode: 0o600, flag: "wx" });
    const guard = join(directory, "runtime-guard.cjs");
    copyFileSync(join(dirname(fileURLToPath(import.meta.url)), "command-runtime-guard.cjs"), guard, constants.COPYFILE_EXCL);
    const nodes = {};
    for (const version of ["20.0.0", "20.20.2"]) {
      nodes[version] = node20Paths ? { path: node20Paths[version], ...probe(node20Paths[version], version), source: "Explicit verified existing binary" }
        : await officialNode(directory, version);
    }
    const environment = { CORTEX_BOOTSTRAP_NPM_ROOT: npmRoot, CORTEX_BOOTSTRAP_DEPENDENCY_ROOT: dependencies,
      CORTEX_BOOTSTRAP_DEPENDENCY_BINDING: bindingPath, CORTEX_RUNTIME_GUARD: guard,
      CORTEX_RUNTIME_NODE_MINIMUM: minimum, CORTEX_RUNTIME_NODE20_0: nodes["20.0.0"].path, CORTEX_RUNTIME_NODE20_20: nodes["20.20.2"].path };
    if (Object.values(environment).some(value => /[\r\n\0]/.test(value))) fail("ENV_VALUE_INVALID");
    const receipt = { status: "OFFLINE_COMMAND_INPUTS_READY", directory, environment,
      npmVersion: npm.version, minimum: minimumProof, negatives: nodes, guardSHA256: hash(guard),
      dependencyBindingSHA256: hash(bindingPath), sdkArtifactCount: Object.keys(binding.sdkArtifacts).length,
      serviceOperations: 0, installs: 0, privateCredentialsExported: false };
    writeFileSync(join(directory, "receipt.json"), JSON.stringify(receipt, null, 2), { mode: 0o600, flag: "wx" });
    if (envFile) {
      const fd = openSync(envFile, constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW);
      try { writeFileSync(fd, Object.entries(environment).map(([name, value]) => `${name}=${value}\n`).join("")); }
      finally { closeSync(fd); }
    }
    return receipt;
  } catch (error) { cleanupCommandFixtures(directory); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, ...args] = process.argv.slice(2), options = {};
    for (let index = 0; index < args.length; index += 2) {
      if (!["--directory", "--env-file", "--node20-0", "--node20-20"].includes(args[index]) || !args[index + 1] || options[args[index]]) fail("ARGUMENTS_INVALID");
      options[args[index]] = args[index + 1];
    }
    if (!options["--directory"] || !["prepare", "cleanup"].includes(command)
      || (command === "cleanup" && Object.keys(options).length !== 1)
      || (command === "prepare" && (!options["--env-file"] || Boolean(options["--node20-0"]) !== Boolean(options["--node20-20"])))) fail("ARGUMENTS_INVALID");
    const result = command === "cleanup" ? cleanupCommandFixtures(options["--directory"])
      : await prepareCommandFixtures({ directory: options["--directory"], envFile: options["--env-file"],
        ...(options["--node20-0"] ? { node20Paths: { "20.0.0": options["--node20-0"], "20.20.2": options["--node20-20"] } } : {}) });
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message?.startsWith("COMMAND_FIXTURE_") ? error.message : "COMMAND_FIXTURE_PREPARATION_FAILED"); process.exitCode = 1; }
}
