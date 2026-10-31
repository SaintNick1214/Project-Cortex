import base from "../../../../../../jest.config.mjs";
export default { ...base, rootDir: process.cwd(), setupFiles: [], setupFilesAfterEnv: [],
  forceExit: false, maxWorkers: 1, testTimeout: 15000, reporters: ["default"],
  testMatch: ["**/tests/unit/domain/media-input.test.ts", "**/tests/unit/domain/model-policy.test.ts", "**/tests/unit/runtime/model-policy-admission.test.ts"], collectCoverage: false };
