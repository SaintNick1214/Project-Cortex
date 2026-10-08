import base from "../../../../../../jest.config.mjs";
export default { ...base, rootDir: process.cwd(), setupFiles: [], setupFilesAfterEnv: [],
  forceExit: false, maxWorkers: 1, testTimeout: 15000, reporters: ["default"],
  testMatch: ["**/tests/unit/client-runtime/*.test.ts"], collectCoverage: false };
