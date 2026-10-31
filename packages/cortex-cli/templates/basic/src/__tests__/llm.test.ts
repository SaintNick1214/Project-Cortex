/** The former local-LLM path is intentionally replaced by the same remote run contract. */
import { it, expect } from "vitest";
import { inferenceOwner } from "../llm.js";
import { chat } from "../chat.js";
import { runtimeMock, config } from "./helpers/test-utils.js";
it("backend inference is required: there is no OpenAI key or echo fallback", async () => {
  const f = runtimeMock(); f.client.submitAndStart.mockRejectedValue(new Error("CAPABILITY_UNAVAILABLE"));
  await expect(chat(f.client, config, { requestId: "key", message: "text" })).rejects.toThrow("CAPABILITY_UNAVAILABLE");
  expect(inferenceOwner).toBe("registered-backend"); expect(f.client.submitAndStart).toHaveBeenCalledOnce(); expect(f.client.get).not.toHaveBeenCalled();
});
