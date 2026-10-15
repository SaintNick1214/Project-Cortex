The final read-only collector now accepts a selected `unapprovedTool:"memory_remember"` plus exact `operationId`, with `purpose:"tool"` and `expectedResponseStatus:"cancelled"`. It derives the conversation from the selected native run; it requires one exact pending/cancelled tool identity, zero approval/result/native tool message/tool-owned source effect across that actual conversation, model0 only/no final assistant output, and ordinary input memory complete. Existing canonical/currentness/facts/vector/usage/finance/watermark/stability checks remain. The input-preapproval flag is rejected for this case.

Actual supplied selection:

```json
{
  "runId": "run:cea154028760db96676a614d9beebc947499c9da6306d4fc4c9c11afb6e8691e",
  "label": "tool-write-cancelled",
  "purpose": "tool",
  "expectedResponseStatus": "cancelled",
  "unapprovedTool": "memory_remember",
  "operationId": "agent-op:e3169c5bfdb034816b1102c06d3a060a7fc3cd9cb3cb1acabaa9f5a2d6d5ac57"
}
```

Node24.15 syntax and inert preflight PASS. Live readback NOT_RUN by this agent. Helper SHA256 `23d47199b54f76cb3a12c9ec9c9234fad1405b0f3a86f5ca22d02c6005ed71a3` (before `fc02f2cf3414313c312a72055e539659537b0777de9bd8f991e034aeb5757bae`). No services/models/private/Proofs/product/Git/tests.

Cancel-only collector remains FAILED_STOPPED_NO_RESUBMISSION / ORIGINAL_DEADLINE. Pending arrived at 29268.266ms, last state waiting_approval / memory complete. Remaining 731.734ms included the 206.162ms fresh identity guard. The single cancel began at 29474.478ms with 525.522ms remaining; its timed await expired after 526.092ms. Terminal response verification and admin native inspection were never reached. All clients closed. There were28 observations,27 pauses (2750.844ms total), 24886.577ms inside observation awaits, four identity verifications and8 management GETs total. Initial setup/pre-case checks stay outside the case deadline; the two per-mutation guards stay inside it. These local durations do not isolate server scheduling/model/DB/network work.

The cancellation RPC was attempted exactly once; the timed await does not establish ACK or final state. Root native final readback determines final cancelled state and zero effects without another cancellation. Later functional proof cannot relabel the original30s failure.

The first readonly receipt coverage sentence saying two actual tool intents is static prospective boilerplate. Its `cases.length===1` and sole readonly run ID are authoritative. The later cancel-only receipt contains one different write intent; both original collector failures remain intact.
