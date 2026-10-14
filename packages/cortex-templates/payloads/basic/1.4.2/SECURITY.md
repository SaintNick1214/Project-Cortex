# Basic chat input limits

The HTTP `/chat` endpoint counts streamed bytes before parsing JSON and accepts
at most64KiB. It forwards only a nonempty `message` string of at most16384 UTF-16
code units and an optional nonempty `conversationId` string of at most256 code
units. Arrays, objects in those fields, and unknown fields are rejected before
SDK calls or conversation-ID generation. Same-origin admission remains required.

[SNYK-JS-ZOD-20510278](https://security.snyk.io/vuln/SNYK-JS-ZOD-20510278)
describes excessive validation-issue accumulation from large failing arrays.
There is no upstream patched release. Real HTTP regression tests include arrays
below the byte cap and chunked oversized requests; these inputs never reach the
SDK through `/chat`.

The adjacent `.snyk` policy records a reviewed temporary mitigation for only this
Basic manifest's `@convex-dev/ai-sdk-provider@0.2.1 > zod@4.6.5` path, expiring
2026-11-07. Keep scanning active and remove the exception when a fixed dependency
is available. Renewing it requires a fresh review of the deployed boundary.

Zod remains installed. This policy does not certify direct SDK callers, backend
or gateway policy inputs, model responses, other applications, or other Zod
dependency paths. Callers exposing additional inputs must establish their own
input limits; this endpoint mitigation does not cover them.
