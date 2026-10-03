const path = require('node:path');
module.exports = {
  rootDir: path.resolve(__dirname, '../../../..'),
  roots: ['<rootDir>/tests/unit/runtimeWorkerClient'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/runtimeWorkerClient/governance.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.(ts|js)$': ['ts-jest', { useESM: true, tsconfig: { allowJs: true, module: 'ESNext', moduleResolution: 'bundler' } }] },
  transformIgnorePatterns: ['node_modules/(?!(convex))'],
};
