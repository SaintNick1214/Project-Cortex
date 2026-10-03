# Proposed one additional registry repair cycle — NOT APPLIED

The third fresh original46 review is FINAL REJECT3.2. All three allowed cycles
are exhausted. No registry product source, SDK consumer or schema is integrated.
The complete frozen candidate and independent raw evidence are preserved in
`task03b2b1/history/cycle3-final` on main and in the isolated candidate.

The remaining defect is the identity callback at `runtimeRegistryAuth.ts:108–109`.
The strict database reader rejects permission-looking infrastructure failures,
but `ctx.auth.getUserIdentity()` runs outside that boundary. Its thrown exact
FORBIDDEN envelope is mistaken for an ordinary initial optional READ denial.
Actual registered agents.update, memorySpaces.update and contexts.update each
return a successful receipt with one committed write in the synthetic fault probe.
The required36-case checker reaches all36 injections and exits1 with36 mismatches.
This is offline fault injection on the real callback seam, not a deployed exploit.

Proposed bounded source correction, only if an extra cycle is authorized:

```diff
- return await resolveAuthority(registryReader(ctx), await ctx.auth.getUserIdentity(), requirement);
+ return await resolveAuthority(registryReader(ctx), await controlRead(async () => await ctx.auth.getUserIdentity()), requirement);
```

Verify the exact source context before applying the patch. Keep the callback
property access, invocation and awaited rejection inside the strict boundary.
A returned null or valid identity still goes to the unchanged accepted resolver;
ordinary current grant denials and READ-less safe receipts retain their behavior.
Do not change runtimeAuth, schemas, capability policy, SDK, scope or exclusions.

Preserve all1,146 ordered original/current registry assertions, actual133 core
assertions, all prior archives and native46 registrations. Add the independent36
identity failures with required failed/rolled_back outcome and zero commitments,
and retain the independent138 database/READ-positive controls. Run meaningful
backend ES2021/scoped types/lint, native catalog, topology, admission, native-value,
revision/retirement and late-READ/final-delivery checks. Report actual root29/27
isolated integration diagnostics and downstream seams honestly. Then obtain a
fresh strict independent review of the entire same original46 contract.

Authorization would permit exactly one additional bounded implementation/judge
cycle. It would not turn the existing REJECT into PASS, reset history, weaken
assertions, authorize later retries, or approve broader Task03/full17 completion.

Required workflow conflict: `.agents/skills/feature-orchestrator/SKILL.md` states
“Maximum three implementation/judge cycles.” `.agents/CODEX-RUNTIME.md` states
“A failed or REJECT verdict never becomes a PASS by exhausting retries. Report
the unresolved issue and continue only independent, authorized work; ask for
input only when it is necessary to resolve the blocker.” Independent auth service
qualification continues while this consequential exception awaits a response.
