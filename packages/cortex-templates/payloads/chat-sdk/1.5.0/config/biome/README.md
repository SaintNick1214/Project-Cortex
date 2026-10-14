# Biome presets

These files are the unmodified core, Next.js and React Biome presets from
[Ultracite 7.12.4](https://www.ultracite.ai/changelog/ultracite-7-12-4),
under the accompanying MIT license. They retain the current rules while the
Chat scaffold runs its pinned Biome 2.5.15 directly. The unused Ultracite
scaffolding CLI pulled in fast-glob/find-workspaces/micromatch/braces, which
has an unpatched resource-exhaustion advisory.

To refresh these presets, inspect the chosen Ultracite npm archive and copy
`config/biome/{core,next,react}/biome.jsonc` plus its license. Review the rule
changes and run the scaffold lint checks before updating.
