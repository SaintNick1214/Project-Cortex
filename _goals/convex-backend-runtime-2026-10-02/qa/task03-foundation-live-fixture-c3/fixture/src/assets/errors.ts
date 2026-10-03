/** Authenticated bounded asset upload/delivery has not been qualified yet. */
export class AssetCapabilityUnavailableError extends Error {
  readonly version = 1;
  readonly code = "CAPABILITY_UNAVAILABLE";
  readonly retryable = false;
  readonly outcome = "not_dispatched";

  constructor() {
    super("Authenticated asset upload and delivery are unavailable in this SDK deployment.");
    this.name = "AssetCapabilityUnavailableError";
  }
}
