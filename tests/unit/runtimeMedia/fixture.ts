import { assertNativeArgs } from "../runtimeAgent/native-arguments";
import { getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import { assetFixture } from "../runtimeAssets/fixture";
import { installMediaMockRoot, ledger } from "../runtimeTranscript/fixture";
import type { MediaNativeFactory } from "../../../convex-dev/runtimeMediaGateway";
export { installMediaMockRoot };
export const media = await import("../../../convex-dev/runtimeMediaJobs");
export const gateway = await import("../../../convex-dev/runtimeMediaGateway");
export const http = await import("../../../convex-dev/runtimeMediaHttp");
export const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
export const mp4 = new Uint8Array([0, 0, 0, 12, 102, 116, 121, 112, 105, 115, 111, 109]);
export async function mediaFixture() {
  const f = await assetFixture(); const oldMutation = f.ctx.runMutation.bind(f.ctx), oldQuery = f.ctx.runQuery.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    let name: string; try { name = getFunctionName(ref); } catch { return oldMutation(ref, args); }
    const registrations = name.startsWith("runtimeMediaJobs:") ? media : name.startsWith("runtimeModelPolicy:") ? ledger : undefined;
    if (registrations) { const value = registrations[name.split(":")[1] as keyof typeof registrations]; assertNativeArgs(value, args); return f.call(value, args); }
    return oldMutation(ref, args);
  }) as MutationCtx["runMutation"];
  f.ctx.runQuery = (async (ref, args) => { let name: string; try { name = getFunctionName(ref); } catch { return oldQuery(ref, args); } if (name === "runtimeModelPolicy:resolve") return f.call(ledger.resolve, args); return oldQuery(ref, args); }) as MutationCtx["runQuery"];
  let images = 0, starts = 0, downloads = 0, statuses = 0;
  let status: "pending" | "completed" | "failed" = "pending";
  const factory: MediaNativeFactory = () => ({
    image: async () => { images++; return { data: png, mimeType: "image/png" }; },
    start: async () => { starts++; return { operation: "PRIVATE_OPERATION", inferenceId: "PRIVATE_INFERENCE", webhookSecret: "PRIVATE_SECRET" }; },
    status: async () => { statuses++; return status; },
    download: async () => { downloads++; return { data: mp4, mimeType: "video/mp4" }; },
  });
  return { ...f, action: f.ctx as unknown as ActionCtx, factory, status: (value: typeof status) => { status = value; }, counts: () => ({ images, starts, downloads, statuses }),
    submit: async (kind: "image" | "video" = "image", requestId = "media-1") => f.call<import("../../../src/domain/media-jobs").RuntimeMediaJobV1>(media.submit, { kind, requestId, prompt: "A simple solid circle." }) };
}
