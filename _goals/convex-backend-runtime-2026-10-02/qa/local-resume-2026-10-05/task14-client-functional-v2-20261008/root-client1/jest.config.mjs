import base from '../../../../../../jest.config.mjs';
export default { ...base, rootDir:process.cwd(), setupFiles:[], setupFilesAfterEnv:[], reporters:['default'],
  testMatch:['<rootDir>/tests/unit/client-runtime/extensions.test.ts','<rootDir>/tests/unit/client-runtime/client.test.ts','<rootDir>/tests/unit/runtimeIngestion/client-extensions.test.ts','<rootDir>/tests/unit/runtimeIngestion/context.test.ts'], maxWorkers:1, forceExit:false };
