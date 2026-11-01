import "server-only";
import { ConvexHttpClient } from "convex/browser";
import { ChatSDKError } from "./errors";
export const operations = [
  "app/chatUsers:credentialByEmail",
  "app/chatUsers:register",
  "app/chatUsers:createGuest",
  "app/chatData:messages",
  "app/chatData:message",
  "app/chatData:saveMessages",
  "app/chatData:updateMessage",
  "app/chatData:truncate",
  "app/chatData:branchEdited",
  "app/chatData:setTitle",
  "app/chatData:setVisibility",
  "app/chatData:votes",
  "app/chatData:vote",
  "app/chatData:suggestions",
  "app/chatData:saveSuggestions",
  "app/chatData:recordStream",
  "app/chatData:publicShare",
  "app/chatData:recallBranches",
  "app/chatData:documentVersions",
  "app/chatData:setDocumentVersions",
  "app/chatData:clearChat",
  "app/chatData:clearAllChats",
  "app/chatData:documentSelection",
  "app/chatData:selectDocumentVersion",
  "app/chatData:registerUpload",
  "app/chatData:verifyUploads",
  "app/chatData:listChats",
  "app/chatData:messageCount",
] as const;
export type PrivateOperation = (typeof operations)[number];
export function privateConfiguration() {
  const convexUrl = process.env.CONVEX_URL,
    deploymentKey = process.env.CORTEX_APP_DEPLOYMENT_ADMIN_KEY,
    tenantId = process.env.CORTEX_APP_TENANT_ID;
  if (!convexUrl || !deploymentKey?.trim() || !tenantId?.trim())
    throw new ChatSDKError(
      "offline:api",
      "Configure CONVEX_URL, CORTEX_APP_DEPLOYMENT_ADMIN_KEY and CORTEX_APP_TENANT_ID on the server",
    );
  let url: URL;
  try {
    url = new URL(convexUrl);
  } catch {
    throw new ChatSDKError("offline:api");
  }
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      ))
  )
    throw new ChatSDKError("offline:api");
  return { convexUrl, deploymentKey, tenantId };
}
export function initializePrivateTransport(client: unknown): undefined {
  const { deploymentKey } = privateConfiguration();
  if (
    !client ||
    typeof client !== "object" ||
    !("setAdminAuth" in client) ||
    typeof client.setAdminAuth !== "function"
  )
    throw new ChatSDKError(
      "offline:api",
      "Installed client lacks private deployment transport",
    );
  client.setAdminAuth(deploymentKey);
  return undefined;
}
type Capability = {
  setAdminAuth: (key: string) => void;
  function: (
    name: string,
    componentPath: undefined,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
};
export async function privateCall<T>(
  name: PrivateOperation,
  args: Record<string, unknown>,
): Promise<T> {
  if (!operations.includes(name)) throw new ChatSDKError("bad_request:api");
  const { convexUrl, deploymentKey } = privateConfiguration();
  const client = new ConvexHttpClient(convexUrl, {
    logger: false,
    fetch: (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
  });
  // The pinned native HTTP /api/function capability is server-only. No public ref cast.
  const capability = client as unknown as Capability;
  if (
    typeof capability.setAdminAuth !== "function" ||
    typeof capability.function !== "function"
  )
    throw new ChatSDKError("offline:api");
  try {
    capability.setAdminAuth(deploymentKey);
    return (await capability.function(name, undefined, args)) as T;
  } catch {
    throw new ChatSDKError(
      "offline:api",
      "Private backend request failed; check deployment credentials and retry",
    );
  }
}
