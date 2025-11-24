/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/streaming"],
  testMatch: ["**/*.test.ts", "!**/*.integration.test.ts"], // Exclude integration tests
  // Skip setup files for unit tests - they don't need Convex
  collectCoverageFrom: ["src/memory/streaming/**/*.ts", "!src/**/*.d.ts"],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testTimeout: 10000, // 10 seconds for unit tests
  forceExit: true,
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          moduleResolution: "node",
        },
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!convex)"],
};
