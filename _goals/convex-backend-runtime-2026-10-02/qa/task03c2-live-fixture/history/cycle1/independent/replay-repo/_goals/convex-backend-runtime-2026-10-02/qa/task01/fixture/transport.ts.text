import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

export type ResponseStatus = "queued" | "running" | "completed" | "cancelled" | "failed" | "uncertain";
export type TextSnapshot = { version: 1; runId: string; text: string; status: ResponseStatus };
export type RemoteTextRuns = {
  start(input: { version: 1; conversationId: string; clientRequestId: string; text: string }): Promise<string>;
  current(conversationId: string): Promise<string | null>;
  observe(runId: string, onSnapshot: (snapshot: TextSnapshot) => void): () => void;
  cancel(runId: string): Promise<void>;
};

export class CortexTextTransport implements ChatTransport<UIMessage> {
  constructor(private readonly remote: RemoteTextRuns) {}
  async sendMessages(options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]): Promise<ReadableStream<UIMessageChunk>> {
    if (options.trigger !== "submit-message") throw new Error("UNSUPPORTED_OPERATION: regeneration needs a distinct backend run");
    const input = options.messages.at(-1);
    if (!input || input.role !== "user") throw new Error("INVALID_INPUT: latest user message required");
    const text = input.parts.flatMap(part => part.type === "text" ? [part.text] : []).join("\n");
    if (!text) throw new Error("INVALID_INPUT: text required");
    const runId = await this.remote.start({ version: 1, conversationId: options.chatId, clientRequestId: input.id, text });
    return this.stream(runId, options.abortSignal);
  }
  async reconnectToStream(options: Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0]): Promise<ReadableStream<UIMessageChunk> | null> {
    const runId = await this.remote.current(options.chatId);
    return runId ? this.stream(runId, options.abortSignal) : null;
  }
  private stream(runId: string, signal?: AbortSignal): ReadableStream<UIMessageChunk> {
    let unsubscribe: (() => void) | undefined;
    let previous = "";
    let done = false;
    const remote = this.remote;
    const finish = () => { done = true; unsubscribe?.(); signal?.removeEventListener("abort", onAbort); };
    let onAbort: () => void = () => {};
    return new ReadableStream<UIMessageChunk>({
      start(controller) {
        onAbort = () => {
          if (done) return;
          controller.enqueue({ type: "abort", reason: "cancelled" });
          finish(); controller.close();
          void remote.cancel(runId).catch(() => {});
        };
        controller.enqueue({ type: "start", messageId: `assistant:${runId}` });
        controller.enqueue({ type: "text-start", id: `text:${runId}` });
        unsubscribe = remote.observe(runId, snapshot => {
          if (done) return;
          if (snapshot.version !== 1 || snapshot.runId !== runId || !snapshot.text.startsWith(previous)) {
            controller.enqueue({ type: "error", errorText: "PROTOCOL_CONFLICT" });
            finish(); controller.close(); return;
          }
          const delta = snapshot.text.slice(previous.length);
          if (delta) controller.enqueue({ type: "text-delta", id: `text:${runId}`, delta });
          previous = snapshot.text;
          if (["completed", "cancelled", "failed", "uncertain"].includes(snapshot.status)) {
            controller.enqueue({ type: "text-end", id: `text:${runId}` });
            if (snapshot.status === "cancelled") controller.enqueue({ type: "abort", reason: "cancelled" });
            else if (snapshot.status !== "completed") controller.enqueue({ type: "error", errorText: snapshot.status === "uncertain" ? "UNCERTAIN_OUTCOME" : "RUN_FAILED" });
            controller.enqueue({ type: "finish", finishReason: snapshot.status === "completed" ? "stop" : "other" });
            finish(); controller.close();
          }
        });
        if (done) unsubscribe();
        if (signal?.aborted) onAbort();
        else signal?.addEventListener("abort", onAbort, { once: true });
      },
      // Observer disconnect only detaches. Explicit AbortSignal is cancellation.
      cancel() { finish(); },
    });
  }
}
