# Native transcript parity fixture repair

The sparse functional-CI checkout excludes `_goals/`; the parity test imported its historical control from that excluded tree. The test now imports a portable fixture under `tests/fixtures/runtimeAgent/`. Its assertions, current-handler imports, rollback checks, original-handler invocations, six security negatives, exact read counts (32→9 and 16→3), and admission/checkpoint comparison are unchanged.

Sources were read with `git show` from commit `8b1ab46051a884e653e34ea26afd473bfabab825`, without materializing the historical QA tree. The complete historical fixture closure is the Agent control and its original Transcript companion. The existing Agent `.d.mts` declaration was also relocated; it preserves the full `typeof runtime` contract. All other local imports resolve to maintained `convex-dev/` or `src/` modules; no additional historical fixture or declaration is required.

The import transformation replaces `../../../../` with `../../../` in root-relative import/export specifiers: 30 Agent imports, 13 Transcript imports, one declaration export. Three non-executable next-line ESLint `no-constant-condition` comments explain intentionally preserved historical loops: Agent source line 1433; Transcript source lines 399 and 751. The Agent's local import of the original Transcript companion is unchanged. Reconstruction first strips only the exact three added comment lines recorded in provenance, checking their occurrence counts, then reverses the import rewrites; this reproduces all three original Git blobs byte-for-byte. No executable source body was regenerated or edited. `native-transcript-read-provenance.json` records exact comments, original paths, Git blobs, byte sizes, before/after hashes and the original historical transformation record.

| Fixture | Original SHA-256 | Relocated SHA-256 |
|---|---|---|
| `native-transcript-read-original-runtimeAgent.mjs` | `b04c564a703b107dcdc06feadfe144e48d8ddfa7abbc4a8d563db3a4caa5d3c4` | `a45ea9c85f208ec21e52c25196fadfd4a8d572291cbf2afd7c06bc5ade7fe247` |
| `native-transcript-read-original-runtimeTranscript.mjs` | `f2cb04c18ae697c91196a8ea9588d29f33ba10c8157c2d4de28da4c91228fd6a` | `6b2826fa955b6d1206c5619f26d2bc8decbd6d57ba9ed9afcdda0d9db4f895df` |
| `native-transcript-read-original-runtimeAgent.d.mts` | `37708bb1da6288528cd80928807283ecf884e3ecd0fe331413083c669d9ded70` | `d58057fcebd57530f2691b3f29e51c765f5fb2f1d491f5bbfabdd7baafdb3fef` |

Observed repair-agent checks: exact-comment-stripping plus inverse-import byte comparison for each source/declaration; all 52 direct control imports resolved to package, maintained module or original companion; both `node --check` fixture commands; `git diff --check`. All succeeded. The test diff is exactly one import specifier.

Coordinator-reported checks before the comment-only follow-up: full `npx --no-install tsc --noEmit` passed; focused offline parity suite passed 9/9 with natural exit. Full lint identified exactly the three frozen constant-loop conditions addressed by these scoped annotations. Root owns the lint rerun and full controlled offline-unit run; this repair agent did not run dependency-dependent checks.

No product source, manifests, pipelines, lockfiles, package versions, historical audit or original continuation checkout was changed. No Git mutations, installs, services, model calls or deployments were performed.
