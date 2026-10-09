import { ConvexHttpClient } from "convex/browser";
import { ciResetTarget } from "./ci-cleanup";

type State = {
  state?: string; ready?: boolean;
  unresolved?: { count?: number } | null;
  writerManifestHash?: string | null; expectedWriterManifestHash?: string;
  backfill?: { complete?: boolean; rows?: number } | null;
  validation?: { complete?: boolean; rows?: number } | null;
};
type Dispatch = (name: string) => Promise<State>;

/** Initialize only the freshly reset, empty, qualified CI deployment through the
 * canonical internal protocol. Never backfill arbitrary inherited test data. */
export async function prepareCiReferences(env: NodeJS.ProcessEnv, dispatch?: Dispatch): Promise<{ calls: number }> {
  const target = ciResetTarget(env); // Refuse before authentication/network effects.
  let calls = 0;
  const client = dispatch ? undefined : new ConvexHttpClient(target.url, { logger: false });
  if (client) (client as unknown as { setAdminAuth(key: string): void }).setAdminAuth(target.key);
  const native = client as unknown as { function(name: string, component: undefined, args: Record<string, never>): Promise<State> };
  const call = async (name: string): Promise<State> => {
    calls++;
    return dispatch ? dispatch(name) : native.function(`referenceMaintenance:${name}`, undefined, {});
  };
  const empty = (state: State) => {
    if ((state.backfill?.rows ?? 0) !== 0 || (state.validation?.rows ?? 0) !== 0)
      throw new Error("Native CI reference preparation observed application rows after reset; preparation is incomplete.");
  };
  try {
    if ((await call("status")).state !== "missing")
      throw new Error("Native CI reference preparation requires a freshly reset deployment; preparation is incomplete.");
    let state = await call("startGeneration");
    for (let step = 0; !state.backfill?.complete && step < 128; step++) { empty(state); state = await call("advanceBackfill"); }
    empty(state);
    if (!state.backfill?.complete) throw new Error("Native CI reference backfill exceeded its finite bound; preparation is incomplete.");
    state = await call("beginFinalization");
    for (let step = 0; !state.validation?.complete && step < 128; step++) { empty(state); state = await call("advanceValidation"); }
    empty(state);
    if (!state.validation?.complete) throw new Error("Native CI reference validation exceeded its finite bound; preparation is incomplete.");
    state = await call("activateGeneration");
    empty(state);
    if (state.state !== "ready" || state.ready !== true || state.unresolved?.count !== 0
      || !state.writerManifestHash || state.writerManifestHash !== state.expectedWriterManifestHash)
      throw new Error("Native CI reference activation was not confirmed; preparation is incomplete.");
    return { calls };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Native CI reference")) throw error;
    throw new Error("Native authenticated CI reference preparation failed; deployment is not declared ready.");
  }
}
