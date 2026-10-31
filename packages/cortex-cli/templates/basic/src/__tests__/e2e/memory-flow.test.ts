import { it, expect } from "vitest";
import { installed } from "../helpers/e2e.js";
it("the installed runtime resumes the already-owned completed run and canonical history without paid repetition", async () => {
  await installed(async (client, runId) => {
    const handle = await client.attach(runId), run = await client.get(handle);
    expect(run.responseStatus).toBe("complete"); expect(run.outputMessageIds.length).toBeGreaterThan(0);
    const observation = await client.observe(handle, { finalOnly: true });
    expect(observation.run.runId).toBe(runId); expect(observation.state).toBe("complete");
    expect(observation.parts.some(item => item.part.type === "text")).toBe(true);
    const history = await client.messages(handle.conversationId);
    expect(history.page.some(item => item.role === "assistant")).toBe(true);
    expect((await client.get(handle)).attemptNumber).toBe(run.attemptNumber);
  });
});
