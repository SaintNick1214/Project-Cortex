const path = require('node:path');
module.exports = {
  rootDir: path.resolve(__dirname, '../../../..'),
  roots: ['<rootDir>/tests/unit/runtimeWorkerAuth'],
  testEnvironment: 'node', testMatch: ['<rootDir>/tests/unit/runtimeWorkerAuth/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.(ts|js)$': ['ts-jest', { useESM: true, tsconfig: { allowJs: true, module: 'ESNext', moduleResolution: 'bundler' } }] },
  transformIgnorePatterns: ['node_modules/(?!(convex))'],
};
