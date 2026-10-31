# Cortex sandbox region capabilities

One authorized GET /teams/325340/list_deployment_regions returned HTTP200 at 2026-10-14T16:08:29.421Z. Only public region capability fields were retained.

| Region | Display name | Available |
|---|---|---|
| aws-ap-southeast-2 | Asia Pacific (Sydney) | true |
| aws-ca-central-1 | Canada (Central) | true |
| aws-eu-west-1 | Europe (Ireland) | true |
| aws-us-east-1 | US East (N. Virginia) | true |

A new nondefault dev deployment in existing project3200658 can choose any available returned region; no new project or project-region migration is required. Convex1.46 [deployment creation](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/convex/src/cli/deploymentCreate.ts:182) sends an explicit per-deployment region. The us alias selects aws-us-east-1; eu selects aws-eu-west-1. The actual response also enables Canada Central and Sydney; the CLI resolves available full names dynamically. Its older generated RegionName enum lists only US/EU. No West-US region was returned.

The current sandbox runner sends region:null, has no configured region option and omits region from saved target metadata. This response contains no default indicator. Team default and the destroyed K23 deployment's actual region remain **UNAVAILABLE**; neither is inferred from availability or the earlier project GET.

The installed CLI obtains TeamResponse.defaultRegion through GET /teams then selects the team by ID ([source](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/convex/src/cli/deploymentCreate.ts:546), [schema](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/convex/src/cli/generatedApi.ts:477)). That broader endpoint was **not fetched**. Explicit available US selection for the next disposable deployment avoids depending on an unknown default.

Contract: [region option](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/convex/src/cli/deploymentCreate.ts:69), [team-default fallback](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/convex/src/cli/deploymentCreate.ts:430), [availability GET/filter](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/convex/src/cli/deploymentCreate.ts:783). The installed CLI typed consumer establishes items[].name/displayName/available; its external Management API declaration is not shipped here, so no broader response schema is asserted.

A local Markdown-template SyntaxError occurred before any request; it was corrected before the one actual GET. No mutation, deployment creation, inference, other-team/project request or product edit occurred. This is capability evidence, not native latency acceptance.
