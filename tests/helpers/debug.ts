/**
 * Test Debug Utilities
 * 
 * Enable debug mode for step-by-step test execution
 */

/**
 * Debug configuration
 */
export interface DebugConfig {
  enabled: boolean;
  pauseAfterEachTest: boolean;
  verboseLogging: boolean;
  inspectStorage: boolean;
}

// Default debug config (override via environment variables)
export const DEBUG_CONFIG: DebugConfig = {
  enabled: process.env.TEST_DEBUG === "true",
  pauseAfterEachTest: process.env.TEST_PAUSE === "true",
  verboseLogging: process.env.TEST_VERBOSE === "true",
  inspectStorage: process.env.TEST_INSPECT === "true",
};

/**
 * Pause execution and wait for user input
 */
export async function pause(message?: string): Promise<void> {
  if (!DEBUG_CONFIG.pauseAfterEachTest) return;

  console.log("\n" + "⏸️ ".repeat(40));
  console.log(message || "⏸️  Test paused. Press ENTER to continue...");
  console.log("⏸️ ".repeat(40) + "\n");

  // In a real terminal, you'd use readline here
  // For Jest, we'll use a simple timeout instead
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * Log verbose debug information
 */
export function debugLog(category: string, message: string, data?: any): void {
  if (!DEBUG_CONFIG.verboseLogging) return;

  console.log(`\n🔍 [${category}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Log test step
 */
export function logStep(stepNumber: number, description: string): void {
  if (!DEBUG_CONFIG.enabled) return;

  console.log("\n" + "=".repeat(80));
  console.log(`📝 STEP ${stepNumber}: ${description}`);
  console.log("=".repeat(80));
}

/**
 * Log test result
 */
export function logResult(
  testName: string,
  passed: boolean,
  details?: string
): void {
  if (!DEBUG_CONFIG.enabled) return;

  const icon = passed ? "✅" : "❌";
  console.log(`\n${icon} ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

/**
 * Log section separator
 */
export function logSection(title: string): void {
  if (!DEBUG_CONFIG.enabled) return;

  console.log("\n" + "━".repeat(80));
  console.log(`  ${title}`);
  console.log("━".repeat(80) + "\n");
}

/**
 * Enable debug mode programmatically
 */
export function enableDebugMode(config?: Partial<DebugConfig>): void {
  Object.assign(DEBUG_CONFIG, {
    enabled: true,
    ...config,
  });

  console.log("\n" + "🐛".repeat(40));
  console.log("🐛 DEBUG MODE ENABLED");
  console.log("🐛".repeat(40));
  console.log("Configuration:");
  console.log(`  - Pause after each test: ${DEBUG_CONFIG.pauseAfterEachTest}`);
  console.log(`  - Verbose logging: ${DEBUG_CONFIG.verboseLogging}`);
  console.log(`  - Inspect storage: ${DEBUG_CONFIG.inspectStorage}`);
  console.log("🐛".repeat(40) + "\n");
}

/**
 * Disable debug mode
 */
export function disableDebugMode(): void {
  DEBUG_CONFIG.enabled = false;
  DEBUG_CONFIG.pauseAfterEachTest = false;
  DEBUG_CONFIG.verboseLogging = false;
  DEBUG_CONFIG.inspectStorage = false;
}

