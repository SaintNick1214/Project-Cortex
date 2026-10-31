import { it, expect } from "vitest";
import { hostToken, AppError } from "../../cortex.js";
import { installed } from "../helpers/e2e.js";
it("the separately running loopback application enforces caller JWT and resumes the same installed run", async () => {
  const url = new URL(process.env.API_URL ?? "http://127.0.0.1:3001");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new AppError("LOOPBACK_E2E_APP_REQUIRED");
  await installed(async (_client, runId) => {
    const denial = await fetch(new URL(`/runs/${encodeURIComponent(runId)}`, url), { signal: AbortSignal.timeout(10000) });
    expect(denial.status).toBe(401);
    const response = await fetch(new URL(`/runs/${encodeURIComponent(runId)}/observe?finalOnly=true`, url), { headers: { Authorization: `Bearer ${await hostToken()}` }, signal: AbortSignal.timeout(35000) });
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(await response.json()).toMatchObject({ run: { runId, responseStatus: "complete" } });
  });
});
