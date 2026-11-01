import { generateText, streamText } from "ai";
import { describe, expect, it } from "vitest";
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from "@/lib/ai/models.mock";

// Exercise fixture protocol through the actual installed AI SDK, including finish/usage conversion.
describe("AI SDK 7 model fixtures", () => {
  it.each([
    ["chat", chatModel],
    ["reasoning", reasoningModel],
    ["title", titleModel],
    ["artifact", artifactModel],
  ] as const)(
    "%s generation and streaming preserve the current model protocol",
    async (_name, model) => {
      expect(model.specificationVersion).toBe("v4");
      const generated = await generateText({ model, prompt: "Hello" });
      expect(generated.text.length).toBeGreaterThan(0);
      expect(generated.finishReason).toBe("stop");
      expect(generated.usage.totalTokens).toBeGreaterThan(0);
      const streamed = streamText({ model, prompt: "Hello" });
      await streamed.consumeStream();
      expect((await streamed.text).length).toBeGreaterThan(0);
      expect(await streamed.finishReason).toBe("stop");
      expect((await streamed.usage).totalTokens).toBeGreaterThan(0);
      if (model === reasoningModel) {
        expect(generated.reasoningText).toContain("step by step");
        expect(await streamed.reasoningText).toContain("step by step");
      }
    }
  );
});
