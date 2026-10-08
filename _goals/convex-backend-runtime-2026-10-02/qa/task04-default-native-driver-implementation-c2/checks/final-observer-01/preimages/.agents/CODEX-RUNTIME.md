# Codex runtime adapter

## Resolve the installation and target

This file, `PROJECT-PROFILE.md`, `roles/`, and `skills/` share one `.agents/` directory.
Resolve the active skill file's real path (including symlinks), then use its ancestor
`.agents/` directory as the orchestration root. The parent of that directory is the
profile root. For this installation it is the `Project-Cortex` Git repository.
References beginning `.agents/` are relative to the profile root, even when the current
working directory is the surrounding Cortex workspace. Other paths in the profile are
relative to the profile root unless explicitly stated otherwise. Pass absolute paths
and explicit working directories to subagents and shell calls.

Check the actual target repository's `AGENTS.md`, manifests, and Git status before work.
The surrounding Cortex directory contains independent repositories. Do not run one
repo's checks in another, infer a shared Git root, or initialize Git in the workspace.
The source blueprint is reference material; its examples do not authorize new work.

## Native delegation

When an installed orchestration workflow calls for delegated execution or review, use
Codex's available subagent tools. In this desktop runtime these are
`collaboration.spawn_agent`, `send_message`, `followup_task`, `wait_agent`, and
`interrupt_agent`. Call them directly, outside `functions.exec`.
There is no Cursor Task tool or special generalPurpose/browser-use type.
Role Markdown files are prompts to read, not registered tool types.

Give each child a bounded task, absolute target paths, the original requirements,
relevant role and rubric paths, permitted writes, prerequisites, and evidence expected.
For fresh judgment use `fork_turns="none"` and provide minimum raw context, rather than
inheriting the implementer's conclusions. Keep the user's configured model; do not set
model or reasoning overrides without authorization. Judges inspect but do not edit.
Wait for the child's final result and inspect outputs before recording a verdict.
A sent message or spawn acknowledgment is not completion.

The current runtime supports four concurrent agents including the coordinator; leave
space for review. Serialize dependent edits and writes to overlapping files. All agents
share the filesystem; use native worktree support only when isolation is warranted.
Do not create user-owned chats for internal subtasks. Do not message other chats unless
the human explicitly authorized it. Use the runtime's actual tool schemas if names differ.
If native delegation is unavailable, report an incomplete independent-review gate;
do not invent tools or label self-review as independent judgment.

Retry a genuinely transient invocation failure up to three total attempts with brief
backoff. Do not retry permission, missing-tool, or invalid-schema failures unchanged.
Limit fix-and-judge loops to three cycles. A failed or REJECT verdict never becomes a
PASS by exhausting retries. Report the unresolved issue and continue only independent,
authorized work; ask for input only when it is necessary to resolve the blocker.

## Questions and autonomy

Follow Profile §10 and the user's current instructions. Prefer available asynchronous
user-input tools for missing requirements while progressing on independent work.
Ask only questions whose answers materially change scope or behavior. Do not impose a
question count or an extra confirmation for work the user already requested.
For routine reversible decisions, choose the smallest change consistent with the code
and record the reason. Required answers and permissions remain pending until received.
Skill instructions do not change the conversation's collaboration mode.

## Browser QA

Use available native browser/computer-use tools and their returned documentation.
In this desktop runtime use `mcp__cua_repl.js` with the documented `cua` API; initialize
with exactly one entry-point call before additional interaction. Read its documentation
before using browser APIs. Never invent Cursor browser_* tools, special browser agent
types, or screenshots/console/network evidence that the tools did not provide.
Serialize work on the same browser tab or app. A judge can review saved evidence while
another task runs only when they do not share a mutable browser session.
Record unavailable evidence explicitly; if it is required for the gate, mark that gate
incomplete. Live QA writes require a verified disposable test environment and cleanup.

## Scope, checks, and evidence

Profile §4 defines selectable check sets. Select affected stacks plus dependency checks
for normal work; a requested full core gate selects all core sets. A docs/config-only
installation needs skill/reference/manifest validation, not application test execution.
Do not add tests that only mirror reversible low-impact edits. For behavior changes,
map requirements to outcome assertions and meaningful regression tests; a separate
per-layer test task is optional. Apply these rules when older rubric text says every
layer needs a test task or every public function needs an error test.

A check's result is PASS only after an observed successful execution. Missing services,
credentials, tools, unsafe targets, or unexecuted required checks are BLOCKED/incomplete,
never success. Keep pre-existing failures separate from failures introduced by the task.
Inspect skipped tests and test discovery as well as exit codes. A zero-test run or skipped
required graph/LLM/integration coverage cannot certify that behavior, even with exit 0.
Do not repair unrelated code just to obtain a green suite. After a fix, rerun the failed
check and independent judge gate. Do not broaden passing checks without a new reason.
Preserve dirty work, never print secret values, and honor the user's commit/publish scope.
