import aiPackage from "ai/package.json";

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

  // Detect Cortex SDK version
  try {
    const cortexModule = await import("@cortexmemory/sdk");
    // Check for version export or use package version
    if ("VERSION" in cortexModule) {
      cortexSdk = cortexModule.VERSION as string;
    } else {
      // Fallback: try to detect from package
      cortexSdk = "0.38.0";
    }
  } catch {
    cortexSdk = "0.38.0";
  }

  // Feature exports survive major upgrades; use the installed package version.
  const aiSdkVersion = aiPackage.version;
  const aiSdkMajor = Number.parseInt(aiSdkVersion.split(".")[0], 10);
  const aiSdk = `v${aiSdkVersion}`;

  return {
    cortexSdk,
    aiSdk,
    aiSdkMajor,
  };
}
