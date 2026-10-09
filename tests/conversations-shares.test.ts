/** Public transcript shares remain deliberately unavailable in currentdev 9b811b04d.
 * Historical success catalog: _DEPRECATED/tests/legacy-transcript/conversations-shares.test.ts.txt. */
import { unavailableTranscriptContract } from "./helpers/unavailable-transcript";

describe("Public conversation share safety closure", () => {
  unavailableTranscriptContract("conversationShares", [
    ["create", "mutation", { conversationId: "foreign-conversation", grantedBy: "caller-label", grantType: "link", permissions: { canView: true, canViewFacts: true, canViewMemories: true, canContinue: true, canFork: true, canExport: true } }],
    ["revoke", "mutation", { shareId: "foreign-share", userId: "caller-label" }],
    ["get", "query", { shareId: "foreign-share" }],
    ["listByConversation", "query", { conversationId: "foreign-conversation" }],
    ["listByGranter", "query", { grantedBy: "caller-label" }],
    ["checkAccess", "query", { conversationId: "foreign-conversation", userId: "caller-label" }],
  ]);
});
