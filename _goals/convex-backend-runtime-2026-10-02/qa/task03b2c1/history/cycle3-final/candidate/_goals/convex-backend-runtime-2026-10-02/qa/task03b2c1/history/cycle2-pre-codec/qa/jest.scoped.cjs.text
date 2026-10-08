const path = require("node:path");
const rootDir = path.resolve(__dirname, "../../../..");
module.exports = {
  rootDir, testEnvironment: "node", roots: ["<rootDir>/tests/unit/runtimeArtifactAuth"],
  testMatch: ["**/*.test.ts"], extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: { "^.+\\.(ts|js)$": ["ts-jest", { useESM: true,
    tsconfig: { allowJs: true, module: "ESNext", moduleResolution: "bundler", target: "ES2021", lib: ["ES2021", "DOM"], strict: true } }] },
};
