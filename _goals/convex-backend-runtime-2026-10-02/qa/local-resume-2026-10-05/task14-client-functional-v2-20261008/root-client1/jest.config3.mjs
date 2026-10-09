import base from '../../../../../../jest.config.mjs';
export default { ...base, rootDir:process.cwd(), setupFiles:[], setupFilesAfterEnv:[], reporters:['default'],
  roots:['<rootDir>/tests','<rootDir>/packages/vercel-ai-provider/tests'],
  moduleNameMapper:{...base.moduleNameMapper,'^@cortexmemory/sdk/runtime$':'<rootDir>/src/client-runtime/index.ts'},
  transform:{'^.+\\.(ts|tsx|js)$':['ts-jest',{useESM:true,tsconfig:{allowJs:true,module:'ESNext',moduleResolution:'bundler',paths:{'@cortexmemory/sdk/runtime':['./src/client-runtime/index.ts']}}}]},
  testMatch:['<rootDir>/tests/unit/client-runtime/*.test.ts','<rootDir>/tests/unit/runtimeIngestion/client-extensions.test.ts','<rootDir>/tests/unit/runtimeIngestion/context.test.ts','<rootDir>/packages/vercel-ai-provider/tests/unit/remote.test.ts'],maxWorkers:1,forceExit:false };
