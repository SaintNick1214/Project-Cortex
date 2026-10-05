---
name: project-bootstrap-orchestrator
description: Scaffold a new project and install a populated Codex orchestration suite when the user requests new-project setup. Existing Cortex work uses its current profile.
---

# Project Bootstrap Orchestrator

Read `.agents/CODEX-RUNTIME.md`. This is a greenfield workflow; never scaffold or
reinitialize an existing Cortex repository merely because this skill is installed.

1. Extract vision, users, product type, stage, stack, data/UI architecture, tooling,
   target directory, requirements clarity, and interaction preferences. Reuse known
   answers and ask only consequential unknowns. Confirm a destination only if ambiguous.
2. Inspect the destination for conflicts. Create a new directory and initialize Git
   only within the requested new project. Use explicit working directories; shell
   creation replaces editor-specific project/move-agent APIs. Do not create a new Codex
   chat unless explicitly requested. Never configure Git identity or push automatically.
3. Use the selected ecosystem scaffolder or a minimal manual scaffold. Add appropriate
   ignore rules and README, license only when selected, and required build/test tooling.
   Run the actual starter checks and retain receipts. Commit only when requested.
4. Locate the installed suite via this skill's real path and copy its `.agents/` support
   files and skills into the new repo without clobbering existing files. The original
   generalized blueprint path in Cortex's profile is provenance, not a Windows default.
   Populate a NEW profile from the new repo and verified commands; do not reuse Cortex's
   stacks, module validators, credentials, or sibling paths as the new project's facts.
   Retain only relevant validators; set §8/§9 N/A when genuinely inapplicable.
5. Populate all profile sections: identity; stacks; ordered layers; commands; exemplars;
   references; artifacts; UI setup; module gate; workflow conventions. Mark actual
   unknowns explicitly without claiming command verification. Add AGENTS.md routing
   appropriate to the requested setup; preserve existing instructions.
6. Delegate a fresh read-only pessimistic judge to verify profile completeness,
   command receipts, architecture/stack fidelity, import references, discovery coverage,
   and routing readiness. Verdict PASS / NEEDS FIXES / REJECT. Fix and rejudge up to three
   cycles. Only PASS permits a successful bootstrap claim or execution handoff.
7. Route clear build requirements to feature-orchestrator, unresolved approach/stack
   questions to deep-research-orchestrator. Carry discovery forward. Continue only within
   the user's requested scope; an installation-only request ends after setup verification.

Report the destination, scaffold, installed artifacts, judge verdict, actual checks,
and any blockers. Missing toolchain or failed validation remains incomplete.
