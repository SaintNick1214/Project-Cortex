import {} from "ai";
import { embedMessages, getPromptArray } from "./search.js";
import { saveMessages } from "./messages.js";
import { assert } from "convex-helpers";
export async function saveInputMessages(ctx, component, { threadId, userId, prompt, messages, ...args }) {
    const shouldSave = args.storageOptions?.saveMessages ?? "promptAndOutput";
    // If only a promptMessageId is provided, this will be empty.
    const promptArray = getPromptArray(prompt);
    const toSave = [];
    if (args.promptMessageId) {
        // We don't save any inputs if a promptMessageId is provided.
        // It's unclear where they'd want to save the new messages.
    }
    else if (shouldSave === "all") {
        if (messages)
            toSave.push(...messages);
        toSave.push(...promptArray);
    }
    else {
        if (promptArray.length) {
            // We treat the whole promptArray as the prompt message to save.
            toSave.push(...promptArray);
        }
        else if (messages) {
            // Otherwise, treat the last message as the prompt message to save.
            toSave.push(...messages.slice(-1));
        }
    }
    let embeddings;
    if ((args.embeddingModel ?? args.textEmbeddingModel) && toSave.length) {
        assert("runAction" in ctx, "You must be in an action context to generate embeddings");
        embeddings = await embedMessages(ctx, { ...args, userId: userId ?? undefined, threadId }, toSave);
        if (embeddings) {
            // for the pending message
            embeddings.vectors.push(null);
        }
    }
    const saved = await saveMessages(ctx, component, {
        threadId,
        userId,
        messages: [...toSave, { role: "assistant", content: [] }],
        metadata: [
            ...Array.from({ length: toSave.length }, () => ({})),
            { status: "pending" },
        ],
        failPendingSteps: !!args.promptMessageId,
        promptMessageId: args.promptMessageId,
        embeddings,
    });
    return {
        promptMessageId: toSave.length
            ? saved.messages.at(-2)._id
            : args.promptMessageId,
        pendingMessage: saved.messages.at(-1),
        savedMessages: saved.messages.slice(0, -1),
    };
}
//# sourceMappingURL=saveInputMessages.js.map