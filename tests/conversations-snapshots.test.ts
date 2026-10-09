/** Public transcript snapshots remain deliberately unavailable in currentdev 9b811b04d.
 * Historical success catalog: _DEPRECATED/tests/legacy-transcript/conversations-snapshots.test.ts.txt. */
import { unavailableTranscriptContract } from "./helpers/unavailable-transcript";

describe("Public conversation snapshot safety closure", () => {
  unavailableTranscriptContract("conversationSnapshots", [
    ["create", "mutation", { conversationId: "foreign-conversation", createdBy: "caller-label", redactPII: true }],
    ["deleteSnapshot", "mutation", { snapshotId: "foreign-snapshot", userId: "caller-label" }],
    ["get", "query", { snapshotId: "foreign-snapshot" }],
    ["listByConversation", "query", { conversationId: "foreign-conversation" }],
    ["listByUser", "query", { userId: "caller-label" }],
  ]);
});
