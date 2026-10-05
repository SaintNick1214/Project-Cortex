export default {
 rootDir: '../../../..', roots: ['<rootDir>/src','<rootDir>/tests/unit/domain'], preset: 'ts-jest/presets/default-esm', testEnvironment: 'node',
 testMatch: ['<rootDir>/tests/unit/domain/model-policy.test.ts'], setupFiles: [], setupFilesAfterEnv: [],
 extensionsToTreatAsEsm: ['.ts'], moduleNameMapper: {'^(\\.{1,2}/.*)\\.js$': '$1'},
 transform: {'^.+\\.ts$':['ts-jest',{useESM:true,tsconfig:'_goals/convex-backend-runtime-2026-10-02/qa/task04-pure-policy-contracts-c3/tsconfig.scoped.json'}]},
};
