/**
 * Custom Jest Reporter for Test Timing Diagnostics
 * Tracks and displays the top 20 longest running tests
 */

class TestTimingReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    this.testTimings = [];
  }

  // eslint-disable-next-line no-unused-vars
  onTestResult(test, testResult, aggregatedResult) {
    // Collect timing for each test
    testResult.testResults.forEach((result) => {
      if (result.duration) {
        this.testTimings.push({
          name: result.fullName || result.title,
          file: testResult.testFilePath.replace(process.cwd(), ""),
          duration: result.duration,
          status: result.status,
        });
      }
    });
  }

  onRunComplete(contexts, results) {
    // Sort by duration (longest first)
    const sortedTimings = this.testTimings
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20);

    if (sortedTimings.length === 0) {
      return;
    }

    // Calculate total time for these tests
    const totalTopTime = sortedTimings.reduce(
      (sum, test) => sum + test.duration,
      0,
    );
    const overallTime = results.startTime
      ? (Date.now() - results.startTime) / 1000
      : 0;

    console.log("\n");
    console.log("=".repeat(80));
    console.log("📊 TEST TIMING DIAGNOSTICS - TOP 20 LONGEST RUNNING TESTS");
    console.log("=".repeat(80));
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
      `Total time for top 20 tests: ${(totalTopTime / 1000).toFixed(2)}s ` +
        `(${((totalTopTime / 1000 / overallTime) * 100).toFixed(1)}% of total runtime)`,
    );
    console.log(`Total test suite runtime: ${overallTime.toFixed(2)}s`);
    console.log(`Number of tests tracked: ${this.testTimings.length}`);
    console.log("=".repeat(80));
    console.log("");
  }
}

module.exports = TestTimingReporter;
