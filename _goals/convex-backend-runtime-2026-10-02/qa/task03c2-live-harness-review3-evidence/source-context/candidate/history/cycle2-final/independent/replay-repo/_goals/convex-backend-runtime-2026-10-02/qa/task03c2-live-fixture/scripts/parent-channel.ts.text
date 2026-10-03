/** JWT-only child protocol. No filesystem, secret, signing, operator or guard import. */
export interface Bootstrap { type: "bootstrap"; version: 1; phase: "live" | "offline-probe"; runId: string; endpoint: string; timeoutMs: number; quietMs: number }
export type Variant = "valid" | "wrong-issuer" | "wrong-audience" | "expired" | "forged";
export class ParentChannel {
  private nextId = 0;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  readonly bootstrap: Promise<Bootstrap>;
  constructor() {
    this.bootstrap = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("BOUNDED_TIMEOUT")), 12_000);
      const first = (message: unknown) => {
        if (!message || typeof message !== "object" || !("type" in message) || message.type !== "bootstrap") return;
        process.off("message", first); clearTimeout(timer);
        const value = message as Record<string, unknown>;
        if (Object.keys(value).sort().join(",") !== "endpoint,phase,quietMs,runId,timeoutMs,type,version" || value.version !== 1
          || !["live", "offline-probe"].includes(String(value.phase)) || typeof value.runId !== "string" || !/^[a-f0-9-]{36}$/.test(value.runId)
          || typeof value.endpoint !== "string" || !/^https:\/\/[a-z0-9-]+\.convex\.cloud$/.test(value.endpoint)
          || value.timeoutMs !== 12_000 || value.quietMs !== 750) { reject(new Error("PROTOCOL_REJECTED")); return; }
        resolve(value as unknown as Bootstrap); // Runtime shape checked field-by-field above.
      };
      process.on("message", first);
    });
    process.on("message", (message: unknown) => {
      if (!message || typeof message !== "object" || !("type" in message) || message.type !== "rpc-result" || !("id" in message) || typeof message.id !== "number") return;
      const pending = this.pending.get(message.id); if (!pending) return;
      this.pending.delete(message.id); clearTimeout(pending.timer);
      if ("ok" in message && message.ok === true && "value" in message) pending.resolve(message.value);
      else pending.reject(new Error("code" in message && message.code === "OPERATOR_AUTHORIZATION_DENIED" ? "OPERATOR_AUTHORIZATION_DENIED" : "OPERATOR_UNAVAILABLE"));
    });
    process.once("disconnect", () => { for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error("OPERATOR_UNAVAILABLE")); } this.pending.clear(); });
    this.send({ type: "ready" });
  }
  send(message: object): void {
    if (!process.connected || !process.send) throw new Error("PROTOCOL_REJECTED");
    process.send(message, () => {});
  }
  async rpc(action: "operator" | "sign", args: object): Promise<unknown> {
    const id = ++this.nextId;
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("OPERATOR_UNAVAILABLE")); }, action === "operator" ? 30_000 : 5_000);
      this.pending.set(id, { resolve, reject, timer }); this.send({ type: "rpc", id, action, args });
    });
  }
  async sign(subject: string, variant: Variant = "valid"): Promise<string> {
    const value = await this.rpc("sign", { subject, variant });
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) throw new Error("PROTOCOL_REJECTED");
    return value;
  }
}
