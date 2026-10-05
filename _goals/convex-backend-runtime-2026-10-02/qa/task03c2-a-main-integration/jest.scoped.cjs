const path = require('node:path');
module.exports = {
 rootDir: path.resolve(__dirname, '../../../..'),
 roots: ['<rootDir>/tests/unit/runtimeMetadataAuth', '<rootDir>/tests/unit/runtimeWorkerAuth', '<rootDir>/tests/unit/runtimeWorkerClient'],
 testEnvironment: 'node',
 testMatch: ['<rootDir>/tests/unit/runtimeMetadataAuth/**/*.test.ts', '<rootDir>/tests/unit/runtimeWorkerAuth/**/*.test.ts', '<rootDir>/tests/unit/runtimeWorkerClient/**/*.test.ts'],
 extensionsToTreatAsEsm: ['.ts'],
 moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
 transform: { '^.+\\.(ts|js)$': ['ts-jest', { useESM: true, tsconfig: { allowJs: true, module: 'ESNext', moduleResolution: 'bundler' } }] },
 transformIgnorePatterns: ['node_modules/(?!(convex))']
};
