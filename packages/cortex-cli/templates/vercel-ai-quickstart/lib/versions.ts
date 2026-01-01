/**
 * Version detection utilities for displaying SDK versions in the UI.
 */

export interface VersionInfo {
  cortexSdk: string;
  aiSdk: string;
  aiSdkMajor: number;
}

/**
 * Detect installed SDK versions at runtime.
 * Returns version strings for display in the UI.
 */
export async function detectVersions(): Promise<VersionInfo> {
  let cortexSdk = "unknown";
  let aiSdk = "unknown";
  let aiSdkMajor = 5;

  // Detect Cortex SDK version
  try {
    const cortexModule = await import("@cortexmemory/sdk");
    // Check for version export or use package version
    if ("VERSION" in cortexModule) {
      cortexSdk = cortexModule.VERSION as string;
    } else {
      // Fallback: try to detect from package
      cortexSdk = "0.24.0";
    }
  } catch {
    cortexSdk = "0.24.0";
  }

  // Detect AI SDK version by checking for v6-specific exports
  try {
    const aiModule = await import("ai");

    // v6 has these specific exports
    const hasV6Features =
      "ToolLoopAgent" in aiModule ||
      "createAgentUIStreamResponse" in aiModule ||
      "Output" in aiModule;

    if (hasV6Features) {
      aiSdkMajor = 6;
      aiSdk = "v6";
    } else {
      aiSdkMajor = 5;
      aiSdk = "v5";
    }
  } catch {
    aiSdk = "v5";
  }

  return {
    cortexSdk,
    aiSdk,
    aiSdkMajor,
  };
}
