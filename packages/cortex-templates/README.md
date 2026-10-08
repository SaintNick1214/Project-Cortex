# Cortex template catalog

`@cortexmemory/templates` is a data-only package. Catalog releases and application
payload versions are independent of CLI/SDK releases. Consumers read `catalog.json`
and `payloads/<template-id>/<template-version>/`; no application, SDK, provider,
framework, graph or CLI dependency executes when reading this package.

The release script deliberately selects the three reviewed canonical sources. Run
`npm run assemble` to replace only this package's owned catalog/payload outputs, or
`node scripts/assemble-canonical.mjs /absolute/new-output` to stage a new package.
Neither CLI build nor any package lifecycle runs assembly. The lower-level assembler
also accepts an explicit JSON configuration and a new output directory:

```sh
node scripts/assemble.mjs /absolute/release-inputs.json /absolute/new-output
```

Configuration is `{ "catalogVersion": "1.0.0", "templates": [...] }`. Each selection
declares `id` (`basic`, `vercel-ai-quickstart` or `chat-sdk`), `version`, absolute
`source`, portable `provenance`, `manager` (`npm` or `pnpm`), `envNames`, optional
`envExamples`, and boolean `backend`/`graph`. The manifest version must match the
selection. SDK/provider dependencies become release-default `^0.37.0`; other
manifest fields and source files retain their values. Proof candidate overrides
belong to the CLI installer, never this catalog.

Assembly sorts paths, templates and declared environment names, normalizes the root
manifest, records SHA256 of actual output bytes, and uses the CLI's payload hash rule.
`assembly.json` additionally records selected original file hashes and transformations;
it is not a published package member. There are no timestamps or absolute source paths
in catalog/provenance receipts. Payload execution modes are normalized to 0644/0755.

Dependencies, locks, generated code, builds/caches, logs and local state are excluded.
All `.env*` files are omitted unless explicitly listed credential-free `.env.example`,
`.env.sample`, `.env.local.example` or `.env.local.sample` documentation. The release
owner must review those opt-in examples as credential-free; assembly never reads real
environment files or discovers host credentials. Included symlinks/hardlinks, portable
path collisions and nonregular files are refused. Every source is fully validated
before creating the output; existing output directories are refused.

Canonical Basic/Vercel/Chat assembly follows the accepted Task13 source handoff.
The emitted directory includes a lifecycle-free package manifest and can be packed
independently with ordinary `npm pack`. CLI builds do not invoke either assembler.

Development checks: `npm test`, `npm run typecheck`, `npm run lint`. These use Node
built-ins and existing workspace development tools; the package has no runtime
dependencies. Complete CLI installation, graph setup, updates and current app/native
coverage belong to Task12 integration and subsequent packaged validation.

For npm-sensitive `.gitignore`, `.npmignore` and `next-env.d.ts` members, optional
`storagePath` names `__catalog_files/<content-sha256>.bin` inside that template's
payload directory. The catalog retains the original canonical `path`, exact bytes,
hash and mode. The CLI validates this fixed mapping before rendering the original
file; ordinary path entries remain compatible. This keeps npm's ignore rules from
silently removing required source files from a normal catalog pack.
