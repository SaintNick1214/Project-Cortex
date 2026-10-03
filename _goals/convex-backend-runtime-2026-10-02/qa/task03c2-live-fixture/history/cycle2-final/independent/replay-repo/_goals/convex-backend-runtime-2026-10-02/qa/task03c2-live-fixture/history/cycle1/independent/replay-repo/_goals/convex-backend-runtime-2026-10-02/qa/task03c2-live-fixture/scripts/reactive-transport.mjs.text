import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";

/** Real Node ws transport, restricted to the exact approved Convex origin. */
export function configureReactiveTransport(deploymentUrl) {
  const target = new URL(deploymentUrl);
  const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  class QualificationWebSocket extends WebSocket {
    constructor(url, protocols) {
      const parsed = new URL(url);
      if (parsed.protocol !== "wss:" || parsed.host !== target.host || !parsed.pathname.startsWith("/api/")) {
        throw new Error("Reactive origin rejected before connection.");
      }
      super(url, protocols, proxyUrl ? { agent: new HttpsProxyAgent(proxyUrl) } : {});
    }
  }
  // Cortex uses the official ConvexClient without a constructor-option seam.
  // This is confined to the Node-only qualification child, with real ws traffic;
  // no fetch/provider interception or browser SDK source change is involved.
  globalThis.WebSocket = QualificationWebSocket;
  return QualificationWebSocket;
}
