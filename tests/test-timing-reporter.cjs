/**
 * Custom Jest Reporter for Test Timing Diagnostics
 * Tracks and displays test performance with categorization by duration
 */

class TestTimingReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    this.testTimings = [];
    this.suiteTimings = new Map(); // file -> { duration, status, testCount }
  }

  // eslint-disable-next-line no-unused-vars
  onTestResult(test, testResult, aggregatedResult) {
    const file = testResult.testFilePath.replace(process.cwd(), "");

    // Track suite-level timing
    const suiteDuration = testResult.perfStats
      ? testResult.perfStats.end - testResult.perfStats.start
      : 0;
    const hasFailed = testResult.numFailingTests > 0;

    this.suiteTimings.set(file, {
      duration: suiteDuration,
      status: hasFailed ? "failed" : "passed",
      testCount: testResult.numPassingTests + testResult.numFailingTests,
      passed: testResult.numPassingTests,
      failed: testResult.numFailingTests,
    });

    // Collect timing for each test
    testResult.testResults.forEach((result) => {
      if (result.duration) {
        this.testTimings.push({
          name: result.fullName || result.title,
          file,
          duration: result.duration,
          status: result.status,
        });
      }
    });
  }

  onRunComplete(contexts, results) {
    const overallTime = results.startTime
      ? (Date.now() - results.startTime) / 1000
      : 0;

    // ════════════════════════════════════════════════════════════════════════
    // SUITE TIMING BY CATEGORY
    // ════════════════════════════════════════════════════════════════════════

    const suites = Array.from(this.suiteTimings.entries())
      .map(([file, data]) => ({ file, ...data }))
      .sort((a, b) => b.duration - a.duration);

    const longSuites = suites.filter((s) => s.duration >= 120000); // >2 min
    const mediumSuites = suites.filter(
      (s) => s.duration >= 30000 && s.duration < 120000,
    ); // 30s-2min
    const shortSuites = suites.filter((s) => s.duration < 30000); // <30s

    console.log("\n");
    console.log("═".repeat(80));
    console.log("📊 TEST SUITE PERFORMANCE REPORT");
    console.log("═".repeat(80));

    // Long suites
    if (longSuites.length > 0) {
      console.log("\n🔴 LONG SUITES (>2 minutes) - Optimization candidates:");
      console.log("-".repeat(80));
      longSuites.forEach((suite) => {
        const icon = suite.status === "passed" ? "✅" : "❌";
        const durationSec = (suite.duration / 1000).toFixed(1);
        console.log(
          `  ${icon} ${durationSec.padStart(7)}s | ${suite.passed}/${suite.testCount} passed | ${suite.file}`,
        );
      });
    }

    // Medium suites
    if (mediumSuites.length > 0) {
      console.log("\n🟡 MEDIUM SUITES (30s - 2 min):");
      console.log("-".repeat(80));
      mediumSuites.forEach((suite) => {
        const icon = suite.status === "passed" ? "✅" : "❌";
        const durationSec = (suite.duration / 1000).toFixed(1);
        console.log(
          `  ${icon} ${durationSec.padStart(7)}s | ${suite.passed}/${suite.testCount} passed | ${suite.file}`,
        );
      });
    }

    // Short suites
    if (shortSuites.length > 0) {
      console.log("\n🟢 SHORT SUITES (<30s) - Fast!");
      console.log("-".repeat(80));
      shortSuites.forEach((suite) => {
        const icon = suite.status === "passed" ? "✅" : "❌";
        const durationSec = (suite.duration / 1000).toFixed(1);
        console.log(
          `  ${icon} ${durationSec.padStart(7)}s | ${suite.passed}/${suite.testCount} passed | ${suite.file}`,
        );
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // TOP 20 SLOWEST INDIVIDUAL TESTS
    // ════════════════════════════════════════════════════════════════════════

    const sortedTimings = this.testTimings
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20);

    if (sortedTimings.length > 0) {
      const totalTopTime = sortedTimings.reduce(
        (sum, test) => sum + test.duration,
        0,
      );

      console.log("\n");
      console.log("═".repeat(80));
      console.log("⏱️  TOP 20 SLOWEST INDIVIDUAL TESTS");
      console.log("═".repeat(80));
      console.log("");

      sortedTimings.forEach((test, index) => {
        const durationSec = (test.duration / 1000).toFixed(2);
        const percentage =
          overallTime > 0
            ? ((test.duration / 1000 / overallTime) * 100).toFixed(1)
            : "0.0";

        const statusIcon = test.status === "passed" ? "✓" : "✗";
        const statusColor = test.status === "passed" ? "\x1b[32m" : "\x1b[31m";
        const resetColor = "\x1b[0m";

        console.log(
          `${String(index + 1).padStart(2)}. ${statusColor}${statusIcon}${resetColor} ` +
            `${durationSec.padStart(7)}s (${percentage.padStart(4)}%) - ` +
            `${test.name}`,
        );
        console.log(`    ${test.file}`);
        if (index < sortedTimings.length - 1) {
          console.log("");
        }
      });

      console.log("");
      console.log("-".repeat(80));
      console.log(
        `Top 20 tests: ${(totalTopTime / 1000).toFixed(2)}s ` +
          `(${((totalTopTime / 1000 / overallTime) * 100).toFixed(1)}% of runtime)`,
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ════════════════════════════════════════════════════════════════════════

    console.log("\n");
    console.log("═".repeat(80));
    console.log("📈 SUMMARY");
    console.log("═".repeat(80));
    console.log(`  Total runtime:      ${overallTime.toFixed(2)}s`);
    console.log(`  Test suites:        ${suites.length}`);
    console.log(`  Individual tests:   ${this.testTimings.length}`);
    console.log(`  Long suites (>2m):  ${longSuites.length}`);
    console.log(`  Medium suites:      ${mediumSuites.length}`);
    console.log(`  Short suites (<30s): ${shortSuites.length}`);

    // Calculate potential savings
    const timedOutTests = this.testTimings.filter(
      (t) => t.duration >= 59000 && t.status !== "passed",
    );
    if (timedOutTests.length > 0) {
      console.log(`\n  ⚠️  ${timedOutTests.length} tests hit timeout (60s)`);
      console.log(
        `     Fixing these could save ~${(timedOutTests.length * 60).toFixed(0)}s`,
      );
    }

    console.log("═".repeat(80));
    console.log("");
  }
}

module.exports = TestTimingReporter;
