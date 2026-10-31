Cortex-owned generated schema now explicitly references the already-required Node declarations. Existing host tsconfig bytes remain unchanged, including the official Convex default and custom types:[] configs.

Before repair, three full-runtime compiler regressions each reproduced41 TS2591 diagnostics. Final full-runtime file8/8 PASS with all156 current manifest sources included, unchanged host config/convex.json/sentinel bytes and bad registered function rejection in every case. Three unchanged affected suites91/91 also PASS (99 unique affected assertions by scoped successor applicability); CLI types, final scoped lint, generator lint and syntax PASS. Intermediate census/lint setup failures remain raw evidence.

No service, codegen, credential, Git, catalog or root distribution effects. Typed bindings/official template reuse is explicitly offline. Root will regenerate/package and run genuine Linux enabled-codegen CI with the same coherent independent reviewer.
